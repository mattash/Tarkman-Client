import * as React from 'react'

interface CustomMessageModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (message: string) => void
  isPending: boolean
}

export function CustomMessageModal({ isOpen, onClose, onSubmit, isPending }: CustomMessageModalProps) {
  const [message, setMessage] = React.useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim()) {
      onSubmit(message.trim())
      // Don't clear message here - let the parent component handle it on success
    }
  }

  const handleClose = () => {
    if (!isPending) {
      onClose()
    }
  }

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, isPending])

  // Clear message when modal closes after successful submission
  React.useEffect(() => {
    if (!isOpen && !isPending) {
      setMessage('')
    }
  }, [isOpen, isPending])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) {
          handleClose()
        }
      }}
    >
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold mb-4">Custom Announcement</h2>
        <form onSubmit={handleSubmit}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (message.trim() && !isPending) {
                  handleSubmit(e as any)
                }
              }
            }}
            className="w-full border border-gray-300 rounded p-3 mb-4 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Enter your custom message... (Press Enter to submit, Shift+Enter for new line)"
            autoFocus
            disabled={isPending}
          />
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !message.trim()}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
