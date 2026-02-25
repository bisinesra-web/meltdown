import { useEffect } from 'react'
import { Outlet, useNavigate } from '@tanstack/react-router'
import { useSocketStore } from '../stores/socket-store'

export function GameLayout() {
  const navigate = useNavigate()
  const { connect, requiresJoin } = useSocketStore()

  useEffect(() => {
    console.log('[GameLayout] Component mounted, connecting socket')
    connect()

    return () => {
      console.log('[GameLayout] Component unmounting (socket stays alive)')
    }
  }, [connect])

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
