import type { Server, Socket } from 'socket.io'
import { database } from '../database.js'
import { getRoomByCode } from '../routes/rooms.js'
import { logger } from '../logger.js'
import type { StoredGameState } from './game-types.js'
import {
  createInitialState,
  buildPublicState,
  buildPrivateState,
  ensureTimersScheduled,
  recordBothPlayersConnected,
  handleCipherSelect,
  handleSubmitCommand,
  handleSubmitGuess,
  handlePlayerReady,
  emitStateToRoom,
} from './state-machine.js'

// Re-export so external consumers (e.g. index.ts) keep working
export type { StoredGameState as GameState } from './game-types.js'

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
      const state = JSON.parse(room.room_state) as StoredGameState
      if (state.phase === 'GAME_OVER') {
        logger.info('Rejected join: game over', { roomCode, socketId: socket.id })
        next(new Error('Game is finished'))
        return
      }
    }

    socket.roomCode = roomCode
    socket.playerNumber = playerNumber
    // Also store on socket.data so fetchSockets() payloads carry the values
    socket.data.roomCode = roomCode
    socket.data.playerNumber = playerNumber
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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sends the current state directly to `socket` only (used on reconnect).
 * Emits both the public broadcast payload and the player's own private state.
 */
async function emitStateToSocket(socket: Socket): Promise<void> {
  const room = await getRoomByCode(socket.roomCode)
  if (!room?.room_state) {
    return
  }

  const stored = JSON.parse(room.room_state) as StoredGameState
  socket.emit('game:state', { public: buildPublicState(stored, room) })
  socket.emit('game:private_state', { private: buildPrivateState(stored, socket.playerNumber) })
}

/**
 * Initialises `room_state` to WAITING_FOR_PLAYERS when the first socket
 * connects to a room that has no state yet.
 */
async function ensureStateInitialised(roomCode: string): Promise<void> {
  const room = await getRoomByCode(roomCode)
  if (!room || room.room_state) {
    return
  }

  const initial = createInitialState()
  await database.run(
    'UPDATE rooms SET room_state = ?, updated_at = CURRENT_TIMESTAMP WHERE room_code = ?',
    JSON.stringify(initial),
    roomCode,
  )
  logger.info('Room state initialised', { roomCode })
}

/**
 * Checks if both player 1 AND player 2 have at least one socket connected.
 * Returns true only if we have at least one connection for each unique player.
 */
async function areBothPlayersConnected(io: Server, roomCode: string): Promise<boolean> {
  const sockets = await io.in(roomCode).fetchSockets()

  let hasPlayer1 = false
  let hasPlayer2 = false

  for (const socket of sockets) {
    const playerNumber = (socket.data as Record<string, unknown>).playerNumber as 1 | 2 | undefined
    if (playerNumber === 1) {
      hasPlayer1 = true
    }

    if (playerNumber === 2) {
      hasPlayer2 = true
    }

    if (hasPlayer1 && hasPlayer2) {
      break
    }
  }

  return hasPlayer1 && hasPlayer2
}

// ---------------------------------------------------------------------------
// Register all Socket.IO event handlers
// ---------------------------------------------------------------------------

export function registerGameHandlers(io: Server): void {
  io.on('connection', (socket) => {
    const { roomCode, playerNumber } = socket
    logger.info('Player connected', { socketId: socket.id, roomCode, playerNumber })

    // Join the Socket.IO room identified by room code
    socket.join(roomCode)?.catch((error: unknown) => {
      logger.error('Failed to join Socket.IO room', { socketId: socket.id, roomCode, error })
    });

    // Run async connection setup sequentially
    (async () => {
      // 1. Initialise DB state if this is the very first connection
      await ensureStateInitialised(roomCode)

      // 2. Re-arm any timed transition that may be pending (handles restarts)
      await ensureTimersScheduled(io, roomCode)

      // 3. Deliver full current state to the reconnecting / joining socket
      await emitStateToSocket(socket)

      // 4. If both players are now present in WAITING_FOR_PLAYERS, start
      //    the 5-second countdown
      const bothConnected = await areBothPlayersConnected(io, roomCode)
      if (bothConnected) {
        await recordBothPlayersConnected(io, roomCode)
      }
    })().catch((error: unknown) => {
      logger.error('Connection setup error', { socketId: socket.id, roomCode, error })
    })

    // -----------------------------------------------------------------------
    // game:select_cipher — controller submits cipher choice during PRE_ROUND
    // -----------------------------------------------------------------------
    socket.on('game:select_cipher', (payload: unknown) => {
      handleCipherSelect(io, roomCode, playerNumber, payload).then((result) => {
        if (!result.success) {
          socket.emit('game:error', { message: result.error || 'Failed to process cipher selection' })
        }
      }).catch((error: unknown) => {
        logger.error('Error handling cipher select', { socketId: socket.id, error })
        socket.emit('game:error', { message: 'Failed to process cipher selection' })
      })
    })

    // -----------------------------------------------------------------------
    // game:submit_command — controller submits command during CHALL_CONTROL
    // -----------------------------------------------------------------------
    socket.on('game:submit_command', (payload: unknown) => {
      const command = (payload as Record<string, unknown>)?.command
      handleSubmitCommand(io, roomCode, playerNumber, command).then((result) => {
        if (!result.success) {
          socket.emit('game:error', { message: result.error || 'Failed to submit command' })
        }
      }).catch((error: unknown) => {
        logger.error('Error handling submit_command', { socketId: socket.id, error })
        socket.emit('game:error', { message: 'Failed to submit command' })
      })
    })

    // -----------------------------------------------------------------------
    // game:submit_guess — sabotager submits guess during CHALL_SABOTAGE
    // -----------------------------------------------------------------------
    socket.on('game:submit_guess', (payload: unknown) => {
      const guess = (payload as Record<string, unknown>)?.guess
      handleSubmitGuess(io, roomCode, playerNumber, guess).then((result) => {
        if (!result.success) {
          socket.emit('game:error', { message: result.error || 'Failed to submit guess' })
        }
      }).catch((error: unknown) => {
        logger.error('Error handling submit_guess', { socketId: socket.id, error })
        socket.emit('game:error', { message: 'Failed to submit guess' })
      })
    })

    // -----------------------------------------------------------------------
    // game:player_ready — either player signals ready during POST_ROUND
    // -----------------------------------------------------------------------
    socket.on('game:player_ready', () => {
      handlePlayerReady(io, roomCode, playerNumber).then((result) => {
        if (!result.success) {
          socket.emit('game:error', { message: result.error || 'Failed to mark player ready' })
        }
      }).catch((error: unknown) => {
        logger.error('Error handling player_ready', { socketId: socket.id, error })
        socket.emit('game:error', { message: 'Failed to mark player ready' })
      })
    })

    // -----------------------------------------------------------------------
    // disconnect
    // -----------------------------------------------------------------------
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
