import type { AuthResponse } from './auth.js'
import type { ActionCableEnvelope, RawExplanation, RawPart, RawSession } from './transport.js'

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Expected a contract object')
  }
  return value as Record<string, unknown>
}

function identified(value: unknown): Record<string, unknown> & { id: number } {
  const data = record(value)
  if (typeof data.id !== 'number' || !Number.isSafeInteger(data.id)) {
    throw new TypeError('Expected an integer contract id')
  }
  return { ...data, id: data.id }
}

/** Validate identity/envelope only, preserving unknown fields and vocabularies. */
export function normalizeSession(value: unknown): RawSession {
  const session = identified(record(value).session)
  if (session.status !== undefined && typeof session.status !== 'string') {
    throw new TypeError('Expected a string session status')
  }
  return { ...session, ...(session.status === undefined ? {} : { status: session.status }) }
}

export function normalizeCurrentSession(value: unknown): RawSession | null {
  const data = record(value)
  if (data.status === 'inactive') { return null }
  return normalizeSession(data)
}

export function normalizePart(value: unknown): RawPart {
  const part = identified(record(value).part)
  if (part.duration_type !== undefined && typeof part.duration_type !== 'string') {
    throw new TypeError('Expected a string duration type')
  }
  return { ...part, ...(part.duration_type === undefined ? {} : { duration_type: part.duration_type }) }
}

export function normalizeExplanations(value: unknown): RawExplanation[] {
  if (Array.isArray(value)) { return value.map(identified) }
  const data = record(value)
  if (!Array.isArray(data.explanations)) { throw new TypeError('Expected explanations array') }
  return data.explanations.map(wrapper => identified(record(wrapper).explanation))
}

export function normalizeActionCableEnvelope(value: unknown): ActionCableEnvelope {
  const envelope = record(value)
  if (typeof envelope.event !== 'string' || envelope.event.length === 0) {
    throw new TypeError('Expected an event name')
  }
  return { event: envelope.event, data: record(envelope.data) }
}

/** Validate the existing token/user response only; no refresh or persistence behavior. */
export function normalizeAuthResponse(value: unknown): AuthResponse {
  const data = record(value)
  const user = identified(data.user)
  if (typeof data.token !== 'string' || data.token.length === 0 ||
      typeof user.email !== 'string' || typeof user.name !== 'string' ||
      !Array.isArray(user.roles) || !user.roles.every((role): role is string => typeof role === 'string')) {
    throw new TypeError('Invalid authentication response')
  }
  return { token: data.token, user: { id: user.id, email: user.email, name: user.name, roles: [...user.roles] } }
}
