// Centralized configuration management
// All API keys, tokens, and sensitive config should be stored in environment variables

export interface KaraokeConfig {
  // API Keys (never committed to repo)
  spotifyAccessToken?: string
  geniusAccessToken?: string
  musixmatchApiKey?: string
  quicklrcApiKey?: string
  
  // File paths
  uploadDir: string
  outputDir: string
  tempDir: string
  cacheDir: string
  downloadDir: string
  youtubeVideoDir: string
  
  // Processing settings
  defaultProcessingQuality: 'fast' | 'balanced' | 'high'
  maxFileSize: number // bytes
  maxProcessingTime: number // milliseconds
  enableTorrentDownload: boolean
  enableYouTubeDownload: boolean
  enableCache: boolean
  
  // Torrent settings
  torrentTimeout: number // milliseconds
  minSeeders: number
  maxConcurrentTorrents: number
  
  // YouTube settings
  youtubeTimeout: number // milliseconds
  preferOfficialKaraoke: boolean
  maxVideoQuality: string
  
  // Cache settings
  cacheMaxAgeDays: number
  cacheMaxEntries: number
  cacheMaxSizeGB: number
  
  // Server settings
  port: number
  host: string
  enableCors: boolean
  
  // Security settings
  maxRequestsPerMinute: number
  enableRateLimit: boolean
}

class ConfigManager {
  private static instance: ConfigManager
  private config: KaraokeConfig

