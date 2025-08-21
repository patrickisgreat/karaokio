import axios from 'axios'
import { LyricLine } from './videoGenerator'

export interface LyricSource {
  source: string
  lyrics: string
  confidence: number
}

export class LyricsProcessor {
  static async fetchLyrics(title: string, artist: string): Promise<string | null> {
    const sources = [
      () => this.fetchFromLyricsOVH(title, artist),
      () => this.fetchFromGenius(title, artist),
      () => this.fetchFromMusixmatch(title, artist)
    ]

    for (const fetchFn of sources) {
      try {
        const lyrics = await fetchFn()
        if (lyrics) return lyrics
      } catch (error) {
        console.warn('Lyrics source failed:', error)
        continue
      }
    }

    return null
  }

  private static async fetchFromLyricsOVH(title: string, artist: string): Promise<string | null> {
    try {
      const response = await axios.get(
        `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
      )
      return response.data.lyrics
    } catch (error) {
      return null
    }
  }

  private static async fetchFromGenius(title: string, artist: string): Promise<string | null> {
    try {
      // Note: Requires Genius API key
      const searchResponse = await axios.get('https://api.genius.com/search', {
        params: { q: `${artist} ${title}` },
        headers: { 'Authorization': `Bearer ${process.env.GENIUS_ACCESS_TOKEN}` }
      })

      const song = searchResponse.data.response.hits[0]?.result
      if (!song) return null

      // Would need to scrape the song page for full lyrics
      // This is a simplified version
      return null
    } catch (error) {
      return null
    }
  }

  private static async fetchFromMusixmatch(title: string, artist: string): Promise<string | null> {
    try {
      // Note: Requires Musixmatch API key
      const response = await axios.get('https://api.musixmatch.com/ws/1.1/matcher.lyrics.get', {
        params: {
          q_track: title,
          q_artist: artist,
          apikey: process.env.MUSIXMATCH_API_KEY
        }
      })

      return response.data.message.body.lyrics?.lyrics_body || null
    } catch (error) {
      return null
    }
  }

  static async synchronizeLyrics(lyrics: string, audioDurationMs: number): Promise<LyricLine[]> {
    const lines = lyrics.split('\n').filter(line => line.trim().length > 0)
    
    if (lines.length === 0) return []

    // Simple time distribution - divide duration evenly
    const timePerLine = audioDurationMs / lines.length
    
    return lines.map((line, index) => ({
      startTime: Math.round(index * timePerLine),
      endTime: Math.round((index + 1) * timePerLine),
      text: line.trim()
    }))
  }

  static async smartSynchronize(
    lyrics: string, 
    audioPath: string,
    onProgress?: (progress: number) => void
  ): Promise<LyricLine[]> {
    // This would use AI/ML to align lyrics with audio
    // For now, using time-based estimation
    
    try {
      // Use QuickLRC API or similar for AI-powered sync
      const response = await axios.post('https://api.quicklrc.com/sync', {
        lyrics: lyrics,
        audioUrl: audioPath // Would need to be publicly accessible
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.QUICKLRC_API_KEY}`
        }
      })

      return response.data.syncedLyrics.map((item: any) => ({
        startTime: item.startTime,
        endTime: item.endTime,
        text: item.text
      }))
    } catch (error) {
      console.warn('AI sync failed, falling back to simple timing:', error)
      
      // Fallback to simple synchronization
      const audioDuration = await this.getAudioDuration(audioPath)
      return this.synchronizeLyrics(lyrics, audioDuration)
    }
  }

  private static async getAudioDuration(audioPath: string): Promise<number> {
    const ffmpeg = require('fluent-ffmpeg')
    
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err: any, metadata: any) => {
        if (err) return reject(err)
        resolve((metadata.format.duration || 0) * 1000)
      })
    })
  }

  static convertToLRC(lyrics: LyricLine[]): string {
    return lyrics.map(line => {
      const minutes = Math.floor(line.startTime / 60000)
      const seconds = Math.floor((line.startTime % 60000) / 1000)
      const centiseconds = Math.floor((line.startTime % 1000) / 10)
      
      return `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}]${line.text}`
    }).join('\n')
  }

  static convertToSRT(lyrics: LyricLine[]): string {
    return lyrics.map((line, index) => {
      const start = this.formatSRTTime(line.startTime)
      const end = this.formatSRTTime(line.endTime)
      
      return `${index + 1}\n${start} --> ${end}\n${line.text}\n`
    }).join('\n')
  }

  private static formatSRTTime(ms: number): string {
    const hours = Math.floor(ms / 3600000)
    const minutes = Math.floor((ms % 3600000) / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    const milliseconds = ms % 1000

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`
  }
}