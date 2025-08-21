import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import ffmpeg from 'fluent-ffmpeg'

export interface ProcessingOptions {
  quality: 'fast' | 'balanced' | 'high'
  outputFormat: 'wav' | 'mp3'
}

export class AudioProcessor {
  private static readonly TEMP_DIR = path.join(process.cwd(), 'temp')
  private static readonly OUTPUT_DIR = path.join(process.cwd(), 'output')

  static {
    // Ensure directories exist
    [this.TEMP_DIR, this.OUTPUT_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    })
  }

  static async separateVocals(
    inputPath: string, 
    options: ProcessingOptions,
    onProgress?: (progress: number) => void
  ): Promise<{ instrumental: string; vocals: string }> {
    const outputDir = path.join(this.OUTPUT_DIR, path.parse(inputPath).name)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const instrumentalPath = path.join(outputDir, `instrumental.${options.outputFormat}`)
    const vocalsPath = path.join(outputDir, `vocals.${options.outputFormat}`)

    try {
      switch (options.quality) {
        case 'high':
          return await this.processWithDemucs(inputPath, outputDir, options, onProgress)
        case 'balanced':
          return await this.processWithSpleeter(inputPath, outputDir, options, onProgress)
        case 'fast':
          return await this.processWithFFmpeg(inputPath, instrumentalPath, vocalsPath, onProgress)
        default:
          throw new Error('Invalid quality option')
      }
    } catch (error) {
      console.error('Vocal separation failed:', error)
      throw error
    }
  }

  private static async processWithDemucs(
    inputPath: string, 
    outputDir: string, 
    options: ProcessingOptions,
    onProgress?: (progress: number) => void
  ): Promise<{ instrumental: string; vocals: string }> {
    return new Promise((resolve, reject) => {
      // Demucs command: python -m demucs.separate --two-stems=vocals input.wav
      const process = spawn('python', [
        '-m', 'demucs.separate',
        '--two-stems=vocals',
        '--out', outputDir,
        inputPath
      ])

      let progress = 0
      process.stderr.on('data', (data) => {
        const output = data.toString()
        
        // Parse progress from Demucs output
        const progressMatch = output.match(/(\d+)%/)
        if (progressMatch) {
          progress = parseInt(progressMatch[1])
          onProgress?.(progress)
        }
      })

      process.on('close', (code) => {
        if (code === 0) {
          const songName = path.parse(inputPath).name
          const resultDir = path.join(outputDir, 'htdemucs', songName)
          
          resolve({
            instrumental: path.join(resultDir, 'no_vocals.wav'),
            vocals: path.join(resultDir, 'vocals.wav')
          })
        } else {
          reject(new Error(`Demucs failed with exit code ${code}`))
        }
      })
    })
  }

  private static async processWithSpleeter(
    inputPath: string,
    outputDir: string,
    options: ProcessingOptions,
    onProgress?: (progress: number) => void
  ): Promise<{ instrumental: string; vocals: string }> {
    return new Promise((resolve, reject) => {
      // Spleeter command: spleeter separate -p spleeter:2stems-16kHz input.wav -o output_dir
      const process = spawn('spleeter', [
        'separate',
        '-p', 'spleeter:2stems-16kHz',
        '-o', outputDir,
        inputPath
      ])

      let progress = 0
      const interval = setInterval(() => {
        progress += 10
        if (progress > 95) progress = 95
        onProgress?.(progress)
      }, 500)

      process.on('close', (code) => {
        clearInterval(interval)
        
        if (code === 0) {
          const songName = path.parse(inputPath).name
          const resultDir = path.join(outputDir, songName)
          
          resolve({
            instrumental: path.join(resultDir, 'accompaniment.wav'),
            vocals: path.join(resultDir, 'vocals.wav')
          })
          onProgress?.(100)
        } else {
          reject(new Error(`Spleeter failed with exit code ${code}`))
        }
      })
    })
  }

  private static async processWithFFmpeg(
    inputPath: string,
    instrumentalPath: string,
    vocalsPath: string,
    onProgress?: (progress: number) => void
  ): Promise<{ instrumental: string; vocals: string }> {
    return new Promise((resolve, reject) => {
      // Simple vocal removal using FFmpeg (center channel extraction)
      ffmpeg(inputPath)
        .audioFilter('pan=mono|c0=0.5*c0+-0.5*c1') // Remove center channel
        .output(instrumentalPath)
        .on('progress', (info) => {
          if (info.percent) {
            onProgress?.(Math.round(info.percent))
          }
        })
        .on('end', () => {
          // Create a "vocals" file (just the original for fast mode)
          fs.copyFileSync(inputPath, vocalsPath)
          resolve({ instrumental: instrumentalPath, vocals: vocalsPath })
        })
        .on('error', reject)
        .run()
    })
  }

  static async convertToFormat(inputPath: string, outputFormat: string): Promise<string> {
    const outputPath = inputPath.replace(path.extname(inputPath), `.${outputFormat}`)
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat(outputFormat)
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run()
    })
  }

  static cleanup(filePaths: string[]) {
    filePaths.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    })
  }
}