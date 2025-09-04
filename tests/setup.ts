import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'
import fs from 'fs'
import path from 'path'

// Test database path
const TEST_DB_PATH = path.join(__dirname, 'test-karaoke.db')

// Test directories
const TEST_DIRS = [
  path.join(__dirname, 'temp'),
  path.join(__dirname, 'uploads'),
  path.join(__dirname, 'output'),
  path.join(__dirname, 'cache')
]

beforeAll(() => {
  // Set test environment variables (only if not already set)
  if (!process.env.NODE_ENV) {
    (process.env as any).NODE_ENV = 'test'
  }
  process.env.UPLOAD_DIR = path.join(__dirname, 'uploads')
  process.env.OUTPUT_DIR = path.join(__dirname, 'output')
  process.env.TEMP_DIR = path.join(__dirname, 'temp')
  process.env.CACHE_DIR = path.join(__dirname, 'cache')
  
  // Disable external services in tests
  process.env.ENABLE_TORRENT_DOWNLOAD = 'false'
  process.env.ENABLE_YOUTUBE_DOWNLOAD = 'false'
  
  // Create test directories
  TEST_DIRS.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  })
})

beforeEach(() => {
  // Clean up test database before each test
  try {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH)
    }
  } catch (error) {
    // Ignore cleanup errors
    console.warn('Test cleanup warning:', error)
  }
})

afterEach(() => {
  // Clean up test files after each test
  TEST_DIRS.forEach(dir => {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir)
      files.forEach(file => {
        const filePath = path.join(dir, file)
        const stat = fs.statSync(filePath)
        if (stat.isFile()) {
          fs.unlinkSync(filePath)
        }
      })
    }
  })
})

afterAll(() => {
  // Clean up test directories
  TEST_DIRS.forEach(dir => {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    } catch (error) {
      console.warn('Test cleanup warning:', error)
    }
  })
  
  // Clean up test database
  try {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH)
    }
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