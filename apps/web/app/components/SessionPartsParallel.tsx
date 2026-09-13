import ReactMarkdown from 'react-markdown'
import { useSessionParts } from '../hooks/useSessionParts'
import { LANG_FIELD_MAP } from './SessionPartsSingle'
import { PartTextField, getPartTextField, shouldHideSessionPartText } from './sessionPartsUtils'
import type { SessionWrapper } from '../types/session'

interface SessionPartsParallelProps {
  sessionId: string
  lang1?: 'translit' | 'en' | 'hyw' | 'grabar'
  lang2?: 'translit' | 'en' | 'hyw' | 'grabar'
  sessionData?: SessionWrapper
}

export function SessionPartsParallel({
  sessionId,
  lang1 = 'translit',
  lang2 = 'en',
  sessionData,
}: SessionPartsParallelProps) {
  const { partsRef, currentPartId, isLoading, error, data } = useSessionParts(sessionId, { sessionData })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error loading parts</div>
  if (!data?.parts?.length) return <div>No parts available for this session.</div>

  const field1: PartTextField = LANG_FIELD_MAP[lang1]
  const field2: PartTextField = LANG_FIELD_MAP[lang2]

  return (
    <div className="relative w-screen left-[50%] right-[50%] -mx-[50vw] bg-gray-800 text-white p-5 shadow-md">
      {(data?.parts ?? []).map(({ part }) => {
        const isCurrentPart = part.id === Number(currentPartId)
        const text1 = getPartTextField(part, field1)
        const text2 = getPartTextField(part, field2)
        const hide1 = shouldHideSessionPartText(text1)
        const hide2 = shouldHideSessionPartText(text2)

        return (
          <div
            className={`grid ${hide1 || hide2 ? 'grid-cols-1' : 'grid-cols-2'} gap-5 mb-5`}
            key={part.liturgy_part_id ?? part.id}
            data-duration-ms={part.effective_duration_ms}
            ref={(el) => {
              if (el) {
                partsRef.current[part.id] = el
              }
            }}
          >
            {!hide1 && (
              <div
                key={`${lang1}-${part.id}`}
                className={`p-5 bg-gray-700 rounded-lg ${!isCurrentPart ? 'text-slate-500' : ''}`}
              >
                <div className="font-bold uppercase text-slate-300 text-4xl">{part.role}</div>
                <ReactMarkdown className="text-7xl prose prose-invert max-w-none">
                  {text1.split('\n').map(line => line.trimStart()).join('\n\n')}
                </ReactMarkdown>
              </div>
            )}
            {!hide2 && (
              <div
                key={`${lang2}-${part.id}`}
                className={`p-5 bg-gray-700 rounded-lg ${!isCurrentPart ? 'text-slate-500' : ''}`}
              >
                <div className="font-bold uppercase text-slate-300 text-4xl">{part.role}</div>
                <ReactMarkdown className="text-7xl prose prose-invert max-w-none">
                  {text2.split('\n').map(line => line.trimStart()).join('\n\n')}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
