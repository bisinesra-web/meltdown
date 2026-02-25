import { useEffect } from 'react'
import { getSocketInstance } from '../stores/socket-store'

export function useSocketEvent(
  event: string,
  handler: (data: unknown) => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) {
      console.log(`[useSocketEvent] Event "${event}" listener skipped (disabled)`)
      return
    }

    console.log(`[useSocketEvent] Subscribing to event: "${event}"`)
    const socket = getSocketInstance()
    socket.on(event, handler)

    return () => {
      console.log(`[useSocketEvent] Unsubscribing from event: "${event}"`)
      socket.off(event, handler)
    }
  }, [event, handler, enabled])
}
