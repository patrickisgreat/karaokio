// Mock filesystem for testing
const fs = jest.createMockFromModule('fs') as any

// Mock file system state
let mockFiles: Record<string, string> = {}

// Override methods
fs.existsSync = jest.fn((filePath: string) => {
  return mockFiles.hasOwnProperty(filePath)
})

fs.readFileSync = jest.fn((filePath: string, encoding?: string) => {
  if (!mockFiles[filePath]) {
    throw new Error(`ENOENT: no such file or directory, open '${filePath}'`)
  }
  return mockFiles[filePath]
})

fs.writeFileSync = jest.fn((filePath: string, content: string) => {
  mockFiles[filePath] = content
})

fs.unlinkSync = jest.fn((filePath: string) => {
  delete mockFiles[filePath]
})

fs.mkdirSync = jest.fn()

fs.readdirSync = jest.fn((dirPath: string) => {
  return Object.keys(mockFiles)
    .filter(path => path.startsWith(dirPath))
    .map(path => path.replace(dirPath + '/', ''))
})

fs.statSync = jest.fn((filePath: string) => {
  if (!mockFiles[filePath]) {
    throw new Error(`ENOENT: no such file or directory, stat '${filePath}'`)
  }
  return {
    size: mockFiles[filePath].length,
    isFile: () => true,
    isDirectory: () => false,
    mtime: new Date()
  }
})

// Helper to manage mock state
fs.__setMockFiles = (files: Record<string, string>) => {
  mockFiles = { ...files }
}

fs.__clearMockFiles = () => {
  mockFiles = {}
}

fs.__getMockFiles = () => {
  return { ...mockFiles }
}

export default fs