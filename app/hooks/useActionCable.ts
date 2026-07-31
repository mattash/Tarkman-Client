import { useState, useEffect, useMemo, useRef } from 'react'
import { createConsumer, Subscription } from '@rails/actioncable'

interface ActionCableEnvelope {
  event: string
  data: Record<string, unknown>
}

interface ActionCableMessage {
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
}

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
  const subscriptionRef = useRef<Subscription | null>(null)

  const events = useMemo(() => {
    return Array.isArray(eventName) ? eventName : [eventName]
  }, [eventName])

  const identifier = useMemo(() => {
    return getChannelIdentifier(channelName)
  }, [channelName])

  useEffect(() => {
    setChannelMessage(null)

    const url = getActionCableUrl()
    const consumer = createConsumer(url)

    subscriptionRef.current = consumer.subscriptions.create(identifier, {
      received(envelope: ActionCableEnvelope) {
        // envelope shape: { event: "part_change", data: { part: "...", status: "..." } }
        if (!events.includes(envelope.event)) return
        setChannelMessage({
          channelName,
          message: envelope.data as ActionCableMessage,
        })
      },
    })

    return () => {
      subscriptionRef.current?.unsubscribe()
      consumer.disconnect()
      subscriptionRef.current = null
    }
  }, [channelName, identifier, events.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  return channelMessage?.channelName === channelName
    ? channelMessage.message
    : null
}
