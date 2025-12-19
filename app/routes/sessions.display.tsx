import { createFileRoute } from '@tanstack/react-router'
import { SessionPartsParallel } from '../components/SessionPartsParallel'
import { useSessionPolling } from '../hooks/useSessionPolling'
import { SessionWrapper } from '../types/session'
import { Message } from '../components/Message'
import { StatusOverlay } from '../components/StatusOverlay'

export const Route = createFileRoute('/sessions/display')({
  component: RouteComponent,
})

function RouteComponent() {
  const { data: sessionWrapper, isLoading, isError } = useSessionPolling()

  const loadingView = (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">Waiting for session...</p>
      </div>
    </div>
  )

  // Show loading view for both loading and error states
  if (isLoading || isError || !sessionWrapper) {
    return loadingView
  }

  const { current_part_position, num_of_parts, options, status, status_message } = sessionWrapper.session
  // Treat undefined status as 'active' for backward compatibility
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
      <SessionPartsParallel sessionId={sessionWrapper.session.id.toString()} />
    </>
  )
}
