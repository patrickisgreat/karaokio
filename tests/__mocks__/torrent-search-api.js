// Stand-in for `torrent-search-api` (see jest.config.js moduleNameMapper).
// Defaults are inert; tests configure `search` per case.
module.exports = {
  enableProvider: jest.fn(),
  disableProvider: jest.fn(),
  search: jest.fn(() => Promise.resolve([]))
}
