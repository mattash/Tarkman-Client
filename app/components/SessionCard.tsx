import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { SessionData } from '../types/session'

interface SessionCardProps {
  session: SessionData
}

export function SessionCard({ session }: SessionCardProps) {
  return (
    <Link
      key={session.id}
      to="/sessions/$id/parts"
      params={{ id: session.id.toString() }}
      className="p-4 border rounded-lg hover:shadow-lg transition-shadow bg-gray-800 border-tarkman-purple"
    >
      <img
        src={session.church_avatar}
        alt={session.church_name}
        className="w-full h-48 object-cover rounded mb-2"
      />
      <h2 className="font-semibold">{session.church_name}</h2>
      <p>
        {session.liturgies && session.liturgies.length > 0
          ? session.liturgies.map((l) => l.name).join(', ')
          : session.liturgy}
      </p>
      <p className="text-gray-600">
        {new Date(session.date + 'T00:00:00').toLocaleDateString()}
      </p>
    </Link>
  )
} 