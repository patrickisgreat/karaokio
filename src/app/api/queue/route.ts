import { NextRequest, NextResponse } from 'next/server'
import { requireParty } from '@/lib/partyAuth'
import { KaraokeDB } from '@/lib/database'

export async function GET(request: NextRequest) {
  const auth = requireParty(request)
  if ('error' in auth) return auth.error

  try {
    const queue = KaraokeDB.getQueue()
    const current = KaraokeDB.getCurrentSong()

    return NextResponse.json({
      current,
      queue: queue.filter((song) => song.status !== 'playing'),
      total: queue.length,
    })
  } catch (error) {
    console.error('Get queue failed:', error)
    return NextResponse.json({ error: 'Failed to get queue' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireParty(request, { host: true })
  if ('error' in auth) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const songId = searchParams.get('songId')

    if (!songId) {
      return NextResponse.json({ error: 'songId is required' }, { status: 400 })
    }

    KaraokeDB.removeSong(songId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove song failed:', error)
    return NextResponse.json({ error: 'Failed to remove song' }, { status: 500 })
  }
}
