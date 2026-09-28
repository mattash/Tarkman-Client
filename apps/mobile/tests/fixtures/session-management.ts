/**
 * Synthetic session-management fixtures shaped to mattash/Tarkman#454 (version 1). Reconcile these with the
 * backend's shared fixture set once it is frozen; every value here is invented for tests and QA.
 */
export const bootstrap = {
  schema_version: 1,
  session_management_version: 1,
  time_zone: 'America/Los_Angeles',
  defaults: { date: '2026-09-27', options: { gospel: '', epistle: '', before_message: '', after_message: '' } },
  limits: { liturgy_ids: { min: 1, max: 10 },
    options: { gospel: { max_length: 500 }, epistle: { max_length: 500 }, before_message: { max_length: 2000 }, after_message: { max_length: 2000 } } },
}

export const liturgyPage1 = {
  schema_version: 1,
  liturgies: [
    { id: 101, name: 'Divine Liturgy', occurrence_count: 42 },
    { id: 202, name: 'Morning Service', occurrence_count: 18 },
  ],
  next_after_id: 202,
}
export const liturgyPage2 = {
  schema_version: 1,
  liturgies: [{ id: 303, name: 'Evening Service', occurrence_count: 12 }],
  next_after_id: null,
}
export const liturgySearch = {
  schema_version: 1,
  liturgies: [{ id: 303, name: 'Evening Service', occurrence_count: 12 }],
  next_after_id: null,
}
export const liturgyEmpty = { schema_version: 1, liturgies: [], next_after_id: null }

export function managedSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 4008,
    date: '2026-10-04',
    liturgy_ids: [101, 202],
    liturgies: [
      { id: 101, name: 'Divine Liturgy', position: 1, selectable: true },
      { id: 202, name: 'Morning Service', position: 2, selectable: true },
    ],
    options: { gospel: 'John 1:1-17', epistle: '', before_message: 'Welcome.', after_message: '' },
    status: 'active',
    revision: 17,
    current_part_id: 9001,
    current_liturgy_part_id: 7001,
    cursor: { liturgy_part_id: 7001 },
    ...overrides,
  }
}

/** 201: first creation, with the canonical nested session and the transitional top-level fields. */
export const created = { id: 4008, user_id: 3, date: '2026-10-04', session: managedSession({ revision: 1 }) }
/** 200: the same accepted creation, replayed under the same client_request_id. */
export const replayed = { replayed: true, session: managedSession({ revision: 3 }) }

export const validation = {
  error: 'invalid_session',
  code: 'invalid_session',
  errors_by_field: { liturgy_ids: ['Morning Service is no longer available.'], 'options.gospel': ['is too long (maximum is 500 characters)'] },
}
export const idempotencyConflict = { error: 'idempotency_conflict', code: 'idempotency_conflict' }
export const creationResultUnavailable = { error: 'creation_result_unavailable', code: 'creation_result_unavailable' }
export const sessionNotFound = { error: 'session_not_found', code: 'session_not_found' }
