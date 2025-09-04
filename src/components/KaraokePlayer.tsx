'use client'

import { useState, useRef, useEffect } from 'react'

interface KaraokePlayerProps {
  songId: string
}

interface Song {
  id: string
  songTitle: string
  artist: string
  user: { name: string; color: string }
  status: string
  instrumentalPath?: string
  videoPath?: string
  lyricsPath?: string
}

export default function KaraokePlayer({ songId }: KaraokePlayerProps) {
  const [song, setSong] = useState<Song | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0)
  const [lyrics, setLyrics] = useState<Array<{time: number, text: string}>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const fetchSong = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/songs/${songId}`)
        const data = await response.json()
        
        if (response.ok) {
          setSong(data.song)
          
          // Start the song if it's ready
          if (data.song.status === 'ready') {
            await fetch(`/api/queue/${songId}/start`, { method: 'POST' })
          }
          
          // Load lyrics if available
          if (data.song.lyricsPath) {
            // For now, use placeholder lyrics - in real implementation,
            // you'd fetch the LRC file content and parse it
            setLyrics([
              { time: 0, text: "♪ Instrumental karaoke track ♪" },
              { time: 10000, text: "♪ Sing along to the music ♪" },
              { time: 20000, text: "♪ Enjoy your karaoke session ♪" }
            ])
          } else {
            setLyrics([
              { time: 0, text: "♪ Processing lyrics... ♪" },
              { time: 5000, text: "♪ Song is being prepared ♪" }
            ])
          }
          
          setError('')
        } else {
          setError(data.error || 'Song not found')
        }
      } catch (err) {
        setError('Failed to load song')
      } finally {
        setLoading(false)
      }
    }

    fetchSong()
  }, [songId])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || lyrics.length === 0) return

    const updateTime = () => {
      setCurrentTime(audio.currentTime * 1000)
      
      // Find current lyric
      const currentIndex = lyrics.findIndex((lyric, index) => {
        const nextLyric = lyrics[index + 1]
        return audio.currentTime * 1000 >= lyric.time && 
               (!nextLyric || audio.currentTime * 1000 < nextLyric.time)
      })
      
      if (currentIndex !== -1) {
        setCurrentLyricIndex(currentIndex)
      }
    }

    audio.addEventListener('timeupdate', updateTime)
    return () => audio.removeEventListener('timeupdate', updateTime)
  }, [lyrics])

  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleEnd = () => {
    // TODO: Mark song as complete and return to main queue
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-xl">Loading karaoke...</p>
        </div>
      </div>
    )
  }

  if (error || !song) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <p className="text-xl mb-4">{error || 'Song not found'}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-colors"
          >
            Back to Queue
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
      {/* Header */}
      <div className="p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{song.songTitle}</h1>
            <p className="text-xl text-purple-200">by {song.artist}</p>
          </div>
          <div className="text-right">
            <p className="text-lg">Now Singing:</p>
            <div className="flex items-center justify-end space-x-2">
              <div className={`w-10 h-10 ${song.user.color} rounded-full flex items-center justify-center text-white font-bold`}>
                {song.user.name.charAt(0)}
              </div>
              <span className="text-xl font-semibold">{song.user.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main karaoke display */}
      <div className="flex-1 flex flex-col justify-center items-center px-8">
        <div className="text-center mb-12">
          {/* Previous lyric */}
          {currentLyricIndex > 0 && (
            <p className="text-2xl text-gray-400 mb-4 opacity-50">
              {lyrics[currentLyricIndex - 1]?.text}
            </p>
          )}
          
          {/* Current lyric */}
          <p className="text-6xl font-bold text-white mb-4 drop-shadow-lg animate-pulse">
            {lyrics[currentLyricIndex]?.text || "♪ Music ♪"}
          </p>
          
          {/* Next lyric */}
          {currentLyricIndex < lyrics.length - 1 && (
            <p className="text-2xl text-gray-300 opacity-70">
              {lyrics[currentLyricIndex + 1]?.text}
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-4xl mb-8">
          <div className="bg-white/20 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-pink-500 to-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${lyrics.length > 0 ? (currentLyricIndex / lyrics.length) * 100 : 0}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-white/70 text-sm mt-2">
            <span>{Math.floor(currentTime / 1000)}s</span>
            <span>{Math.floor((lyrics.length * 10000) / 1000)}s</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 bg-black/30">
        <div className="flex justify-center space-x-4">
          <button
            onClick={togglePlayPause}
            className="w-16 h-16 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            {isPlaying ? (
              <svg className="w-8 h-8 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg className="w-8 h-8 text-gray-800 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="m7 4 12 8-12 8V4z"/>
              </svg>
            )}
          </button>
          
          <button
            onClick={handleEnd}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-full font-medium transition-colors"
          >
            Finish Song
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-medium transition-colors"
          >
            Skip Song
          </button>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={song.instrumentalPath || '/silence.mp3'} // Use processed instrumental or silence
        onEnded={handleEnd}
      />
    </div>
  )
}