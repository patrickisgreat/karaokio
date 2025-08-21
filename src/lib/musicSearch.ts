import axios from 'axios'

export interface SearchResult {
  title: string
  artist: string
  album?: string
  duration?: number
  spotifyId?: string
  musicbrainzId?: string
  previewUrl?: string
}

export class MusicSearch {
  static async searchSpotify(query: string): Promise<SearchResult[]> {
    try {
      // Note: In production, you'd need Spotify API credentials
      const response = await axios.get('https://api.spotify.com/v1/search', {
        params: {
          q: query,
          type: 'track',
          limit: 10
        },
        headers: {
          'Authorization': `Bearer ${process.env.SPOTIFY_ACCESS_TOKEN}`
        }
      })

      return response.data.tracks.items.map((track: any) => ({
        title: track.name,
        artist: track.artists[0].name,
        album: track.album.name,
        duration: track.duration_ms,
        spotifyId: track.id,
        previewUrl: track.preview_url
      }))
    } catch (error) {
      console.error('Spotify search failed:', error)
      return []
    }
  }

  static async searchMusicBrainz(query: string): Promise<SearchResult[]> {
    try {
      const response = await axios.get('https://musicbrainz.org/ws/2/recording', {
        params: {
          query: query,
          fmt: 'json',
          limit: 10
        }
      })

      return response.data.recordings.map((recording: any) => ({
        title: recording.title,
        artist: recording['artist-credit'][0].artist.name,
        duration: recording.length,
        musicbrainzId: recording.id
      }))
    } catch (error) {
      console.error('MusicBrainz search failed:', error)
      return []
    }
  }

  static async searchAll(query: string): Promise<SearchResult[]> {
    const [spotifyResults, musicBrainzResults] = await Promise.allSettled([
      this.searchSpotify(query),
      this.searchMusicBrainz(query)
    ])

    const results: SearchResult[] = []
    
    if (spotifyResults.status === 'fulfilled') {
      results.push(...spotifyResults.value)
    }
    
    if (musicBrainzResults.status === 'fulfilled') {
      results.push(...musicBrainzResults.value)
    }

    // Deduplicate by title + artist
    const seen = new Set()
    return results.filter(result => {
      const key = `${result.title.toLowerCase()}-${result.artist.toLowerCase()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  static async fetchLyrics(title: string, artist: string): Promise<string | null> {
    try {
      // Using a lyrics API like Genius, Musixmatch, or LyricFind
      const response = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`)
      return response.data.lyrics
    } catch (error) {
      console.error('Lyrics fetch failed:', error)
      return null
    }
  }
}