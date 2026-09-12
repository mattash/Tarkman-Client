import * as React from 'react'
import { useIsMutating, useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import {
  sessionsKeys,
  sessionMutationKeys,
  prevPart,
  nextPart,
  fetchSession,
  classifyControlFailure,
  controlFailureMessage,
} from '@/queries/sessions'
import { SessionWrapper } from '@/types/session'
import { SessionStatusControl } from './SessionStatusControl'

interface SessionControlsProps {
  sessionId: number
}

export function SessionControls({ sessionId }: SessionControlsProps) {
  const queryClient = useQueryClient()
  const sessionIdString = sessionId.toString()
  const mutationKey = sessionMutationKeys.controls(sessionIdString)
  const pendingCommandCount = useIsMutating({ mutationKey, exact: true })
  const [commandError, setCommandError] = React.useState<string | null>(null)

  const { data: sessionData } = useQuery<SessionWrapper>({
    queryKey: sessionsKeys.session(sessionIdString),
    queryFn: () => fetchSession(sessionIdString),
    staleTime: 1000
  })

  const currentPartId = sessionData?.session?.current_part_id ?? null

  const refreshFromServer = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: sessionsKeys.session(sessionIdString) }),
    queryClient.invalidateQueries({ queryKey: sessionsKeys.sessionParts(sessionIdString) }),
  ])

  const partMutation = useMutation({
    mutationKey,
    mutationFn: (direction: 'previous' | 'next') => {
      const transitionedAt = new Date().toISOString()
      return direction === 'previous'
        ? prevPart(sessionIdString, transitionedAt, currentPartId)
        : nextPart(sessionIdString, transitionedAt, currentPartId)
    },
    onMutate: () => setCommandError(null),
    onSuccess: async () => {
      await refreshFromServer()
    },
    onError: async (error) => {
      const failure = classifyControlFailure(error)
      setCommandError(controlFailureMessage(failure, 'position'))
      // A refused stale move means this screen is behind; show where the service actually is.
      if (failure.kind === 'stale') await refreshFromServer()
    },
  })

  const runPartCommand = (direction: 'previous' | 'next') => {
    if (queryClient.isMutating({ mutationKey, exact: true }) > 0) return
    partMutation.mutate(direction)
  }

  const isCommandPending = pendingCommandCount > 0

  return (
    <div className="flex gap-4 items-center p-4 rounded-lg bg-white shadow-md">
      <button
        onClick={() => runPartCommand('previous')}
        disabled={isCommandPending}
        className="px-5 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Previous part"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-8 w-8" 
          viewBox="0 0 20 20" 
          fill="currentColor"
        >
          <path 
            fillRule="evenodd" 
            d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" 
            clipRule="evenodd" 
          />
        </svg>
      </button>

      <button
        onClick={() => runPartCommand('next')}
        disabled={isCommandPending}
        className="px-5 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Next part"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <SessionStatusControl
        sessionId={sessionId}
        currentStatus={sessionData?.session?.status}
      />
      {commandError && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {commandError}
        </p>
      )}
    </div>
  )
} 
