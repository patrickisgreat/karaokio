'use client'

import { useState } from 'react'
import AddSongForm from './AddSongForm'
import QueueList from './QueueList'

export default function QueueInterface() {
  const [activeTab, setActiveTab] = useState<'add' | 'queue'>('add')

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('add')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'add'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Add Song
        </button>
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2 font-medium transition-colors ml-6 ${
            activeTab === 'queue'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Queue (3)
        </button>
      </div>

      {activeTab === 'add' ? <AddSongForm /> : <QueueList />}
    </div>
  )
}