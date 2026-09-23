import * as React from 'react'
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import {
  sessionsKeys,
  sessionMutationKeys,
  setPart,
  fetchSession,
  classifyControlFailure,
  controlFailureMessage,
} from '@/queries/sessions'
import { SessionWrapper } from '@/types/session'
import { acceptCommandPublication, recoverRejectedCommand } from '@/queries/sessionState'

interface FastForwardButtonProps {
  sessionId: string
  partId: number
}

export function FastForwardButton({ sessionId, partId }: FastForwardButtonProps) {
  const queryClient = useQueryClient()
  const auth = useAuth()
  const mutationKey = sessionMutationKeys.controls(sessionId)
  const pendingCommandCount = useIsMutating({ mutationKey, exact: true })
  const [commandError, setCommandError] = React.useState<string | null>(null)

  // Shares the cache entry the controls already keep warm, so this adds no extra request.
  const { data: sessionData } = useQuery<SessionWrapper>({
    queryKey: sessionsKeys.session(sessionId),
    queryFn: () => fetchSession(sessionId),
    staleTime: 1000,
  })

  const refreshFromServer = () => recoverRejectedCommand(queryClient, sessionId)

  const setPartMutation = useMutation({
    mutationKey,
    mutationFn: () => setPart(sessionId, partId, new Date().toISOString(), sessionData?.session?.current_part_id ?? null, sessionData?.session?.revision),
    onMutate: () => setCommandError(null),
    onSuccess: async (response) => {
      if (!acceptCommandPublication(queryClient, sessionId, response)) await refreshFromServer()
    },
    onError: async (error) => {
      const failure = classifyControlFailure(error)
      setCommandError(controlFailureMessage(failure, 'position'))
      if (failure.kind === 'stale') await refreshFromServer()
    },
  })

  const isCommandPending = pendingCommandCount > 0

  const handleFastForward = () => {
    if (queryClient.isMutating({ mutationKey, exact: true }) > 0) return
    setPartMutation.mutate()
  }

  if (!auth.user) {
    return null
  }

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <button
        onClick={handleFastForward}
        disabled={isCommandPending}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-md transition-colors
          ${isCommandPending
            ? 'bg-blue-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
          } text-white`}
        title="Fast forward to this part"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 ${isCommandPending ? 'animate-spin' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          {isCommandPending ? (
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
              clipRule="evenodd"
            />
          ) : (
            <>
              <path
                fillRule="evenodd"
                d="M4.293 15.707a1 1 0 010-1.414L8.586 10 4.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
              <path
                fillRule="evenodd"
                d="M10.293 15.707a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </>
          )}
        </svg>
        {isCommandPending ? 'Setting...' : 'Fast Forward'}
      </button>
      {commandError && (
        <p role="alert" className="text-sm font-medium text-red-400">
          {commandError}
        </p>
      )}
    </div>
  )
}
