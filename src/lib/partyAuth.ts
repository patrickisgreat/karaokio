import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import db from './database'

// Party-code auth (see CLAUDE.md — trust model). Guests join with the
// per-party code and get a signed HttpOnly cookie; the host joins with
// HOST_PIN and gets a host-role session that unlocks destructive controls.
// Rotating the party code invalidates every session, host included.

export interface PartySession {
  name: string
  role: 'guest' | 'host'
}

const COOKIE_NAME = 'karaokio_session'

// No ambiguous characters (0/O, 1/I/L) — guests type this from a TV screen.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

db.exec(`
  CREATE TABLE IF NOT EXISTS party_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    party_code TEXT NOT NULL,
    session_secret TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

function randomCode(length: number): string {
  const bytes = crypto.randomBytes(length)
  let code = ''
  for (let i = 0; i < bytes.length; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return code
}

interface PartyStateRow {
  party_code: string
  session_secret: string
}

function partyState(): PartyStateRow {
  const row = db
    .prepare('SELECT party_code, session_secret FROM party_state WHERE id = 1')
    .get() as PartyStateRow | undefined
  if (row) return row

  const fresh = {
    party_code: randomCode(6),
    session_secret: crypto.randomBytes(32).toString('hex'),
  }
  db.prepare('INSERT INTO party_state (id, party_code, session_secret) VALUES (1, ?, ?)').run(
    fresh.party_code,
    fresh.session_secret
  )
  return fresh
}

export function getPartyCode(): string {
  return process.env.PARTY_CODE || partyState().party_code
}

export function rotatePartyCode(): string {
  const code = randomCode(6)
  // New secret too: every outstanding session token dies with the old party
  db.prepare('UPDATE party_state SET party_code = ?, session_secret = ? WHERE id = 1').run(
    code,
    crypto.randomBytes(32).toString('hex')
  )
  return getPartyCode()
}

function sessionSecret(): string {
  return process.env.PARTY_SESSION_SECRET || partyState().session_secret
}

function hostPin(): string | undefined {
  return process.env.HOST_PIN || undefined
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
}

export function createSessionToken(session: PartySession): string {
  const payload = b64url(JSON.stringify({ ...session, code: getPartyCode(), iat: Date.now() }))
  return `${payload}.${sign(payload)}`
}

export function verifySessionToken(token: string): PartySession | null {
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const payload = token.slice(0, dot)
  const signature = token.slice(dot + 1)

  const expected = sign(payload)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (parsed.code !== getPartyCode()) return null // party rotated — token dead
    if (typeof parsed.name !== 'string' || !['guest', 'host'].includes(parsed.role)) return null
    return { name: parsed.name, role: parsed.role }
  } catch {
    return null
  }
}

// Trades a name + code for a session. The host PIN doubles as a join code so
// the host can log in before anyone knows the party code (it's shown in-app).
export function joinParty(name: string, code: string): PartySession | null {
  const trimmedName = name.trim()
  if (!trimmedName || trimmedName.length > 40) return null

  const pin = hostPin()
  if (pin && timingSafeStringEqual(code, pin)) {
    return { name: trimmedName, role: 'host' }
  }
  if (timingSafeStringEqual(code.toUpperCase(), getPartyCode().toUpperCase())) {
    return { name: trimmedName, role: 'guest' }
  }
  return null
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

export function sessionFromRequest(request: Request): PartySession | null {
  const cookieHeader = request.headers.get('cookie') || ''
  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
  if (!match) return null
  return verifySessionToken(decodeURIComponent(match.slice(COOKIE_NAME.length + 1)))
}

type AuthResult = { session: PartySession } | { error: NextResponse }

// Every API route except join/status calls this first. `host: true` restricts
// to the host session — in development with no HOST_PIN configured, any
// session passes the host gate so local hacking stays frictionless.
export function requireParty(
  request: NextRequest | Request,
  options: { host?: boolean } = {}
): AuthResult {
  const session = sessionFromRequest(request)
  if (!session) {
    return {
      error: NextResponse.json(
        { error: 'Join the party first', joinUrl: '/join' },
        { status: 401 }
      ),
    }
  }
  if (options.host && session.role !== 'host') {
    const devWithoutPin = !hostPin() && process.env.NODE_ENV !== 'production'
    if (!devWithoutPin) {
      return {
        error: NextResponse.json({ error: 'Host controls require the host PIN' }, { status: 403 }),
      }
    }
  }
  return { session }
}

export function attachSessionCookie(response: NextResponse, session: PartySession): NextResponse {
  response.cookies.set(COOKIE_NAME, createSessionToken(session), {
    httpOnly: true,
    sameSite: 'lax',
    // The party box serves plain http on a public IP; `secure` would make the
    // browser drop the cookie entirely. Revisit when TLS lands.
    secure: false,
    path: '/',
    maxAge: 60 * 60 * 24, // one party, generously
  })
  return response
}
