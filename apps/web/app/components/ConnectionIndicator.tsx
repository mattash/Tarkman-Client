export type DisplayConnectionState = 'connected' | 'recovering' | 'disconnected'

export function ConnectionIndicator({ state }: { state: DisplayConnectionState }) {
  if (state === 'connected') return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-3 top-3 z-[60] rounded-full bg-gray-950/85 px-3 py-1 text-sm font-medium text-amber-200 shadow"
    >
      {state === 'recovering' ? 'Reconnecting…' : 'Disconnected — retrying'}
    </div>
  )
}
