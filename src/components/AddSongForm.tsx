'use client'

import { useState } from 'react'
import { redirectIfUnauthed } from '@/lib/clientAuth'

export default function AddSongForm() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSubmitting(true)
    setMessage('')
    try {
      const response = await fetch('/api/queue/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchQuery: searchQuery.trim(),
          processingQuality: 'balanced',
          outputFormat: 'wav',
        }),
      })
      if (redirectIfUnauthed(response)) return

      const result = await response.json()
      if (response.ok && result.success) {
        setMessage(`✅ "${searchQuery.trim()}" added to the queue!`)
        setSearchQuery('')
      } else {
        setMessage(`❌ ${result.error || 'Failed to add song'}`)
      }
    } catch {
      setMessage('❌ Network error — is the party box up?')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Song Request</label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="e.g. Bohemian Rhapsody Queen"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          You&apos;re queued under the name you joined with.
        </p>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.startsWith('✅')
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}
        >
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !searchQuery.trim()}
        className="w-full py-3 rounded-lg bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {isSubmitting ? 'Adding…' : 'Add to Queue 🎤'}
      </button>
    </form>
  )
}
