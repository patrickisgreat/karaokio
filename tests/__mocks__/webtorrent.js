class MockWebTorrent {
  constructor() {
    this.torrents = []
  }

  add(torrentId, options = {}, callback) {
    const mockTorrent = {
      magnetURI: torrentId,
      name: 'Mock Torrent',
      files: [
        {
          name: 'mock-audio.mp3',
          path: '/mock/path/mock-audio.mp3',
          length: 1024000
        }
      ],
      done: false,
      downloaded: 512000,
      length: 1024000,
      downloadSpeed: 1000,
      uploadSpeed: 500,
      progress: 0.5,
      on: jest.fn(),
      destroy: jest.fn()
    }
    
    this.torrents.push(mockTorrent)
    
    if (callback) {
      setTimeout(() => callback(mockTorrent), 100)
    }
    
    return mockTorrent
  }

  get(torrentId) {
    return this.torrents.find(t => t.magnetURI === torrentId)
  }

  remove(torrentId, callback) {
    const index = this.torrents.findIndex(t => t.magnetURI === torrentId)
    if (index > -1) {
      this.torrents.splice(index, 1)
    }
    if (callback) callback()
  }

  destroy(callback) {
    this.torrents = []
    if (callback) callback()
  }
}

module.exports = MockWebTorrent