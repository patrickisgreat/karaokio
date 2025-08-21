import { NextRequest, NextResponse } from 'next/server'
import { KaraokeDB } from '@/lib/database'

export async function POST(
  request: NextRequest,
  { params }: { params: { songId: string } }
) {
  try {
    const { songId } = params

    if (!songId) {
      return NextResponse.json({ error: 'songId is required' }, { status: 400 })
    }

    // Mark song as completed
    KaraokeDB.updateSongStatus(songId, 'completed')

    // Find next ready song and start it automatically
    const queue = KaraokeDB.getQueue()
    const nextSong = queue.find(song => song.status === 'ready')
    
    if (nextSong) {
      KaraokeDB.updateSongStatus(nextSong.id, 'playing')
    }

    return NextResponse.json({ 
      success: true,
      nextSongId: nextSong?.id || null,
      message: nextSong ? 'Next song started automatically' : 'No more songs in queue'
    })

  } catch (error) {
    console.error('Complete song failed:', error)
    return NextResponse.json({ error: 'Failed to complete song' }, { status: 500 })
  }
}