import Database from 'better-sqlite3'
import { QueuedSong, User } from '@/types/queue'
import path from 'path'

const dbPath = path.join(process.cwd(), 'karaoke.db')
const db = new Database(dbPath)

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS songs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    song_title TEXT NOT NULL,
    artist TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    processing_progress INTEGER DEFAULT 0,
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    original_audio_path TEXT,
    instrumental_path TEXT,
    lyrics_path TEXT,
    video_path TEXT,
    search_query TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS queue_state (
    id INTEGER PRIMARY KEY,
    current_song_id TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

export class KaraokeDB {
  static addUser(user: User) {
    const stmt = db.prepare('INSERT OR REPLACE INTO users (id, name, color) VALUES (?, ?, ?)')
    stmt.run(user.id, user.name, user.color)
  }

  static getUser(id: string): User | null {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?')
    const row = stmt.get(id) as any
    return row ? { id: row.id, name: row.name, color: row.color } : null
  }

  static addSong(song: QueuedSong) {
    const stmt = db.prepare(`
      INSERT INTO songs (id, user_id, song_title, artist, search_query, status, requested_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(song.id, song.user.id, song.songTitle, song.artist, 
             `${song.songTitle} ${song.artist}`, song.status, song.requestedAt.toISOString())
  }

  static updateSongStatus(id: string, status: QueuedSong['status'], progress?: number) {
    let stmt
    if (progress !== undefined) {
      stmt = db.prepare('UPDATE songs SET status = ?, processing_progress = ? WHERE id = ?')
      stmt.run(status, progress, id)
    } else {
      stmt = db.prepare('UPDATE songs SET status = ? WHERE id = ?')
      stmt.run(status, id)
    }
  }

  static updateSongPaths(id: string, paths: Partial<{
    original_audio_path: string
    instrumental_path: string
    lyrics_path: string
    video_path: string
  }>) {
    const updates: string[] = []
    const values: any[] = []
    
    Object.entries(paths).forEach(([key, value]) => {
      if (value) {
        updates.push(`${key} = ?`)
        values.push(value)
      }
    })
    
    if (updates.length > 0) {
      values.push(id)
      const stmt = db.prepare(`UPDATE songs SET ${updates.join(', ')} WHERE id = ?`)
      stmt.run(...values)
    }
  }

  static getQueue(): QueuedSong[] {
    const stmt = db.prepare(`
      SELECT s.*, u.name as user_name, u.color as user_color
      FROM songs s
      JOIN users u ON s.user_id = u.id
      WHERE s.status IN ('queued', 'processing', 'ready', 'playing')
      ORDER BY s.requested_at ASC
    `)
    
    const rows = stmt.all() as any[]
    return rows.map(row => ({
      id: row.id,
      user: { id: row.user_id, name: row.user_name, color: row.user_color },
      songTitle: row.song_title,
      artist: row.artist,
      requestedAt: new Date(row.requested_at),
      status: row.status,
      processingProgress: row.processing_progress,
      karaoke: row.instrumental_path ? {
        instrumentalUrl: row.instrumental_path,
        lyricsUrl: row.lyrics_path,
        videoUrl: row.video_path
      } : undefined
    }))
  }

  static getCurrentSong(): QueuedSong | null {
    const stmt = db.prepare(`
      SELECT s.*, u.name as user_name, u.color as user_color
      FROM songs s
      JOIN users u ON s.user_id = u.id
      WHERE s.status = 'playing'
      LIMIT 1
    `)
    
    const row = stmt.get() as any
    if (!row) return null
    
    return {
      id: row.id,
      user: { id: row.user_id, name: row.user_name, color: row.user_color },
      songTitle: row.song_title,
      artist: row.artist,
      requestedAt: new Date(row.requested_at),
      status: row.status,
      processingProgress: row.processing_progress,
      karaoke: row.instrumental_path ? {
        instrumentalUrl: row.instrumental_path,
        lyricsUrl: row.lyrics_path,
        videoUrl: row.video_path
      } : undefined
    }
  }

  static removeSong(id: string) {
    const stmt = db.prepare('DELETE FROM songs WHERE id = ?')
    stmt.run(id)
  }

  static getSong(id: string): QueuedSong | null {
    const stmt = db.prepare(`
      SELECT s.*, u.name as user_name, u.color as user_color
      FROM songs s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `)
    
    const row = stmt.get(id) as any
    if (!row) return null
    
    return {
      id: row.id,
      user: { id: row.user_id, name: row.user_name, color: row.user_color },
      songTitle: row.song_title,
      artist: row.artist,
      requestedAt: new Date(row.requested_at),
      status: row.status,
      processingProgress: row.processing_progress,
      karaoke: row.instrumental_path ? {
        instrumentalUrl: row.instrumental_path,
        lyricsUrl: row.lyrics_path,
        videoUrl: row.video_path
      } : undefined
    }
  }
}

export default db