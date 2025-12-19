import { useState, useEffect } from 'react'
import Pusher from 'pusher-js'

interface PusherMessage {
  part?: string
  status?: string
  status_message?: string | null
}

export function usePusher(channelName: string, eventName: string | string[]) {
  const [data, setData] = useState<PusherMessage | null>(null)

  useEffect(() => {
    // Initialize Pusher with your credentials
    const pusher = new Pusher(import.meta.env.VITE_PUSHER_APP_KEY, {
      cluster: import.meta.env.VITE_PUSHER_CLUSTER
    })

    const channel = pusher.subscribe(channelName)

    const events = Array.isArray(eventName) ? eventName : [eventName]

    events.forEach(event => {
      channel.bind(event, (newData: PusherMessage) => {
        setData(newData)
      })
    })

    return () => {
      events.forEach(event => {
        channel.unbind(event)
      })
      pusher.unsubscribe(channelName)
    }
  }, [channelName, eventName])

  return data
} 