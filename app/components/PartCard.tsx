import * as React from 'react'
import { Part } from '../types/part'
import { useLanguage } from '../contexts/LanguageContext'
import { Link } from '@tanstack/react-router'
import ReactMarkdown from 'react-markdown'
import clsx from 'clsx'

export interface PartCardProps {
  part: Part
  sessionId: string
}

const styles = {
  card: 'bg-gray-700 p-4 rounded shadow hover:bg-gray-600 transition cursor-pointer',
  title: 'font-semibold capitalize mb-2',
  content: 'text-gray-200 prose prose-invert prose-sm max-w-none'
}

export function PartCard({ part, sessionId }: PartCardProps, ref: React.Ref<HTMLLIElement>) {
  const { selectedLang } = useLanguage()

  const renderPartContent = () => {
    const content = {
      grabar: part.grabar,
      translit: part.translit,
      en: part.en,
      ru: part.ru
    }[selectedLang] || part.en

    // Process content to prevent unwanted code blocks
    // Remove any leading whitespace that might cause Markdown to interpret as code blocks
    const processedContent = content.split('\n').map(line => line.trimStart()).join('\n\n')

    return (
      <ReactMarkdown 
        className={styles.content}
      >
        {processedContent}
      </ReactMarkdown>
    )
  }

  return (
    <li ref={ref} className={styles.card}>
      <Link
        to="/sessions/$id/part/$partId"
        params={{
          id: sessionId,
          partId: part.id.toString()
        }}
        className="block"
      >
        <h2 className={styles.title}>{part.role}</h2>
        {renderPartContent()}
      </Link>
    </li>
  )
}

export default React.forwardRef(PartCard) 