export interface User {
  id: string
  name: string
  avatar?: string
  color: string
}

export interface QueuedSong {
  id: string
  user: User
  songTitle: string
  artist: string
  requestedAt: Date
  status: 'queued' | 'processing' | 'ready' | 'playing' | 'completed' | 'failed'
  processingProgress?: number
  estimatedProcessingTime?: number
  karaoke?: {
    instrumentalUrl: string
    lyricsUrl: string
    videoUrl?: string
  }
}

export interface QueueState {
  currentSong: QueuedSong | null
  upNext: QueuedSong[]
  processing: QueuedSong[]
  completed: QueuedSong[]
}