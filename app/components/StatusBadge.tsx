import { SessionStatus, STATUS_LABELS, STATUS_COLORS } from '@/types/status'

interface StatusBadgeProps {
  status?: SessionStatus
  size?: 'sm' | 'md' | 'lg'
}

export function StatusBadge({ status = 'active', size = 'sm' }: StatusBadgeProps) {
  if (status === 'active') return null

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  }

  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium text-white
        ${STATUS_COLORS[status]}
        ${sizeClasses[size]}
      `}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
