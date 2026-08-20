import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { EventEmitter } from 'events'
import fs from 'fs'
import { TorrentClient } from '@/lib/torrentClient'
import WebTorrent from 'webtorrent'
import TorrentSearchApi from 'torrent-search-api'

// Both imports resolve to configurable stubs via jest.config.js moduleNameMapper.
const mockWebTorrent = WebTorrent as unknown as jest.Mock
const mockSearch = TorrentSearchApi.search as unknown as jest.Mock<
  (...args: unknown[]) => Promise<unknown>
>

interface MockTorrentFile {
  name: string
  length: number
  createReadStream: jest.Mock
}

interface MockTorrent {
  name: string
  files: MockTorrentFile[]
  downloaded: number
  length: number
  destroy: jest.Mock
}

const searchResult = (overrides: Record<string, unknown> = {}) => ({
  title: 'Queen - Bohemian Rhapsody (1975) [FLAC]',
  size: '5.2MB',
  seeds: 42,
  peers: 10,
  desc: '',
  magnet: 'magnet:?xt=urn:btih:test',
  provider: '1337x',
  ...overrides,
})

const audioFile = (name: string, length: number): MockTorrentFile => ({
  name,
  length,
  createReadStream: jest.fn(),
})

const makeTorrent = (files: MockTorrentFile[]): MockTorrent => ({
  name: 'mock torrent',
  files,
  downloaded: 0,
  length: files.reduce((sum, f) => sum + f.length, 0),
  destroy: jest.fn(),
})

