import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { CacheManager } from '@/lib/cacheManager'
import fs from 'fs'
import path from 'path'

describe('CacheManager', () => {
  const testCacheDir = path.join(__dirname, '../temp/cache-test')
  const testTitle = 'Bohemian Rhapsody'
  const testArtist = 'Queen'
  const testQuality = 'high'

  beforeEach(() => {
    // Override cache directory for tests
    process.env.CACHE_DIR = testCacheDir
    if (!fs.existsSync(testCacheDir)) {
      fs.mkdirSync(testCacheDir, { recursive: true })
    }
    
    // Clear any existing cache entries
    try {
      // Force a new database instance for each test
      const db = require('@/lib/database').default
      db.exec('DELETE FROM processed_cache')
    } catch (error) {
      // Ignore if database doesn't exist yet
    }
  })

  afterEach(() => {
    // Clean up test cache
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true })
    }
  })

  describe('generateCacheKey', () => {
    test('should generate consistent cache keys', () => {
      const key1 = CacheManager.generateCacheKey(testTitle, testArtist, testQuality)
      const key2 = CacheManager.generateCacheKey(testTitle, testArtist, testQuality)
      
      expect(key1).toBe(key2)
      expect(key1).toHaveLength(16)
      expect(typeof key1).toBe('string')
    })

    test('should generate different keys for different inputs', () => {
      const key1 = CacheManager.generateCacheKey('Song A', 'Artist A', 'high')
      const key2 = CacheManager.generateCacheKey('Song B', 'Artist B', 'high')
      const key3 = CacheManager.generateCacheKey('Song A', 'Artist A', 'low')
      
      expect(key1).not.toBe(key2)
      expect(key1).not.toBe(key3)
      expect(key2).not.toBe(key3)
    })

    test('should normalize case and whitespace', () => {
      const key1 = CacheManager.generateCacheKey('  BOHEMIAN rhapsody  ', '  Queen  ', 'high')
      const key2 = CacheManager.generateCacheKey('bohemian rhapsody', 'queen', 'high')
      
      expect(key1).toBe(key2)
    })
  })

  describe('cache operations', () => {
    test('should return null for cache miss', async () => {
      const result = await CacheManager.checkCache(testTitle, testArtist, testQuality)
      expect(result).toBeNull()
    })

    test('should add and retrieve from cache', async () => {
      // Create test files
      const testFiles = {
        original: path.join(testCacheDir, 'original.mp3'),
        instrumental: path.join(testCacheDir, 'instrumental.wav'),
        lyrics: path.join(testCacheDir, 'lyrics.lrc'),
        video: path.join(testCacheDir, 'karaoke.mp4')
      }

      // Create mock files with some content
      Object.values(testFiles).forEach(filePath => {
        fs.writeFileSync(filePath, 'mock content for testing file size calculation', 'utf8')
      })

      // Add to cache
      const cacheKey = await CacheManager.addToCache(
        testTitle,
        testArtist,
        testQuality,
        testFiles,
        'youtube-id-123'
      )

      expect(cacheKey).toBeDefined()
      expect(typeof cacheKey).toBe('string')

      // Retrieve from cache
      const cached = await CacheManager.checkCache(testTitle, testArtist, testQuality)
      
      expect(cached).not.toBeNull()
      expect(cached!.cacheKey).toBe(cacheKey)
      expect(cached!.metadata.title).toBe(testTitle)
      expect(cached!.metadata.artist).toBe(testArtist)
      expect(cached!.metadata.quality).toBe(testQuality)
      expect(cached!.metadata.youtubeVideoId).toBe('youtube-id-123')
      expect(cached!.files.original).toBe(testFiles.original)
      expect(cached!.files.instrumental).toBe(testFiles.instrumental)
      expect(cached!.files.lyrics).toBe(testFiles.lyrics)
      expect(cached!.files.video).toBe(testFiles.video)
    })

    test('should return null if essential files are missing', async () => {
      // Create test files but missing instrumental
      const testFiles = {
        original: path.join(testCacheDir, 'original.mp3'),
        lyrics: path.join(testCacheDir, 'lyrics.lrc'),
        video: path.join(testCacheDir, 'karaoke.mp4')
      }

      // Create only some files
      fs.writeFileSync(testFiles.original, 'mock content', 'utf8')
      fs.writeFileSync(testFiles.lyrics, 'mock content', 'utf8')
      fs.writeFileSync(testFiles.video, 'mock content', 'utf8')

      // Add to cache
      await CacheManager.addToCache(
        testTitle,
        testArtist,
        testQuality,
        {
          ...testFiles,
          instrumental: path.join(testCacheDir, 'missing-instrumental.wav')
        }
      )

      // Should return null because instrumental file doesn't exist
      const cached = await CacheManager.checkCache(testTitle, testArtist, testQuality)
      expect(cached).toBeNull()
    })
  })

  describe('cache statistics', () => {
    test('should return empty stats initially', () => {
      const stats = CacheManager.getCacheStats()
      
      expect(stats.totalEntries).toBe(0)
      expect(stats.totalSizeMB).toBe(0)
      expect(stats.oldestEntry).toBeNull()
      expect(stats.newestEntry).toBeNull()
    })

    test('should calculate stats correctly after adding entries', async () => {
      // Create test files
      const testFiles = {
        instrumental: path.join(testCacheDir, 'instrumental.wav'),
        video: path.join(testCacheDir, 'karaoke.mp4')
      }

      // Create files with enough content to register in MB calculation (1MB+ each)
      const largeContent = 'a'.repeat(1024 * 1024 + 1) // Just over 1MB
      fs.writeFileSync(testFiles.instrumental, largeContent, 'utf8')
      fs.writeFileSync(testFiles.video, largeContent, 'utf8')

      // Add multiple entries
      await CacheManager.addToCache('Song 1', 'Artist 1', 'high', testFiles)
      await CacheManager.addToCache('Song 2', 'Artist 2', 'high', testFiles)

      const stats = CacheManager.getCacheStats()
      
      expect(stats.totalEntries).toBe(2)
      expect(stats.totalSizeMB).toBeGreaterThan(0)
      expect(stats.oldestEntry).toBeInstanceOf(Date)
      expect(stats.newestEntry).toBeInstanceOf(Date)
      expect(stats.newestEntry!.getTime()).toBeGreaterThanOrEqual(stats.oldestEntry!.getTime())
    })
  })

  describe('cache cleanup', () => {
    test('should list cached songs', async () => {
      // Create test files
      const testFiles = {
        instrumental: path.join(testCacheDir, 'instrumental.wav'),
        video: path.join(testCacheDir, 'karaoke.mp4')
      }

      fs.writeFileSync(testFiles.instrumental, 'mock content for testing file size calculation', 'utf8')
      fs.writeFileSync(testFiles.video, 'mock content for testing file size calculation', 'utf8')

      // Add entries
      await CacheManager.addToCache(testTitle, testArtist, testQuality, testFiles)
      
      const cachedSongs = CacheManager.listCachedSongs()
      
      expect(cachedSongs).toHaveLength(1)
      expect(cachedSongs[0].title).toBe(testTitle)
      expect(cachedSongs[0].artist).toBe(testArtist)
      expect(cachedSongs[0].processingQuality).toBe(testQuality)
      expect(cachedSongs[0].instrumentalPath).toBe(testFiles.instrumental)
      expect(cachedSongs[0].videoPath).toBe(testFiles.video)
    })

    test('should clean up old entries', async () => {
      // Create test files
      const testFiles = {
        instrumental: path.join(testCacheDir, 'instrumental.wav'),
        video: path.join(testCacheDir, 'karaoke.mp4')
      }

      fs.writeFileSync(testFiles.instrumental, 'mock content for testing file size calculation', 'utf8')
      fs.writeFileSync(testFiles.video, 'mock content for testing file size calculation', 'utf8')

      // Add entries
      await CacheManager.addToCache('Song 1', 'Artist 1', 'high', testFiles)
      await CacheManager.addToCache('Song 2', 'Artist 2', 'high', testFiles)
      await CacheManager.addToCache('Song 3', 'Artist 3', 'high', testFiles)

      expect(CacheManager.getCacheStats().totalEntries).toBe(3)

      // Clean up with max 2 entries
      CacheManager.cleanupOldEntries(30, 2)

      // Should have only 2 entries left
      expect(CacheManager.getCacheStats().totalEntries).toBe(2)
    })
  })

  describe('edge cases', () => {
    test('should handle empty file paths gracefully', async () => {
      const cacheKey = await CacheManager.addToCache(
        testTitle,
        testArtist,
        testQuality,
        {}
      )

      expect(cacheKey).toBeDefined()
      
      // Should return null because no essential files
      const cached = await CacheManager.checkCache(testTitle, testArtist, testQuality)
      expect(cached).toBeNull()
    })

    test('should handle special characters in titles/artists', async () => {
      const specialTitle = "Don't Stop Me Now (2011 Remaster)"
      const specialArtist = "Qüéén & David Bowie"
      
      const key1 = CacheManager.generateCacheKey(specialTitle, specialArtist, testQuality)
      const key2 = CacheManager.generateCacheKey(specialTitle, specialArtist, testQuality)
      
      expect(key1).toBe(key2)
      expect(key1).toHaveLength(16)
    })
  })
})