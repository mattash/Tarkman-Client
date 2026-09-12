import { Posture } from './Posture'
import { BookOpen } from 'lucide-react'

interface MinimalStatusViewProps {
  statusView: 'pages_only' | 'posture_only'
  page?: number
  posture?: string
}

export function MinimalStatusView({ statusView, page, posture }: MinimalStatusViewProps) {
  if (statusView === 'pages_only') {
    return (
      <div className="relative w-screen left-[50%] right-[50%] -mx-[50vw] flex flex-col items-center justify-center min-h-screen">
        <div className="absolute top-8 left-8">
          <BookOpen className="w-24 h-24 stroke-gray-300" />
        </div>
        <p className="text-[15vw] font-bold text-center w-full flex items-center justify-center"
           style={{ lineHeight: '1' }}>
          {page && page > 0 ? page : '—'}
        </p>
      </div>
    )
  }

  // posture_only
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-96 h-96">
        <Posture posture={posture ?? null} />
      </div>
    </div>
  )
}
