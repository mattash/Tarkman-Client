import { Language } from '../contexts/LanguageContext'

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Russian' },
  { value: 'grabar', label: 'Grabar' },
  { value: 'translit', label: 'Transliteration' }
] 