import * as React from 'react'
import { Part } from '../types/part'
import { useLanguage } from '../contexts/LanguageContext'
import clsx from 'clsx'

interface PartCardProps {
  part: Part
}

const styles = {
  card: 'bg-gray-700 p-4 rounded shadow hover:bg-gray-600 transition',
  title: 'font-semibold capitalize mb-2',
  content: 'text-gray-200'
}

export function PartCard({ part }: PartCardProps, ref: React.Ref<HTMLLIElement>) {
  const { selectedLang } = useLanguage()

  const renderPartContent = () => {
    const content = {
      grabar: part.grabar,
      translit: part.translit,
      en: part.en,
      ru: part.ru
    }[selectedLang] || part.en

    return <p className={styles.content}>{content}</p>
  }

  return (
    <li ref={ref} className={styles.card}>
      <h2 className={styles.title}>{part.role}</h2>
      {renderPartContent()}
    </li>
  )
}

export default React.forwardRef(PartCard) 