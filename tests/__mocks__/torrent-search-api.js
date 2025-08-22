const mockTorrentSearchApi = {
  enableProvider: jest.fn(),
  disableProvider: jest.fn(),
  getProviders: jest.fn(() => ['ThePirateBay', '1337x', 'RARBG']),
  getActiveProviders: jest.fn(() => ['ThePirateBay', '1337x']),
  search: jest.fn((query, category, limit) => {
    // Return mock search results
    return Promise.resolve([
      {
        title: `${query} - High Quality Audio`,
        seeds: 100,
        peers: 50,
        size: '4.5 MB',
        magnet: 'magnet:?xt=urn:btih:mock123&dn=test-torrent',
        desc: 'https://example.com/torrent/1',
        provider: 'ThePirateBay'
      },
      {
        title: `${query} - MP3 320kbps`,
        seeds: 80,
        peers: 30,
        size: '3.2 MB', 
        magnet: 'magnet:?xt=urn:btih:mock456&dn=test-torrent-2',
        desc: 'https://example.com/torrent/2',
        provider: '1337x'
      }
    ])
  })
}

module.exports = mockTorrentSearchApi