import { expect, it } from '@jest/globals'
import { announceMutation, claimReconcile, clearMutations, managementScope } from '../features/services/management/mutations'

it('lets exactly one My Sessions mount reconcile each notice', () => {
  const notice = announceMutation({ kind: 'created', scope: managementScope('https://api.test', 3), session: { id: 1, title: 'A', date: null } })
  expect(claimReconcile(notice)).toBe(true)
  expect(claimReconcile(notice)).toBe(false)
  const next = announceMutation({ kind: 'created', scope: notice.scope, session: { id: 2, title: 'B', date: null } })
  expect(claimReconcile(next)).toBe(true)
  clearMutations()
})

it('scopes notices by environment and account', () => {
  expect(managementScope('https://a.test', 3)).not.toBe(managementScope('https://b.test', 3))
  expect(managementScope('https://a.test', 3)).not.toBe(managementScope('https://a.test', 4))
})
