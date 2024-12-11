import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">About Tarkman</h1>
      <div className="prose-invert">
        <p className="text-lg mb-4">
          Tarkman is a digital platform designed to enhance the experience of Armenian Church services
          by providing real-time liturgical texts, translations, and explanations.
        </p>
        
        <h2 className="text-2xl font-semibold mt-6 mb-4">Features</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Real-time service tracking</li>
          <li>Multilingual support (Classical Armenian, English, Russian)</li>
          <li>Detailed explanations of liturgical elements</li>
          <li>Large-screen display mode for church use</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-4">Contact</h2>
        <p>
          For support or inquiries, please contact us at:{' '}
          <a href="mailto:support@tarkman.app" className="text-blue-600 hover:underline">
            support@tarkman.app
          </a>
        </p>
      </div>
    </div>
  )
} 