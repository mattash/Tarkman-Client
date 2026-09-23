import { readingKey } from '../hooks/sessionOccurrence'
import ReactMarkdown from 'react-markdown'
import { useSessionParts } from '../hooks/useSessionParts'
import { PartTextField, getPartTextField, shouldHideSessionPartText } from './sessionPartsUtils'
import type { SessionWrapper } from '../types/session'
import type { LiveSessionReading } from '../hooks/useLiveSession'

export const LANG_FIELD_MAP = {
  translit: 'translit',
  en: 'en',
  hyw: 'hy_west',
  grabar: 'grabar',
} as const

interface SessionPartsSingleProps {
  sessionId: string
  lang1?: 'translit' | 'en' | 'hyw' | 'grabar'
  sessionData?: SessionWrapper
  live?: LiveSessionReading
}

export function SessionPartsSingle({
  sessionId,
  lang1 = 'translit',
  sessionData,
  live,
}: SessionPartsSingleProps) {
  return live
    ? <SessionPartsSingleContent lang1={lang1} live={live} />
    : <StandaloneSessionPartsSingle sessionId={sessionId} lang1={lang1} sessionData={sessionData} />
}

function StandaloneSessionPartsSingle({ sessionId, lang1, sessionData }: Required<Pick<SessionPartsSingleProps, 'sessionId' | 'lang1'>> & Pick<SessionPartsSingleProps, 'sessionData'>) {
  const result = useSessionParts(sessionId, { sessionData })
  const live: LiveSessionReading = { ...result, sessionData: result.data?.sessionData ?? sessionData!, parts: result.data?.parts ?? [], connectionState: 'connected' }
  return <SessionPartsSingleContent lang1={lang1} live={live} />
}

function SessionPartsSingleContent({ lang1, live }: { lang1: NonNullable<SessionPartsSingleProps['lang1']>; live: LiveSessionReading }) {
  const { partsRef, currentPartKey, isLoading, error, parts } = live

  if (isLoading) return <div>Loading...</div>
  if (error && !parts.length) return <div>Error loading parts</div>
  if (!parts.length) return <div>No parts available for this session.</div>

  const field: PartTextField = LANG_FIELD_MAP[lang1]

  return (
    <div className="relative w-screen left-[50%] right-[50%] -mx-[50vw] bg-gray-800 text-white p-5 shadow-md">
      {parts.map(({ part }) => {
        const key = readingKey(part)
        const isCurrentPart = key === currentPartKey
        const text = getPartTextField(part, field)
        const hide = shouldHideSessionPartText(text)

        if (hide) return null

        return (
          <div
            className="mb-5"
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
            <div
              className={`p-5 bg-gray-700 rounded-lg ${!isCurrentPart ? 'text-slate-500' : ''}`}
            >
              <div className="font-bold uppercase text-slate-300 text-3xl">{part.role}</div>
              <ReactMarkdown className="text-6xl prose prose-invert max-w-none">
                {text.split('\n').map(line => line.trimStart()).join('\n\n')}
              </ReactMarkdown>
            </div>
          </div>
        )
      })}
    </div>
  )
}
