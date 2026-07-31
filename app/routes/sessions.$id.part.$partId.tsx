import { createFileRoute, Link } from '@tanstack/react-router'
import { PartDetails } from '../components/PartDetails'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/sessions/$id/part/$partId')({
  component: PartDetailsPage,
  validateSearch: () => ({}),
  loader: ({ params: { id, partId } }) => {
    return {
      id,
      partId
    }
  }
})

function PartDetailsPage() {
  const { id, partId } = Route.useLoaderData()

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          to="/sessions/$id/parts"
          params={{ id }}
          className="inline-block"
        >
          <Button
            variant="ghost"
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Service
          </Button>
        </Link>
      </div>
      <PartDetails sessionId={id} partId={parseInt(partId, 10)} />
    </div>
  )
}
