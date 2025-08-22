import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'

// Mock WebTorrent and TorrentSearchApi BEFORE importing TorrentClient
jest.mock('webtorrent')
jest.mock('torrent-search-api')

import { TorrentClient } from '@/lib/torrentClient'
import WebTorrent from 'webtorrent'
import TorrentSearchApi from 'torrent-search-api'

const MockedWebTorrent = WebTorrent as jest.MockedClass<typeof WebTorrent>
const MockedTorrentSearchApi = TorrentSearchApi as jest.Mocked<typeof TorrentSearchApi>

describe('TorrentClient', () => {
  const mockTorrent = {
    name: 'Queen - Bohemian Rhapsody.mp3',
    files: [
      {
        name: 'Queen - Bohemian Rhapsody.mp3',
        length: 5000000, // 5MB
        createReadStream: jest.fn(() => ({
          pipe: jest.fn()
        }))
      }
    ],
    downloaded: 0,
    length: 5000000,
    destroy: jest.fn()
  }

  const mockWebTorrentInstance = {
    add: jest.fn(),
    destroy: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    MockedWebTorrent.mockImplementation(() => mockWebTorrentInstance as any)
  })

  describe('searchTorrents', () => {
    test('should search for torrents successfully', async () => {
      const mockResults = [
        {
          title: 'Queen - Bohemian Rhapsody (1975) [FLAC]',
          size: '5.2MB',
          seeds: 42,
          magnet: 'magnet:?xt=urn:btih:test',
          provider: '1337x'
        },
        {
          title: 'Queen Greatest Hits',
          size: '120MB',
          seeds: 15,
          magnet: 'magnet:?xt=urn:btih:test2',
          provider: 'ThePirateBay'
        }
      ]

      MockedTorrentSearchApi.search.mockResolvedValue(mockResults)

      const results = await TorrentClient.searchTorrents('Queen Bohemian Rhapsody', 10)

      expect(MockedTorrentSearchApi.search).toHaveBeenCalledWith('Queen Bohemian Rhapsody', 'Audio', 10)
      expect(results).toHaveLength(2)
      expect(results[0]).toEqual({
        title: 'Queen - Bohemian Rhapsody (1975) [FLAC]',
        size: '5.2MB',
        seeders: 42,
        magnet: 'magnet:?xt=urn:btih:test',
        provider: '1337x'
      })
    })

    test('should handle search errors gracefully', async () => {
      MockedTorrentSearchApi.search.mockRejectedValue(new Error('Search failed'))

      const results = await TorrentClient.searchTorrents('Invalid Query')

      expect(results).toEqual([])
    })

    test('should handle missing seeds data', async () => {
      const mockResults = [
        {
          title: 'Test Song',
          size: '5MB',
          magnet: 'magnet:test',
          provider: 'test'
          // No seeds property
        }
      ]

      MockedTorrentSearchApi.search.mockResolvedValue(mockResults)

      const results = await TorrentClient.searchTorrents('test query')

      expect(results[0].seeders).toBe(0)
    })
  })

  describe('downloadAudio', () => {
    test('should download audio file successfully', async () => {
      const mockWriteStream = {
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            setTimeout(callback, 100) // Simulate async completion
          }
          return mockWriteStream
        })
      }

      const mockReadStream = {
        pipe: jest.fn(() => mockWriteStream)
      }

      mockTorrent.files[0].createReadStream.mockReturnValue(mockReadStream)

      // Mock the torrent add callback
      mockWebTorrentInstance.add.mockImplementation((magnet, options, callback) => {
        setTimeout(() => callback(mockTorrent), 50)
        return mockTorrent as any
      })

      const progressCallback = jest.fn()
      const downloadPromise = TorrentClient.downloadAudio(
        'magnet:?xt=urn:btih:test',
        'Test Song',
        progressCallback
      )

      // Simulate download progress
      setTimeout(() => {
        mockTorrent.downloaded = 2500000 // 50% downloaded
      }, 25)

      const result = await downloadPromise

      expect(result).toMatch(/Test_Song_.*\.mp3$/)
      expect(mockWebTorrentInstance.add).toHaveBeenCalled()
      expect(mockTorrent.files[0].createReadStream).toHaveBeenCalled()
    })

    test('should handle torrents with no audio files', async () => {
      const mockTorrentNoAudio = {
        ...mockTorrent,
        files: [
          {
            name: 'readme.txt',
            length: 1000,
            createReadStream: jest.fn()
          }
        ]
      }

      mockWebTorrentInstance.add.mockImplementation((magnet, options, callback) => {
        setTimeout(() => callback(mockTorrentNoAudio), 50)
        return mockTorrentNoAudio as any
      })

      await expect(
        TorrentClient.downloadAudio('magnet:test', 'Test')
      ).rejects.toThrow('No audio files found in torrent')
    })

    test('should handle download timeout', async () => {
      // Mock a torrent that never completes
      mockWebTorrentInstance.add.mockImplementation((magnet, options, callback) => {
        // Never call the callback to simulate hanging
        return mockTorrent as any
      })

      await expect(
        TorrentClient.downloadAudio('magnet:test', 'Test')
      ).rejects.toThrow('Download timeout')
    }, 15000) // Longer timeout for this test

    test('should select largest audio file when multiple exist', async () => {
      const mockTorrentMultipleAudio = {
        ...mockTorrent,
        files: [
          {
            name: 'small-preview.mp3',
            length: 1000000, // 1MB
            createReadStream: jest.fn()
          },
          {
            name: 'full-song.mp3',
            length: 5000000, // 5MB (largest)
            createReadStream: jest.fn(() => ({ pipe: jest.fn() }))
          },
          {
            name: 'medium-quality.wav',
            length: 3000000, // 3MB
            createReadStream: jest.fn()
          }
        ]
      }

      mockWebTorrentInstance.add.mockImplementation((magnet, options, callback) => {
        setTimeout(() => callback(mockTorrentMultipleAudio), 50)
        return mockTorrentMultipleAudio as any
      })

      const mockWriteStream = {
        on: jest.fn((event, callback) => {
          if (event === 'finish') setTimeout(callback, 100)
          return mockWriteStream
        })
      }

      mockTorrentMultipleAudio.files[1].createReadStream().pipe = jest.fn(() => mockWriteStream)

      await TorrentClient.downloadAudio('magnet:test', 'Test')

      // Should select the largest file (index 1)
      expect(mockTorrentMultipleAudio.files[1].createReadStream).toHaveBeenCalled()
      expect(mockTorrentMultipleAudio.files[0].createReadStream).not.toHaveBeenCalled()
      expect(mockTorrentMultipleAudio.files[2].createReadStream).not.toHaveBeenCalled()
    })
  })

  describe('findBestMatch', () => {
    test('should find best matching torrent', async () => {
      const mockSearchResults = [
        {
          title: 'Queen - Bohemian Rhapsody [1975] FLAC',
          size: '5MB',
          seeds: 50,
          magnet: 'magnet:best',
          provider: '1337x'
        },
        {
          title: 'Queen Bohemian Rhapsody MP3',
          size: '4MB', 
          seeds: 25,
          magnet: 'magnet:ok',
          provider: 'TPB'
        },
        {
          title: 'Random Song',
          size: '3MB',
          seeds: 100, // High seeders but wrong song
          magnet: 'magnet:wrong',
          provider: 'test'
        }
      ]

      MockedTorrentSearchApi.search.mockResolvedValue(mockSearchResults)

      const result = await TorrentClient.findBestMatch('Bohemian Rhapsody', 'Queen', 5)

      expect(result).not.toBeNull()
      expect(result!.title).toBe('Queen - Bohemian Rhapsody [1975] FLAC')
      expect(result!.seeders).toBe(50)
    })

    test('should return null if no good matches found', async () => {
      const mockSearchResults = [
        {
          title: 'Completely Different Song',
          size: '5MB',
          seeds: 50,
          magnet: 'magnet:wrong',
          provider: 'test'
        }
      ]

      MockedTorrentSearchApi.search.mockResolvedValue(mockSearchResults)

      const result = await TorrentClient.findBestMatch('Bohemian Rhapsody', 'Queen', 5)

      expect(result).toBeNull()
    })

    test('should filter out torrents with insufficient seeders', async () => {
      const mockSearchResults = [
        {
          title: 'Queen - Bohemian Rhapsody',
          size: '5MB',
          seeds: 2, // Below minimum
          magnet: 'magnet:lowseed',
          provider: 'test'
        }
      ]

      MockedTorrentSearchApi.search.mockResolvedValue(mockSearchResults)

      const result = await TorrentClient.findBestMatch('Bohemian Rhapsody', 'Queen', 5)

      expect(result).toBeNull()
    })

    test('should try multiple query variations', async () => {
      // Mock first query returning no results
      MockedTorrentSearchApi.search
        .mockResolvedValueOnce([]) // "Queen Bohemian Rhapsody"
        .mockResolvedValueOnce([   // "Bohemian Rhapsody Queen"
          {
            title: 'Bohemian Rhapsody - Queen',
            size: '5MB',
            seeds: 30,
            magnet: 'magnet:found',
            provider: 'test'
          }
        ])

      const result = await TorrentClient.findBestMatch('Bohemian Rhapsody', 'Queen', 5)

      expect(MockedTorrentSearchApi.search).toHaveBeenCalledTimes(2)
      expect(result).not.toBeNull()
      expect(result!.title).toBe('Bohemian Rhapsody - Queen')
    })
  })

  describe('utility methods', () => {
    test('should cleanup client', () => {
      TorrentClient.cleanup()
      // Just verify it doesn't throw - actual cleanup is internal
    })

    test('should get downloaded files list', () => {
      // Mock fs for this test
      const mockFiles = TorrentClient.getDownloadedFiles()
      expect(Array.isArray(mockFiles)).toBe(true)
    })
  })
})