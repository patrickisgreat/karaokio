import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import db from './database'

export interface CacheEntry {
  id: number
  cacheKey: string
  title: string
  artist: string
  originalAudioPath?: string
  instrumentalPath?: string
  lyricsPath?: string
  videoPath?: string
  youtubeVideoId?: string
  processingQuality: string
  createdAt: Date
  lastAccessed: Date
  fileSize: number
}

export interface ProcessedSong {
  cacheKey: string
  files: {
    original?: string
    instrumental?: string
    lyrics?: string
    video?: string
  }
  metadata: {
    title: string
    artist: string
    quality: string
    youtubeVideoId?: string
  }
}

export class CacheManager {
  private static readonly CACHE_DIR = path.join(process.cwd(), 'cache')

  static {
    // Ensure cache directory exists
    if (!fs.existsSync(this.CACHE_DIR)) {
      fs.mkdirSync(this.CACHE_DIR, { recursive: true })
    }

    // Initialize cache table
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS processed_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cache_key TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          artist TEXT NOT NULL,
          original_audio_path TEXT,
          instrumental_path TEXT,
          lyrics_path TEXT,
          video_path TEXT,
          youtube_video_id TEXT,
          processing_quality TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
          file_size INTEGER DEFAULT 0
        );
      `)
    } catch (error) {
      // Cache table might already exist
    }

    // Try to add new columns to existing songs table (ignore errors if they exist)
    try { db.exec('ALTER TABLE songs ADD COLUMN cache_key TEXT'); } catch {}
    try { db.exec('ALTER TABLE songs ADD COLUMN torrent_magnet TEXT'); } catch {}
    try { db.exec('ALTER TABLE songs ADD COLUMN youtube_video_id TEXT'); } catch {}
    try { db.exec('ALTER TABLE songs ADD COLUMN processing_method TEXT'); } catch {}
  }

  static generateCacheKey(title: string, artist: string, quality: string): string {
    const normalized = `${title.toLowerCase().trim()}_${artist.toLowerCase().trim()}_${quality}`
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16)
  }

  static async checkCache(title: string, artist: string, quality: string): Promise<ProcessedSong | null> {
    const cacheKey = this.generateCacheKey(title, artist, quality)
    
    const stmt = db.prepare(`
      SELECT * FROM processed_cache 
      WHERE cache_key = ?
    `)
    
    const row = stmt.get(cacheKey) as any
    if (!row) return null

    // Update last accessed time
    this.updateLastAccessed(cacheKey)

    // Verify files still exist
    const files: ProcessedSong['files'] = {}
    
    if (row.original_audio_path && fs.existsSync(row.original_audio_path)) {
      files.original = row.original_audio_path
    }
    if (row.instrumental_path && fs.existsSync(row.instrumental_path)) {
      files.instrumental = row.instrumental_path
    }
    if (row.lyrics_path && fs.existsSync(row.lyrics_path)) {
      files.lyrics = row.lyrics_path
    }
    if (row.video_path && fs.existsSync(row.video_path)) {
      files.video = row.video_path
    }

    // If key files are missing, remove from cache
    if (!files.instrumental || !files.video) {
      console.warn(`Cache entry ${cacheKey} has missing files, removing from cache`)
      this.removeFromCache(cacheKey)
      return null
    }

    console.log(`Cache hit for: ${artist} - ${title} (${quality})`)
    
    return {
      cacheKey,
      files,
      metadata: {
        title: row.title,
        artist: row.artist,
        quality: row.processing_quality,
        youtubeVideoId: row.youtube_video_id
      }
    }
  }

  static async addToCache(
    title: string,
    artist: string,
    quality: string,
    files: ProcessedSong['files'],
    youtubeVideoId?: string
  ): Promise<string> {
    const cacheKey = this.generateCacheKey(title, artist, quality)

    // Calculate total file size
    let totalSize = 0
    Object.values(files).forEach((filePath: string | undefined) => {
      if (filePath && fs.existsSync(filePath)) {
        totalSize += fs.statSync(filePath).size
      }
    })

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO processed_cache (
        cache_key, title, artist, original_audio_path, instrumental_path,
        lyrics_path, video_path, youtube_video_id, processing_quality, file_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      cacheKey,
      title,
      artist,
      files.original || null,
      files.instrumental || null,
      files.lyrics || null,
      files.video || null,
      youtubeVideoId || null,
      quality,
      totalSize
    )

    console.log(`Added to cache: ${artist} - ${title} (${quality}) [${(totalSize / 1024 / 1024).toFixed(1)}MB]`)
    
    return cacheKey
  }

  private static updateLastAccessed(cacheKey: string) {
    const stmt = db.prepare('UPDATE processed_cache SET last_accessed = CURRENT_TIMESTAMP WHERE cache_key = ?')
    stmt.run(cacheKey)
  }

  static removeFromCache(cacheKey: string) {
    const stmt = db.prepare('DELETE FROM processed_cache WHERE cache_key = ?')
    stmt.run(cacheKey)
  }

  static getCacheStats(): {
    totalEntries: number
    totalSizeMB: number
    oldestEntry: Date | null
    newestEntry: Date | null
  } {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as count,
        SUM(file_size) as total_size,
        MIN(created_at) as oldest,
        MAX(created_at) as newest
      FROM processed_cache
    `)
    
    const row = stmt.get() as any
    
    return {
      totalEntries: row.count || 0,
      totalSizeMB: Math.round((row.total_size || 0) / 1024 / 1024),
      oldestEntry: row.oldest ? new Date(row.oldest) : null,
      newestEntry: row.newest ? new Date(row.newest) : null
    }
  }

  static cleanupOldEntries(maxAgeDays: number = 30, maxEntries: number = 100) {
    console.log(`Cleaning up cache entries older than ${maxAgeDays} days or exceeding ${maxEntries} entries...`)

    // Get entries to remove (old or excess)
    const stmt = db.prepare(`
      SELECT cache_key, original_audio_path, instrumental_path, lyrics_path, video_path
      FROM processed_cache
      WHERE 
        last_accessed < datetime('now', '-${maxAgeDays} days')
        OR id NOT IN (
          SELECT id FROM processed_cache 
          ORDER BY last_accessed DESC 
          LIMIT ${maxEntries}
        )
    `)

    const entriesToRemove = stmt.all() as any[]
    
    entriesToRemove.forEach(entry => {
      // Remove files
      [entry.original_audio_path, entry.instrumental_path, entry.lyrics_path, entry.video_path]
        .filter(Boolean)
        .forEach(filePath => {
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath)
              console.log(`Deleted cached file: ${path.basename(filePath)}`)
            }
          } catch (error) {
            console.warn(`Failed to delete cached file ${filePath}:`, error)
          }
        })

      // Remove from database
      this.removeFromCache(entry.cache_key)
    })

    console.log(`Cleaned up ${entriesToRemove.length} cache entries`)
  }

  static listCachedSongs(): CacheEntry[] {
    const stmt = db.prepare(`
      SELECT * FROM processed_cache
      ORDER BY last_accessed DESC
    `)
    
    const rows = stmt.all() as any[]
    
    return rows.map(row => ({
      id: row.id,
      cacheKey: row.cache_key,
      title: row.title,
      artist: row.artist,
      originalAudioPath: row.original_audio_path,
      instrumentalPath: row.instrumental_path,
      lyricsPath: row.lyrics_path,
      videoPath: row.video_path,
      youtubeVideoId: row.youtube_video_id,
      processingQuality: row.processing_quality,
      createdAt: new Date(row.created_at),
      lastAccessed: new Date(row.last_accessed),
      fileSize: row.file_size
    }))
  }

  static async preloadPopularSongs(songList: Array<{title: string, artist: string}>) {
    console.log(`Preloading ${songList.length} popular songs...`)
    
    const { processAudio } = await import('./jobProcessor')
    
    for (const song of songList) {
      const cacheKey = this.generateCacheKey(song.title, song.artist, 'high')
      const cached = await this.checkCache(song.title, song.artist, 'high')
      
      if (!cached) {
        console.log(`Preloading: ${song.artist} - ${song.title}`)
        // This would trigger the full processing pipeline
        // Implementation depends on your job queue system
      } else {
        console.log(`Already cached: ${song.artist} - ${song.title}`)
      }
    }
  }
}