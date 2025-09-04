declare module 'webtorrent' {
  export interface TorrentFile {
    name: string
    path: string
    length: number
    createReadStream(): any
  }

  export interface Torrent {
    magnetURI: string
    name: string
    files: TorrentFile[]
    done: boolean
    downloaded: number
    length: number
    downloadSpeed: number
    uploadSpeed: number
    progress: number
    on(event: string, callback: Function): void
    destroy(): void
  }

  class WebTorrent {
    torrents: Torrent[]
    constructor(options?: any)
    add(torrentId: string, options?: any, callback?: (torrent: Torrent) => void): Torrent
    get(torrentId: string): Torrent | undefined
    remove(torrentId: string, callback?: () => void): void
    destroy(callback?: () => void): void
  }

  namespace WebTorrent {
    export type Instance = WebTorrent
  }

  export = WebTorrent
}

declare module 'torrent-search-api' {
  export interface TorrentResult {
    title: string
    seeds: number
    peers: number
    size: string
    magnet: string
    desc: string
    provider: string
  }

  export interface TorrentSearchApi {
    enableProvider(name: string): void
    disableProvider(name: string): void
    getProviders(): string[]
    getActiveProviders(): string[]
    search(query: string, category?: string, limit?: number): Promise<TorrentResult[]>
  }

  const api: TorrentSearchApi
  export default api
}