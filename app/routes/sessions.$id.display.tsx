import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { fetchSession, sessionsKeys } from '@/queries/sessions'
import { fetchDisplayLink, displayLinkKeys } from '@/queries/displayLinks'
import { SessionPartsParallel } from '@/components/SessionPartsParallel'
import { SessionPartsSingle } from '@/components/SessionPartsSingle'
import { Message } from '@/components/Message'
import { StatusOverlay } from '@/components/StatusOverlay'
import { MinimalStatusView } from '@/components/MinimalStatusView'
import { ExplanationIndicator } from '@/components/ExplanationIndicator'
import { DisplayLanguage } from '@/types/displayLink'

export const Route = createFileRoute('/sessions/$id/display')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      token: typeof search.token === 'string' ? search.token : undefined,
      mode: typeof search.mode === 'string' && (search.mode === 'parallel' || search.mode === 'single')
        ? search.mode as 'parallel' | 'single'
        : undefined,
      lang1: typeof search.lang1 === 'string' && (search.lang1 === 'translit' || search.lang1 === 'en' || search.lang1 === 'hyw')
        ? search.lang1 as DisplayLanguage
        : undefined,
      lang2: typeof search.lang2 === 'string' && (search.lang2 === 'translit' || search.lang2 === 'en' || search.lang2 === 'hyw')
        ? search.lang2 as DisplayLanguage
        : undefined,
      show_explanations: typeof search.show_explanations === 'string'
        ? search.show_explanations === '1' || search.show_explanations === 'true'
        : undefined,
      show_notifications: typeof search.show_notifications === 'string'
        ? search.show_notifications === '1' || search.show_notifications === 'true'
        : undefined,
      status_view: typeof search.status_view === 'string' &&
        (search.status_view === 'full' || search.status_view === 'pages_only' || search.status_view === 'posture_only')
        ? search.status_view as 'full' | 'pages_only' | 'posture_only'
        : undefined,
    }
  },
})

function RouteComponent() {
  const { id } = Route.useParams()
  const { token, ...directPrefs } = Route.useSearch()

  // Fetch display link config when token is present
  const { data: config, isLoading: configLoading, isError: configError } = useQuery({
    queryKey: displayLinkKeys.detail(token || ''),
    queryFn: () => fetchDisplayLink(token!),
    enabled: !!token,
    retry: false,
  })

  const { data: sessionWrapper, isLoading, isError } = useQuery({
    queryKey: sessionsKeys.session(id),
    queryFn: () => fetchSession(id),
    retry: true,
    retryDelay: (attemptIndex) => Math.min(1000 * (2 ** attemptIndex), 30000),
    refetchInterval: 1000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    gcTime: 1000 * 60 * 5,
  })

  const effectiveLoading = isLoading || (!!token && configLoading)

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

  if (effectiveLoading || isError || !sessionWrapper) {
    return loadingView
  }

  const { current_part_position, num_of_parts, options, status, status_message } = sessionWrapper.session

  // Resolve preferences: token config > direct search params > defaults
  const showNotifications = config?.show_notifications ?? directPrefs.show_notifications ?? true
  const showExplanations = config?.show_explanations ?? directPrefs.show_explanations ?? true
  const mode = config?.mode ?? directPrefs.mode ?? 'parallel'
  const lang1 = config?.lang1 ?? directPrefs.lang1 ?? 'translit'
  const lang2 = config?.lang2 ?? directPrefs.lang2 ?? 'en'
  const statusView = config?.status_view ?? directPrefs.status_view ?? 'full'

  const showWelcomeMessage = showNotifications &&
    current_part_position === 0 &&
    options.before_message &&
    (!status || status === 'active')
  const showFarewellMessage = showNotifications &&
    current_part_position === num_of_parts - 1 &&
    options.after_message &&
    (!status || status === 'active')

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
      <StatusOverlay
        status={status || 'active'}
        statusMessage={status_message}
        sessionOptions={options}
        enabled={statusView === 'full'}
      />
      {showWelcomeMessage && <Message message={options.before_message} />}
      {showFarewellMessage && <Message message={options.after_message} />}

      {mode === 'parallel' ? (
        <SessionPartsParallel
          sessionId={id}
          lang1={lang1}
          lang2={lang2}
        />
      ) : (
        <SessionPartsSingle
          sessionId={id}
          lang1={lang1}
        />
      )}

      <ExplanationIndicator
        sessionId={id}
        enabled={showExplanations}
      />
    </>
  )
}
