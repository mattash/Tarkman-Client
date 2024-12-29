import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import { useAuth } from '@/contexts/AuthContext'

interface FastForwardButtonProps {
  sessionId: string
  partId: number
}

interface SessionPartResponse {
  id: number
  current_part: {
    id: number
    name: string
    metadata: Record<string, unknown>
  }
}

export function FastForwardButton({ sessionId, partId }: FastForwardButtonProps) {
  const queryClient = useQueryClient()
  const auth = useAuth()

  const setPartMutation = useMutation<SessionPartResponse>({
    mutationFn: async () => {
      const { data } = await api.post<SessionPartResponse>(`/s/${sessionId}/set_part`, {
        part_id: partId
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', sessionId] })
    }
  })

  if (!auth.user) {
    return null
  }

  return (
    <button
      onClick={() => setPartMutation.mutate()}
      disabled={setPartMutation.isPending}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-md transition-colors
        ${setPartMutation.isPending 
          ? 'bg-blue-400 cursor-not-allowed' 
          : 'bg-blue-600 hover:bg-blue-700'
        } text-white`}
      title="Fast forward to this part"
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className={`h-5 w-5 ${setPartMutation.isPending ? 'animate-spin' : ''}`}
        viewBox="0 0 20 20" 
        fill="currentColor"
      >
        {setPartMutation.isPending ? (
          // Loading spinner icon
          <path 
            fillRule="evenodd" 
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" 
            clipRule="evenodd" 
          />
        ) : (
          // Fast forward icon
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
      {setPartMutation.isPending ? 'Setting...' : 'Fast Forward'}
    </button>
  )
} 