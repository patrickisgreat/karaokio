import KaraokePlayer from '@/components/KaraokePlayer'

interface PageProps {
  params: {
    songId: string
  }
}

export default function SingPage({ params }: PageProps) {
  return (
    <div className="min-h-screen bg-black">
      <KaraokePlayer songId={params.songId} />
    </div>
  )
}