import { useState, useEffect } from 'react'
import Pusher from 'pusher-js'

interface PusherMessage {
  part: string
  // Add other fields that might come from Pusher
}

export function usePusher(channelName: string, eventName: string) {
  const [data, setData] = useState<PusherMessage | null>(null)

  useEffect(() => {
    // Initialize Pusher with your credentials
    const pusher = new Pusher(import.meta.env.VITE_PUSHER_APP_KEY, {
      cluster: import.meta.env.VITE_PUSHER_CLUSTER
    })

    const channel = pusher.subscribe(channelName)
    channel.bind(eventName, (newData: PusherMessage) => {
      setData(newData)
    })

    return () => {
      channel.unbind(eventName)
      pusher.unsubscribe(channelName)
    }
  }, [channelName, eventName])

  return data
} 