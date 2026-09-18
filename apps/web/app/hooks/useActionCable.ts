import { useState, useEffect, useMemo } from 'react'
import { createConsumer, Subscription } from '@rails/actioncable'

interface ActionCableEnvelope {
  event: string
  data: Record<string, unknown>
}

interface ActionCableMessage {
  revision?: number
  cursor?: { part_id: number; liturgy_part_id: number; liturgy_id: number; position: number } | null
  part?: string | number
  status?: string
  status_message?: string | null
}

interface ChannelMessage {
  channelName: string
  message: ActionCableMessage
}

type ActionCableChannelIdentifier = string | {
  channel: string
  id?: string | number
  [key: string]: unknown
}

type ActionCableConsumer = ReturnType<typeof createConsumer>
type EnvelopeListener = (envelope: ActionCableEnvelope) => void

interface SharedChannel {
  subscription: Subscription
  listeners: Set<EnvelopeListener>
}

interface SharedConnection {
  consumer: ActionCableConsumer
  channels: Map<string, SharedChannel>
}

const sharedConnections = new Map<string | undefined, SharedConnection>()

// ActionCable URL - defaults to same host's /cable path
// For cross-origin (e.g., Vite dev server → Rails backend), set VITE_ACTIONCABLE_URL
function getActionCableUrl(): string | undefined {
  if (typeof import.meta.env.VITE_ACTIONCABLE_URL === 'string') {
    return import.meta.env.VITE_ACTIONCABLE_URL
  }
  // In production (same-origin), createConsumer() defaults to /cable
  return undefined
}

function isActionCableChannelIdentifier(value: unknown): value is Exclude<ActionCableChannelIdentifier, string> {
  return typeof value === 'object' &&
    value !== null &&
    'channel' in value &&
    typeof value.channel === 'string'
}

function getChannelIdentifier(channelName: string): ActionCableChannelIdentifier {
  // Support both pusher-style "channel_123" and ActionCable-style { channel: "SessionChannel", id: 123 }
  if (channelName.startsWith('channel_')) {
    // Legacy Pusher channel name → convert to SessionChannel
    const idPart = channelName.replace('channel_', '')
    return { channel: 'SessionChannel', id: idPart }
  }
  if (channelName.startsWith('user_')) {
    const userId = channelName.replace('user_', '')
    return { channel: 'UserChannel', id: userId }
  }

  try {
    const parsedIdentifier = JSON.parse(channelName)
    if (isActionCableChannelIdentifier(parsedIdentifier)) {
      return parsedIdentifier
    }
  } catch {
    // Plain ActionCable channel names, like "SessionChannel", are valid strings.
  }

  return channelName
}

function getIdentifierKey(identifier: ActionCableChannelIdentifier): string {
  if (typeof identifier === 'string') {
    return `string:${identifier}`
  }

  const sortedIdentifier = Object.fromEntries(
    Object.entries(identifier).sort(([left], [right]) => left.localeCompare(right))
  )
  return `object:${JSON.stringify(sortedIdentifier)}`
}

function subscribeToSharedChannel(
  url: string | undefined,
  identifier: ActionCableChannelIdentifier,
  listener: EnvelopeListener
): () => void {
  const connectionKey = url
  let connection = sharedConnections.get(connectionKey)

  if (!connection) {
    connection = {
      consumer: createConsumer(url),
      channels: new Map(),
    }
    sharedConnections.set(connectionKey, connection)
  }

  const channelKey = getIdentifierKey(identifier)
  let channel = connection.channels.get(channelKey)

  if (!channel) {
    const listeners = new Set<EnvelopeListener>()
    const subscription = connection.consumer.subscriptions.create(identifier, {
      received(envelope: ActionCableEnvelope) {
        for (const subscribedListener of Array.from(listeners)) {
          subscribedListener(envelope)
        }
      },
    })

    channel = { subscription, listeners }
    connection.channels.set(channelKey, channel)
  }

  channel.listeners.add(listener)

  return () => {
    channel.listeners.delete(listener)

    if (channel.listeners.size > 0) return

    channel.subscription.unsubscribe()
    connection.channels.delete(channelKey)

    if (connection.channels.size === 0) {
      connection.consumer.disconnect()
      sharedConnections.delete(connectionKey)
    }
  }
}

/**
 * useActionCable — replaces usePusher for ActionCable subscriptions.
 *
 * Handles the ActionCable envelope format:
 *   { event: "part_change", data: { part: "123", status: "live" } }
 *
 * Returns the `data` payload directly (same shape as old Pusher messages),
 * making it a drop-in replacement for usePusher in most components.
 */
export function useActionCable(
  channelName: string,
  eventName: string | string[]
): ActionCableMessage | null {
  const [channelMessage, setChannelMessage] = useState<ChannelMessage | null>(null)
  const eventKey = JSON.stringify(Array.isArray(eventName) ? eventName : [eventName])

  const identifier = useMemo(() => {
    return getChannelIdentifier(channelName)
  }, [channelName])

  useEffect(() => {
    setChannelMessage(null)
    const subscribedEvents = new Set(JSON.parse(eventKey) as string[])

    return subscribeToSharedChannel(
      getActionCableUrl(),
      identifier,
      (envelope) => {
        if (!subscribedEvents.has(envelope.event)) return
        setChannelMessage({
          channelName,
          message: envelope.data as ActionCableMessage,
        })
      }
    )
  }, [channelName, identifier, eventKey])

  return channelMessage?.channelName === channelName
    ? channelMessage.message
    : null
}
