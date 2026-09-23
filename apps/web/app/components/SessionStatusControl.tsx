import * as React from 'react'
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'
import { updateSessionStatus, sessionMutationKeys, classifyControlFailure, controlFailureMessage } from '@/queries/sessions'
import { SessionStatus, STATUS_LABELS } from '@/types/status'
import { CustomMessageModal } from './CustomMessageModal'
import { acceptCommandPublication, recoverRejectedCommand } from '@/queries/sessionState'

interface SessionStatusControlProps {
  sessionId: number
  currentStatus?: SessionStatus
  currentRevision?: number
}

export function SessionStatusControl({ sessionId, currentStatus = 'active', currentRevision }: SessionStatusControlProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [customMessageModalOpen, setCustomMessageModalOpen] = React.useState(false)
  const [commandError, setCommandError] = React.useState<string | null>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const sessionIdString = sessionId.toString()
  const mutationKey = sessionMutationKeys.controls(sessionIdString)
  const pendingCommandCount = useIsMutating({ mutationKey, exact: true })
  const isCommandPending = pendingCommandCount > 0

  const statusMutation = useMutation({
    mutationKey,
    mutationFn: (request: { status: SessionStatus; status_message?: string }) =>
      updateSessionStatus(sessionIdString, { ...request, ...(currentRevision == null ? {} : { expected_revision: currentRevision }) }),
    onMutate: () => setCommandError(null),
    onSuccess: async (response) => {
      if (!acceptCommandPublication(queryClient, sessionIdString, response)) {
        await recoverRejectedCommand(queryClient, sessionIdString)
      }
      setIsOpen(false)
      setCustomMessageModalOpen(false)
    },
    onError: (error) => setCommandError(controlFailureMessage(classifyControlFailure(error), 'status')),
  })

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleStatusSelect = (status: SessionStatus) => {
    if (queryClient.isMutating({ mutationKey, exact: true }) > 0) {
      return
    }

    if (status === 'showing_custom') {
      setCustomMessageModalOpen(true)
      setIsOpen(false)
    } else {
      setIsOpen(false)
      statusMutation.mutate({ status })
    }
  }

  const handleCustomMessageSubmit = (message: string) => {
    if (queryClient.isMutating({ mutationKey, exact: true }) > 0) return
    statusMutation.mutate({ status: 'showing_custom', status_message: message })
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isCommandPending}
          className="px-4 py-3 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          aria-label="Change session status"
        >
          <span>{STATUS_LABELS[currentStatus]}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]">
            {(Object.keys(STATUS_LABELS) as SessionStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => handleStatusSelect(status)}
                disabled={isCommandPending}
                className={`w-full text-left px-4 py-2 text-gray-900 hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                  status === currentStatus ? 'bg-gray-50 font-semibold' : ''
                }`}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        )}
      </div>

      <CustomMessageModal
        isOpen={customMessageModalOpen}
        onClose={() => setCustomMessageModalOpen(false)}
        onSubmit={handleCustomMessageSubmit}
        isPending={isCommandPending}
      />
      {commandError && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {commandError}
        </p>
      )}
    </>
  )
}
