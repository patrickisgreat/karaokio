import { KaraokeDB } from './database'
import { AudioProcessor, ProcessingOptions } from './audioProcessor'
import { VideoGenerator, LyricLine } from './videoGenerator'
import { LyricsProcessor } from './lyricsProcessor'
import { MusicSearch } from './musicSearch'
import path from 'path'
import fs from 'fs'

export interface ProcessingJob {
  songId: string
  options: ProcessingOptions
}

const processingJobs = new Map<string, ProcessingJob>()

export async function processAudio(songId: string, options: ProcessingOptions) {
  const job: ProcessingJob = { songId, options }
  processingJobs.set(songId, job)

  try {
    console.log(`Starting processing for song ${songId}`)
    
    // Update status
    KaraokeDB.updateSongStatus(songId, 'processing', 0)

    // Get song details
    const song = KaraokeDB.getSong(songId)
    if (!song) {
      throw new Error('Song not found')
    }

    // Step 1: Search for and download audio (placeholder - would need actual implementation)
    KaraokeDB.updateSongStatus(songId, 'processing', 10)
    const audioPath = await acquireAudioFile(song.songTitle, song.artist)
    
    if (!audioPath) {
      throw new Error('Could not find audio file')
    }

    // Update database with original audio path
    KaraokeDB.updateSongPaths(songId, { original_audio_path: audioPath })

    // Step 2: Separate vocals
    KaraokeDB.updateSongStatus(songId, 'processing', 30)
    console.log('Starting vocal separation...')
    
    const { instrumental } = await AudioProcessor.separateVocals(
      audioPath,
      options,
      (progress) => {
        const overallProgress = 30 + Math.round(progress * 0.4) // 30-70%
        KaraokeDB.updateSongStatus(songId, 'processing', overallProgress)
      }
    )

    // Update database with processed audio path
    KaraokeDB.updateSongPaths(songId, { instrumental_path: instrumental })

    // Step 3: Fetch and process lyrics
    KaraokeDB.updateSongStatus(songId, 'processing', 75)
    console.log('Fetching lyrics...')
    
    const lyrics = await LyricsProcessor.fetchLyrics(song.songTitle, song.artist)
    if (lyrics) {
      const syncedLyrics = await LyricsProcessor.smartSynchronize(lyrics, instrumental)
      
      // Save lyrics as LRC file
      const lrcContent = LyricsProcessor.convertToLRC(syncedLyrics)
      const lyricsPath = path.join(path.dirname(instrumental), 'lyrics.lrc')
      fs.writeFileSync(lyricsPath, lrcContent, 'utf8')
      
      KaraokeDB.updateSongPaths(songId, { lyrics_path: lyricsPath })

      // Step 4: Generate karaoke video (optional)
      if (options.outputFormat !== 'audio-only') {
        KaraokeDB.updateSongStatus(songId, 'processing', 85)
        console.log('Generating karaoke video...')
        
        const videoPath = path.join(path.dirname(instrumental), 'karaoke.mp4')
        await VideoGenerator.generateKaraokeVideo(
          instrumental,
          syncedLyrics,
          videoPath
        )
        
        KaraokeDB.updateSongPaths(songId, { video_path: videoPath })
      }
    }

    // Step 5: Complete processing
    KaraokeDB.updateSongStatus(songId, 'ready', 100)
    console.log(`Processing complete for song ${songId}`)

  } catch (error) {
    console.error(`Processing failed for song ${songId}:`, error)
    KaraokeDB.updateSongStatus(songId, 'failed', 0)
  } finally {
    processingJobs.delete(songId)
  }
}

async function acquireAudioFile(title: string, artist: string): Promise<string | null> {
  // This is where you'd implement:
  // 1. Search local music library
  // 2. Download from legal sources
  // 3. Use user uploads
  
  // For demo purposes, this is a placeholder
  console.log(`Looking for audio file: ${title} by ${artist}`)
  
  // Check if user has uploaded a file
  const uploadDir = path.join(process.cwd(), 'uploads')
  const possibleFiles = [
    `${title} - ${artist}.mp3`,
    `${artist} - ${title}.mp3`,
    `${title}.mp3`
  ]

  for (const filename of possibleFiles) {
    const filePath = path.join(uploadDir, filename)
    if (fs.existsSync(filePath)) {
      console.log(`Found local file: ${filePath}`)
      return filePath
    }
  }

  // In a real implementation, you might:
  // 1. Search Spotify for preview URLs
  // 2. Use YouTube-dl for legal downloads
  // 3. Integrate with music streaming APIs
  // 4. Use a local music library scan

  console.warn('No audio file found - this would need real implementation')
  return null
}

export function getProcessingStatus(songId: string) {
  const job = processingJobs.get(songId)
  const song = KaraokeDB.getSong(songId)
  
  return {
    exists: !!job,
    song,
    isProcessing: !!job
  }
}

export function cancelProcessing(songId: string) {
  processingJobs.delete(songId)
  KaraokeDB.updateSongStatus(songId, 'failed')
}