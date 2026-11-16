import { describe, test, expect, vi, afterEach } from 'vitest'
import { CUSTOM, MAX_FILE_BYTES, loadImageFile, resolveAvatar, storePicture, loadStoredPicture } from './customAvatar'
import { avatarSrc, isCustomAvatar } from './avatar'

const PICTURE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=='

describe('custom avatar', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    storePicture(null)
  })

  test('avatar values: built-in golems, own pictures, anything else falls back', () => {
    expect(isCustomAvatar('u_0123456789abcdef')).toBe(true)
    expect(isCustomAvatar('7')).toBe(false)
    expect(avatarSrc('u_0123456789abcdef')).toBe('/api/avatars/0123456789abcdef.jpg')
    expect(avatarSrc('u_../../x')).toMatch(/\/assets\/images\/avatar\/1\.svg/)
    expect(avatarSrc('javascript:alert(1)')).toMatch(/\/assets\/images\/avatar\/1\.svg/)
  })

  test('files over 5 MB or not images are refused before decoding', async () => {
    const big = new File([new Uint8Array(MAX_FILE_BYTES + 1)], 'big.jpg', { type: 'image/jpeg' })
    await expect(loadImageFile(big)).rejects.toThrow(/5 MB/)
    const txt = new File(['hello'], 'a.txt', { type: 'text/plain' })
    await expect(loadImageFile(txt)).rejects.toThrow(/image/)
  })

  test('built-in avatars are sent as they are, no upload', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    expect(await resolveAvatar('12')).toBe('12')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('my picture is uploaded when the game starts and its value is used', async () => {
    storePicture(PICTURE)
    expect(loadStoredPicture()).toBe(PICTURE)
    const fetchSpy = vi.fn(async (url) => {
      if (String(url).startsWith('data:')) return { blob: async () => new Blob(['x'], { type: 'image/jpeg' }) }
      return { ok: true, status: 200, json: async () => ({ avatar: 'u_00000000000000ff' }) }
    })
    vi.stubGlobal('fetch', fetchSpy)
    expect(await resolveAvatar(CUSTOM)).toBe('u_00000000000000ff')
    const upload = fetchSpy.mock.calls.find(([u]) => u === '/api/avatars')
    expect(upload[1].method).toBe('POST')
    expect(upload[1].headers['Content-Type']).toBe('image/jpeg')
  })

  test('without a stored picture the choice falls back to a golem', async () => {
    expect(await resolveAvatar(CUSTOM)).toBe('4')
  })
})
