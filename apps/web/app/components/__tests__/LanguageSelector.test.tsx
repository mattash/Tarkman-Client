import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguageSelector } from '../LanguageSelector'

describe('LanguageSelector', () => {
  it('applies selected languages in stable product order', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    render(<LanguageSelector value={['en']} onApply={onApply} />)

    await user.click(screen.getByRole('button', { name: /languages/i }))
    await user.click(screen.getByRole('checkbox', { name: 'Русский' }))
    await user.click(screen.getByRole('checkbox', { name: 'Translit' }))
    await user.click(screen.getByRole('button', { name: 'Apply languages' }))

    expect(onApply).toHaveBeenCalledWith(['en', 'ru', 'translit'])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('discards draft changes when cancelled', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    render(<LanguageSelector value={['en']} onApply={onApply} />)

    await user.click(screen.getByRole('button', { name: /languages/i }))
    await user.click(screen.getByRole('checkbox', { name: 'English' }))
    await user.click(screen.getByRole('checkbox', { name: 'Գրաբար' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onApply).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /languages/i }))
    expect(screen.getByRole('checkbox', { name: 'English' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Գրաբար' })).not.toBeChecked()
  })

  it('requires at least one language', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    render(<LanguageSelector value={['en']} onApply={onApply} />)

    await user.click(screen.getByRole('button', { name: /languages/i }))
    await user.click(screen.getByRole('checkbox', { name: 'English' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Choose at least one language.')
    expect(screen.getByRole('button', { name: 'Apply languages' })).toBeDisabled()
    expect(onApply).not.toHaveBeenCalled()
  })
})
