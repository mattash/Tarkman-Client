import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import { useSessionParts } from '../hooks/useSessionParts'
import { Part } from '../types/part'

export const LANG_FIELD_MAP = {
  translit: 'translit',
  en: 'en',
  hyw: 'hy_west',
} as const

export type LangKey = keyof typeof LANG_FIELD_MAP

type PartTextField = 'translit' | 'en' | 'hy_west'

function getPartTextField(part: Part, field: PartTextField): string {
  return part[field] ?? ''
}

interface SessionPartsSingleProps {
  sessionId: string
  lang1?: 'translit' | 'en' | 'hyw'
}

const HIDDEN_SENTINELS = new Set(['HOLD', 'NA', 'EMPTY'])

export function SessionPartsSingle({ sessionId, lang1 = 'translit' }: SessionPartsSingleProps) {
  const { partsRef, currentPartId, isLoading, error, data } = useSessionParts(sessionId)

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error loading parts</div>
  if (!data?.parts?.length) return <div>No parts available for this session.</div>

  const field: PartTextField = LANG_FIELD_MAP[lang1]

  return (
    <div className="relative w-screen left-[50%] right-[50%] -mx-[50vw] bg-gray-800 text-white p-5 shadow-md">
      {(data?.parts ?? []).map(({ part }) => {
        const isCurrentPart = part.id === Number(currentPartId)
        const text = getPartTextField(part, field)
        const hide = HIDDEN_SENTINELS.has(text?.trim().toUpperCase())

        if (hide) return null

        return (
          <div
            className="mb-5"
            key={part.id}
            data-duration-ms={part.effective_duration_ms}
            ref={(el) => {
              if (el) {
                partsRef.current[part.id] = el
              }
            }}
          >
            <div
              className={`p-5 bg-gray-700 rounded-lg ${!isCurrentPart ? 'text-slate-500' : ''}`}
            >
              <div className="font-bold uppercase text-slate-300 text-7xl">{part.role}</div>
              <ReactMarkdown className="text-9xl prose prose-invert max-w-none">
                {text.split('\n').map(line => line.trimStart()).join('\n\n')}
              </ReactMarkdown>
            </div>
          </div>
        )
      })}
    </div>
  )
}
