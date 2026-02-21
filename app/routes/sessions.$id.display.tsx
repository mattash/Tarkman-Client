import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { fetchSession, sessionsKeys } from '@/queries/sessions'
import { SessionPartsParallel } from '@/components/SessionPartsParallel'
import { Message } from '@/components/Message'
import { StatusOverlay } from '@/components/StatusOverlay'
import { ExplanationIndicator } from '@/components/ExplanationIndicator'

export const Route = createFileRoute('/sessions/$id/display')({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
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

  const loadingView = (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">Waiting for session...</p>
      </div>
    </div>
  )

  if (isLoading || isError || !sessionWrapper) {
    return loadingView
  }

  const { current_part_position, num_of_parts, options, status, status_message } = sessionWrapper.session
  const showWelcomeMessage = current_part_position === 0 && options.before_message && (!status || status === 'active')
  const showFarewellMessage = current_part_position === (num_of_parts - 1) && options.after_message && (!status || status === 'active')

  return (
    <>
      <StatusOverlay
        status={status || 'active'}
        statusMessage={status_message}
        sessionOptions={options}
      />
      {showWelcomeMessage && <Message message={options.before_message} />}
      {showFarewellMessage && <Message message={options.after_message} />}
      <SessionPartsParallel sessionId={id} />
      <ExplanationIndicator sessionId={id} />
    </>
  )
}
