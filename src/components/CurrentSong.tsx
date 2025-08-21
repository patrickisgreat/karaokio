'use client'

import { useState } from 'react'

export default function CurrentSong() {
  const [currentSong] = useState({
    id: '1',
    user: { id: '1', name: 'Alice', color: 'bg-pink-500' },
    songTitle: 'Bohemian Rhapsody',
    artist: 'Queen',
    status: 'playing' as const
  })

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Now Playing</h2>
        {currentSong ? (
          <div>
            <div className="flex items-center justify-center mb-4">
              <div className={`w-12 h-12 ${currentSong.user.color} rounded-full flex items-center justify-center text-white font-bold text-lg mr-3`}>
                {currentSong.user.name.charAt(0)}
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-800">{currentSong.user.name}</p>
                <p className="text-sm text-gray-600">is singing</p>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-xl p-6">
              <h3 className="text-xl font-bold mb-1">{currentSong.songTitle}</h3>
              <p className="text-primary-100">by {currentSong.artist}</p>
            </div>

            <div className="mt-6 space-y-3">
              <button 
                onClick={() => window.location.href = `/sing/${currentSong.id}`}
                className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
              >
                Open Karaoke Player
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button className="py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors">
                  Skip Song
                </button>
                <button className="py-2 px-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors">
                  Mark Complete
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg">No one is singing</p>
            <p className="text-gray-400">Add a song to get started!</p>
          </div>
        )}
      </div>
    </div>
  )
}