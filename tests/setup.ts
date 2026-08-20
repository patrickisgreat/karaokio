import { beforeAll, afterAll, afterEach } from '@jest/globals'
import fs from 'fs'
import path from 'path'

// Everything below runs at module load, BEFORE any test file's imports are
// evaluated. That matters: database.ts and the *Client classes read these env
// vars in static initializers at import time, so setting them in beforeAll
// would be too late.
//
// Each jest worker gets its own sandbox (own DB file, own dirs) so parallel
// suites can't interfere with each other — or with the real karaoke.db.
const WORKER_ID = process.env.JEST_WORKER_ID || '0'
const WORKER_ROOT = path.join(__dirname, `.worker-${WORKER_ID}`)

const TEST_DB_PATH = path.join(WORKER_ROOT, 'test-karaoke.db')

const TEST_DIRS = {
  UPLOAD_DIR: path.join(WORKER_ROOT, 'uploads'),
  OUTPUT_DIR: path.join(WORKER_ROOT, 'output'),
  TEMP_DIR: path.join(WORKER_ROOT, 'temp'),
  CACHE_DIR: path.join(WORKER_ROOT, 'cache'),
  DOWNLOAD_DIR: path.join(WORKER_ROOT, 'downloads'),
  YOUTUBE_VIDEO_DIR: path.join(WORKER_ROOT, 'youtube_videos')
}

process.env.KARAOKE_DB_PATH = TEST_DB_PATH
Object.entries(TEST_DIRS).forEach(([envVar, dir]) => {
  process.env[envVar] = dir
  fs.mkdirSync(dir, { recursive: true })
})

// Disable external services in tests
process.env.ENABLE_TORRENT_DOWNLOAD = 'false'
process.env.ENABLE_YOUTUBE_DOWNLOAD = 'false'

beforeAll(() => {
  if (!process.env.NODE_ENV) {
    (process.env as any).NODE_ENV = 'test'
  }
})

afterEach(() => {
  // Clean up test files after each test (directories themselves stay for the
  // next suite in this worker)
  Object.values(TEST_DIRS).forEach(dir => {
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file)
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath)
        }
      })
    }
  })
})

afterAll(() => {
  // better-sqlite3 keeps the node process alive until the connection is
  // closed; without this, jest force-exits with a leaked-handle warning.
  try {
    const db = require('@/lib/database').default
    db.close()
  } catch {
    // this suite never opened the database
  }

  try {
    fs.rmSync(WORKER_ROOT, { recursive: true, force: true })
  } catch (error) {
    console.warn('Test cleanup warning:', error)
  }
})

// Global test helpers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidAudioFile(): R
      toBeValidVideoFile(): R
      toHaveValidLyrics(): R
    }
  }
}

// Custom matchers
expect.extend({
  toBeValidAudioFile(received: string) {
    const audioExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg']
    const hasValidExtension = audioExtensions.some(ext => received.endsWith(ext))
    const fileExists = fs.existsSync(received)
    
    if (hasValidExtension && fileExists) {
      return {
        message: () => `Expected ${received} not to be a valid audio file`,
        pass: true
      }
    } else {
      return {
        message: () => `Expected ${received} to be a valid audio file (exists: ${fileExists}, valid ext: ${hasValidExtension})`,
        pass: false
      }
    }
  },

  toBeValidVideoFile(received: string) {
    const videoExtensions = ['.mp4', '.avi', '.mov', '.webm', '.mkv']
    const hasValidExtension = videoExtensions.some(ext => received.endsWith(ext))
    const fileExists = fs.existsSync(received)
    
    if (hasValidExtension && fileExists) {
      return {
        message: () => `Expected ${received} not to be a valid video file`,
        pass: true
      }
    } else {
      return {
        message: () => `Expected ${received} to be a valid video file (exists: ${fileExists}, valid ext: ${hasValidExtension})`,
        pass: false
      }
    }
  },

  toHaveValidLyrics(received: string) {
    if (!fs.existsSync(received)) {
      return {
        message: () => `Expected lyrics file ${received} to exist`,
        pass: false
      }
    }
    
    const content = fs.readFileSync(received, 'utf8')
    const hasTimestamps = /\[\d{2}:\d{2}\.\d{2}\]/.test(content)
    const hasLyrics = content.trim().length > 0
    
    if (hasTimestamps && hasLyrics) {
      return {
        message: () => `Expected ${received} not to have valid lyrics`,
        pass: true
      }
    } else {
      return {
        message: () => `Expected ${received} to have valid lyrics with timestamps`,
        pass: false
      }
    }
  }
})