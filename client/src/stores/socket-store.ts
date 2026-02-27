import { create } from 'zustand'
import { getSocket, destroySocket } from '../lib/socket'
import {
  safeParseSocketMessage,
  GameStateEventSchema,
  GameErrorEventSchema,
} from '../lib/socket-message-validator'
import { useRoomStore } from './room-store'
import { useGameStore } from './game-store'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface SocketState {
  status: ConnectionStatus
  error?: string
  requiresJoin: boolean
  lastAuthKey?: string
  connect: () => void
  disconnect: () => void
}

const authErrorMessages = new Set([
  'room_code and secret are required',
  'Room not found',
  'Invalid credentials',
  'Game is finished',
  'Authentication failed',
])

function isAuthErrorMessage(message: string | undefined): boolean {
  if (!message) {
    return false
  }

  return authErrorMessages.has(message)
}

export const useSocketStore = create<SocketState>((set, get) => ({
  status: 'disconnected',
  requiresJoin: false,
  lastAuthKey: undefined,

  connect() {
    console.log('[SocketStore] connect() called')
    const { roomCode, playerSecret } = useRoomStore.getState()

    if (!roomCode || !playerSecret) {
      console.warn('[SocketStore] Missing room auth, redirecting to join')
      set({
        status: 'error',
        error: 'Missing room credentials',
        requiresJoin: true,
      })
      return
    }

    const nextAuthKey = `${roomCode}:${playerSecret}`
    const currentAuthKey = get().lastAuthKey
    if (currentAuthKey && currentAuthKey !== nextAuthKey) {
      console.log('[SocketStore] Auth changed, resetting socket')
      destroySocket()
    }

    const socket = getSocket()
    // eslint-disable-next-line camelcase
    socket.auth = { room_code: roomCode, secret: playerSecret }

    // Prevent double-binding on React StrictMode/HMR
    if (socket.hasListeners('connect')) {
      console.log('[SocketStore] Socket already has listeners, skipping rebind')
      set({
        status: socket.connected ? 'connected' : 'connecting',
        error: undefined,
        requiresJoin: false,
        lastAuthKey: nextAuthKey,
      })
      if (!socket.connected) {
        console.log('[SocketStore] Socket not connected, calling connect()')
        socket.connect()
      }

      return
    }

    set({
      status: 'connecting', error: undefined, requiresJoin: false, lastAuthKey: nextAuthKey,
    })
    console.log('[SocketStore] Status set to connecting')

    socket.on('connect', () => {
      console.log('[SocketStore] Socket connected successfully')
      set({ status: 'connected', error: undefined, requiresJoin: false })
    })

    socket.on('disconnect', (reason) => {
      console.log('[SocketStore] Socket disconnected, reason:', reason)
      set({ status: 'disconnected' })
      if (reason === 'io server disconnect') {
        console.log('[SocketStore] Server disconnected, attempting to reconnect')
        socket.connect()
      }
    })

    socket.on('connect_error', (error: Error) => {
      console.error('[SocketStore] Connection error:', error.message)
      const requiresJoin = isAuthErrorMessage(error.message)
      set({
        status: 'error',
        error: error.message,
        requiresJoin,
      })
    })

    // Subscribe to game state events and forward to game store
    socket.on('game:state', (rawData: unknown) => {
      const result = safeParseSocketMessage(GameStateEventSchema, rawData)
      if (!result.success) {
        console.error(
          '[SocketStore] Validation failed for game:state event:',
          result.error.issues,
        )
        return
      }

      const { data } = result
      if (data.public) {
        useGameStore.getState().updatePublicState(data.public)
      }
    })
    // Subscribe to private_state as well
    socket.on('game:private_state', (rawData: unknown) => {
      const result = safeParseSocketMessage(GameStateEventSchema, rawData)
      if (!result.success) {
        console.error(
          '[SocketStore] Validation failed for game:private_state event:',
          result.error.issues,
        )
        return
      }

      const { data } = result
      if (data.private) {
        useGameStore.getState().updatePrivateState(data.private)
      }
    })

    socket.on('game:error', (rawData: unknown) => {
      const result = safeParseSocketMessage(GameErrorEventSchema, rawData)
      if (!result.success) {
        console.error(
          '[SocketStore] Validation failed for game:error event:',
          result.error.issues,
        )
        return
      }

      useGameStore.getState().setErrorMessage(result.data.message)
    })

    console.log('[SocketStore] Calling socket.connect()')
    socket.connect()
  },

  disconnect() {
    console.log('[SocketStore] disconnect() called')
    destroySocket()
    useGameStore.getState().reset()
    set({ status: 'disconnected', requiresJoin: false, lastAuthKey: undefined })
  },
}))

export function getSocketInstance() {
  return getSocket()
}
