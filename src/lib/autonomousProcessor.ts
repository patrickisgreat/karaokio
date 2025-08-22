import { KaraokeDB } from './database'
import { AudioProcessor, ProcessingOptions } from './audioProcessor'
import { VideoProcessor } from './videoProcessor'
import { LyricsProcessor } from './lyricsProcessor'
import { TorrentClient } from './torrentClient'
import { YouTubeClient } from './youtubeClient'
import { CacheManager } from './cacheManager'
import path from 'path'
import fs from 'fs'

export interface AutonomousProcessingOptions extends ProcessingOptions {
  useCache?: boolean
  maxTorrentWaitTime?: number
  maxYouTubeWaitTime?: number
}

export interface AutonomousProcessingJob {
  songId: string
  options: AutonomousProcessingOptions
}

const processingJobs = new Map<string, AutonomousProcessingJob>()

export async function processKaraokeSong(songId: string, options: AutonomousProcessingOptions = {}) {
  const job: AutonomousProcessingJob = { 
    songId, 
    options: {
      quality: 'high',
      ...options,
      useCache: options.useCache ?? true,
      maxTorrentWaitTime: options.maxTorrentWaitTime ?? 5 * 60 * 1000, // 5 minutes
      maxYouTubeWaitTime: options.maxYouTubeWaitTime ?? 2 * 60 * 1000   // 2 minutes
    }
  }
  processingJobs.set(songId, job)

  try {
    console.log(`🎵 Starting autonomous karaoke processing for song ${songId}`)
    
    // Get song details
    const song = KaraokeDB.getSong(songId)
    if (!song) {
      throw new Error('Song not found')
    }

    const { songTitle, artist } = song

    // STEP 1: Check cache first
    KaraokeDB.updateSongStatus(songId, 'processing', 5)
    console.log(`🔍 Checking cache for: ${artist} - ${songTitle}`)
    
    const cached = await CacheManager.checkCache(songTitle, artist, options.quality)
    if (cached && options.useCache) {
      console.log(`✅ Cache hit! Using existing files for ${artist} - ${songTitle}`)
      
      // Update database with cached paths
      KaraokeDB.updateSongPaths(songId, {
        original_audio_path: cached.files.original,
        instrumental_path: cached.files.instrumental,
        lyrics_path: cached.files.lyrics,
        video_path: cached.files.video
      })

      KaraokeDB.updateSongStatus(songId, 'ready', 100)
      return
    }

    // STEP 2: Acquire audio via torrents
    KaraokeDB.updateSongStatus(songId, 'processing', 10)
    console.log(`🔍 Searching torrents for: ${artist} - ${songTitle}`)
    
    const torrentResult = await TorrentClient.findBestMatch(songTitle, artist, 3)
    let audioPath: string | null = null

    if (torrentResult) {
      console.log(`📥 Downloading from torrent: ${torrentResult.title}`)
      
      try {
        audioPath = await Promise.race([
          TorrentClient.downloadAudio(
            torrentResult.magnet, 
            `${artist} - ${songTitle}`,
            (progress) => {
              const overallProgress = 10 + Math.round(progress * 0.15) // 10-25%
              KaraokeDB.updateSongStatus(songId, 'processing', overallProgress)
            }
          ),
          new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('Torrent timeout')), job.options.maxTorrentWaitTime)
          )
        ])
      } catch (error) {
        console.warn(`⚠️ Torrent download failed: ${error}`)
        audioPath = null
      }
    }

    // Fallback: Check uploads directory
    if (!audioPath) {
      console.log(`🔍 Checking uploads directory...`)
      audioPath = await checkUploadsDirectory(songTitle, artist)
    }

    if (!audioPath) {
      throw new Error(`Could not acquire audio for: ${artist} - ${songTitle}`)
    }

    console.log(`✅ Audio acquired: ${path.basename(audioPath)}`)
    KaraokeDB.updateSongPaths(songId, { original_audio_path: audioPath })

    // STEP 3: Search and download YouTube karaoke video
    KaraokeDB.updateSongStatus(songId, 'processing', 30)
    console.log(`🎥 Searching YouTube for karaoke video...`)
    
    let karaokeVideoPath: string | null = null
    let youtubeVideoId: string | null = null

    try {
      const youtubeResult = await Promise.race([
        YouTubeClient.getBestKaraokeVideo(songTitle, artist),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('YouTube timeout')), job.options.maxYouTubeWaitTime)
        )
      ])

      if (youtubeResult) {
        karaokeVideoPath = youtubeResult.filePath
        youtubeVideoId = youtubeResult.video.id
        console.log(`✅ YouTube karaoke video downloaded: ${youtubeResult.video.title}`)
      }
    } catch (error) {
      console.warn(`⚠️ YouTube download failed: ${error}`)
    }

    // STEP 4: Vocal separation
    KaraokeDB.updateSongStatus(songId, 'processing', 45)
    console.log(`🎙️ Starting vocal separation with ${options.quality} quality...`)
    
    const { instrumental } = await AudioProcessor.separateVocals(
      audioPath,
      options,
      (progress) => {
        const overallProgress = 45 + Math.round(progress * 0.25) // 45-70%
        KaraokeDB.updateSongStatus(songId, 'processing', overallProgress)
      }
    )

    KaraokeDB.updateSongPaths(songId, { instrumental_path: instrumental })
    console.log(`✅ Vocal separation complete`)

    // STEP 5: Fetch and sync lyrics
    KaraokeDB.updateSongStatus(songId, 'processing', 75)
    console.log(`📝 Fetching and synchronizing lyrics...`)
    
    const lyrics = await LyricsProcessor.fetchLyrics(songTitle, artist)
    let lyricsPath: string | null = null
    
    if (lyrics) {
      const syncedLyrics = await LyricsProcessor.smartSynchronize(lyrics, instrumental)
      const lrcContent = LyricsProcessor.convertToLRC(syncedLyrics)
      lyricsPath = path.join(path.dirname(instrumental), 'lyrics.lrc')
      fs.writeFileSync(lyricsPath, lrcContent, 'utf8')
      
      KaraokeDB.updateSongPaths(songId, { lyrics_path: lyricsPath })
      console.log(`✅ Lyrics synchronized and saved`)
    } else {
      console.warn(`⚠️ Could not fetch lyrics for: ${artist} - ${songTitle}`)
    }

    // STEP 6: Create final karaoke video
    KaraokeDB.updateSongStatus(songId, 'processing', 85)
    console.log(`🎬 Creating final karaoke video...`)
    
    let finalVideoPath: string

    if (karaokeVideoPath && fs.existsSync(karaokeVideoPath)) {
      // Replace audio in YouTube karaoke video
      console.log(`🔄 Replacing audio in karaoke video...`)
      finalVideoPath = path.join(path.dirname(instrumental), 'final_karaoke.mp4')
      
      await VideoProcessor.replaceAudio(
        karaokeVideoPath,
        instrumental,
        finalVideoPath,
        { method: 'replace', volumeLevel: 1.0 }
      )
      
      // Optimize for streaming
      const optimizedPath = await VideoProcessor.optimizeForStreaming(finalVideoPath)
      if (optimizedPath !== finalVideoPath) {
        fs.unlinkSync(finalVideoPath) // Remove unoptimized version
        finalVideoPath = optimizedPath
      }
    } else {
      // Generate karaoke video from scratch (fallback)
      console.log(`🎨 Generating karaoke video from scratch...`)
      const { VideoGenerator } = await import('./videoGenerator')
      
      finalVideoPath = path.join(path.dirname(instrumental), 'generated_karaoke.mp4')
      
      if (lyricsPath && lyrics) {
        const syncedLyrics = await LyricsProcessor.smartSynchronize(lyrics, instrumental)
        await VideoGenerator.generateKaraokeVideo(
          instrumental,
          syncedLyrics,
          finalVideoPath
        )
      } else {
        // Create simple instrumental video
        await VideoGenerator.createLyricVideo([], 300000, finalVideoPath)
      }
    }

    KaraokeDB.updateSongPaths(songId, { video_path: finalVideoPath })

    // STEP 7: Add to cache for future use
    console.log(`💾 Adding to cache...`)
    await CacheManager.addToCache(
      songTitle,
      artist,
      options.quality,
      {
        original: audioPath,
        instrumental: instrumental,
        lyrics: lyricsPath || undefined,
        video: finalVideoPath
      },
      youtubeVideoId || undefined
    )

    // STEP 8: Complete processing
    KaraokeDB.updateSongStatus(songId, 'ready', 100)
    console.log(`🎉 Autonomous processing complete for: ${artist} - ${songTitle}`)

    // Cleanup temporary files
    if (karaokeVideoPath && karaokeVideoPath !== finalVideoPath) {
      try {
        fs.unlinkSync(karaokeVideoPath)
      } catch (error) {
        console.warn(`Warning: Could not delete temp video: ${error}`)
      }
    }

  } catch (error) {
    console.error(`❌ Autonomous processing failed for song ${songId}:`, error)
    KaraokeDB.updateSongStatus(songId, 'failed', 0)
  } finally {
    processingJobs.delete(songId)
  }
}

