import { isUnauthorized, type AuthContextValue } from '../../auth/AuthProvider'
import { t } from '../../i18n'
import {
  errorCode, fieldErrors, ManagementError, normalizeBootstrap, normalizeCreateResult, normalizeEditSnapshot, normalizeLiturgyOptions,
  normalizeManagedSession, setupPayload, unavailableError, type CreateResult, type LiturgyOptionsPage, type ManagedSession,
  type ManagementBootstrap, type SessionPatch, type SessionSetup,
} from './contracts'

type Fetch = AuthContextValue['authorizedFetch']
const JSON_HEADERS = { 'Content-Type': 'application/json' }
export const LITURGY_PAGE_SIZE = 50

async function body(response: Response): Promise<unknown> {
  return response.json().catch(() => undefined)
}

/** Maps a failed management response to a typed outcome. `write` marks answers whose commit state is unknown. */
async function failure(response: Response, write: boolean): Promise<ManagementError> {
  const data = await body(response)
  const code = errorCode(data)
  if (response.status === 403) return new ManagementError('forbidden', t('sessionManagement.forbidden'))
  if (response.status === 422) return new ManagementError('validation', t('sessionManagement.fixErrors'), fieldErrors(data), data)
  if (response.status === 404 && code === 'session_not_found') return new ManagementError('notFound', t('sessionManagement.notFound'), {}, data)
  if (response.status === 409 && code === 'stale_session') return new ManagementError('stale', t('sessionManagement.stale'), {}, data)
  if (response.status === 409 && code === 'cursor_reset_required') return new ManagementError('cursorReset', t('sessionManagement.cursorReset'), {}, data)
  if (response.status === 409 && code === 'creation_result_unavailable') return new ManagementError('creationDeleted', t('sessionManagement.creationDeleted'), {}, data)
  if (response.status === 409 && code === 'idempotency_conflict') return new ManagementError('conflict', t('sessionManagement.creationConflict'), {}, data)
  if (response.status >= 500 && write) return new ManagementError('uncertain', t('sessionManagement.uncertain'))
  if (response.status >= 500 || response.status === 408 || response.status === 429) return new ManagementError('network', t('sessionManagement.busy'))
  // A generic 404/405/406 means this backend does not offer version-1 management.
  if (response.status === 404 || response.status === 405 || response.status === 406) return unavailableError()
  // Any other refusal (400, an unknown 409 code…) is a definite answer that was not applied.
  return new ManagementError('rejected', t('sessionManagement.rejected'))
}

async function send(fetcher: Fetch, path: string, init: Parameters<Fetch>[1], write: boolean): Promise<Response> {
  try {
    return await fetcher(path, init)
  } catch (error) {
    if (isUnauthorized(error)) throw error
    if (!write && init?.signal?.aborted) throw error
    // A write that never answered, even one aborted locally, may still have been committed.
    throw new ManagementError(write ? 'uncertain' : 'network', t(write ? 'sessionManagement.uncertain' : 'sessionManagement.offline'))
  }
}
async function read<T>(fetcher: Fetch, path: string, signal: AbortSignal, normalize: (value: unknown) => T): Promise<T> {
  const response = await send(fetcher, path, { signal }, false)
  if (!response.ok) throw await failure(response, false)
  return normalize(await body(response))
}

export function fetchBootstrap(fetcher: Fetch, signal: AbortSignal): Promise<ManagementBootstrap> {
  return read(fetcher, '/s/new.json', signal, normalizeBootstrap)
}

/** Server-side title search with stable-ID keyset pagination. */
export function fetchLiturgyOptions(fetcher: Fetch, signal: AbortSignal, query: string, afterId?: number | null): Promise<LiturgyOptionsPage> {
  const params = [`limit=${LITURGY_PAGE_SIZE}`]
  if (afterId) params.push(`after_id=${afterId}`)
  if (query.trim()) params.push(`q=${encodeURIComponent(query.trim())}`)
  return read(fetcher, `/s/liturgy_options.json?${params.join('&')}`, signal, normalizeLiturgyOptions)
}

export interface CreateAttempt { clientRequestId: string; setup: SessionSetup; startedAt: number }

/** One logical creation. Repeating the same attempt is a safe replay, never a second session. */
export async function createSession(fetcher: Fetch, attempt: CreateAttempt): Promise<CreateResult> {
  const response = await send(fetcher, '/s.json', { method: 'POST', headers: JSON_HEADERS,
    body: JSON.stringify({ client_request_id: attempt.clientRequestId, session: setupPayload(attempt.setup) }) }, true)
  if (response.status !== 201 && response.status !== 200) throw await failure(response, true)
  return normalizeCreateResult(await body(response), response.status)
}

export function fetchEditSnapshot(fetcher: Fetch, sessionId: number, signal: AbortSignal): Promise<ManagedSession> {
  return read(fetcher, `/s/${sessionId}/edit.json`, signal, normalizeEditSnapshot)
}

export async function updateSession(fetcher: Fetch, sessionId: number, expectedRevision: number, changes: SessionPatch,
  confirmCursorReset = false): Promise<ManagedSession> {
  const payload: Record<string, unknown> = { expected_revision: expectedRevision, session: changes }
  if (confirmCursorReset) payload.confirm_cursor_reset = true
  const response = await send(fetcher, `/s/${sessionId}.json`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(payload) }, true)
  if (!response.ok) throw await failure(response, true)
  try { return normalizeManagedSession(await body(response)) } catch {
    throw new ManagementError('uncertain', t('sessionManagement.uncertain'))
  }
}

/** The documented success is HTTP 200 with an empty body, so a success body is never parsed. */
export async function deleteSession(fetcher: Fetch, sessionId: number, expectedRevision: number): Promise<void> {
  const response = await send(fetcher, `/s/${sessionId}.json`, { method: 'DELETE', headers: JSON_HEADERS,
    body: JSON.stringify({ expected_revision: expectedRevision }) }, true)
  if (response.status === 200 || response.status === 204) return
  throw await failure(response, true)
}
