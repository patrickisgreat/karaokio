/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude problematic modules from server-side bundling
      config.externals = config.externals || []
      config.externals.push({
        'webtorrent': 'webtorrent',
        'torrent-search-api': 'torrent-search-api',
        'utp-native': 'utp-native',
        'fs-native-extensions': 'fs-native-extensions'
      })
    }
    
    // Ignore node modules with native dependencies during build
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    }
    
    return config
  },
  experimental: {
    // Disable static page generation for API routes that use dynamic imports
    serverComponentsExternalPackages: ['webtorrent', 'torrent-search-api']
  }
}

module.exports = nextConfig