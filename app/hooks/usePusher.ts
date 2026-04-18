/**
 * usePusher — migrated to ActionCable.
 *
 * This module now delegates to useActionCable, which connects via
 * @rails/actioncable instead of pusher-js.
 *
 * Channel name convention (legacy Pusher → ActionCable):
 *   "channel_{id}"   → SessionChannel with id
 *   "user_{id}"      → UserChannel with id
 *
 * Event envelope is unwrapped: the hook returns the `data` payload
 * directly, preserving the same shape the components expected from Pusher.
 */
export { useActionCable as usePusher } from './useActionCable'
