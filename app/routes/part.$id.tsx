import * as React from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { PartDetails } from '../components/PartDetails'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/part/$id')({
  component: PartDetailsPage
})

function PartDetailsPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()

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
      <PartDetails partId={parseInt(id)} />
    </div>
  )
} 