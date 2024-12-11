import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CurrentExplanation } from '../components/CurrentExplanation'

export const Route = createFileRoute('/sessions/$id/explanations')({
  component: SessionExplanations,
})

function SessionExplanations() {
  const { id } = Route.useParams()
  return <CurrentExplanation sessionId={id} />
} 