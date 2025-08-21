import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'

export interface LyricLine {
  startTime: number // in milliseconds
  endTime: number
  text: string
}

export interface VideoOptions {
  width: number
  height: number
  fps: number
  backgroundColor: string
  textColor: string
  fontSize: number
}

export class VideoGenerator {
  private static readonly DEFAULT_OPTIONS: VideoOptions = {
    width: 1920,
    height: 1080,
    fps: 24,
    backgroundColor: '#1a1a2e',
    textColor: '#ffffff',
    fontSize: 48
  }

  static async generateKaraokeVideo(
    audioPath: string,
    lyrics: LyricLine[],
    outputPath: string,
    options: Partial<VideoOptions> = {}
  ): Promise<string> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options }
    const tempDir = path.join(process.cwd(), 'temp', 'video')
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    // Generate subtitle file (SRT format)
    const subtitlePath = await this.generateSubtitleFile(lyrics, tempDir)
    
    // Create background video
    const backgroundPath = await this.createBackgroundVideo(audioPath, tempDir, opts)
    
    // Combine background with subtitles
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(backgroundPath)
        .input(audioPath)
        .complexFilter([
          // Add gradient background
          `color=${opts.backgroundColor}:size=${opts.width}x${opts.height}:duration=0.1[bg]`,
          
          // Add animated gradient
          `[bg]geq=r='255*sin(2*PI*t/10)':g='255*sin(2*PI*(t+1)/10)':b='255*sin(2*PI*(t+2)/10)'[gradient]`,
          
          // Overlay subtitles
          `[gradient]subtitles=${subtitlePath}:force_style='FontName=Arial,FontSize=${opts.fontSize},PrimaryColour=&H${this.colorToHex(opts.textColor)},Alignment=2,MarginV=150'[video]`
        ])
        .outputOptions([
          '-map', '[video]',
          '-map', '1:a',
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-r', opts.fps.toString(),
          '-t', '300' // Max 5 minutes
        ])
        .output(outputPath)
        .on('end', () => {
          this.cleanup([subtitlePath, backgroundPath])
          resolve(outputPath)
        })
        .on('error', (err) => {
          this.cleanup([subtitlePath, backgroundPath])
          reject(err)
        })
        .run()
    })
  }

  private static async generateSubtitleFile(lyrics: LyricLine[], tempDir: string): Promise<string> {
    const subtitlePath = path.join(tempDir, `lyrics_${Date.now()}.srt`)
    
    const srtContent = lyrics.map((line, index) => {
      const start = this.formatTime(line.startTime)
      const end = this.formatTime(line.endTime)
      
      return `${index + 1}\n${start} --> ${end}\n${line.text}\n`
    }).join('\n')
    
    fs.writeFileSync(subtitlePath, srtContent, 'utf8')
    return subtitlePath
  }

  private static async createBackgroundVideo(audioPath: string, tempDir: string, options: VideoOptions): Promise<string> {
    const backgroundPath = path.join(tempDir, `background_${Date.now()}.mp4`)
    
    return new Promise((resolve, reject) => {
      // Get audio duration first
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) return reject(err)
        
        const duration = metadata.format.duration || 300
        
        // Create animated background
        ffmpeg()
          .input(`color=${options.backgroundColor}:size=${options.width}x${options.height}:duration=${duration}`)
          .inputFormat('lavfi')
          .complexFilter([
            // Create moving gradient effect
            `geq=r='128+127*sin(2*PI*X/${options.width}+t)':g='128+127*sin(2*PI*Y/${options.height}+t*1.2)':b='128+127*sin(2*PI*(X+Y)/${options.width+options.height}+t*0.8)'[gradient]`,
            
            // Add particle effect
            `[gradient]drawtext=text='♪':fontsize=30:fontcolor=white@0.3:x='if(gte(t,0),10+t*30,NAN)':y='50+50*sin(t*0.5)':enable='between(t,0,20)'[particles]`
          ])
          .outputOptions([
            '-c:v', 'libx264',
            '-r', options.fps.toString(),
            '-pix_fmt', 'yuv420p'
          ])
          .output(backgroundPath)
          .on('end', () => resolve(backgroundPath))
          .on('error', reject)
          .run()
      })
    })
  }

  static async createLyricVideo(lyrics: LyricLine[], duration: number, outputPath: string): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp', 'lyrics')
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    return new Promise((resolve, reject) => {
      let filterComplex = `color=black:size=1920x1080:duration=${duration/1000}[base];`
      let overlays = '[base]'

      lyrics.forEach((line, index) => {
        const startSec = line.startTime / 1000
        const endSec = line.endTime / 1000
        
        filterComplex += `${overlays}drawtext=text='${line.text.replace(/'/g, "\\'")}':fontfile=/System/Library/Fonts/Arial.ttf:fontsize=48:fontcolor=white:x=(w-text_w)/2:y=h/2:enable='between(t,${startSec},${endSec})'[text${index}];`
        overlays = `[text${index}]`
      })

      // Remove the last semicolon
      filterComplex = filterComplex.slice(0, -1)

      ffmpeg()
        .input('color=black:size=1920x1080:duration=' + (duration/1000))
        .inputFormat('lavfi')
        .complexFilter(filterComplex)
        .outputOptions([
          '-c:v', 'libx264',
          '-r', '24',
          '-pix_fmt', 'yuv420p'
        ])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run()
    })
  }

  private static formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const milliseconds = ms % 1000

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`
  }

  private static colorToHex(color: string): string {
    // Convert CSS color to BGR hex for FFmpeg
    if (color.startsWith('#')) {
      const hex = color.slice(1)
      const r = hex.slice(0, 2)
      const g = hex.slice(2, 4)
      const b = hex.slice(4, 6)
      return `${b}${g}${r}` // BGR format
    }
    return 'ffffff' // Default white
  }

  private static cleanup(files: string[]) {
    files.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file)
      }
    })
  }
}