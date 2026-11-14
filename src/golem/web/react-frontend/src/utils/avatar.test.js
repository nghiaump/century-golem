import { describe, it, expect } from 'vitest'
import { AVATAR_IDS, avatarSrc, resolveAvatarId } from './avatar'

const human = (id, avatar) => ({ id, name: `H${id}`, avatar, isAI: false })
const ai = (id) => ({ id, name: `AI ${id}`, avatar: String(id), isAI: true })

describe('resolveAvatarId', () => {
  it('uses the avatar a human picked', () => {
    expect(resolveAvatarId(human(0, '11'), [human(0, '11')])).toBe('11')
  })

  it('gives AIs avatars no human picked, without duplicates, in seat order', () => {
    // Human picks Bowser (4); server would give AI seat 4 avatar "4" too.
    const players = [human(0, '4'), ai(1), ai(2), ai(3), ai(4)]
    const shown = players.map((p) => resolveAvatarId(p, players))
    expect(shown).toEqual(['4', '1', '2', '3', '5'])
    expect(new Set(shown).size).toBe(players.length)
  })

  it('keeps AIs distinct from several humans', () => {
    const players = [human(0, '1'), human(1, '2'), ai(2), ai(3), human(4, '3')]
    const shown = players.map((p) => resolveAvatarId(p, players))
    expect(shown).toEqual(['1', '2', '4', '5', '3'])
  })

  it('falls back safely', () => {
    expect(resolveAvatarId(null)).toBe(AVATAR_IDS[0])
    expect(resolveAvatarId({ id: 9, name: 'x' })).toBe(AVATAR_IDS[0])
    expect(resolveAvatarId(ai(1), [])).toBe(AVATAR_IDS[0])   // AI not found in list → first free
  })

  it('uses the random avatar the server picked for an AI', () => {
    const players = [human(0, '4'), { ...ai(1), avatar: '17', aiAvatar: true }, { ...ai(2), avatar: '9', aiAvatar: true }]
    expect(players.map((p) => resolveAvatarId(p, players))).toEqual(['4', '17', '9'])
    // an invalid server value falls back to the seat-order rule
    expect(resolveAvatarId({ ...ai(1), avatar: '999', aiAvatar: true }, [human(0, '1'), ai(1)])).toBe('2')
  })

  it('offers 23 avatars', () => {
    expect(AVATAR_IDS).toHaveLength(23)
  })

  it('builds versioned URLs', () => {
    expect(avatarSrc('3')).toMatch(/^\/assets\/images\/avatar\/3\.webp\?v=/)
  })
})
