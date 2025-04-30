import { createFileRoute } from '@tanstack/react-router'
import { useSessionPolling } from '../hooks/useSessionPolling'
import { Posture } from '../components/Posture'
import { BookOpen } from 'lucide-react'

export const Route = createFileRoute('/sessions/status/display')({
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

  if (isLoading || isError) {
    return loadingView
  }

  if (!sessionWrapper) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">No active session</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-screen left-[50%] right-[50%] -mx-[50vw] flex flex-col items-center justify-center min-h-screen grid grid-cols-3">
      <div className="absolute top-8 left-8">
        <BookOpen className="w-24 h-24 stroke-gray-300" />
      </div>
      <div className="col-span-2">
        <p className="
          text-[45vw] 
          font-bold 
          text-center 
          w-full 
          h-full 
          flex 
          items-center 
          justify-center 
          " style={{ lineHeight: '1' }}>{sessionWrapper.session.page}</p>
      </div>
      <div className="col-span-1">
        <Posture posture={sessionWrapper.session.posture} />
      </div>
    </div>
  )
}