describe('TorrentClient', () => {
  const mockClient = {
    add: jest.fn(),
    destroy: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockWebTorrent.mockImplementation(() => mockClient)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // Wires a torrent whose selected file pipes into a write stream that
  // finishes immediately — the download succeeds without touching disk.
  const wireSuccessfulDownload = (torrent: MockTorrent, fileIndex: number) => {
    const writeStream = new EventEmitter()
    jest.spyOn(fs, 'createWriteStream').mockReturnValue(writeStream as unknown as fs.WriteStream)

    torrent.files[fileIndex].createReadStream.mockReturnValue({
      pipe: jest.fn(() => {
        setImmediate(() => writeStream.emit('finish'))
        return writeStream
      }),
    })

    mockClient.add.mockImplementation((_magnet, _options, callback) => {
      setImmediate(() => (callback as (t: MockTorrent) => void)(torrent))
      return torrent
    })
  }

  describe('searchTorrents', () => {
    test('maps provider results into TorrentResult shape', async () => {
      mockSearch.mockResolvedValue([
        searchResult(),
        searchResult({
          title: 'Queen Greatest Hits',
          seeds: 15,
          magnet: 'magnet:2',
          provider: 'ThePirateBay',
        }),
      ])

      const results = await TorrentClient.searchTorrents('Queen Bohemian Rhapsody', 10)

      expect(mockSearch).toHaveBeenCalledWith('Queen Bohemian Rhapsody', 'Audio', 10)
      expect(results).toHaveLength(2)
      expect(results[0]).toEqual({
        title: 'Queen - Bohemian Rhapsody (1975) [FLAC]',
        size: '5.2MB',
        seeders: 42,
        magnet: 'magnet:?xt=urn:btih:test',
        provider: '1337x',
      })
    })

    test('returns an empty list when the search provider throws', async () => {
      mockSearch.mockRejectedValue(new Error('Search failed'))

      const results = await TorrentClient.searchTorrents('Invalid Query')

      expect(results).toEqual([])
    })

    test('defaults seeders to 0 when the provider omits seeds', async () => {
      mockSearch.mockResolvedValue([searchResult({ seeds: undefined })])

      const results = await TorrentClient.searchTorrents('test query')

      expect(results[0].seeders).toBe(0)
    })
  })

  describe('downloadAudio', () => {
    test('resolves with the output path when the download finishes', async () => {
      const torrent = makeTorrent([audioFile('Queen - Bohemian Rhapsody.mp3', 5_000_000)])
      wireSuccessfulDownload(torrent, 0)

      const result = await TorrentClient.downloadAudio('magnet:?xt=urn:btih:test', 'Test Song')

      expect(result).toMatch(/Test_Song_.*\.mp3$/)
      expect(mockClient.add).toHaveBeenCalled()
      expect(torrent.files[0].createReadStream).toHaveBeenCalled()
      expect(torrent.destroy).toHaveBeenCalled()
    })

    test('rejects when the torrent contains no audio files', async () => {
      const torrent = makeTorrent([audioFile('readme.txt', 1000)])
      mockClient.add.mockImplementation((_magnet, _options, callback) => {
        setImmediate(() => (callback as (t: MockTorrent) => void)(torrent))
        return torrent
      })

      await expect(TorrentClient.downloadAudio('magnet:test', 'Test')).rejects.toThrow(
        'No audio files found in torrent'
      )
    })

    test('rejects with a timeout when the torrent never becomes ready', async () => {
      // add() never invokes its callback — the timeout must still fire
      mockClient.add.mockImplementation(() => makeTorrent([]))

      await expect(
        TorrentClient.downloadAudio('magnet:test', 'Test', undefined, 100)
      ).rejects.toThrow('Download timeout')
    })

    test('selects the largest audio file when multiple exist', async () => {
      const torrent = makeTorrent([
        audioFile('small-preview.mp3', 1_000_000),
        audioFile('full-song.mp3', 5_000_000),
        audioFile('medium-quality.wav', 3_000_000),
      ])
      wireSuccessfulDownload(torrent, 1)

      await TorrentClient.downloadAudio('magnet:test', 'Test')

      expect(torrent.files[1].createReadStream).toHaveBeenCalled()
      expect(torrent.files[0].createReadStream).not.toHaveBeenCalled()
      expect(torrent.files[2].createReadStream).not.toHaveBeenCalled()
    })
  })

  describe('findBestMatch', () => {
    test('returns the highest-seeded result matching both artist and title', async () => {
      mockSearch.mockResolvedValue([
        searchResult({
          title: 'Queen - Bohemian Rhapsody [1975] FLAC',
          seeds: 50,
          magnet: 'magnet:best',
        }),
        searchResult({ title: 'Queen Bohemian Rhapsody MP3', seeds: 25, magnet: 'magnet:ok' }),
        searchResult({ title: 'Random Song', seeds: 100, magnet: 'magnet:wrong' }),
      ])

      const result = await TorrentClient.findBestMatch('Bohemian Rhapsody', 'Queen', 5)

      expect(result).not.toBeNull()
      expect(result!.title).toBe('Queen - Bohemian Rhapsody [1975] FLAC')
      expect(result!.seeders).toBe(50)
    })

    test('returns null when no result matches the song', async () => {
      mockSearch.mockResolvedValue([
        searchResult({ title: 'Completely Different Song', seeds: 50 }),
      ])

      const result = await TorrentClient.findBestMatch('Bohemian Rhapsody', 'Queen', 5)

      expect(result).toBeNull()
    })

    test('filters out results with insufficient seeders', async () => {
      mockSearch.mockResolvedValue([searchResult({ title: 'Queen - Bohemian Rhapsody', seeds: 2 })])

      const result = await TorrentClient.findBestMatch('Bohemian Rhapsody', 'Queen', 5)

      expect(result).toBeNull()
    })

    test('tries multiple query variations until one matches', async () => {
      mockSearch
        .mockResolvedValueOnce([]) // "Queen Bohemian Rhapsody"
        .mockResolvedValueOnce([
          // "Bohemian Rhapsody Queen"
          searchResult({ title: 'Bohemian Rhapsody - Queen', seeds: 30, magnet: 'magnet:found' }),
        ])

      const result = await TorrentClient.findBestMatch('Bohemian Rhapsody', 'Queen', 5)

      expect(mockSearch).toHaveBeenCalledTimes(2)
      expect(result).not.toBeNull()
      expect(result!.title).toBe('Bohemian Rhapsody - Queen')
    })
  })

  describe('utility methods', () => {
    test('cleanup destroys the client without throwing', () => {
      TorrentClient.cleanup()
    })

    test('getDownloadedFiles returns an array', () => {
      expect(Array.isArray(TorrentClient.getDownloadedFiles())).toBe(true)
    })
  })
})
