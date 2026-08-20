// Stand-in for the ESM-only `webtorrent` package (see jest.config.js
// moduleNameMapper). A bare jest.fn() constructor: each test file configures
// the instance it returns via mockImplementation.
module.exports = jest.fn()
