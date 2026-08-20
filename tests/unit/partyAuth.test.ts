import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import {
  getPartyCode,
  rotatePartyCode,
  createSessionToken,
  verifySessionToken,
  joinParty,
  sessionFromRequest,
  requireParty,
} from '@/lib/partyAuth'
import db from '@/lib/database'

describe('partyAuth', () => {
  beforeEach(() => {
    delete process.env.PARTY_CODE
    delete process.env.PARTY_SESSION_SECRET
    delete process.env.HOST_PIN
    db.exec('DELETE FROM party_state')
  })

  afterEach(() => {
    delete process.env.PARTY_CODE
    delete process.env.HOST_PIN
  })

  describe('party code', () => {
    test('generates a stable 6-character code without ambiguous characters', () => {
      const code = getPartyCode()
      expect(code).toMatch(/^[A-HJ-KM-NP-Z2-9]{6}$/)
      expect(getPartyCode()).toBe(code)
    })

    test('PARTY_CODE env overrides the generated code', () => {
      process.env.PARTY_CODE = 'FIXED1'
      expect(getPartyCode()).toBe('FIXED1')
    })

    test('rotation changes the code', () => {
      const before = getPartyCode()
      const after = rotatePartyCode()
      expect(after).not.toBe(before)
      expect(getPartyCode()).toBe(after)
    })
  })

  describe('session tokens', () => {
    test('round-trips a session', () => {
      const token = createSessionToken({ name: 'Freddie', role: 'guest' })
      expect(verifySessionToken(token)).toEqual({ name: 'Freddie', role: 'guest' })
    })

    test('rejects a tampered payload', () => {
      const token = createSessionToken({ name: 'Freddie', role: 'guest' })
      const [payload, sig] = token.split('.')
      const forged = Buffer.from(
        JSON.stringify({
          ...JSON.parse(Buffer.from(payload, 'base64url').toString()),
          role: 'host',
        })
      ).toString('base64url')
      expect(verifySessionToken(`${forged}.${sig}`)).toBeNull()
    })

    test('rejects garbage tokens without throwing', () => {
      expect(verifySessionToken('')).toBeNull()
      expect(verifySessionToken('not-a-token')).toBeNull()
      expect(verifySessionToken('a.b')).toBeNull()
    })

    test('rotating the party kills every outstanding session', () => {
      const token = createSessionToken({ name: 'Freddie', role: 'host' })
      expect(verifySessionToken(token)).not.toBeNull()
      rotatePartyCode()
      expect(verifySessionToken(token)).toBeNull()
    })
  })

  describe('joinParty', () => {
    test('accepts the party code case-insensitively as a guest', () => {
      const code = getPartyCode()
      expect(joinParty('Freddie', code.toLowerCase())).toEqual({
        name: 'Freddie',
        role: 'guest',
      })
    })

    test('rejects a wrong code', () => {
      expect(joinParty('Mallory', 'WRONG1')).toBeNull()
    })

    test('accepts the host PIN as a host, case-sensitively', () => {
      process.env.HOST_PIN = 'sEcret9'
      expect(joinParty('Patrick', 'sEcret9')).toEqual({ name: 'Patrick', role: 'host' })
      expect(joinParty('Patrick', 'secret9')).toBeNull()
    })

    test('rejects blank and oversized names', () => {
      const code = getPartyCode()
      expect(joinParty('   ', code)).toBeNull()
      expect(joinParty('x'.repeat(41), code)).toBeNull()
    })
  })

  describe('requireParty', () => {
    const requestWith = (token?: string) =>
      new Request('http://box/api/queue', {
        headers: token ? { cookie: `karaokio_session=${token}` } : {},
      })

    test('401s a request with no session cookie', () => {
      const result = requireParty(requestWith())
      expect('error' in result && result.error.status).toBe(401)
    })

    test('admits a valid guest session', () => {
      const token = createSessionToken({ name: 'Freddie', role: 'guest' })
      const result = requireParty(requestWith(token))
      expect('session' in result && result.session.name).toBe('Freddie')
    })

    test('403s a guest on a host-gated route when a host PIN is configured', () => {
      process.env.HOST_PIN = 'pin123'
      const token = createSessionToken({ name: 'Freddie', role: 'guest' })
      const result = requireParty(requestWith(token), { host: true })
      expect('error' in result && result.error.status).toBe(403)
    })

    test('admits the host on a host-gated route', () => {
      process.env.HOST_PIN = 'pin123'
      const token = createSessionToken({ name: 'Patrick', role: 'host' })
      const result = requireParty(requestWith(token), { host: true })
      expect('session' in result).toBe(true)
    })
  })
})
