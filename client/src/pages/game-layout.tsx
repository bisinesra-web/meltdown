import { useEffect } from 'react'
import { Outlet, useNavigate } from '@tanstack/react-router'
import { useSocketStore } from '../stores/socket-store'
import { useRoomStore } from '../stores/room-store'

export function GameLayout() {
  const navigate = useNavigate()
  const { connect, requiresJoin } = useSocketStore()
  const roomCode = useRoomStore(state => state.roomCode)
  const playerSecret = useRoomStore(state => state.playerSecret)

  useEffect(() => {
    if (!roomCode || !playerSecret) {
      console.warn('[GameLayout] Missing room auth, redirecting to /join')
      navigate({ to: '/join' }).catch(console.error)
      return
    }

    console.log('[GameLayout] Credentials ready, connecting socket')
    connect()

    return () => {
      console.log('[GameLayout] Component unmounting (socket stays alive)')
    }
  }, [connect, navigate, playerSecret, roomCode])

  useEffect(() => {
    if (!requiresJoin) {
      return
    }

    console.warn('[GameLayout] Missing or invalid auth, redirecting to /join')
    navigate({ to: '/join' }).catch(console.error)
  }, [requiresJoin, navigate])

  return (
    <Outlet />
  )
}
