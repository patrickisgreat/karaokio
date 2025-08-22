import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { KaraokeDB } from '@/lib/database'
import { QueuedSong, User } from '@/types/queue'
import { processKaraokeSong } from '@/lib/autonomousProcessor'

const AVATAR_COLORS = [
  'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
  'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userName, searchQuery, processingQuality, outputFormat } = body

    if (!userName || !searchQuery) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create or get user
    const userId = uuidv4()
    const userColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
    const user: User = {
      id: userId,
      name: userName.trim(),
      color: userColor
    }

    KaraokeDB.addUser(user)

    // Parse song info (simple approach - could be enhanced with search results)
    const parts = searchQuery.split(' ')
    let songTitle = 'Unknown Song'
    let artist = 'Unknown Artist'
    
    // Simple heuristic: assume format is "Song Title Artist Name" or "Artist - Song"
    if (searchQuery.includes(' - ')) {
      [artist, songTitle] = searchQuery.split(' - ').map(s => s.trim())
    } else if (searchQuery.includes(' by ')) {
      [songTitle, artist] = searchQuery.split(' by ').map(s => s.trim())
    } else {
      // Take last word(s) as artist, rest as title
      const words = parts
      if (words.length > 1) {
        artist = words.pop() || 'Unknown Artist'
        songTitle = words.join(' ') || 'Unknown Song'
      } else {
        songTitle = searchQuery
      }
    }

    // Create song entry
    const songId = uuidv4()
    const song: QueuedSong = {
      id: songId,
      user,
      songTitle,
      artist,
      requestedAt: new Date(),
      status: 'queued'
    }

    // Add to database
    KaraokeDB.addSong(song)

    // Start autonomous background processing
    processKaraokeSong(songId, {
      quality: processingQuality || 'balanced',
      outputFormat: outputFormat || 'wav'
    }).catch(error => {
      console.error('Autonomous processing failed:', error)
      KaraokeDB.updateSongStatus(songId, 'failed')
    })

    return NextResponse.json({ 
      success: true, 
      songId,
      message: 'Song added to queue and processing started' 
    })

  } catch (error) {
    console.error('Add to queue failed:', error)
    return NextResponse.json({ error: 'Failed to add song to queue' }, { status: 500 })
  }
}