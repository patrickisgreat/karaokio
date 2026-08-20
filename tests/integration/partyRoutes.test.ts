import { describe, test, expect, beforeEach } from '@jest/globals'
import { NextRequest } from 'next/server'
import { POST as join } from '@/app/api/party/join/route'
import { GET as status } from '@/app/api/party/status/route'
import { GET as getQueue, DELETE as removeSong } from '@/app/api/queue/route'
import { getPartyCode, createSessionToken } from '@/lib/partyAuth'
import db from '@/lib/database'

const jsonRequest = (url: string, method: string, body?: unknown, cookie?: string) =>
  new NextRequest(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const cookieFor = (role: 'guest' | 'host', name = 'Tester') =>
  `karaokio_session=${createSessionToken({ name, role })}`

describe('party auth across API routes', () => {
  beforeEach(() => {
    delete process.env.PARTY_CODE
    delete process.env.HOST_PIN
    db.exec('DELETE FROM party_state')
    db.exec('DELETE FROM songs')
    db.exec('DELETE FROM users')
  })

  describe('join flow', () => {
    test('joins with the right code and sets the session cookie', async () => {
      const response = await join(
        jsonRequest('http://box/api/party/join', 'POST', {
          name: 'Freddie',
          code: getPartyCode(),
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toMatchObject({ success: true, name: 'Freddie', role: 'guest' })

      const setCookie = response.headers.get('set-cookie') || ''
      expect(setCookie).toContain('karaokio_session=')
      expect(setCookie.toLowerCase()).toContain('httponly')
    })

    test('rejects a wrong code with 401 and no cookie', async () => {
      const response = await join(
        jsonRequest('http://box/api/party/join', 'POST', { name: 'Mallory', code: 'NOPE99' })
      )
      expect(response.status).toBe(401)
      expect(response.headers.get('set-cookie')).toBeNull()
    })

    test('host PIN joins as host', async () => {
      process.env.HOST_PIN = 'hostpin1'
      const response = await join(
        jsonRequest('http://box/api/party/join', 'POST', { name: 'Patrick', code: 'hostpin1' })
      )
      expect((await response.json()).role).toBe('host')
    })
  })

  describe('status', () => {
    test('reports unauthenticated without leaking the party code', async () => {
      const response = await status(jsonRequest('http://box/api/party/status', 'GET'))
      const body = await response.json()
      expect(body.authenticated).toBe(false)
      expect(body.partyCode).toBeUndefined()
    })

    test('returns the party code to an authenticated session', async () => {
      const response = await status(
        jsonRequest('http://box/api/party/status', 'GET', undefined, cookieFor('guest'))
      )
      const body = await response.json()
      expect(body.authenticated).toBe(true)
      expect(body.partyCode).toBe(getPartyCode())
    })
  })

  describe('protected routes', () => {
    test('queue GET requires a session', async () => {
      const anonymous = await getQueue(jsonRequest('http://box/api/queue', 'GET'))
      expect(anonymous.status).toBe(401)

      const authed = await getQueue(
        jsonRequest('http://box/api/queue', 'GET', undefined, cookieFor('guest'))
      )
      expect(authed.status).toBe(200)
    })

    test('queue DELETE is host-gated when a host PIN exists', async () => {
      process.env.HOST_PIN = 'hostpin1'

      const asGuest = await removeSong(
        jsonRequest('http://box/api/queue?songId=x', 'DELETE', undefined, cookieFor('guest'))
      )
      expect(asGuest.status).toBe(403)

      const asHost = await removeSong(
        jsonRequest('http://box/api/queue?songId=x', 'DELETE', undefined, cookieFor('host'))
      )
      expect(asHost.status).toBe(200)
    })
  })
})
