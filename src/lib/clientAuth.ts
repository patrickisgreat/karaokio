// Client-side companion to the party-code auth: any API response that comes
// back 401 means this browser has no (valid) session — send it to the join
// page. Returns true when a redirect was triggered so callers can bail out.
export function redirectIfUnauthed(response: Response): boolean {
  if (response.status === 401 && typeof window !== 'undefined') {
    window.location.href = '/join'
    return true
  }
  return false
}
