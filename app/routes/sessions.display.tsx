import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { SessionPartsParallel } from '../components/SessionPartsParallel'
import { SessionPartsSingle } from '../components/SessionPartsSingle'
import { useSessionPolling } from '../hooks/useSessionPolling'
import { useUserSessionPolling } from '../hooks/useUserSessionPolling'
import { fetchDisplayLink, displayLinkKeys } from '../queries/displayLinks'
import { Message } from '../components/Message'
import { StatusOverlay } from '../components/StatusOverlay'
import { MinimalStatusView } from '../components/MinimalStatusView'
import { ExplanationIndicator } from '../components/ExplanationIndicator'

export const Route = createFileRoute('/sessions/display')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      token: typeof search.token === 'string' ? search.token : undefined,
    }
  },
})

function RouteComponent() {
  const { token } = Route.useSearch()

  // Fetch display link config when token is present
  const {
    data: config,
    isLoading: configLoading,
    isError: configError,
  } = useQuery({
    queryKey: displayLinkKeys.detail(token || ''),
    queryFn: () => fetchDisplayLink(token!),
    enabled: !!token,
    retry: false,
  })

  // Existing default-church polling (no token path)
  const {
    data: defaultSession,
    isLoading: defaultLoading,
    isError: defaultError,
  } = useSessionPolling({ enabled: !token })

  // User-scoped polling (token path)
  const {
    data: userSession,
    isLoading: userLoading,
    isError: userError,
  } = useUserSessionPolling(config?.user_id?.toString() || null)

  const usingToken = !!token
  const sessionWrapper = usingToken ? userSession : defaultSession
  const isLoading = usingToken ? configLoading || userLoading : defaultLoading
  const isError = usingToken ? configError || userError : defaultError

  const loadingView = (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">Waiting for session...</p>
      </div>
    </div>
  )

  // Invalid or expired display link token
  if (token && configError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Invalid or expired display link.</p>
        </div>
      </div>
    )
  }

  if (isLoading || isError || !sessionWrapper) {
    return loadingView
  }

  const { current_part_position, num_of_parts, options, status, status_message } = sessionWrapper.session

  // Resolve preferences: token config overrides, otherwise defaults
  const showNotifications = config?.show_notifications ?? true
  const showExplanations = config?.show_explanations ?? true
  const mode = config?.mode ?? 'parallel'
  const lang1 = config?.lang1 ?? 'translit'
  const lang2 = config?.lang2 ?? 'en'
  const statusView = config?.status_view ?? 'full'

  const showWelcomeMessage = showNotifications &&
    current_part_position === 0 &&
    options.before_message &&
    (!status || status === 'active')
  const showFarewellMessage = showNotifications &&
    current_part_position === num_of_parts - 1 &&
    options.after_message &&
    (!status || status === 'active')

  // None status view: skip overlays, messages, show only parts + explanations
  const isNoneView = statusView === 'none'

  // Minimal status view for pages_only / posture_only
  if (statusView === 'pages_only') {
    return (
      <MinimalStatusView
        statusView="pages_only"
        page={sessionWrapper.session.page}
      />
    )
  }

  if (statusView === 'posture_only') {
    return (
      <MinimalStatusView
        statusView="posture_only"
        posture={sessionWrapper.session.posture}
      />
    )
  }

  return (
    <>
      {!isNoneView && (
        <StatusOverlay
          status={status || 'active'}
          statusMessage={status_message}
          sessionOptions={options}
          enabled={statusView === 'full'}
        />
      )}
      {!isNoneView && showWelcomeMessage && <Message message={options.before_message} />}
      {!isNoneView && showFarewellMessage && <Message message={options.after_message} />}

      {mode === 'parallel' ? (
        <SessionPartsParallel
          sessionId={sessionWrapper.session.id.toString()}
          lang1={lang1}
          lang2={lang2}
        />
      ) : (
        <SessionPartsSingle
          sessionId={sessionWrapper.session.id.toString()}
          lang1={lang1}
        />
      )}

      <ExplanationIndicator
        sessionId={sessionWrapper.session.id.toString()}
        enabled={showExplanations}
      />
    </>
  )
}
