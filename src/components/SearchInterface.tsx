'use client'

import { useState } from 'react'

export default function SearchInterface() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    
    setIsSearching(true)
    // TODO: Implement search logic
    console.log('Searching for:', searchQuery)
    setTimeout(() => setIsSearching(false), 2000) // Mock delay
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <form onSubmit={handleSearch} className="mb-8">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a song... (e.g., 'Bohemian Rhapsody Queen')"
              className="w-full px-6 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:outline-none transition-colors"
              disabled={isSearching}
            />
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="absolute right-2 top-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800">Search Options</h3>
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input type="checkbox" className="w-4 h-4 text-primary-600" defaultChecked />
                <span className="text-gray-700">Local music library</span>
              </label>
              <label className="flex items-center space-x-3">
                <input type="checkbox" className="w-4 h-4 text-primary-600" defaultChecked />
                <span className="text-gray-700">Online databases</span>
              </label>
              <label className="flex items-center space-x-3">
                <input type="checkbox" className="w-4 h-4 text-primary-600" />
                <span className="text-gray-700">Allow file upload</span>
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800">Processing Options</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vocal Separation Quality
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option>High Quality (Demucs)</option>
                  <option>Balanced (Spleeter)</option>
                  <option>Fast (Basic)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Output Format
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option>MP4 with subtitles</option>
                  <option>Audio + LRC file</option>
                  <option>Both formats</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-lg font-medium text-gray-800 mb-2">How it works:</h4>
          <ol className="list-decimal list-inside text-gray-600 space-y-1">
            <li>Search for your song in our database or upload your own</li>
            <li>AI removes vocals using advanced source separation</li>
            <li>Lyrics are synchronized and formatted for karaoke</li>
            <li>Generate video with instrumental track and scrolling lyrics</li>
          </ol>
        </div>
      </div>
    </div>
  )
}