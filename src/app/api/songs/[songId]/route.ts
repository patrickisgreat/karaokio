import { NextRequest, NextResponse } from 'next/server'
import { requireParty } from '@/lib/partyAuth'
import { KaraokeDB } from '@/lib/database'

export async function GET(request: NextRequest, { params }: { params: { songId: string } }) {
  const auth = requireParty(request)
  if ('error' in auth) return auth.error

  try {
    const { songId } = params

    if (!songId) {
      return NextResponse.json({ error: 'songId is required' }, { status: 400 })
    }

    const song = KaraokeDB.getSong(songId)
    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      song,
    })
  } catch (error) {
    console.error('Get song failed:', error)
    return NextResponse.json({ error: 'Failed to get song' }, { status: 500 })
  }
}
