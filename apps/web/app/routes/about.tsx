import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-12">
        <div className="prose prose-lg prose-invert max-w-none">
          <h1 className="mb-6">About Tarkman</h1>
          <p>
            Tarkman is a digital platform designed to enhance the experience of Armenian Church
            services by providing real-time liturgical texts, translations, and explanations.
          </p>
        </div>

        <div className="border-t border-gray-700 pt-12">
          <div className="prose prose-lg prose-invert max-w-none">
            <h2>Features</h2>
            <ul className="space-y-4">
              <li>Real-time service tracking</li>
              <li>Multilingual support (Classical Armenian, English, Russian)</li>
              <li>Detailed explanations of liturgical elements</li>
              <li>Large-screen display mode for church use</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-12">
          <div className="prose prose-lg prose-invert max-w-none">
            <h2>Contact</h2>
            <p>
              For support or inquiries, please contact us at:{' '}
              <a
                href="mailto:support@tarkman.app"
                className="inline-block px-1 py-2 text-blue-600 hover:underline"
              >
                support@tarkman.app
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
