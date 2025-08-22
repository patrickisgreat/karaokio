import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { YouTubeClient } from '@/lib/youtubeClient'
import fs from 'fs'
import path from 'path'

// Mock youtube-dl-exec
jest.mock('youtube-dl-exec')
import youtubedl from 'youtube-dl-exec'

const MockedYoutubeDl = youtubedl as any

describe('YouTubeClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('searchKaraokeVideos', () => {
    test('should search for karaoke videos successfully', async () => {
      const mockSearchResults = [
        {
          id: 'video1',
          title: 'Bohemian Rhapsody - Queen (Official Karaoke Video)',
          duration: 355,
          uploader: 'KaraokeChannel'
        },
        {
          id: 'video2', 
          title: 'Queen - Bohemian Rhapsody Karaoke with Lyrics',
          duration: 354,
          uploader: 'LyricsKaraoke'
        },
        {
          id: 'video3',
          title: 'Bohemian Rhapsody Instrumental Backing Track',
          duration: 356,
          uploader: 'BackingTracks'
        }
      ]

      MockedYoutubeDl.mockResolvedValue(mockSearchResults)

      const results = await YouTubeClient.searchKaraokeVideos('Bohemian Rhapsody', 'Queen', 5)

      expect(MockedYoutubeDl).toHaveBeenCalled()
      expect(results).toHaveLength(3)
      
      // Check that results are properly scored and sorted
      expect(results[0].relevanceScore).toBeGreaterThan(0.3)
      expect(results[0].video.id).toBe('video1')
      expect(results[0].isOfficialKaraoke).toBe(true)
    })

    test('should filter out non-karaoke videos', async () => {
      const mockSearchResults = [
        {
          id: 'video1',
          title: 'Queen - Bohemian Rhapsody (Official Music Video)', // No karaoke terms
          duration: 355,
          uploader: 'QueenOfficial'
        },
        {
          id: 'video2',
          title: 'Bohemian Rhapsody Karaoke Version',
          duration: 354,
          uploader: 'KaraokeChannel'
        }
      ]

      MockedYoutubeDl.mockResolvedValue(mockSearchResults)

      const results = await YouTubeClient.searchKaraokeVideos('Bohemian Rhapsody', 'Queen')

      // Should only return the karaoke video
      expect(results).toHaveLength(1)
      expect(results[0].video.title).toContain('Karaoke')
    })

    test('should handle search failures gracefully', async () => {
      MockedYoutubeDl.mockRejectedValue(new Error('Search failed'))

      const results = await YouTubeClient.searchKaraokeVideos('Bohemian Rhapsody', 'Queen')

      expect(results).toEqual([])
    })

    test('should score karaoke relevance correctly', async () => {
      const mockSearchResults = [
        {
          id: 'official',
          title: 'Queen - Bohemian Rhapsody Official Karaoke HD',
          duration: 355,
          uploader: 'Official'
        },
        {
          id: 'lyrics',
          title: 'Bohemian Rhapsody with Lyrics - Queen',
          duration: 355,
          uploader: 'LyricsChannel'
        },
        {
          id: 'cover',
          title: 'Queen - Bohemian Rhapsody Karaoke Cover Live',
          duration: 355,
          uploader: 'CoverBand'
        }
      ]

      MockedYoutubeDl.mockResolvedValue(mockSearchResults)

      const results = await YouTubeClient.searchKaraokeVideos('Bohemian Rhapsody', 'Queen')

      // Official karaoke should score highest
      const officialResult = results.find(r => r.video.id === 'official')
      const coverResult = results.find(r => r.video.id === 'cover')
      
      expect(officialResult!.relevanceScore).toBeGreaterThan(coverResult!.relevanceScore)
      expect(officialResult!.isOfficialKaraoke).toBe(true)
    })

    test('should remove duplicate videos', async () => {
      const mockSearchResults = [
        {
          id: 'video1',
          title: 'Bohemian Rhapsody Karaoke',
          duration: 355,
          uploader: 'Channel1'
        },
        {
          id: 'video1', // Duplicate ID
          title: 'Bohemian Rhapsody Karaoke (Reupload)',
          duration: 355,
          uploader: 'Channel2'
        }
      ]

      MockedYoutubeDl.mockResolvedValue(mockSearchResults)

      const results = await YouTubeClient.searchKaraokeVideos('Bohemian Rhapsody', 'Queen')

      // Should only return one video
      expect(results).toHaveLength(1)
    })
  })

  describe('downloadKaraokeVideo', () => {
    test('should download video successfully', async () => {
      // Create a mock downloaded file in the actual download directory
      const downloadDir = path.join(process.cwd(), 'youtube_videos')
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true })
      }
      
      // Mock youtubedl to succeed
      MockedYoutubeDl.mockResolvedValue({})
      
      // Create the expected downloaded file (calculate the same hash as the method)
      const crypto = require('crypto')
      const hash = crypto.createHash('md5').update('Queen_Bohemian Rhapsody').digest('hex').substring(0, 8)
      const expectedFilename = `Queen_Bohemian_Rhapsody_${hash}.mp4`
      const expectedPath = path.join(downloadDir, expectedFilename)
      fs.writeFileSync(expectedPath, 'mock video content')

      const result = await YouTubeClient.downloadKaraokeVideo(
        'https://youtube.com/watch?v=test123',
        'Bohemian Rhapsody',
        'Queen'
      )

      expect(MockedYoutubeDl).toHaveBeenCalledWith(
        'https://youtube.com/watch?v=test123',
        expect.objectContaining({
          format: 'best[height<=1080][ext=mp4]/best[ext=mp4]/best',
          writeInfoJson: true,
          extractFlat: false,
          noWarnings: true
        })
      )

      expect(result).toMatch(/Queen_Bohemian_Rhapsody_.*\.(mp4|webm|mkv)$/)
    })

    test('should handle download failures', async () => {
      MockedYoutubeDl.mockRejectedValue(new Error('Download failed'))

      const result = await YouTubeClient.downloadKaraokeVideo(
        'https://youtube.com/watch?v=invalid',
        'Test Song',
        'Test Artist'
      )

      expect(result).toBeNull()
    })

    test('should generate unique filenames', async () => {
      MockedYoutubeDl.mockResolvedValue({})

      const result1 = await YouTubeClient.downloadKaraokeVideo(
        'https://youtube.com/watch?v=test1',
        'Song A',
        'Artist A'
      )

      const result2 = await YouTubeClient.downloadKaraokeVideo(
        'https://youtube.com/watch?v=test2', 
        'Song B',
        'Artist B'
      )

      // Should generate different filenames
      expect(result1).not.toBe(result2)
    })
  })

  describe('getBestKaraokeVideo', () => {
    test('should get best karaoke video', async () => {
      const mockSearchResults = [
        {
          id: 'video1',
          title: 'Bohemian Rhapsody Official Karaoke',
          duration: 355,
          uploader: 'KaraokeChannel'
        }
      ]

      const mockDownloadPath = '/path/to/downloaded/video.mp4'

      MockedYoutubeDl
        .mockResolvedValueOnce(mockSearchResults) // Search call
        .mockResolvedValueOnce({}) // Download call

      // Mock file system to simulate successful download
      const fs = require('fs')
      jest.spyOn(fs, 'existsSync').mockReturnValue(true)

      const result = await YouTubeClient.getBestKaraokeVideo('Bohemian Rhapsody', 'Queen')

      expect(result).not.toBeNull()
      expect(result!.video.title).toBe('Bohemian Rhapsody Official Karaoke')
    })

    test('should return null when no karaoke videos found', async () => {
      MockedYoutubeDl.mockResolvedValue([]) // No search results

      const result = await YouTubeClient.getBestKaraokeVideo('Unknown Song', 'Unknown Artist')

      expect(result).toBeNull()
    })

    test('should try multiple videos if downloads fail', async () => {
      const mockSearchResults = [
        {
          id: 'video1',
          title: 'Bohemian Rhapsody Karaoke',
          duration: 355,
          uploader: 'Channel1'
        },
        {
          id: 'video2',
          title: 'Bohemian Rhapsody Karaoke Backup',
          duration: 355,
          uploader: 'Channel2'
        }
      ]

      MockedYoutubeDl
        .mockResolvedValueOnce(mockSearchResults) // Search
        .mockRejectedValueOnce(new Error('First download failed')) // First download fails
        .mockResolvedValueOnce({}) // Second download succeeds

      const fs = require('fs')
      jest.spyOn(fs, 'existsSync').mockReturnValue(true)

      const result = await YouTubeClient.getBestKaraokeVideo('Bohemian Rhapsody', 'Queen')

      expect(result).not.toBeNull()
      expect(MockedYoutubeDl).toHaveBeenCalledTimes(3) // 1 search + 2 download attempts
    })
  })

  describe('utility methods', () => {
    test('should get downloaded videos list', () => {
      const videos = YouTubeClient.getDownloadedVideos()
      expect(Array.isArray(videos)).toBe(true)
    })

    test('should cleanup files', () => {
      // Mock fs operations
      const fs = require('fs')
      jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      jest.spyOn(fs, 'readdirSync').mockReturnValue(['video1.mp4', 'video2.mp4'])
      jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {})

      YouTubeClient.cleanup(['keep-this-video.mp4'])

      expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('video1.mp4'))
      expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('video2.mp4'))
    })
  })

  describe('edge cases', () => {
    test('should handle videos with special characters in titles', async () => {
      const mockSearchResults = [
        {
          id: 'video1',
          title: 'Don\'t Stop Me Now - Queen (Karaoke)',
          duration: 355,
          uploader: 'KaraokeChannel'
        }
      ]

      MockedYoutubeDl.mockResolvedValue(mockSearchResults)

      const results = await YouTubeClient.searchKaraokeVideos('Don\'t Stop Me Now', 'Queen')

      expect(results).toHaveLength(1)
      expect(results[0].video.title).toContain('Don\'t Stop Me Now')
    })

    test('should handle empty search results', async () => {
      MockedYoutubeDl.mockResolvedValue([])

      const results = await YouTubeClient.searchKaraokeVideos('Nonexistent Song', 'Fake Artist')

      expect(results).toEqual([])
    })

    test('should handle malformed video data', async () => {
      const mockSearchResults = [
        {
          // Missing required fields
          duration: 355
        },
        {
          id: 'video2',
          title: 'Valid Karaoke Video',
          duration: 355,
          uploader: 'Channel'
        }
      ]

      MockedYoutubeDl.mockResolvedValue(mockSearchResults)

      const results = await YouTubeClient.searchKaraokeVideos('Test Song', 'Test Artist')

      // Should filter out malformed video and keep valid one
      expect(results).toHaveLength(1)
      expect(results[0].video.id).toBe('video2')
    })
  })
})