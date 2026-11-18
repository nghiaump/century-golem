import React from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi, afterEach } from 'vitest'
import UpgradeModal from '../UpgradeModal'

const buttons = () => screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') || b.textContent)

describe('UpgradeModal', () => {
  afterEach(cleanup)

  test('tapping never adds or removes buttons (the upgrade buttons stay put); Reset undoes', () => {
    render(<UpgradeModal card={{ name: 'upgrade_3' }} playerResources={{ yellow: 3, green: 1 }} maxTurnUpgrade={3} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const reset = screen.getByRole('button', { name: 'Reset' })
    expect(reset.disabled).toBe(true)
    const before = buttons().length

    fireEvent.click(screen.getByRole('button', { name: /Upgrade one yellow to green \(you have 3\)/ }))
    expect(buttons()).toHaveLength(before)
    expect(screen.getByRole('button', { name: 'Reset' }).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /Upgrade one yellow to green \(you have 2\)/ }))
    expect(buttons()).toHaveLength(before)
    expect(screen.getByText('1 of 3 upgrades left')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getByText('3 of 3 upgrades left')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reset' }).disabled).toBe(true)
    expect(buttons()).toHaveLength(before)
  })

  test('confirm sends what was given up and what was received', () => {
    const onConfirm = vi.fn()
    render(<UpgradeModal card={{ name: 'upgrade_2' }} playerResources={{ yellow: 2 }} maxTurnUpgrade={2} onConfirm={onConfirm} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /yellow to green/ }))
    fireEvent.click(screen.getByRole('button', { name: /green to blue/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Upgrade' }))
    expect(onConfirm).toHaveBeenCalledWith({ yellow: 1, green: 0, blue: 0, pink: 0 }, { yellow: 0, green: 0, blue: 1, pink: 0 })
  })
})
