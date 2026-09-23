import { readingKey } from '../hooks/sessionOccurrence'
import ReactMarkdown from 'react-markdown'
import { useSessionParts } from '../hooks/useSessionParts'
import { LANG_FIELD_MAP } from './SessionPartsSingle'
import { PartTextField, getPartTextField, shouldHideSessionPartText } from './sessionPartsUtils'
import type { SessionWrapper } from '../types/session'
import type { LiveSessionReading } from '../hooks/useLiveSession'

interface SessionPartsParallelProps {
  sessionId: string
  lang1?: 'translit' | 'en' | 'hyw' | 'grabar'
  lang2?: 'translit' | 'en' | 'hyw' | 'grabar'
  sessionData?: SessionWrapper
  live?: LiveSessionReading
}

export function SessionPartsParallel({
  sessionId,
  lang1 = 'translit',
  lang2 = 'en',
  sessionData,
  live,
}: SessionPartsParallelProps) {
  return live
    ? <SessionPartsParallelContent lang1={lang1} lang2={lang2} live={live} />
    : <StandaloneSessionPartsParallel sessionId={sessionId} lang1={lang1} lang2={lang2} sessionData={sessionData} />
}

function StandaloneSessionPartsParallel({ sessionId, lang1, lang2, sessionData }: Required<Pick<SessionPartsParallelProps, 'sessionId' | 'lang1' | 'lang2'>> & Pick<SessionPartsParallelProps, 'sessionData'>) {
  const result = useSessionParts(sessionId, { sessionData })
  const live: LiveSessionReading = { ...result, sessionData: result.data?.sessionData ?? sessionData!, parts: result.data?.parts ?? [], connectionState: 'connected' }
  return <SessionPartsParallelContent lang1={lang1} lang2={lang2} live={live} />
}

function SessionPartsParallelContent({ lang1, lang2, live }: { lang1: NonNullable<SessionPartsParallelProps['lang1']>; lang2: NonNullable<SessionPartsParallelProps['lang2']>; live: LiveSessionReading }) {
  const { partsRef, currentPartKey, isLoading, error, parts } = live

  if (isLoading) return <div>Loading...</div>
  if (error && !parts.length) return <div>Error loading parts</div>
  if (!parts.length) return <div>No parts available for this session.</div>

  const field1: PartTextField = LANG_FIELD_MAP[lang1]
  const field2: PartTextField = LANG_FIELD_MAP[lang2]

  return (
    <div className="relative w-screen left-[50%] right-[50%] -mx-[50vw] bg-gray-800 text-white p-5 shadow-md">
      {parts.map(({ part }) => {
        const key = readingKey(part)
        const isCurrentPart = key === currentPartKey
        const text1 = getPartTextField(part, field1)
        const text2 = getPartTextField(part, field2)
        const hide1 = shouldHideSessionPartText(text1)
        const hide2 = shouldHideSessionPartText(text2)

        return (
          <div
            className={`grid ${hide1 || hide2 ? 'grid-cols-1' : 'grid-cols-2'} gap-5 mb-5`}
            key={key}
            data-duration-ms={part.effective_duration_ms}
            data-reading-key={key}
            data-current={isCurrentPart}
            ref={(el) => {
              if (el) {
                partsRef.current[key] = el
              } else {
                delete partsRef.current[key]
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
