import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '../contexts/LanguageContext'
import { useActionCable } from '../hooks/useActionCable'
import { usePartScroll } from '../hooks/usePartScroll'
import { LanguageSelector } from './LanguageSelector'
import { ReadingAppearanceControl } from './ReadingAppearanceControl'
import PartCard from './PartCard'
import { fetchSession, fetchSessionParts, sessionsKeys } from '../queries/sessions'
import { PartsResponse } from '../types/part'
import type { Language } from '../contexts/LanguageContext'
import { useReadingAppearance } from '../hooks/useReadingAppearance'

interface SessionPartsProps {
  sessionId: string
}

export function SessionParts({ sessionId }: SessionPartsProps) {
  const {
    selectedLang,
    setSelectedLang,
    readingLanguagesBySession,
    setReadingLanguagesForSession,
    activeReadingLanguageBySession,
    setActiveReadingLanguageForSession,
  } = useLanguage()
  const selectedLanguages = readingLanguagesBySession[sessionId] ?? [selectedLang]
  const storedActiveLanguage = activeReadingLanguageBySession[sessionId]
  const activeLanguage = storedActiveLanguage && selectedLanguages.includes(storedActiveLanguage)
    ? storedActiveLanguage
    : selectedLanguages[0]
  const { appearance, resolvedAppearance, setAppearance } = useReadingAppearance()
  const { partsRef, handlePartUpdated } = usePartScroll()
  const queryClient = useQueryClient()
  
  const subscriptionData = useActionCable(`channel_${sessionId}`, 'part_change')

  const { 
    data, 
    isLoading, 
    error 
  } = useQuery<PartsResponse>({
    queryKey: sessionsKeys.sessionParts(sessionId),
    queryFn: async () => {
      const sessionData = await queryClient.fetchQuery({
        queryKey: sessionsKeys.session(sessionId),
        queryFn: () => fetchSession(sessionId),
        staleTime: 1000,
      })
      return fetchSessionParts(sessionId, sessionData)
    },
    staleTime: 0,
    refetchOnMount: true
  })

  React.useEffect(() => {
    if (data?.sessionData.session.current_part_id) {
      handlePartUpdated({ part: data.sessionData.session.current_part_id })
    }
  }, [data, handlePartUpdated])

  React.useEffect(() => {
    if (subscriptionData?.part !== undefined) {
      handlePartUpdated({ part: subscriptionData.part })
    }
  }, [subscriptionData, handlePartUpdated])

  const handleLanguagesApply = React.useCallback((languages: Language[]) => {
    const nextActiveLanguage = languages.includes(activeLanguage) ? activeLanguage : languages[0]
    setReadingLanguagesForSession(sessionId, languages)
    setActiveReadingLanguageForSession(sessionId, nextActiveLanguage)
    setSelectedLang(nextActiveLanguage)
  }, [activeLanguage, sessionId, setActiveReadingLanguageForSession, setReadingLanguagesForSession, setSelectedLang])

  const handleActiveLanguageChange = React.useCallback((language: Language) => {
    setActiveReadingLanguageForSession(sessionId, language)
    setSelectedLang(language)
  }, [sessionId, setActiveReadingLanguageForSession, setSelectedLang])

  if (isLoading) {
    return <div className="tarkman-reader-status tarkman-design" data-theme={resolvedAppearance}>Loading service…</div>
  }
  if (error) {
    return (
      <div className="tarkman-reader-status tarkman-design" data-theme={resolvedAppearance} role="alert">
        The service could not be loaded. Refresh to try again.
      </div>
    )
  }
  if (!data?.parts?.length) {
    return <div className="tarkman-reader-status tarkman-design" data-theme={resolvedAppearance}>No readings are available for this service.</div>
  }

  const session = data.sessionData.session
  const serviceTitle = session.liturgy.trim() || 'Service reading'
  const churchName = session.church_name?.trim()

  return (
    <section className="tarkman-reader tarkman-design" data-theme={resolvedAppearance} aria-label="Service reading">
      <header className="reading-page-heading">
        <h1>{serviceTitle}</h1>
        {churchName ? <p>{churchName}</p> : null}
      </header>
      <div className="reading-toolbar sticky">
        <LanguageSelector
          value={selectedLanguages}
          activeValue={activeLanguage}
          onActiveChange={handleActiveLanguageChange}
          onApply={handleLanguagesApply}
        />
        <ReadingAppearanceControl value={appearance} onChange={setAppearance} />
      </div>
      <ul className="reading-parts">
        {(data?.parts ?? []).map(({ part }) => (
          <PartCard
            key={part.liturgy_part_id ?? part.id}
            ref={(el) => {
              if (el) {
                partsRef.current[part.id] = el
              }
            }}
            part={part}
            sessionId={sessionId}
            selectedLanguages={selectedLanguages}
            activeLanguage={activeLanguage}
          />
        ))}
      </ul>
    </section>
  )
}
