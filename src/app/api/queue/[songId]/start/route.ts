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

    // Check if song exists and is ready
    const song = KaraokeDB.getSong(songId)
    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    }

    if (song.status !== 'ready') {
      return NextResponse.json({ 
        error: 'Song is not ready to play',
        status: song.status 
      }, { status: 400 })
    }

    // Mark current song as complete and set this song as playing
    const currentSong = KaraokeDB.getCurrentSong()
    if (currentSong) {
      KaraokeDB.updateSongStatus(currentSong.id, 'completed')
    }

    KaraokeDB.updateSongStatus(songId, 'playing')

    return NextResponse.json({ 
      success: true,
      message: 'Song started' 
    })

  } catch (error) {
    console.error('Start song failed:', error)
    return NextResponse.json({ error: 'Failed to start song' }, { status: 500 })
  }
}