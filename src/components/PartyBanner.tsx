'use client'

import { useState, useEffect } from 'react'
import QRCode from 'qrcode'

interface PartyStatus {
  authenticated: boolean
  name?: string
  role?: 'guest' | 'host'
  partyCode?: string
}

// Shown on the big screen: the party code and a QR that lands guests on the
// join page with the code prefilled. Also the home page's auth gate — an
// unauthenticated visitor is bounced to /join.
export default function PartyBanner() {
  const [status, setStatus] = useState<PartyStatus | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/party/status')
        const data: PartyStatus = await response.json()
        if (!data.authenticated) {
          window.location.href = '/join'
          return
        }
        setStatus(data)
        if (data.partyCode) {
          const joinUrl = `${window.location.origin}/join?code=${data.partyCode}`
          setQrDataUrl(await QRCode.toDataURL(joinUrl, { margin: 1, width: 160 }))
        }
      } catch {
        // status endpoint unreachable — leave the banner off rather than block the page
      }
    }
    load()
  }, [])

  if (!status?.authenticated) return null

  return (
    <div className="flex items-center justify-center gap-6 bg-white/70 backdrop-blur rounded-xl px-6 py-4 mb-8 shadow-sm">
      {qrDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrDataUrl} alt="Scan to join the party" className="w-24 h-24 rounded" />
      )}
      <div className="text-left">
        <p className="text-sm text-gray-500">Party code</p>
        <p className="text-3xl font-mono font-bold tracking-widest text-gray-800">
          {status.partyCode}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Scan or visit <span className="font-mono">/join</span> · singing as{' '}
          <span className="font-medium text-gray-700">{status.name}</span>
          {status.role === 'host' && ' 👑'}
        </p>
      </div>
    </div>
  )
}
