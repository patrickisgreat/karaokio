import { NextRequest, NextResponse } from 'next/server'
import { requireParty, getPartyCode, sessionFromRequest } from '@/lib/partyAuth'

// Session probe + party info. Unauthenticated callers get told to join
// (without the code, obviously); authenticated ones get the code so the big
// screen can show the QR for the next guest.
export async function GET(request: NextRequest) {
  const session = sessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ authenticated: false })
  }

  const auth = requireParty(request)
  if ('error' in auth) return auth.error

  return NextResponse.json({
    authenticated: true,
    name: session.name,
    role: session.role,
    partyCode: getPartyCode(),
  })
}
