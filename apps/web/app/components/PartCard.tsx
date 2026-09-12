import * as React from 'react'
import { Part } from '../types/part'
import type { Language } from '../contexts/LanguageContext'
import { Link } from '@tanstack/react-router'
import ReactMarkdown from 'react-markdown'

export interface PartCardProps {
  part: Part
  sessionId: string
  selectedLanguages: Language[]
  activeLanguage: Language
}

const languageDetails: Record<Language, { label: string; lang: string }> = {
  en: { label: 'English', lang: 'en' },
  ru: { label: 'Russian', lang: 'ru' },
  grabar: { label: 'Classical Armenian', lang: 'hy' },
  translit: { label: 'Transliteration', lang: 'hy-Latn' },
}

const contentForLanguage = (part: Part, language: Language) => ({
  grabar: part.grabar,
  translit: part.translit,
  en: part.en,
  ru: part.ru,
})[language]

const prepareMarkdown = (content: string) => content
  .split('\n')
  .map((line) => line.trimStart())
  .join('\n\n')

export function PartCard(
  { part, sessionId, selectedLanguages, activeLanguage }: PartCardProps,
  ref: React.Ref<HTMLLIElement>,
) {

  return (
    <li ref={ref} className="reading-part">
      <Link
        to="/sessions/$id/part/$partId"
        params={{
          id: sessionId,
          partId: part.id.toString()
        }}
        className="reading-part__link"
      >
        <h2 className="reading-part__role">{part.role}</h2>
        <div className={`reading-part__languages reading-part__languages--${selectedLanguages.length}`}>
          {selectedLanguages.map((language) => {
            const details = languageDetails[language]
            const content = contentForLanguage(part, language)
            return (
              <section
                key={language}
                className={`reading-language reading-language--${language}${language === activeLanguage ? ' reading-language--active' : ''}`}
                lang={details.lang}
              >
                <h3 lang="en">{details.label}</h3>
                {content?.trim() ? (
                  <ReactMarkdown className="reading-language__content">
                    {prepareMarkdown(content)}
                  </ReactMarkdown>
                ) : (
                  <p className="reading-language__missing" lang="en">
                    {details.label} is unavailable for this passage.
                  </p>
                )}
              </section>
            )
          })}
        </div>
      </Link>
    </li>
  )
}

export default React.forwardRef(PartCard)
