import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { processKaraokeSong } from '@/lib/autonomousProcessor'
import { KaraokeDB } from '@/lib/database'
import { CacheManager } from '@/lib/cacheManager'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'

// Mock external dependencies
jest.mock('@/lib/torrentClient')
jest.mock('@/lib/youtubeClient')
jest.mock('@/lib/audioProcessor')
jest.mock('@/lib/videoProcessor')
jest.mock('@/lib/lyricsProcessor')

// Import mocked modules
import { TorrentClient } from '@/lib/torrentClient'
import { YouTubeClient } from '@/lib/youtubeClient'
import { AudioProcessor } from '@/lib/audioProcessor'
import { VideoProcessor } from '@/lib/videoProcessor'
import { LyricsProcessor } from '@/lib/lyricsProcessor'

const MockedTorrentClient = TorrentClient as jest.Mocked<typeof TorrentClient>
const MockedYouTubeClient = YouTubeClient as jest.Mocked<typeof YouTubeClient>
const MockedAudioProcessor = AudioProcessor as jest.Mocked<typeof AudioProcessor>
const MockedVideoProcessor = VideoProcessor as jest.Mocked<typeof VideoProcessor>
const MockedLyricsProcessor = LyricsProcessor as jest.Mocked<typeof LyricsProcessor>

