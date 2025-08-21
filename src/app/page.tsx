import QueueInterface from '@/components/QueueInterface'
import CurrentSong from '@/components/CurrentSong'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent mb-4">
            Karaokio
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            AI-powered karaoke queue - Add your songs, wait your turn, and sing!
          </p>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-8">
          <CurrentSong />
          <QueueInterface />
        </div>
      </div>
    </main>
  )
}