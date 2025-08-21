'use client'

import { useState, useRef, useEffect } from 'react'

interface KaraokePlayerProps {
  songId: string
}

const mockLyrics = [
  { time: 0, text: "Is this the real life?" },
  { time: 3000, text: "Is this just fantasy?" },
  { time: 6000, text: "Caught in a landslide" },
  { time: 9000, text: "No escape from reality" },
  { time: 12000, text: "Open your eyes" },
  { time: 15000, text: "Look up to the skies and see" },
  { time: 18000, text: "I'm just a poor boy" },
  { time: 21000, text: "I need no sympathy" }
]

export default function KaraokePlayer({ songId }: KaraokePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => {
      setCurrentTime(audio.currentTime * 1000)
      
      // Find current lyric
      const currentIndex = mockLyrics.findIndex((lyric, index) => {
        const nextLyric = mockLyrics[index + 1]
        return audio.currentTime * 1000 >= lyric.time && 
               (!nextLyric || audio.currentTime * 1000 < nextLyric.time)
      })
      
      if (currentIndex !== -1) {
        setCurrentLyricIndex(currentIndex)
      }
    }

    audio.addEventListener('timeupdate', updateTime)
    return () => audio.removeEventListener('timeupdate', updateTime)
  }, [])

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
      {/* Header */}
      <div className="p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Bohemian Rhapsody</h1>
            <p className="text-xl text-purple-200">by Queen</p>
          </div>
          <div className="text-right">
            <p className="text-lg">Now Singing:</p>
            <div className="flex items-center justify-end space-x-2">
              <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                A
              </div>
              <span className="text-xl font-semibold">Alice</span>
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
              {mockLyrics[currentLyricIndex - 1]?.text}
            </p>
          )}
          
          {/* Current lyric */}
          <p className="text-6xl font-bold text-white mb-4 drop-shadow-lg animate-pulse">
            {mockLyrics[currentLyricIndex]?.text || "♪ Music ♪"}
          </p>
          
          {/* Next lyric */}
          {currentLyricIndex < mockLyrics.length - 1 && (
            <p className="text-2xl text-gray-300 opacity-70">
              {mockLyrics[currentLyricIndex + 1]?.text}
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-4xl mb-8">
          <div className="bg-white/20 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-pink-500 to-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentLyricIndex / mockLyrics.length) * 100}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-white/70 text-sm mt-2">
            <span>{Math.floor(currentTime / 1000)}s</span>
            <span>{Math.floor((mockLyrics.length * 3000) / 1000)}s</span>
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
        src="/sample-instrumental.mp3" // TODO: Use actual processed instrumental
        onEnded={handleEnd}
      />
    </div>
  )
}