describe('Autonomous Processor Integration', () => {
  const testSongId = uuidv4()
  const testTitle = 'Bohemian Rhapsody'
  const testArtist = 'Queen'
  const testUser = {
    id: uuidv4(),
    name: 'Test User',
    color: 'bg-blue-500'
  }

  const testTempDir = path.join(__dirname, '../temp/processor-test')

  beforeEach(() => {
    // Create test directories
    if (!fs.existsSync(testTempDir)) {
      fs.mkdirSync(testTempDir, { recursive: true })
    }

    // Add test song to database
    KaraokeDB.addUser(testUser)
    KaraokeDB.addSong({
      id: testSongId,
      user: testUser,
      songTitle: testTitle,
      artist: testArtist,
      requestedAt: new Date(),
      status: 'queued'
    })

    // Reset all mocks
    jest.clearAllMocks()
  })

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testTempDir)) {
      fs.rmSync(testTempDir, { recursive: true, force: true })
    }
  })

  test('should complete full autonomous processing pipeline', async () => {
    // Mock successful cache miss
    jest.spyOn(CacheManager, 'checkCache').mockResolvedValue(null)
    jest.spyOn(CacheManager, 'addToCache').mockResolvedValue('test-cache-key')

    // Mock successful torrent download
    const mockAudioPath = path.join(testTempDir, 'downloaded-audio.mp3')
    fs.writeFileSync(mockAudioPath, 'mock audio content')
    
    MockedTorrentClient.findBestMatch.mockResolvedValue({
      title: 'Queen - Bohemian Rhapsody',
      size: '5MB',
      seeders: 50,
      magnet: 'magnet:test',
      provider: 'test'
    })
    MockedTorrentClient.downloadAudio.mockResolvedValue(mockAudioPath)

    // Mock successful YouTube download
    const mockVideoPath = path.join(testTempDir, 'karaoke-video.mp4')
    fs.writeFileSync(mockVideoPath, 'mock video content')
    
    MockedYouTubeClient.getBestKaraokeVideo.mockResolvedValue({
      video: {
        id: 'youtube-123',
        title: 'Bohemian Rhapsody Karaoke',
        duration: 355,
        url: 'https://youtube.com/watch?v=youtube-123',
        thumbnail: 'thumb.jpg',
        uploader: 'KaraokeChannel'
      },
      filePath: mockVideoPath
    })

    // Mock successful audio processing
    const mockInstrumentalPath = path.join(testTempDir, 'instrumental.wav')
    fs.writeFileSync(mockInstrumentalPath, 'mock instrumental')
    
    MockedAudioProcessor.separateVocals.mockResolvedValue({
      instrumental: mockInstrumentalPath,
      vocals: path.join(testTempDir, 'vocals.wav')
    })

    // Mock successful lyrics processing
    const mockLyrics = '[00:00.50]Is this the real life?\n[00:03.00]Is this just fantasy?'
    MockedLyricsProcessor.fetchLyrics.mockResolvedValue(mockLyrics)
    MockedLyricsProcessor.smartSynchronize.mockResolvedValue([
      { startTime: 500, endTime: 3000, text: 'Is this the real life?' },
      { startTime: 3000, endTime: 5500, text: 'Is this just fantasy?' }
    ])
    MockedLyricsProcessor.convertToLRC.mockReturnValue(mockLyrics)

    // Mock successful video processing
    const mockFinalVideoPath = path.join(testTempDir, 'final_karaoke.mp4')
    fs.writeFileSync(mockFinalVideoPath, 'mock final video')
    
    MockedVideoProcessor.replaceAudio.mockResolvedValue(mockFinalVideoPath)
    MockedVideoProcessor.optimizeForStreaming.mockResolvedValue(mockFinalVideoPath)

    // Run the autonomous processor
    await processKaraokeSong(testSongId, {
      quality: 'high',
      outputFormat: 'wav'
    })

    // Verify the song status was updated to ready
    const finalSong = KaraokeDB.getSong(testSongId)
    expect(finalSong?.status).toBe('ready')

    // Verify all processing steps were called
    expect(MockedTorrentClient.findBestMatch).toHaveBeenCalledWith(testTitle, testArtist, 3)
    expect(MockedTorrentClient.downloadAudio).toHaveBeenCalled()
    expect(MockedYouTubeClient.getBestKaraokeVideo).toHaveBeenCalledWith(testTitle, testArtist)
    expect(MockedAudioProcessor.separateVocals).toHaveBeenCalled()
    expect(MockedLyricsProcessor.fetchLyrics).toHaveBeenCalledWith(testTitle, testArtist)
    expect(MockedVideoProcessor.replaceAudio).toHaveBeenCalled()
    expect(CacheManager.addToCache).toHaveBeenCalled()

    // Verify file paths were updated in database
    expect(finalSong?.karaoke?.instrumentalUrl).toBe(mockInstrumentalPath)
    expect(finalSong?.karaoke?.videoUrl).toBe(mockFinalVideoPath)
  }, 30000)

  test('should use cached result when available', async () => {
    // Mock cache hit
    const mockCachedResult = {
      cacheKey: 'cached-key',
      files: {
        original: path.join(testTempDir, 'cached-original.mp3'),
        instrumental: path.join(testTempDir, 'cached-instrumental.wav'),
        lyrics: path.join(testTempDir, 'cached-lyrics.lrc'),
        video: path.join(testTempDir, 'cached-video.mp4')
      },
      metadata: {
        title: testTitle,
        artist: testArtist,
        quality: 'high',
        youtubeVideoId: 'cached-youtube-id'
      }
    }

    // Create mock cached files
    Object.values(mockCachedResult.files).forEach(filePath => {
      if (filePath) {
        fs.writeFileSync(filePath, 'cached content')
      }
    })

    jest.spyOn(CacheManager, 'checkCache').mockResolvedValue(mockCachedResult)

    // Run the processor
    await processKaraokeSong(testSongId, {
      quality: 'high',
      outputFormat: 'wav'
    })

    // Verify cache was checked
    expect(CacheManager.checkCache).toHaveBeenCalledWith(testTitle, testArtist, 'high')

    // Verify no processing steps were called (cache hit)
    expect(MockedTorrentClient.findBestMatch).not.toHaveBeenCalled()
    expect(MockedYouTubeClient.getBestKaraokeVideo).not.toHaveBeenCalled()
    expect(MockedAudioProcessor.separateVocals).not.toHaveBeenCalled()

    // Verify song was marked ready
    const finalSong = KaraokeDB.getSong(testSongId)
    expect(finalSong?.status).toBe('ready')
    expect(finalSong?.karaoke?.instrumentalUrl).toBe(mockCachedResult.files.instrumental)
  })

  test('should handle torrent download failure gracefully', async () => {
    // Mock cache miss
    jest.spyOn(CacheManager, 'checkCache').mockResolvedValue(null)

    // Mock torrent failure
    MockedTorrentClient.findBestMatch.mockResolvedValue(null)

    // Mock fallback to uploads directory (no files)
    // The processor should fail gracefully

    // Run the processor
    await processKaraokeSong(testSongId, {
      quality: 'high',
      outputFormat: 'wav'
    })

    // Verify song was marked as failed
    const finalSong = KaraokeDB.getSong(testSongId)
    expect(finalSong?.status).toBe('failed')

    // Verify torrent was attempted
    expect(MockedTorrentClient.findBestMatch).toHaveBeenCalled()
  })

  test('should handle YouTube download failure and fallback to generated video', async () => {
    // Mock cache miss and successful torrent
    jest.spyOn(CacheManager, 'checkCache').mockResolvedValue(null)
    jest.spyOn(CacheManager, 'addToCache').mockResolvedValue('test-cache-key')

    const mockAudioPath = path.join(testTempDir, 'downloaded-audio.mp3')
    fs.writeFileSync(mockAudioPath, 'mock audio content')
    
    MockedTorrentClient.findBestMatch.mockResolvedValue({
      title: 'Queen - Bohemian Rhapsody',
      size: '5MB',
      seeders: 50,
      magnet: 'magnet:test',
      provider: 'test'
    })
    MockedTorrentClient.downloadAudio.mockResolvedValue(mockAudioPath)

    // Mock YouTube failure
    MockedYouTubeClient.getBestKaraokeVideo.mockResolvedValue(null)

    // Mock successful audio processing and video generation
    const mockInstrumentalPath = path.join(testTempDir, 'instrumental.wav')
    fs.writeFileSync(mockInstrumentalPath, 'mock instrumental')
    
    MockedAudioProcessor.separateVocals.mockResolvedValue({
      instrumental: mockInstrumentalPath,
      vocals: path.join(testTempDir, 'vocals.wav')
    })

    MockedLyricsProcessor.fetchLyrics.mockResolvedValue('mock lyrics')
    MockedLyricsProcessor.smartSynchronize.mockResolvedValue([])
    MockedLyricsProcessor.convertToLRC.mockReturnValue('mock lrc')

    // Mock generated video creation
    const { VideoGenerator } = await import('@/lib/videoGenerator')
    jest.spyOn(VideoGenerator, 'createLyricVideo').mockResolvedValue('generated-video.mp4')

    // Run the processor
    await processKaraokeSong(testSongId, {
      quality: 'high',
      outputFormat: 'wav'
    })

    // Verify song was still processed successfully
    const finalSong = KaraokeDB.getSong(testSongId)
    expect(finalSong?.status).toBe('ready')

    // Verify fallback video generation was used
    expect(VideoGenerator.createLyricVideo).toHaveBeenCalled()
  })

  test('should handle processing timeout gracefully', async () => {
    // Mock cache miss
    jest.spyOn(CacheManager, 'checkCache').mockResolvedValue(null)

    // Mock torrent that times out
    MockedTorrentClient.findBestMatch.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(null), 10000))
    )

    // Run with shorter timeout
    await processKaraokeSong(testSongId, {
      quality: 'high',
      outputFormat: 'wav'
    })

    // Should eventually fail due to timeout/no audio found
    const finalSong = KaraokeDB.getSong(testSongId)
    expect(finalSong?.status).toBe('failed')
  })
})