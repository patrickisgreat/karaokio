import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { KaraokeDB } from '@/lib/database'
import { QueuedSong, User } from '@/types/queue'
import fs from 'fs'
import path from 'path'

describe('KaraokeDB', () => {
  const testDbPath = path.join(__dirname, '../temp/test-karaoke.db')
  
  const mockUser: User = {
    id: 'user-123',
    name: 'Test User',
    color: 'bg-blue-500'
  }

  const mockSong: QueuedSong = {
    id: 'song-123',
    user: mockUser,
    songTitle: 'Test Song',
    artist: 'Test Artist',
    requestedAt: new Date(),
    status: 'queued'
  }

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
    
    // Override database path for tests
    process.env.TEST_DB_PATH = testDbPath
    
    // Clear all database tables for clean test isolation
    try {
      const db = require('@/lib/database').default
      db.exec('DELETE FROM songs')
      db.exec('DELETE FROM users')
    } catch (error) {
      // Database might not exist yet
    }
  })

  afterEach(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  describe('User operations', () => {
    test('should add and retrieve user', () => {
      KaraokeDB.addUser(mockUser)
      
      const retrievedUser = KaraokeDB.getUser(mockUser.id)
      
      expect(retrievedUser).not.toBeNull()
      expect(retrievedUser!.id).toBe(mockUser.id)
      expect(retrievedUser!.name).toBe(mockUser.name)
      expect(retrievedUser!.color).toBe(mockUser.color)
    })

    test('should update existing user', () => {
      KaraokeDB.addUser(mockUser)
      
      const updatedUser = {
        ...mockUser,
        name: 'Updated Name',
        color: 'bg-red-500'
      }
      
      KaraokeDB.addUser(updatedUser)
      
      const retrievedUser = KaraokeDB.getUser(mockUser.id)
      expect(retrievedUser!.name).toBe('Updated Name')
      expect(retrievedUser!.color).toBe('bg-red-500')
    })

    test('should return null for non-existent user', () => {
      const user = KaraokeDB.getUser('non-existent-id')
      expect(user).toBeNull()
    })
  })

  describe('Song operations', () => {
    beforeEach(() => {
      // Add user first since songs reference users
      KaraokeDB.addUser(mockUser)
    })

    test('should add and retrieve song', () => {
      const testSong = { ...mockSong, id: 'song-add-retrieve' }
      KaraokeDB.addSong(testSong)
      
      const retrievedSong = KaraokeDB.getSong(testSong.id)
      
      expect(retrievedSong).not.toBeNull()
      expect(retrievedSong!.id).toBe(testSong.id)
      expect(retrievedSong!.songTitle).toBe(testSong.songTitle)
      expect(retrievedSong!.artist).toBe(testSong.artist)
      expect(retrievedSong!.status).toBe(testSong.status)
      expect(retrievedSong!.user.id).toBe(mockUser.id)
    })

    test('should update song status', () => {
      const testSong = { ...mockSong, id: 'song-update-status' }
      KaraokeDB.addSong(testSong)
      
      KaraokeDB.updateSongStatus(testSong.id, 'processing', 50)
      
      const updatedSong = KaraokeDB.getSong(testSong.id)
      expect(updatedSong!.status).toBe('processing')
      expect(updatedSong!.processingProgress).toBe(50)
    })

    test('should update song status without progress', () => {
      KaraokeDB.addSong(mockSong)
      
      KaraokeDB.updateSongStatus(mockSong.id, 'ready')
      
      const updatedSong = KaraokeDB.getSong(mockSong.id)
      expect(updatedSong!.status).toBe('ready')
    })

    test('should update song file paths', () => {
      KaraokeDB.addSong(mockSong)
      
      const paths = {
        original_audio_path: '/path/to/original.mp3',
        instrumental_path: '/path/to/instrumental.wav',
        lyrics_path: '/path/to/lyrics.lrc',
        video_path: '/path/to/karaoke.mp4'
      }
      
      KaraokeDB.updateSongPaths(mockSong.id, paths)
      
      const updatedSong = KaraokeDB.getSong(mockSong.id)
      expect(updatedSong!.karaoke).toBeDefined()
      expect(updatedSong!.karaoke!.instrumentalUrl).toBe(paths.instrumental_path)
      expect(updatedSong!.karaoke!.lyricsUrl).toBe(paths.lyrics_path)
      expect(updatedSong!.karaoke!.videoUrl).toBe(paths.video_path)
    })

    test('should update partial file paths', () => {
      KaraokeDB.addSong(mockSong)
      
      // Update only some paths
      KaraokeDB.updateSongPaths(mockSong.id, {
        instrumental_path: '/path/to/instrumental.wav'
      })
      
      const updatedSong = KaraokeDB.getSong(mockSong.id)
      expect(updatedSong!.karaoke?.instrumentalUrl).toBe('/path/to/instrumental.wav')
      expect(updatedSong!.karaoke?.lyricsUrl).toBeNull()
    })

    test('should remove song', () => {
      KaraokeDB.addSong(mockSong)
      
      expect(KaraokeDB.getSong(mockSong.id)).not.toBeNull()
      
      KaraokeDB.removeSong(mockSong.id)
      
      expect(KaraokeDB.getSong(mockSong.id)).toBeNull()
    })

    test('should return null for non-existent song', () => {
      const song = KaraokeDB.getSong('non-existent-id')
      expect(song).toBeNull()
    })
  })

  describe('Queue operations', () => {
    beforeEach(() => {
      KaraokeDB.addUser(mockUser)
    })

    test('should get empty queue initially', () => {
      const queue = KaraokeDB.getQueue()
      expect(queue).toEqual([])
    })

    test('should get queue with songs', () => {
      const song1 = { ...mockSong, id: 'song-1', status: 'queued' as const }
      const song2 = { ...mockSong, id: 'song-2', status: 'processing' as const }
      const song3 = { ...mockSong, id: 'song-3', status: 'ready' as const }
      const song4 = { ...mockSong, id: 'song-4', status: 'completed' as const } // Should not appear in queue
      
      KaraokeDB.addSong(song1)
      KaraokeDB.addSong(song2)
      KaraokeDB.addSong(song3)
      KaraokeDB.addSong(song4)
      
      const queue = KaraokeDB.getQueue()
      
      expect(queue).toHaveLength(3) // Completed songs not included
      expect(queue.map(s => s.id)).toEqual(['song-1', 'song-2', 'song-3'])
    })

    test('should get queue ordered by request time', () => {
      const now = new Date()
      const song1 = { 
        ...mockSong, 
        id: 'song-1', 
        requestedAt: new Date(now.getTime() + 10000) // Later (10 seconds)
      }
      const song2 = { 
        ...mockSong, 
        id: 'song-2', 
        requestedAt: new Date(now.getTime() - 10000) // Earlier (10 seconds ago)
      }
      
      KaraokeDB.addSong(song1)
      KaraokeDB.addSong(song2)
      
      const queue = KaraokeDB.getQueue()
      
      // Should be ordered by request time (earliest first)
      expect(queue[0].id).toBe('song-2')
      expect(queue[1].id).toBe('song-1')
    })

    test('should get current playing song', () => {
      KaraokeDB.addSong(mockSong)
      KaraokeDB.updateSongStatus(mockSong.id, 'playing')
      
      const currentSong = KaraokeDB.getCurrentSong()
      
      expect(currentSong).not.toBeNull()
      expect(currentSong!.id).toBe(mockSong.id)
      expect(currentSong!.status).toBe('playing')
    })

    test('should return null when no song is playing', () => {
      KaraokeDB.addSong(mockSong) // Status is 'queued' by default
      
      const currentSong = KaraokeDB.getCurrentSong()
      
      expect(currentSong).toBeNull()
    })

    test('should handle multiple songs but only one playing', () => {
      const song1 = { ...mockSong, id: 'song-1', status: 'ready' as const }
      const song2 = { ...mockSong, id: 'song-2', status: 'playing' as const }
      const song3 = { ...mockSong, id: 'song-3', status: 'queued' as const }
      
      KaraokeDB.addSong(song1)
      KaraokeDB.addSong(song2)
      KaraokeDB.addSong(song3)
      
      const currentSong = KaraokeDB.getCurrentSong()
      
      expect(currentSong!.id).toBe('song-2')
    })
  })

  describe('Complex scenarios', () => {
    test('should handle complete karaoke workflow', () => {
      // 1. Add user and song
      KaraokeDB.addUser(mockUser)
      KaraokeDB.addSong(mockSong)
      
      // 2. Start processing
      KaraokeDB.updateSongStatus(mockSong.id, 'processing', 0)
      expect(KaraokeDB.getSong(mockSong.id)!.status).toBe('processing')
      
      // 3. Update progress
      KaraokeDB.updateSongStatus(mockSong.id, 'processing', 50)
      expect(KaraokeDB.getSong(mockSong.id)!.processingProgress).toBe(50)
      
      // 4. Add file paths as processing completes
      KaraokeDB.updateSongPaths(mockSong.id, {
        original_audio_path: '/audio/original.mp3',
        instrumental_path: '/audio/instrumental.wav'
      })
      
      // 5. Mark as ready
      KaraokeDB.updateSongStatus(mockSong.id, 'ready', 100)
      
      // 6. Start playing
      KaraokeDB.updateSongStatus(mockSong.id, 'playing')
      expect(KaraokeDB.getCurrentSong()!.id).toBe(mockSong.id)
      
      // 7. Complete song
      KaraokeDB.updateSongStatus(mockSong.id, 'completed')
      expect(KaraokeDB.getCurrentSong()).toBeNull()
      expect(KaraokeDB.getQueue()).toHaveLength(0) // Completed songs not in queue
    })

    test('should handle multiple users and songs', () => {
      const user1 = { ...mockUser, id: 'user-1', name: 'Alice' }
      const user2 = { ...mockUser, id: 'user-2', name: 'Bob' }
      
      const song1 = { ...mockSong, id: 'song-1', user: user1, songTitle: 'Song A' }
      const song2 = { ...mockSong, id: 'song-2', user: user2, songTitle: 'Song B' }
      const song3 = { ...mockSong, id: 'song-3', user: user1, songTitle: 'Song C' }
      
      KaraokeDB.addUser(user1)
      KaraokeDB.addUser(user2)
      KaraokeDB.addSong(song1)
      KaraokeDB.addSong(song2)
      KaraokeDB.addSong(song3)
      
      const queue = KaraokeDB.getQueue()
      
      expect(queue).toHaveLength(3)
      expect(queue.map(s => s.user.name)).toEqual(['Alice', 'Bob', 'Alice'])
      expect(queue.map(s => s.songTitle)).toEqual(['Song A', 'Song B', 'Song C'])
    })

    test('should handle edge case with empty or null values', () => {
      KaraokeDB.addUser(mockUser)
      KaraokeDB.addSong(mockSong)
      
      // Try to update with empty paths
      KaraokeDB.updateSongPaths(mockSong.id, {})
      
      // Song should still exist and be unchanged
      const song = KaraokeDB.getSong(mockSong.id)
      expect(song).not.toBeNull()
      expect(song!.karaoke).toBeUndefined()
    })
  })
})