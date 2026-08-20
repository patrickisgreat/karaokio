'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function JoinForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // QR codes on the big screen link to /join?code=XYZ so scanning prefills it
  useEffect(() => {
    const prefill = searchParams.get('code')
    if (prefill) setCode(prefill.toUpperCase())
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/party/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code }),
      })
      const data = await response.json()
      if (response.ok) {
        router.push('/')
      } else {
        setError(data.error || 'Could not join the party')
      }
    } catch {
      setError('Network error — is the party box up?')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Your name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          required
          autoFocus
          placeholder="Freddie"
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg"
        />
      </div>
      <div>
        <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
          Party code
        </label>
        <input
          id="code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          required
          placeholder="ABC123"
          autoCapitalize="characters"
          autoComplete="off"
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg tracking-widest font-mono"
        />
        <p className="text-xs text-gray-500 mt-1">It&apos;s on the big screen 📺</p>
      </div>
      {error && (
        <div className="p-3 bg-red-100 text-red-800 rounded-lg border border-red-200 text-sm">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-lg bg-gradient-to-r from-primary-600 to-secondary-600 text-white text-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {submitting ? 'Joining…' : "Let's sing 🎤"}
      </button>
    </form>
  )
}

export default function JoinPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex flex-col items-center justify-center px-4">
      <h1 className="text-5xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent mb-2">
        Karaokio
      </h1>
      <p className="text-gray-600 mb-8">Join the party</p>
      <Suspense>
        <JoinForm />
      </Suspense>
    </main>
  )
}
