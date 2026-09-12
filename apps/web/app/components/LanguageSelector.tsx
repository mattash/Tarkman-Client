import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Check, Languages, X } from 'lucide-react'
import type { Language } from '../contexts/LanguageContext'
import { LANGUAGES } from '../constants/languages'

interface LanguageSelectorProps {
  value: Language[]
  onApply: (languages: Language[]) => void
}

export function LanguageSelector({ value, onApply }: LanguageSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<Language[]>(value)

  const resetDraft = React.useCallback(() => setDraft(value), [value])
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) resetDraft()
    setOpen(nextOpen)
  }
  const toggleLanguage = (language: Language) => {
    setDraft((current) => current.includes(language)
      ? current.filter((candidate) => candidate !== language)
      : [...current, language])
  }
  const handleApply = () => {
    if (draft.length === 0) return
    const orderedDraft = LANGUAGES.map(({ value: language }) => language)
      .filter((language) => draft.includes(language))
    onApply(orderedDraft)
    setOpen(false)
  }

  const selectedLabel = value.length === 1 ? '1 language' : `${value.length} languages`

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button type="button" className="reading-toolbar-button">
          <Languages aria-hidden="true" />
          <span>Languages</span>
          <span className="reading-toolbar-button__meta">{selectedLabel}</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="reading-dialog-overlay" />
        <Dialog.Content className="reading-dialog-content tarkman-design">
          <div className="reading-dialog-heading">
            <div>
              <Dialog.Title>Choose reading languages</Dialog.Title>
              <Dialog.Description>
                Show one language or compare several in the service.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="reading-icon-button" aria-label="Close language settings">
                <X aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <fieldset className="reading-language-options">
            <legend className="sr-only">Languages to show</legend>
            {LANGUAGES.map(({ value: language, label }) => {
              const checked = draft.includes(language)
              return (
                <label key={language} className="reading-language-option">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleLanguage(language)}
                  />
                  <span className="reading-language-option__check" aria-hidden="true">
                    {checked ? <Check /> : null}
                  </span>
                  <span lang={language === 'grabar' ? 'hy' : language === 'translit' ? 'hy-Latn' : language}>
                    {label}
                  </span>
                </label>
              )
            })}
          </fieldset>

          {draft.length === 0 ? (
            <p className="reading-language-error" role="alert">Choose at least one language.</p>
          ) : null}

          <div className="reading-dialog-actions">
            <Dialog.Close asChild>
              <button type="button" className="reading-button reading-button--secondary" onClick={resetDraft}>
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              className="reading-button reading-button--primary"
              disabled={draft.length === 0}
              onClick={handleApply}
            >
              Apply languages
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
