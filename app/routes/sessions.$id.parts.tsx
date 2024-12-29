import { createFileRoute } from '@tanstack/react-router'
import { SessionParts } from '../components/SessionParts'
import { SessionControls } from '@/components/SessionControls'
import { useAuth } from '@/contexts/AuthContext'
import { ExplanationDrawer } from '@/components/ExplanationDrawer'
import { useState } from 'react'
import { CurrentExplanation } from '@/components/CurrentExplanation'

export const Route = createFileRoute('/sessions/$id/parts')({
  component: () => {
    const { id } = Route.useParams()
    const auth = useAuth()
    const [isExplanationOpen, setIsExplanationOpen] = useState(false)

    return (
      <div>
        <SessionParts sessionId={id} />
        <ExplanationDrawer title="Explanation">
          <CurrentExplanation sessionId={id} />
        </ExplanationDrawer>
        {auth.user && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-1000">
            <SessionControls sessionId={parseInt(id)} />
          </div>
        )}
      </div>
    )
  },
}) 