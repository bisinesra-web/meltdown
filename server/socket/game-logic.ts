import type { Server, Socket } from 'socket.io'
import { database } from '../database.js'
import { getRoomByCode } from '../routes/rooms.js'
import { logger } from '../logger.js'

export interface GameState {
  turn: number
  currentPlayer: 1 | 2
  status: 'waiting' | 'active' | 'finished'
  [key: string]: unknown
}

// Extend Socket type with authenticated player info
declare module 'socket.io' {
  interface Socket {
    roomCode: string
    playerNumber: 1 | 2
  }
}

// ---------------------------------------------------------------------------
// Auth middleware
// Expects handshake.auth = { room_code: string, secret: string }
// ---------------------------------------------------------------------------

async function authenticateSocket(
  socket: Socket,
  next: (error?: Error) => void,
): Promise<void> {
  const auth = socket.handshake.auth as Record<string, unknown>
  const { room_code: roomCode, secret } = auth

  if (typeof roomCode !== 'string' || typeof secret !== 'string') {
    logger.warn('Missing or invalid auth credentials', { socketId: socket.id })
    next(new Error('room_code and secret are required'))
    return
  }

  try {
    const room = await getRoomByCode(roomCode)
    if (!room) {
      logger.warn('Room not found during socket auth', { roomCode, socketId: socket.id })
      next(new Error('Room not found'))
      return
    }

    const playerNumber: 1 | 2 | undefined
      = room.player_1_secret === secret
        ? 1
        : (room.player_2_secret === secret ? 2 : undefined)

    if (!playerNumber) {
      logger.warn('Invalid secret during socket auth', { roomCode, socketId: socket.id })
      next(new Error('Invalid credentials'))
      return
    }

    // Block joins on finished rooms
    if (room.room_state) {
      const state = JSON.parse(room.room_state) as GameState
      if (state.status === 'finished') {
        logger.info('Rejected join: room finished', { roomCode, socketId: socket.id })
        next(new Error('Game is finished'))
        return
      }
    }

    socket.roomCode = roomCode
    socket.playerNumber = playerNumber
    logger.info('Socket authenticated', { socketId: socket.id, roomCode, playerNumber })
    next()
  }
  catch (error) {
    logger.error('Socket auth error', { socketId: socket.id, error })
    next(new Error('Authentication failed'))
  }
}

function socketAuthHandler(socket: Socket, next: (error?: Error) => void): void {
  authenticateSocket(socket, next).catch((error: unknown) => {
    logger.error('Unexpected auth error', { socketId: socket.id, error })
    next(new Error('Authentication failed'))
  })
}

export function createAuthMiddleware() {
  return socketAuthHandler
}

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

async function emitStateToSocket(socket: Socket): Promise<void> {
  const room = await getRoomByCode(socket.roomCode)
  if (!room) {
    return
  }

  const state: GameState | undefined = room.room_state
    ? (JSON.parse(room.room_state) as GameState)
    : undefined

  socket.emit('game:state', { state })
}

// ---------------------------------------------------------------------------
// Move handler
// ---------------------------------------------------------------------------

async function handleMove(io: Server, socket: Socket, payload: unknown): Promise<void> {
  const { roomCode, playerNumber } = socket

  const room = await getRoomByCode(roomCode)
  if (!room) {
    socket.emit('game:error', { message: 'Room not found' })
    return
  }

  if (!room.room_state) {
    socket.emit('game:error', { message: 'Game has not started' })
    return
  }

  const state = JSON.parse(room.room_state) as GameState

  if (state.status === 'finished') {
    socket.emit('game:error', { message: 'Game is already finished' })
    return
  }

  if (state.currentPlayer !== playerNumber) {
    socket.emit('game:error', { message: 'Not your turn' })
    return
  }

  const newState = applyMove(state, payload)
  if (!newState) {
    socket.emit('game:error', { message: 'Invalid move' })
    return
  }

  await database.run(
    'UPDATE rooms SET room_state = ?, updated_at = CURRENT_TIMESTAMP WHERE room_code = ?',
    JSON.stringify(newState),
    roomCode,
  )

  logger.info('Move applied', { roomCode, playerNumber, turn: newState.turn })

  io.to(roomCode).emit('game:state', { state: newState })
}

// ---------------------------------------------------------------------------
// Game logic — replace with real rules
// ---------------------------------------------------------------------------

/**
 * Validate and apply a move to the current state.
 * Returns the new state, or undefined if the move is invalid.
 *
 * TODO: Replace with actual game-specific move validation and application.
 */
function applyMove(state: GameState, payload: unknown): GameState | undefined {
  if (typeof payload !== 'object' || payload === null) {
    return undefined
  }

  return {
    ...state,
    turn: state.turn + 1,
    currentPlayer: state.currentPlayer === 1 ? 2 : 1,
    lastMove: payload,
  }
}

// ---------------------------------------------------------------------------
// Register all Socket.IO event handlers
// ---------------------------------------------------------------------------

export function registerGameHandlers(io: Server): void {
  io.on('connection', (socket) => {
    const { roomCode, playerNumber } = socket
    logger.info('Player connected', { socketId: socket.id, roomCode, playerNumber })

    // Join the Socket.IO room identified by room code
    Promise.resolve(socket.join(roomCode)).catch((error: unknown) => {
      logger.error('Failed to join socket room', { socketId: socket.id, roomCode, error })
    })

    // Send the full current state immediately (handles reconnects transparently)
    emitStateToSocket(socket).catch((error: unknown) => {
      logger.error('Error emitting state on connect', { socketId: socket.id, error })
    })

    socket.on('game:move', (payload: unknown) => {
      handleMove(io, socket, payload).catch((error: unknown) => {
        logger.error('Error handling move', { socketId: socket.id, error })
        socket.emit('game:error', { message: 'Failed to process move' })
      })
    })

    socket.on('disconnect', (reason) => {
      logger.info('Player disconnected', {
        socketId: socket.id,
        roomCode,
        playerNumber,
        reason,
      })
    })
  })
}