  private constructor() {
    this.config = this.loadConfig()
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager()
    }
    return ConfigManager.instance
  }

  private loadConfig(): KaraokeConfig {
    const isDevelopment = process.env.NODE_ENV !== 'production'
    
    return {
      // API Keys from environment
      spotifyAccessToken: process.env.SPOTIFY_ACCESS_TOKEN,
      geniusAccessToken: process.env.GENIUS_ACCESS_TOKEN,
      musixmatchApiKey: process.env.MUSIXMATCH_API_KEY,
      quicklrcApiKey: process.env.QUICKLRC_API_KEY,
      
      // File paths
      uploadDir: process.env.UPLOAD_DIR || './uploads',
      outputDir: process.env.OUTPUT_DIR || './output',
      tempDir: process.env.TEMP_DIR || './temp',
      cacheDir: process.env.CACHE_DIR || './cache',
      downloadDir: process.env.DOWNLOAD_DIR || './downloads',
      youtubeVideoDir: process.env.YOUTUBE_VIDEO_DIR || './youtube_videos',
      
      // Processing settings
      defaultProcessingQuality: (process.env.DEFAULT_QUALITY as any) || 'balanced',
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800'), // 50MB default
      maxProcessingTime: parseInt(process.env.MAX_PROCESSING_TIME || '600000'), // 10 minutes
      enableTorrentDownload: process.env.ENABLE_TORRENT_DOWNLOAD !== 'false',
      enableYouTubeDownload: process.env.ENABLE_YOUTUBE_DOWNLOAD !== 'false',
      enableCache: process.env.ENABLE_CACHE !== 'false',
      
      // Torrent settings
      torrentTimeout: parseInt(process.env.TORRENT_TIMEOUT || '300000'), // 5 minutes
      minSeeders: parseInt(process.env.MIN_SEEDERS || '3'),
      maxConcurrentTorrents: parseInt(process.env.MAX_CONCURRENT_TORRENTS || '3'),
      
      // YouTube settings
      youtubeTimeout: parseInt(process.env.YOUTUBE_TIMEOUT || '120000'), // 2 minutes
      preferOfficialKaraoke: process.env.PREFER_OFFICIAL_KARAOKE !== 'false',
      maxVideoQuality: process.env.MAX_VIDEO_QUALITY || '1080p',
      
      // Cache settings
      cacheMaxAgeDays: parseInt(process.env.CACHE_MAX_AGE_DAYS || '30'),
      cacheMaxEntries: parseInt(process.env.CACHE_MAX_ENTRIES || '100'),
      cacheMaxSizeGB: parseInt(process.env.CACHE_MAX_SIZE_GB || '10'),
      
      // Server settings
      port: parseInt(process.env.PORT || '3000'),
      host: process.env.HOST || 'localhost',
      enableCors: process.env.ENABLE_CORS !== 'false',
      
      // Security settings
      maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '60'),
      enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false'
    }
  }

  get(): KaraokeConfig {
    return { ...this.config } // Return copy to prevent mutation
  }

  getApiKey(service: 'spotify' | 'genius' | 'musixmatch' | 'quicklrc'): string | undefined {
    switch (service) {
      case 'spotify': return this.config.spotifyAccessToken
      case 'genius': return this.config.geniusAccessToken
      case 'musixmatch': return this.config.musixmatchApiKey
      case 'quicklrc': return this.config.quicklrcApiKey
      default: return undefined
    }
  }

  isFeatureEnabled(feature: 'torrent' | 'youtube' | 'cache'): boolean {
    switch (feature) {
      case 'torrent': return this.config.enableTorrentDownload
      case 'youtube': return this.config.enableYouTubeDownload
      case 'cache': return this.config.enableCache
      default: return false
    }
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check required directories exist or can be created
    const requiredDirs = [
      this.config.uploadDir,
      this.config.outputDir,
      this.config.tempDir,
      this.config.cacheDir
    ]

    requiredDirs.forEach(dir => {
      try {
        const fs = require('fs')
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
      } catch (error) {
        errors.push(`Cannot create directory: ${dir}`)
      }
    })

    // Validate numeric ranges
    if (this.config.maxFileSize <= 0) {
      errors.push('maxFileSize must be positive')
    }

    if (this.config.port < 1 || this.config.port > 65535) {
      errors.push('port must be between 1 and 65535')
    }

    if (this.config.minSeeders < 0) {
      errors.push('minSeeders must be non-negative')
    }

    // Warn about missing API keys (not errors, just warnings)
    const missingKeys: string[] = []
    if (!this.config.spotifyAccessToken) missingKeys.push('SPOTIFY_ACCESS_TOKEN')
    if (!this.config.geniusAccessToken) missingKeys.push('GENIUS_ACCESS_TOKEN')
    if (!this.config.musixmatchApiKey) missingKeys.push('MUSIXMATCH_API_KEY')
    if (!this.config.quicklrcApiKey) missingKeys.push('QUICKLRC_API_KEY')

    if (missingKeys.length > 0) {
      console.warn(`⚠️ Missing optional API keys: ${missingKeys.join(', ')}`)
      console.warn('Some features may not work without these keys')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  printConfig(): void {
    const config = this.get()
    
    console.log('\n🎤 Karaokio Configuration:')
    console.log('=' .repeat(40))
    
    // Safe config (no secrets)
    const safeConfig = {
      processingQuality: config.defaultProcessingQuality,
      enableTorrent: config.enableTorrentDownload,
      enableYouTube: config.enableYouTubeDownload,
      enableCache: config.enableCache,
      maxFileSize: `${Math.round(config.maxFileSize / 1024 / 1024)}MB`,
      port: config.port,
      apiKeysConfigured: {
        spotify: !!config.spotifyAccessToken,
        genius: !!config.geniusAccessToken,
        musixmatch: !!config.musixmatchApiKey,
        quicklrc: !!config.quicklrcApiKey
      }
    }
    
    console.table(safeConfig)
    console.log('=' .repeat(40) + '\n')
  }
}

// Export singleton instance
export const config = ConfigManager.getInstance()

// Helper function to ensure directories exist
export function ensureDirectoriesExist(): void {
  const cfg = config.get()
  const fs = require('fs')
  
  const dirs = [
    cfg.uploadDir,
    cfg.outputDir,
    cfg.tempDir,
    cfg.cacheDir,
    cfg.downloadDir,
    cfg.youtubeVideoDir
  ]
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      console.log(`📁 Created directory: ${dir}`)
    }
  })
}