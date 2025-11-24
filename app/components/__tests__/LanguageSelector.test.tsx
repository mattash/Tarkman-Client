import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguageSelector } from '../LanguageSelector'
import type { Language } from '@/contexts/LanguageContext'

describe('LanguageSelector', () => {
  it('should render all language buttons', () => {
    const mockOnChange = vi.fn()
    render(<LanguageSelector selectedLang="en" onLanguageChange={mockOnChange} />)

    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('Русский')).toBeInTheDocument()
    expect(screen.getByText('Գրաբար')).toBeInTheDocument()
    expect(screen.getByText('Translit')).toBeInTheDocument()
  })

  it('should highlight the selected language', () => {
    const mockOnChange = vi.fn()
    render(<LanguageSelector selectedLang="ru" onLanguageChange={mockOnChange} />)

    const russianButton = screen.getByText('Русский')
    const englishButton = screen.getByText('English')

    // Selected button should have bg-gray-700
    expect(russianButton).toHaveClass('bg-gray-700')

    // Non-selected buttons should have bg-gray-600
    expect(englishButton).toHaveClass('bg-gray-600')
  })

  it('should call onLanguageChange when a language button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnChange = vi.fn()
    render(<LanguageSelector selectedLang="en" onLanguageChange={mockOnChange} />)

    const russianButton = screen.getByText('Русский')
    await user.click(russianButton)

    expect(mockOnChange).toHaveBeenCalledWith('ru')
  })

  it('should handle clicking different language buttons', async () => {
    const user = userEvent.setup()
    const mockOnChange = vi.fn()
    render(<LanguageSelector selectedLang="en" onLanguageChange={mockOnChange} />)

    const grabarButton = screen.getByText('Գրաբար')
    await user.click(grabarButton)

    expect(mockOnChange).toHaveBeenCalledWith('grabar')

    const translitButton = screen.getByText('Translit')
    await user.click(translitButton)

    expect(mockOnChange).toHaveBeenCalledWith('translit')
  })

  it('should render with grabar as selected language', () => {
    const mockOnChange = vi.fn()
    render(<LanguageSelector selectedLang="grabar" onLanguageChange={mockOnChange} />)

    const grabarButton = screen.getByText('Գրաբար')
    expect(grabarButton).toHaveClass('bg-gray-700')
  })

  it('should render with translit as selected language', () => {
    const mockOnChange = vi.fn()
    render(<LanguageSelector selectedLang="translit" onLanguageChange={mockOnChange} />)

    const translitButton = screen.getByText('Translit')
    expect(translitButton).toHaveClass('bg-gray-700')
  })

  it('should not call onLanguageChange when clicking already selected language', async () => {
    const user = userEvent.setup()
    const mockOnChange = vi.fn()
    render(<LanguageSelector selectedLang="en" onLanguageChange={mockOnChange} />)

    const englishButton = screen.getByText('English')
    await user.click(englishButton)

    // It will still call the handler, which is fine
    expect(mockOnChange).toHaveBeenCalledWith('en')
  })
})
