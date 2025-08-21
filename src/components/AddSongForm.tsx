'use client'

import { useState } from 'react'

export default function AddSongForm() {
  const [userName, setUserName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userName.trim() || !searchQuery.trim()) return
    
    setIsSubmitting(true)
    // TODO: Add song to queue
    console.log('Adding song:', { userName, searchQuery })
    setTimeout(() => {
      setIsSubmitting(false)
      setSearchQuery('')
    }, 1000)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your Name
        </label>
        <input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="Enter your name"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Song Request
        </label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Song title and artist (e.g., 'Bohemian Rhapsody Queen')"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <label className="block text-gray-700 mb-1">Processing Quality</label>
          <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
            <option>High (3-5 min)</option>
            <option>Balanced (1-2 min)</option>
            <option>Fast (30 sec)</option>
          </select>
        </div>
        <div>
          <label className="block text-gray-700 mb-1">Output Format</label>
          <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
            <option>Video + Lyrics</option>
            <option>Audio Only</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !userName.trim() || !searchQuery.trim()}
        className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
      >
        {isSubmitting ? 'Adding to Queue...' : 'Add to Queue'}
      </button>

      <div className="text-xs text-gray-500 text-center">
        Your song will be processed and added to the queue. Processing time varies by quality setting.
      </div>
    </form>
  )
}