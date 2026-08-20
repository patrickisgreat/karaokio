import { NextRequest, NextResponse } from 'next/server'
import { requireParty } from '@/lib/partyAuth'
import { MusicSearch } from '@/lib/musicSearch'

export async function GET(request: NextRequest) {
  const auth = requireParty(request)
  if ('error' in auth) return auth.error

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
  }

  try {
    const results = await MusicSearch.searchAll(query)
    return NextResponse.json({ results })
  } catch (error) {
    console.error('Search failed:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
