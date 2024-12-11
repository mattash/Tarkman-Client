import * as React from 'react'
import { Language } from '../contexts/LanguageContext'
import { LANGUAGES } from '../constants/languages'

interface LanguageSelectorProps {
  selectedLang: Language
  onLanguageChange: (lang: Language) => void
}

export function LanguageSelector({ selectedLang, onLanguageChange }: LanguageSelectorProps) {
  return (
    <div className="sticky top-0 flex justify-center mb-6 bg-gray-800 py-2 z-10 rounded">
      {LANGUAGES.map(({ value, label }) => (
        <button
          key={value}
          className={`px-4 py-2 ${
            value === LANGUAGES[0].value ? 'rounded-l' : ''
          } ${
            value === LANGUAGES[LANGUAGES.length - 1].value ? 'rounded-r' : ''
          } ${selectedLang === value ? 'bg-gray-700' : 'bg-gray-600'}`}
          onClick={() => onLanguageChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  )
} 