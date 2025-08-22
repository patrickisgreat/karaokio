import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'

export interface AudioSyncOptions {
  method: 'replace' | 'overlay' | 'smart_sync'
  volumeLevel: number // 0.0 to 1.0
  fadeIn: number // seconds
  fadeOut: number // seconds
  audioOffset: number // milliseconds to sync audio
}

export class VideoProcessor {
  private static readonly TEMP_DIR = path.join(process.cwd(), 'temp', 'video_processing')

  static {
    if (!fs.existsSync(this.TEMP_DIR)) {
      fs.mkdirSync(this.TEMP_DIR, { recursive: true })
    }
  }

  static async replaceAudio(
    videoPath: string,
    audioPath: string,
    outputPath: string,
    options: Partial<AudioSyncOptions> = {}
  ): Promise<string> {
    const opts: AudioSyncOptions = {
      method: 'replace',
      volumeLevel: 1.0,
      fadeIn: 0,
      fadeOut: 0,
      audioOffset: 0,
      ...options
    }

    return new Promise((resolve, reject) => {
      console.log(`Replacing audio in video: ${path.basename(videoPath)}`)
      
      let command = ffmpeg()
        .input(videoPath)
        .input(audioPath)

      // Apply audio processing based on method
      switch (opts.method) {
        case 'replace':
          command = command
            .outputOptions([
              '-c:v', 'copy', // Copy video stream without re-encoding
              '-c:a', 'aac',  // Encode audio as AAC
              '-map', '0:v:0', // Use video from first input
              '-map', '1:a:0', // Use audio from second input
              '-shortest'      // End when shortest stream ends
            ])
          break

        case 'overlay':
          command = command
            .complexFilter([
              `[1:a]volume=${opts.volumeLevel}[newaudio]`,
              `[0:a][newaudio]amix=inputs=2:duration=shortest[audio]`
            ])
            .outputOptions([
              '-c:v', 'copy',
              '-map', '0:v:0',
              '-map', '[audio]'
            ])
          break

        case 'smart_sync':
          // Attempt to sync audio based on tempo/beat detection
          command = command
            .complexFilter([
              `[1:a]volume=${opts.volumeLevel},adelay=${Math.abs(opts.audioOffset)}|${Math.abs(opts.audioOffset)}[synced]`,
              `[synced]afade=in:st=0:d=${opts.fadeIn},afade=out:st=-${opts.fadeOut}:d=${opts.fadeOut}[audio]`
            ])
            .outputOptions([
              '-c:v', 'copy',
              '-map', '0:v:0',
              '-map', '[audio]'
            ])
          break
      }

      command
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine)
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`Audio replacement progress: ${Math.round(progress.percent)}%`)
          }
        })
        .on('end', () => {
          console.log(`Audio replacement complete: ${outputPath}`)
          resolve(outputPath)
        })
        .on('error', (error) => {
          console.error('Audio replacement failed:', error)
          reject(error)
        })
        .run()
    })
  }

  static async analyzeAudioSync(videoPath: string, audioPath: string): Promise<{
    videoDuration: number
    audioDuration: number
    suggestedOffset: number
    confidence: number
  }> {
    return new Promise((resolve, reject) => {
      // Get video duration
      ffmpeg.ffprobe(videoPath, (err, videoMetadata) => {
        if (err) return reject(err)
        
        const videoDuration = videoMetadata.format.duration || 0
        
        // Get audio duration
        ffmpeg.ffprobe(audioPath, (err, audioMetadata) => {
          if (err) return reject(err)
          
          const audioDuration = audioMetadata.format.duration || 0
          const durationDiff = Math.abs(videoDuration - audioDuration)
          
          // Simple heuristic for sync offset
          let suggestedOffset = 0
          let confidence = 1.0
          
          // If durations are very different, suggest trimming
          if (durationDiff > 5) {
            confidence = 0.3
            console.warn(`Large duration difference: video=${videoDuration}s, audio=${audioDuration}s`)
          } else if (durationDiff > 1) {
            confidence = 0.7
            // Suggest small offset to account for intro/outro differences
            suggestedOffset = (videoDuration - audioDuration) * 500 // Convert to ms
          }
          
          resolve({
            videoDuration,
            audioDuration,
            suggestedOffset,
            confidence
          })
        })
      })
    })
  }

  static async createPreview(
    videoPath: string,
    startTime: number = 30,
    duration: number = 15
  ): Promise<string> {
    const previewPath = path.join(
      this.TEMP_DIR, 
      `preview_${Date.now()}.mp4`
    )

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(startTime)
        .duration(duration)
        .outputOptions([
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-crf', '28', // Compressed for preview
          '-preset', 'fast'
        ])
        .output(previewPath)
        .on('end', () => resolve(previewPath))
        .on('error', reject)
        .run()
    })
  }

  static async extractAudioFromVideo(videoPath: string): Promise<string> {
    const audioPath = path.join(
      this.TEMP_DIR,
      `extracted_${Date.now()}.wav`
    )

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .output(audioPath)
        .audioCodec('pcm_s16le') // WAV format
        .noVideo()
        .on('end', () => resolve(audioPath))
        .on('error', reject)
        .run()
    })
  }

  static async optimizeForStreaming(videoPath: string): Promise<string> {
    const optimizedPath = videoPath.replace(/\.(mp4|webm|mkv)$/i, '_optimized.mp4')

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-maxrate', '2M',
          '-bufsize', '4M',
          '-movflags', '+faststart', // Enable streaming
          '-c:a', 'aac',
          '-b:a', '128k'
        ])
        .output(optimizedPath)
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`Optimization progress: ${Math.round(progress.percent)}%`)
          }
        })
        .on('end', () => {
          console.log(`Video optimized for streaming: ${optimizedPath}`)
          resolve(optimizedPath)
        })
        .on('error', reject)
        .run()
    })
  }

  static async validateVideoAudio(filePath: string): Promise<{
    hasVideo: boolean
    hasAudio: boolean
    duration: number
    videoCodec?: string
    audioCodec?: string
    resolution?: string
  }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return reject(err)

        const videoStream = metadata.streams.find(s => s.codec_type === 'video')
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio')

        resolve({
          hasVideo: !!videoStream,
          hasAudio: !!audioStream,
          duration: metadata.format.duration || 0,
          videoCodec: videoStream?.codec_name,
          audioCodec: audioStream?.codec_name,
          resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : undefined
        })
      })
    })
  }

  static cleanup(keepFiles: string[] = []) {
    if (!fs.existsSync(this.TEMP_DIR)) return

    const tempFiles = fs.readdirSync(this.TEMP_DIR)
    
    tempFiles.forEach(file => {
      const fullPath = path.join(this.TEMP_DIR, file)
      if (!keepFiles.includes(fullPath)) {
        try {
          const stats = fs.statSync(fullPath)
          const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60)
          
          // Clean up files older than 1 hour
          if (ageHours > 1) {
            fs.unlinkSync(fullPath)
            console.log(`Cleaned up temp file: ${file}`)
          }
        } catch (error) {
          console.warn(`Failed to clean up ${file}:`, error)
        }
      }
    })
  }
}