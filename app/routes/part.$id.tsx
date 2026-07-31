import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/part/$id')({
  component: PartDetailsPage
})

function PartDetailsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          to="/"
          className="inline-block"
        >
          <Button
            variant="ghost"
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>
      <div className="rounded-lg bg-gray-800 p-6 text-white">
        <h1 className="text-2xl font-semibold">Open this part from a service</h1>
        <p className="mt-3 text-gray-300">
          This older link does not identify the service needed to load the part and its explanations.
          Return to the service list and open the part from there.
        </p>
      </div>
    </div>
  )
}
