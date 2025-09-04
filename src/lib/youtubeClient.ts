import youtubedl from 'youtube-dl-exec'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

export interface YouTubeVideo {
  id: string
  title: string
  duration: number
  url: string
  thumbnail: string
  uploader: string
}

export interface KaraokeSearchResult {
  video: YouTubeVideo
  relevanceScore: number
  isLyricVideo: boolean
  isOfficialKaraoke: boolean
}

export class YouTubeClient {
  private static readonly DOWNLOAD_DIR = path.join(process.cwd(), 'youtube_videos')
  private static readonly MAX_DURATION = 600 // 10 minutes max

  static {
    // Ensure download directory exists
    if (!fs.existsSync(this.DOWNLOAD_DIR)) {
      fs.mkdirSync(this.DOWNLOAD_DIR, { recursive: true })
    }
  }

  static async searchKaraokeVideos(
    title: string, 
    artist: string,
    limit: number = 10
  ): Promise<KaraokeSearchResult[]> {
    const searchQueries = [
      `${artist} ${title} karaoke`,
      `${title} ${artist} karaoke`,
      `${artist} - ${title} karaoke`,
      `${title} karaoke lyrics`,
      `${artist} ${title} instrumental karaoke`,
      `${title} sing along karaoke`
    ]

    const allResults: KaraokeSearchResult[] = []

    for (const query of searchQueries) {
      try {
        console.log(`Searching YouTube for: ${query}`)
        
        const searchResults = await youtubedl(
          `ytsearch${limit}:${query}`,
          {
            dumpJson: true,
            noWarnings: true
          }
        )

        // Handle both single result and array
        const videos = Array.isArray(searchResults) ? searchResults : [searchResults]

        const karaokeResults = videos
          .filter((video: any) => {
            if (!video || !video.title) return false
            
            const titleLower = video.title.toLowerCase()
            const artistLower = artist.toLowerCase()
            const songLower = title.toLowerCase()
            
            // Must contain the song/artist and karaoke-related terms
            const hasArtistOrSong = titleLower.includes(artistLower) || titleLower.includes(songLower)
            const hasKaraokeTerms = titleLower.includes('karaoke') || 
                                  titleLower.includes('instrumental') || 
                                  titleLower.includes('lyrics') ||
                                  titleLower.includes('sing along') ||
                                  titleLower.includes('backing track')
            
            return hasArtistOrSong && hasKaraokeTerms
          })
          .map((video: any) => this.scoreKaraokeRelevance(video, title, artist))
          .filter((result: KaraokeSearchResult) => result.relevanceScore > 0.3)

        allResults.push(...karaokeResults)
      } catch (error) {
        console.warn(`YouTube search failed for query: ${query}`, error)
        continue
      }
    }

    // Remove duplicates and sort by relevance
    const uniqueResults = this.removeDuplicates(allResults)
    return uniqueResults
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit)
  }

  private static scoreKaraokeRelevance(
    video: any, 
    title: string, 
    artist: string
  ): KaraokeSearchResult {
    const titleLower = video.title.toLowerCase()
    const artistLower = artist.toLowerCase()
    const songLower = title.toLowerCase()
    
    let score = 0
    let isLyricVideo = false
    let isOfficialKaraoke = false

    // Base score for having artist and song
    if (titleLower.includes(artistLower)) score += 0.3
    if (titleLower.includes(songLower)) score += 0.3

    // Karaoke quality indicators
    if (titleLower.includes('karaoke')) {
      score += 0.4
      if (titleLower.includes('official')) {
        score += 0.2
        isOfficialKaraoke = true
      }
    }

    if (titleLower.includes('instrumental')) score += 0.3
    if (titleLower.includes('backing track')) score += 0.25
    if (titleLower.includes('sing along')) score += 0.2
    
    if (titleLower.includes('lyrics')) {
      score += 0.15
      isLyricVideo = true
    }

    // Penalty for covers or live versions (we want original karaoke)
    if (titleLower.includes('cover')) score -= 0.2
    if (titleLower.includes('live')) score -= 0.15
    if (titleLower.includes('acoustic')) score -= 0.1

    // Bonus for HD quality
    if (titleLower.includes('hd') || titleLower.includes('1080p')) score += 0.1

    return {
      video: {
        id: video.id,
        title: video.title,
        duration: video.duration || 0,
        url: `https://youtube.com/watch?v=${video.id}`,
        thumbnail: video.thumbnail || '',
        uploader: video.uploader || ''
      },
      relevanceScore: Math.min(score, 1.0),
      isLyricVideo,
      isOfficialKaraoke
    }
  }

  static async downloadKaraokeVideo(
    videoUrl: string,
    title: string,
    artist: string,
    onProgress?: (progress: number) => void
  ): Promise<string | null> {
    try {
      // Generate unique filename
      const hash = crypto.createHash('md5')
        .update(`${artist}_${title}`)
        .digest('hex')
        .substring(0, 8)
      
      const filename = `${artist.replace(/[^a-z0-9]/gi, '_')}_${title.replace(/[^a-z0-9]/gi, '_')}_${hash}.%(ext)s`
      const outputTemplate = path.join(this.DOWNLOAD_DIR, filename)

      console.log(`Downloading karaoke video: ${videoUrl}`)

      // Download with progress tracking
      const result = await youtubedl(videoUrl, {
        format: 'best[height<=1080][ext=mp4]/best[ext=mp4]/best',
        output: outputTemplate,
        writeInfoJson: true,
        noWarnings: true
      })

      // Find the downloaded file
      const baseFilename = filename.replace('.%(ext)s', '')
      const possibleExtensions = ['.mp4', '.webm', '.mkv']
      
      for (const ext of possibleExtensions) {
        const fullPath = path.join(this.DOWNLOAD_DIR, baseFilename + ext)
        if (fs.existsSync(fullPath)) {
          console.log(`Video downloaded: ${fullPath}`)
          return fullPath
        }
      }

      throw new Error('Downloaded file not found')
      
    } catch (error) {
      console.error('YouTube download failed:', error)
      return null
    }
  }

  static async getBestKaraokeVideo(
    title: string, 
    artist: string
  ): Promise<{ video: YouTubeVideo; filePath: string } | null> {
    try {
      // Search for karaoke videos
      const results = await this.searchKaraokeVideos(title, artist, 5)
      
      if (results.length === 0) {
        console.warn(`No karaoke videos found for: ${artist} - ${title}`)
        return null
      }

      // Try downloading the best matches
      for (const result of results) {
        console.log(`Trying to download: ${result.video.title} (score: ${result.relevanceScore})`)
        
        const filePath = await this.downloadKaraokeVideo(
          result.video.url,
          title,
          artist
        )
        
        if (filePath && fs.existsSync(filePath)) {
          return {
            video: result.video,
            filePath
          }
        }
      }

      return null
    } catch (error) {
      console.error('Failed to get karaoke video:', error)
      return null
    }
  }

  private static removeDuplicates(results: KaraokeSearchResult[]): KaraokeSearchResult[] {
    const seen = new Set<string>()
    return results.filter(result => {
      const key = result.video.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  static getDownloadedVideos(): string[] {
    if (!fs.existsSync(this.DOWNLOAD_DIR)) {
      return []
    }
    
    return fs.readdirSync(this.DOWNLOAD_DIR)
      .filter(file => /\.(mp4|webm|mkv)$/i.test(file))
      .map(file => path.join(this.DOWNLOAD_DIR, file))
  }

  static cleanup(keepFiles: string[] = []) {
    if (!fs.existsSync(this.DOWNLOAD_DIR)) return

    const allFiles = fs.readdirSync(this.DOWNLOAD_DIR)
    
    allFiles.forEach(file => {
      const fullPath = path.join(this.DOWNLOAD_DIR, file)
      if (!keepFiles.includes(fullPath)) {
        try {
          fs.unlinkSync(fullPath)
          console.log(`Cleaned up: ${file}`)
        } catch (error) {
          console.warn(`Failed to delete ${file}:`, error)
        }
      }
    })
  }
}