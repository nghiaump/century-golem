import { describe, test, expect, vi, beforeAll, beforeEach } from 'vitest'

// A stand-in <audio>: records each play() and whether it was muted.
class FakeAudio {
  constructor(src) {
    this.src = src
    this.paused = true
    this.ended = false
    this.muted = false
    this.currentTime = 0
    this.plays = []
    FakeAudio.all.push(this)
  }
  addEventListener() {}
  play() {
    this.plays.push({ muted: this.muted })
    this.paused = false
    return Promise.resolve()
  }
  pause() { this.paused = true }
  cloneNode() { return new FakeAudio(this.src) }
}
FakeAudio.all = []

let sm
beforeAll(async () => {
  vi.stubGlobal('Audio', FakeAudio)
  localStorage.setItem('gameSoundsMuted', 'false')
  sm = (await import('./sounds')).default
})
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('soundManager on phones', () => {
  beforeEach(() => {
    sm.setMuted(false)
    Object.values(sm.sounds).forEach((a) => { a.paused = true; a.ended = false; a.plays = [] })
  })

  test('the first tap unlocks every sound: started muted, then stopped and unmuted', async () => {
    document.dispatchEvent(new Event('touchend'))
    Object.values(sm.sounds).forEach((a) => expect(a.plays).toEqual([{ muted: true }]))
    await flush()
    Object.values(sm.sounds).forEach((a) => {
      expect(a._unlocked).toBe(true)
      expect(a.paused).toBe(true)
      expect(a.muted).toBe(false)
    })
    document.dispatchEvent(new Event('touchend')) // already unlocked: nothing more
    Object.values(sm.sounds).forEach((a) => expect(a.plays).toHaveLength(1))
  })

  test('a sound cut off without an "ended" event still plays the next time (your turn, rest)', () => {
    sm.play('myTurn')
    expect(sm.sounds.myTurn.plays).toHaveLength(1)
    sm.sounds.myTurn.paused = true // interrupted: screen locked, app switched… no 'ended'
    sm.play('myTurn')
    expect(sm.sounds.myTurn.plays).toHaveLength(2)
    sm.play('rest')
    sm.sounds.rest.paused = true
    sm.play('rest')
    expect(sm.sounds.rest.plays).toHaveLength(2)
  })

  test('a sound still playing is not restarted; overlap sounds use the unlocked element when it is free', () => {
    sm.play('myTurn')
    sm.play('myTurn')
    expect(sm.sounds.myTurn.plays).toHaveLength(1)
    const before = FakeAudio.all.length
    sm.play('gameOver', true)
    expect(sm.sounds.gameOver.plays).toHaveLength(1)
    expect(FakeAudio.all.length).toBe(before) // no fresh (locked) copy
    sm.play('gameOver', true)
    expect(FakeAudio.all.length).toBe(before + 1) // busy: a copy to overlap
  })

  test('the card slap: a short, soft, deterministic sound as WAV', async () => {
    const { cardSlapSamples, wavBytes } = await import('./sounds')
    const a = cardSlapSamples()
    expect(a.length).toBe(4410) // 0.2 s at 22 050 Hz
    expect(Math.max(...a.map(Math.abs))).toBeCloseTo(0.6, 5)
    expect(cardSlapSamples()).toEqual(a)
    const wav = new Uint8Array(wavBytes(a))
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF')
    expect(wav.length).toBe(44 + a.length * 2)
  })

  test('muted: nothing plays', () => {
    sm.setMuted(true)
    sm.play('myTurn')
    expect(sm.sounds.myTurn.plays).toHaveLength(0)
  })
})
