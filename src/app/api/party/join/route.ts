import { NextRequest, NextResponse } from 'next/server'
import { joinParty, attachSessionCookie } from '@/lib/partyAuth'

// The one unauthenticated API route: trades a name + party code (or host PIN)
// for a signed session cookie.
export async function POST(request: NextRequest) {
  try {
    const { name, code } = await request.json()

    if (typeof name !== 'string' || typeof code !== 'string') {
      return NextResponse.json({ error: 'Name and code are required' }, { status: 400 })
    }

    const session = joinParty(name, code)
    if (!session) {
      return NextResponse.json({ error: 'Wrong party code' }, { status: 401 })
    }

    const response = NextResponse.json({ success: true, name: session.name, role: session.role })
    return attachSessionCookie(response, session)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
