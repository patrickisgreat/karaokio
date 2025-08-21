'use client'

import { useState } from 'react'

const mockQueue = [
  {
    id: '2',
    user: { id: '2', name: 'Bob', color: 'bg-blue-500' },
    songTitle: 'Don\'t Stop Believin\'',
    artist: 'Journey',
    status: 'processing' as const,
    processingProgress: 65,
    estimatedTimeLeft: '2 min'
  },
  {
    id: '3',
    user: { id: '3', name: 'Charlie', color: 'bg-green-500' },
    songTitle: 'Sweet Caroline',
    artist: 'Neil Diamond',
    status: 'ready' as const,
    position: 1
  },
  {
    id: '4',
    user: { id: '4', name: 'Diana', color: 'bg-purple-500' },
    songTitle: 'Livin\' on a Prayer',
    artist: 'Bon Jovi',
    status: 'queued' as const,
    position: 2,
    estimatedWait: '8 min'
  }
]

export default function QueueList() {
  const [queue] = useState(mockQueue)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return (
          <div className="animate-spin w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full"></div>
        )
      case 'ready':
        return (
          <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )
      case 'queued':
        return (
          <div className="w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
            {(queue.find(s => s.id === mockQueue.find(ms => ms.status === status)?.id)as any)?.position}
          </div>
        )
      default:
        return null
    }
  }

  const getStatusText = (item: typeof mockQueue[0]) => {
    switch (item.status) {
      case 'processing':
        return `Processing... ${item.processingProgress}% (${item.estimatedTimeLeft} left)`
      case 'ready':
        return 'Ready to sing! Up next'
      case 'queued':
        return `In queue • Est. wait: ${item.estimatedWait}`
      default:
        return ''
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Song Queue</h3>
        <span className="text-sm text-gray-500">{queue.length} songs</span>
      </div>

      <div className="space-y-3">
        {queue.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-lg border-2 transition-colors ${
              item.status === 'ready' 
                ? 'border-green-200 bg-green-50' 
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                <div className={`w-10 h-10 ${item.user.color} rounded-full flex items-center justify-center text-white font-bold`}>
                  {item.user.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-medium text-gray-800">{item.songTitle}</h4>
                    {getStatusIcon(item.status)}
                  </div>
                  <p className="text-sm text-gray-600">by {item.artist}</p>
                  <p className="text-sm text-gray-500 mt-1">{item.user.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{getStatusText(item)}</p>
                  
                  {item.status === 'processing' && item.processingProgress && (
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${item.processingProgress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex space-x-2 ml-2">
                {item.status === 'ready' && (
                  <button 
                    onClick={() => window.location.href = `/sing/${item.id}`}
                    className="text-green-600 hover:text-green-700 transition-colors"
                    title="Start singing"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="m7 4 12 8-12 8V4z"/>
                    </svg>
                  </button>
                )}
                <button 
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Remove from queue"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {queue.length === 0 && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-gray-500">Queue is empty</p>
          <p className="text-sm text-gray-400">Add a song to get the party started!</p>
        </div>
      )}
    </div>
  )
}