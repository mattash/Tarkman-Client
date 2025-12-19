import * as React from 'react'
import { SessionStatus } from '@/types/status'

interface StatusOverlayProps {
  status: SessionStatus
  statusMessage?: string | null
  sessionOptions?: {
    gospel?: string
    epistle?: string
    before_message?: string
  }
}

export function StatusOverlay({ status, statusMessage, sessionOptions }: StatusOverlayProps) {
  if (status === 'active') return null

  const getMessage = () => {
    switch (status) {
      case 'paused':
        return statusMessage || 'Service Paused'
      case 'showing_gospel':
        return sessionOptions?.gospel || 'Gospel Reading'
      case 'showing_epistle':
        return sessionOptions?.epistle || 'Epistle Reading'
      case 'showing_welcome':
        return sessionOptions?.before_message || 'Welcome'
      case 'showing_custom':
        return statusMessage || 'Announcement'
      default:
        return ''
    }
  }

  const getTitle = () => {
    switch (status) {
      case 'showing_gospel':
        return 'Gospel'
      case 'showing_epistle':
        return 'Epistle'
      case 'showing_welcome':
        return ''
      case 'showing_custom':
        return 'Announcement'
      case 'paused':
        return null
      default:
        return null
    }
  }

  const message = getMessage()
  const title = getTitle()

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 animate-fade-in" aria-live="polite">
      <div className="w-[90%] max-w-5xl bg-gray-800/95 text-white px-16 py-12 rounded-lg shadow-2xl">
        {title && (
          <h2 className="text-5xl font-bold text-center mb-8 text-purple-300">
            {title}
          </h2>
        )}
        <div className="text-7xl md:text-7xl lg:text-8xl xl:text-9xl font-medium text-center leading-tight whitespace-pre-wrap">
          {message}
        </div>
      </div>
    </div>
  )
}
