import React from 'react'
import { describe, test, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import Avatar from './Avatar'

describe('Avatar fit (phone chips)', () => {
  afterEach(cleanup)

  test('the portrait fills the box up to the 2px ring; the ring pulses on the turn', () => {
    const { container } = render(<Avatar player={{ id: 2, name: 'Basalt', avatar: '3' }} size={34} fit turn />)
    const box = container.firstChild
    expect(box.style.width).toBe('34px')
    expect(box.className).toContain('turn-ring')
    const portrait = container.querySelector('[style*="30px"]')
    expect(portrait).not.toBeNull()
  })

  test('a person on turn gets the timer drawn in the same ring, no pulse class', () => {
    const { container } = render(<Avatar player={{ id: 2, name: 'Ann', avatar: '3' }} size={34} fit turn timer={{ remaining: 30, total: 60 }} />)
    expect(container.querySelectorAll('circle')).toHaveLength(2)
    expect(container.firstChild.className).not.toContain('turn-ring')
  })
})
