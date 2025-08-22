import WebTorrent from 'webtorrent'
import TorrentSearchApi from 'torrent-search-api'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

export interface TorrentResult {
  title: string
  size: string
  seeders: number
  magnet: string
  provider: string
}

export class TorrentClient {
  private static client: WebTorrent.Instance | null = null
  private static readonly DOWNLOAD_DIR = path.join(process.cwd(), 'downloads')

  static {
    // Ensure download directory exists
    if (!fs.existsSync(this.DOWNLOAD_DIR)) {
      fs.mkdirSync(this.DOWNLOAD_DIR, { recursive: true })
    }

    // Enable torrent search providers
    TorrentSearchApi.enableProvider('1337x')
    TorrentSearchApi.enableProvider('ThePirateBay')
    TorrentSearchApi.enableProvider('Torlock')
    TorrentSearchApi.enableProvider('TorrentGalaxy')
  }

  private static getClient(): WebTorrent.Instance {
    if (!this.client) {
      this.client = new WebTorrent()
    }
    return this.client
  }

  static async searchTorrents(query: string, limit: number = 10): Promise<TorrentResult[]> {
    try {
      console.log(`Searching torrents for: ${query}`)
      
      const results = await TorrentSearchApi.search(query, 'Audio', limit)
      
      return results.map((result: any) => ({
        title: result.title,
        size: result.size,
        seeders: result.seeds || 0,
        magnet: result.magnet,
        provider: result.provider
      }))
    } catch (error) {
      console.error('Torrent search failed:', error)
      return []
    }
  }

  static async downloadAudio(
    magnet: string, 
    targetTitle: string,
    onProgress?: (progress: number) => void
  ): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const client = this.getClient()
      
      console.log(`Starting torrent download: ${targetTitle}`)
      
      client.add(magnet, { path: this.DOWNLOAD_DIR }, (torrent) => {
        console.log(`Torrent added: ${torrent.name}`)
        
        // Find audio files in the torrent
        const audioFiles = torrent.files.filter(file => 
          /\.(mp3|wav|flac|m4a|aac|ogg)$/i.test(file.name)
        )
        
        if (audioFiles.length === 0) {
          torrent.destroy()
          return reject(new Error('No audio files found in torrent'))
        }

        // Pick the largest audio file (usually the best quality)
        const mainAudioFile = audioFiles.reduce((largest, file) => 
          file.length > largest.length ? file : largest
        )

        console.log(`Selected audio file: ${mainAudioFile.name} (${(mainAudioFile.length / 1024 / 1024).toFixed(1)}MB)`)

        // Generate unique filename
        const hash = crypto.createHash('md5').update(targetTitle).digest('hex').substring(0, 8)
        const extension = path.extname(mainAudioFile.name)
        const outputFilename = `${targetTitle.replace(/[^a-z0-9]/gi, '_')}_${hash}${extension}`
        const outputPath = path.join(this.DOWNLOAD_DIR, outputFilename)

        // Track download progress
        const progressInterval = setInterval(() => {
          const progress = Math.round((torrent.downloaded / torrent.length) * 100)
          onProgress?.(progress)
          
          if (progress >= 100) {
            clearInterval(progressInterval)
          }
        }, 1000)

        // Start downloading the specific file
        const stream = mainAudioFile.createReadStream()
        const writeStream = fs.createWriteStream(outputPath)
        
        stream.pipe(writeStream)
        
        writeStream.on('finish', () => {
          clearInterval(progressInterval)
          console.log(`Download complete: ${outputPath}`)
          
          // Clean up torrent
          torrent.destroy()
          
          resolve(outputPath)
        })

        writeStream.on('error', (error) => {
          clearInterval(progressInterval)
          torrent.destroy()
          reject(error)
        })

        // Timeout after 10 minutes
        setTimeout(() => {
          clearInterval(progressInterval)
          torrent.destroy()
          reject(new Error('Download timeout'))
        }, 10 * 60 * 1000)
      })
    })
  }

  static async findBestMatch(
    title: string, 
    artist: string,
    minSeeders: number = 5
  ): Promise<TorrentResult | null> {
    const queries = [
      `${artist} ${title}`,
      `${title} ${artist}`,
      `${artist} - ${title}`,
      title
    ]

    for (const query of queries) {
      const results = await this.searchTorrents(query, 20)
      
      // Filter and sort by quality
      const goodResults = results
        .filter(result => result.seeders >= minSeeders)
        .filter(result => {
          const titleLower = result.title.toLowerCase()
          const artistLower = artist.toLowerCase()
          const songLower = title.toLowerCase()
          
          return titleLower.includes(artistLower) && titleLower.includes(songLower)
        })
        .sort((a, b) => b.seeders - a.seeders) // Sort by seeders desc

      if (goodResults.length > 0) {
        console.log(`Found ${goodResults.length} good matches for: ${query}`)
        return goodResults[0]
      }
    }

    console.warn(`No good torrent matches found for: ${artist} - ${title}`)
    return null
  }

  static cleanup() {
    if (this.client) {
      this.client.destroy()
      this.client = null
    }
  }

  static getDownloadedFiles(): string[] {
    if (!fs.existsSync(this.DOWNLOAD_DIR)) {
      return []
    }
    
    return fs.readdirSync(this.DOWNLOAD_DIR)
      .filter(file => /\.(mp3|wav|flac|m4a|aac|ogg)$/i.test(file))
      .map(file => path.join(this.DOWNLOAD_DIR, file))
  }
}