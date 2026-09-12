import React, { createContext, useContext, useState } from 'react'

export type Language = 'en' | 'ru' | 'grabar' | 'translit'

interface LanguageContextType {
  selectedLang: Language
  setSelectedLang: (lang: Language) => void
  readingLanguagesBySession: Record<string, Language[]>
  setReadingLanguagesForSession: (sessionId: string, languages: Language[]) => void
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [selectedLang, setSelectedLang] = useState<Language>('en')
  const [readingLanguagesBySession, setReadingLanguagesBySession] = useState<Record<string, Language[]>>({})

  const setReadingLanguagesForSession = React.useCallback((sessionId: string, languages: Language[]) => {
    setReadingLanguagesBySession((current) => ({ ...current, [sessionId]: languages }))
  }, [])

  return (
    <LanguageContext.Provider
      value={{ selectedLang, setSelectedLang, readingLanguagesBySession, setReadingLanguagesForSession }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
