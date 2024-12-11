import { createFileRoute } from '@tanstack/react-router'
import { SessionParts } from '../components/SessionParts'
import { SessionControls } from '~/components/SessionControls'
import { useAuth } from '~/contexts/AuthContext'

export const Route = createFileRoute('/sessions/$id/parts')({
  component: () => {
    const { id } = Route.useParams()
    const auth = useAuth()

    return (
      <div>
        <SessionParts sessionId={id} />
        {auth.user && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2">
            <SessionControls sessionId={parseInt(id)} />
          </div>
        )}
      </div>
    )
  },
}) 