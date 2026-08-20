import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { YouTubeClient } from '@/lib/youtubeClient'
import fs from 'fs'

jest.mock('youtube-dl-exec')
import youtubedl from 'youtube-dl-exec'

const mockYoutubeDl = youtubedl as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>

interface MockVideo {
  id?: string
  title?: string
  duration?: number
  uploader?: string
}

// Configures the youtubedl mock the way the real binary behaves: search
// invocations (ytsearchN:...) return metadata, download invocations write the
// output file to disk (into the worker-sandboxed YOUTUBE_VIDEO_DIR).
const wireYoutubeDl = (
  searchResults: MockVideo[],
  options: { failDownloads?: number } = {}
) => {
  let downloadAttempts = 0
  mockYoutubeDl.mockImplementation(async (url: unknown, opts: unknown) => {
    if (String(url).startsWith('ytsearch')) {
      return searchResults
    }
    downloadAttempts++
    if (options.failDownloads && downloadAttempts <= options.failDownloads) {
      throw new Error('Download failed')
    }
    const output = (opts as { output: string }).output
    fs.writeFileSync(output.replace('.%(ext)s', '.mp4'), 'mock video content')
    return {}
  })
  return { getDownloadAttempts: () => downloadAttempts }
}

describe('YouTubeClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('searchKaraokeVideos', () => {
    test('returns scored and sorted karaoke results', async () => {
      wireYoutubeDl([
        { id: 'video1', title: 'Bohemian Rhapsody - Queen (Official Karaoke Video)', duration: 355, uploader: 'KaraokeChannel' },
        { id: 'video2', title: 'Queen - Bohemian Rhapsody Karaoke with Lyrics', duration: 354, uploader: 'LyricsKaraoke' },
        { id: 'video3', title: 'Bohemian Rhapsody Instrumental Backing Track', duration: 356, uploader: 'BackingTracks' }
      ])

      const results = await YouTubeClient.searchKaraokeVideos('Bohemian Rhapsody', 'Queen', 5)

      expect(mockYoutubeDl).toHaveBeenCalled()
      expect(results).toHaveLength(3)
      expect(results[0].relevanceScore).toBeGreaterThan(0.3)
      expect(results[0].video.id).toBe('video1')
      expect(results[0].isOfficialKaraoke).toBe(true)
    })

    test('filters out non-karaoke videos', async () => {
      wireYoutubeDl([
        { id: 'video1', title: 'Queen - Bohemian Rhapsody (Official Music Video)', duration: 355, uploader: 'QueenOfficial' },
        { id: 'video2', title: 'Bohemian Rhapsody Karaoke Version', duration: 354, uploader: 'KaraokeChannel' }
      ])

      const results = await YouTubeClient.searchKaraokeVideos('Bohemian Rhapsody', 'Queen')

      expect(results).toHaveLength(1)
      expect(results[0].video.title).toContain('Karaoke')
    })

    test('returns an empty list when every search query fails', async () => {
      mockYoutubeDl.mockRejectedValue(new Error('Search failed'))

      const results = await YouTubeClient.searchKaraokeVideos('Bohemian Rhapsody', 'Queen')

      expect(results).toEqual([])
    })

    test('scores official karaoke above covers', async () => {
      wireYoutubeDl([
        { id: 'official', title: 'Queen - Bohemian Rhapsody Official Karaoke HD', duration: 355, uploader: 'Official' },
        { id: 'lyrics', title: 'Bohemian Rhapsody with Lyrics - Queen', duration: 355, uploader: 'LyricsChannel' },
        { id: 'cover', title: 'Queen - Bohemian Rhapsody Karaoke Cover Live', duration: 355, uploader: 'CoverBand' }
      ])

      const results = await YouTubeClient.searchKaraokeVideos('Bohemian Rhapsody', 'Queen')

      const officialResult = results.find(r => r.video.id === 'official')
      const coverResult = results.find(r => r.video.id === 'cover')

      expect(officialResult!.relevanceScore).toBeGreaterThan(coverResult!.relevanceScore)
      expect(officialResult!.isOfficialKaraoke).toBe(true)
    })

    test('removes duplicate video ids', async () => {
      wireYoutubeDl([
        { id: 'video1', title: 'Bohemian Rhapsody Karaoke', duration: 355, uploader: 'Channel1' },
        { id: 'video1', title: 'Bohemian Rhapsody Karaoke (Reupload)', duration: 355, uploader: 'Channel2' }
      ])

      const results = await YouTubeClient.searchKaraokeVideos('Bohemian Rhapsody', 'Queen')

      expect(results).toHaveLength(1)
    })
  })

  describe('downloadKaraokeVideo', () => {
    test('downloads a video and resolves the file path', async () => {
      wireYoutubeDl([])

      const result = await YouTubeClient.downloadKaraokeVideo(
        'https://youtube.com/watch?v=test123',
        'Bohemian Rhapsody',
        'Queen'
      )

      expect(mockYoutubeDl).toHaveBeenCalledWith(
        'https://youtube.com/watch?v=test123',
        expect.objectContaining({
          format: 'best[height<=1080][ext=mp4]/best[ext=mp4]/best',
          writeInfoJson: true,
          noWarnings: true
        })
      )
      expect(result).toMatch(/Queen_Bohemian_Rhapsody_.*\.mp4$/)
      expect(fs.existsSync(result!)).toBe(true)
    })

    test('returns null when the download fails', async () => {
      mockYoutubeDl.mockRejectedValue(new Error('Download failed'))

      const result = await YouTubeClient.downloadKaraokeVideo(
        'https://youtube.com/watch?v=invalid',
        'Test Song',
        'Test Artist'
      )

      expect(result).toBeNull()
    })

    test('generates distinct filenames for distinct songs', async () => {
      wireYoutubeDl([])

      const result1 = await YouTubeClient.downloadKaraokeVideo(
        'https://youtube.com/watch?v=test1', 'Song A', 'Artist A'
      )
      const result2 = await YouTubeClient.downloadKaraokeVideo(
        'https://youtube.com/watch?v=test2', 'Song B', 'Artist B'
      )

      expect(result1).not.toBeNull()
      expect(result2).not.toBeNull()
      expect(result1).not.toBe(result2)
    })
  })

  describe('getBestKaraokeVideo', () => {
    test('searches, downloads, and returns the best video', async () => {
      wireYoutubeDl([
        { id: 'video1', title: 'Bohemian Rhapsody Official Karaoke', duration: 355, uploader: 'KaraokeChannel' }
      ])

      const result = await YouTubeClient.getBestKaraokeVideo('Bohemian Rhapsody', 'Queen')

      expect(result).not.toBeNull()
      expect(result!.video.title).toBe('Bohemian Rhapsody Official Karaoke')
      expect(fs.existsSync(result!.filePath)).toBe(true)
    })

    test('returns null when no karaoke videos are found', async () => {
      wireYoutubeDl([])

      const result = await YouTubeClient.getBestKaraokeVideo('Unknown Song', 'Unknown Artist')

      expect(result).toBeNull()
    })

    test('tries the next video when a download fails', async () => {
      const { getDownloadAttempts } = wireYoutubeDl(
        [
          { id: 'video1', title: 'Bohemian Rhapsody Karaoke', duration: 355, uploader: 'Channel1' },
          { id: 'video2', title: 'Bohemian Rhapsody Karaoke Backup', duration: 355, uploader: 'Channel2' }
        ],
        { failDownloads: 1 }
      )

      const result = await YouTubeClient.getBestKaraokeVideo('Bohemian Rhapsody', 'Queen')

      expect(result).not.toBeNull()
      expect(getDownloadAttempts()).toBe(2)
    })
  })

  describe('utility methods', () => {
    test('getDownloadedVideos returns an array', () => {
      expect(Array.isArray(YouTubeClient.getDownloadedVideos())).toBe(true)
    })

    test('cleanup deletes files not in the keep list', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      jest.spyOn(fs, 'readdirSync').mockReturnValue(['video1.mp4', 'video2.mp4'] as unknown as ReturnType<typeof fs.readdirSync>)
      const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {})

      YouTubeClient.cleanup(['keep-this-video.mp4'])

      expect(unlinkSpy).toHaveBeenCalledWith(expect.stringContaining('video1.mp4'))
      expect(unlinkSpy).toHaveBeenCalledWith(expect.stringContaining('video2.mp4'))
    })
  })

  describe('edge cases', () => {
    test('handles titles with special characters', async () => {
      wireYoutubeDl([
        { id: 'video1', title: "Don't Stop Me Now - Queen (Karaoke)", duration: 355, uploader: 'KaraokeChannel' }
      ])

      const results = await YouTubeClient.searchKaraokeVideos("Don't Stop Me Now", 'Queen')

      expect(results).toHaveLength(1)
      expect(results[0].video.title).toContain("Don't Stop Me Now")
    })

    test('handles empty search results', async () => {
      wireYoutubeDl([])

      const results = await YouTubeClient.searchKaraokeVideos('Nonexistent Song', 'Fake Artist')

      expect(results).toEqual([])
    })

    test('filters out malformed video entries', async () => {
      wireYoutubeDl([
        { duration: 355 }, // missing id/title
        { id: 'video2', title: 'Test Song Karaoke Video', duration: 355, uploader: 'Channel' }
      ])

      const results = await YouTubeClient.searchKaraokeVideos('Test Song', 'Test Artist')

      expect(results).toHaveLength(1)
      expect(results[0].video.id).toBe('video2')
    })
  })
})