async function checkUploadsDirectory(title: string, artist: string): Promise<string | null> {
  const uploadDir = path.join(process.cwd(), 'uploads')
  if (!fs.existsSync(uploadDir)) return null

  const possibleFiles = [
    `${artist} - ${title}.mp3`,
    `${title} - ${artist}.mp3`,
    `${artist}_${title}.mp3`,
    `${title}_${artist}.mp3`,
    `${title}.mp3`,
    `${artist}.mp3`
  ]

  for (const filename of possibleFiles) {
    const filePath = path.join(uploadDir, filename)
    if (fs.existsSync(filePath)) {
      console.log(`✅ Found local upload: ${filename}`)
      return filePath
    }
  }

  // Also check for any audio files and do fuzzy matching
  const audioFiles = fs.readdirSync(uploadDir)
    .filter(file => /\.(mp3|wav|flac|m4a|aac|ogg)$/i.test(file))

  const titleLower = title.toLowerCase()
  const artistLower = artist.toLowerCase()

  for (const file of audioFiles) {
    const fileLower = file.toLowerCase()
    if (fileLower.includes(titleLower) && fileLower.includes(artistLower)) {
      const filePath = path.join(uploadDir, file)
      console.log(`✅ Found fuzzy match: ${file}`)
      return filePath
    }
  }

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