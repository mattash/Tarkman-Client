import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

interface Explanation {
  title: string
  description: string
}

export const Route = createFileRoute('/sessions/$id/explanations')({
  component: SessionExplanations,
})

function SessionExplanations() {
  const { id } = Route.useParams()
  const [explanation, setExplanation] = useState<Explanation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchExplanation() {
      try {
        const response = await fetch(`https://www.tarkman.app/s/${id}/explanations/current.json`)
        const data = await response.json()
        setExplanation(data[0])
      } catch (error) {
        console.error('Error fetching explanation:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchExplanation()
  }, [id])

  if (loading) {
    return <div>Loading explanation...</div>
  }

  if (!explanation) {
    return <div>No explanation available</div>
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{explanation.title}</h1>
      <div className="prose">
        <ReactMarkdown>{explanation.description}</ReactMarkdown>
      </div>
    </div>
  )
} 