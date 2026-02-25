import type { Server } from 'socket.io'
import { database } from '../database.js'
import { getRoomByCode } from '../routes/rooms.js'
import { logger } from '../logger.js'
import type {
  StoredGameState,
  PublicState,
  PrivateState,
  GamePhase,
} from './game-types.js'

// ---------------------------------------------------------------------------
// Timer registry — one pending timer per room at most
// ---------------------------------------------------------------------------

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Returns the number of milliseconds remaining until
 * `isoTimestamp + delayMs`, floored at 0.
 */
function msRemaining(isoTimestamp: string, delayMs: number): number {
  const fireAt = new Date(isoTimestamp).getTime() + delayMs
  return Math.max(0, fireAt - Date.now())
}

function clearRoomTimer(roomCode: string): void {
  const existing = pendingTimers.get(roomCode)
  if (existing !== undefined) {
    clearTimeout(existing)
    pendingTimers.delete(roomCode)
  }
}

// ---------------------------------------------------------------------------
// State factory
// ---------------------------------------------------------------------------

export function createInitialState(): StoredGameState {
  return {
    phase: 'WAITING_FOR_PLAYERS',
    phaseEnteredAt: nowIso(),
    roundNumber: 0,
    scores: { player1: 0, player2: 0 },
    player1Ready: false,
    player2Ready: false,
  }
}

// ---------------------------------------------------------------------------
// View builders — convert StoredGameState into wire-safe payloads
// ---------------------------------------------------------------------------

export function buildPublicState(
  stored: StoredGameState,
  room: { player_1_name: string, player_2_name: string },
): PublicState {
  return {
    phase: stored.phase,
    phaseEnteredAt: stored.phaseEnteredAt,
    roundNumber: stored.roundNumber,
    scores: stored.scores,
    player1Name: room.player_1_name,
    player2Name: room.player_2_name,
    coinTossWinner: stored.coinTossWinner,
    player1Ready: stored.player1Ready,
    player2Ready: stored.player2Ready,
    roundWinner: stored.roundWinner,
    gameWinner: stored.gameWinner,
  }
}

export function buildPrivateState(stored: StoredGameState, playerNumber: 1 | 2): PrivateState {
  return {
    playerNumber,
    cipher: playerNumber === 1 ? stored.player1Cipher : stored.player2Cipher,
  }
}

// ---------------------------------------------------------------------------
// Persistence helper
// ---------------------------------------------------------------------------

async function persistState(roomCode: string, state: StoredGameState): Promise<void> {
  await database.run(
    'UPDATE rooms SET room_state = ?, updated_at = CURRENT_TIMESTAMP WHERE room_code = ?',
    JSON.stringify(state),
    roomCode,
  )
}

// ---------------------------------------------------------------------------
// Emit helpers
// ---------------------------------------------------------------------------

/**
 * Sends the full current state to every participant of `roomCode`.
 *
 * - Public state is broadcast to the room.
 * - Private state is dispatched individually to each connected socket so that
 *   no player ever receives the other player's sensitive data.
 */
export async function emitStateToRoom(io: Server, roomCode: string): Promise<void> {
  const room = await getRoomByCode(roomCode)
  if (!room?.room_state) {
    return
  }

  const stored = JSON.parse(room.room_state) as StoredGameState
  const publicState = buildPublicState(stored, room)

  // Broadcast public payload to all sockets in the room
  io.to(roomCode).emit('game:state', { public: publicState })

  // Dispatch private payloads individually — never broadcast private data
  const sockets = await io.in(roomCode).fetchSockets()
  for (const s of sockets) {
    // PlayerNumber is stored on socket.data by the auth middleware
    const pn = (s.data as Record<string, unknown>).playerNumber as 1 | 2 | undefined
    if (pn === 1 || pn === 2) {
      s.emit('game:private_state', { private: buildPrivateState(stored, pn) })
    }
  }
}

// ---------------------------------------------------------------------------
// Core transition engine
// ---------------------------------------------------------------------------

/**
 * Transitions `roomCode` to `newPhase`, optionally merging additional fields
 * returned by `updater`, then persists, emits, and re-schedules timers.
 */
async function transitionTo(
  io: Server,
  roomCode: string,
  newPhase: GamePhase,
  updater?: (current: StoredGameState) => Partial<StoredGameState>,
): Promise<void> {
  clearRoomTimer(roomCode)

  const room = await getRoomByCode(roomCode)
  if (!room?.room_state) {
    logger.warn('transitionTo: room or state missing', { roomCode, newPhase })
    return
  }

  const current = JSON.parse(room.room_state) as StoredGameState
  const extra = updater ? updater(current) : {}

  const newState: StoredGameState = {
    ...current,
    ...extra,
    phase: newPhase,
    phaseEnteredAt: nowIso(),
  }

  await persistState(roomCode, newState)
  logger.info('Phase transition', { roomCode, from: current.phase, to: newPhase })

  await emitStateToRoom(io, roomCode)
  scheduleNextTimer(io, roomCode, newState)
}

// ---------------------------------------------------------------------------
// Timer scheduler
// ---------------------------------------------------------------------------

/**
 * Inspects `state.phase` and schedules the next automatic timed transition,
 * if one is defined for that phase. Uses stored timestamps so the correct
 * remaining delay is computed even after a server restart.
 */
export function scheduleNextTimer(io: Server, roomCode: string, state: StoredGameState): void {
  clearRoomTimer(roomCode)

  switch (state.phase) {
    case 'WAITING_FOR_PLAYERS': {
      if (!state.bothPlayersConnectedAt) {
        break
      }

      // → COIN_TOSSING after 1 s from when both players first connected
      const delay = msRemaining(state.bothPlayersConnectedAt, 1000)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          transitionTo(io, roomCode, 'COIN_TOSSING', () => ({
            coinTossWinner: (Math.random() < 0.5 ? 1 : 2),
          })).catch((error: unknown) => {
            logger.error('Timer error: WAITING→COIN_TOSSING', { roomCode, err: error })
          })
        }, delay),
      )
      break
    }

    case 'COIN_TOSSING': {
      // → COIN_TOSSED after 3 s (frontend coin-flip animation window)
      const delay = msRemaining(state.phaseEnteredAt, 3000)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          transitionTo(io, roomCode, 'COIN_TOSSED').catch((error: unknown) => {
            logger.error('Timer error: COIN_TOSSING→COIN_TOSSED', { roomCode, err: error })
          })
        }, delay),
      )
      break
    }

    case 'COIN_TOSSED': {
      // → PRE_ROUND after 10 s (let players see who goes first)
      const delay = msRemaining(state.phaseEnteredAt, 10_000)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          transitionTo(io, roomCode, 'PRE_ROUND', s => ({
            roundNumber: s.roundNumber + 1,
            player1Ready: false,
            player2Ready: false,
            player1Cipher: undefined,
            player2Cipher: undefined,
            roundWinner: undefined,
          })).catch((error: unknown) => {
            logger.error('Timer error: COIN_TOSSED→PRE_ROUND', { roomCode, err: error })
          })
        }, delay),
      )
      break
    }

    case 'POST_ROUND': {
      // → GAME_OVER or PRE_ROUND after 5 s (results display window)
      const delay = msRemaining(state.phaseEnteredAt, 5000)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          if (state.gameWinner) {
            transitionTo(io, roomCode, 'GAME_OVER').catch((error: unknown) => {
              logger.error('Timer error: POST_ROUND→GAME_OVER', { roomCode, err: error })
            })
          }
          else {
            transitionTo(io, roomCode, 'PRE_ROUND', s => ({
              roundNumber: s.roundNumber + 1,
              player1Ready: false,
              player2Ready: false,
              player1Cipher: undefined,
              player2Cipher: undefined,
              roundWinner: undefined,
            })).catch((error: unknown) => {
              logger.error('Timer error: POST_ROUND→PRE_ROUND', { roomCode, err: error })
            })
          }
        }, delay),
      )
      break
    }

    // PRE_ROUND, IN_ROUND, GAME_OVER have no automatic timed transitions
    default: {
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Public handlers called from game-logic.ts
// ---------------------------------------------------------------------------

/**
 * Called once per `roomCode` on the first connection. Re-arms any timed
 * transition that should still be pending (e.g. after a server restart).
 */
export async function ensureTimersScheduled(io: Server, roomCode: string): Promise<void> {
  if (pendingTimers.has(roomCode)) {
    return
  } // Already running

  const room = await getRoomByCode(roomCode)
  if (!room?.room_state) {
    return
  }

  const state = JSON.parse(room.room_state) as StoredGameState
  scheduleNextTimer(io, roomCode, state)
}

/**
 * Records the moment both players' sockets are present in the room (called
 * the first time the second player connects while in WAITING_FOR_PLAYERS).
 * Starts the 5-second countdown to COIN_TOSSING.
 */
export async function recordBothPlayersConnected(
  io: Server,
  roomCode: string,
): Promise<void> {
  const room = await getRoomByCode(roomCode)
  if (!room?.room_state) {
    return
  }

  const state = JSON.parse(room.room_state) as StoredGameState
  if (state.phase !== 'WAITING_FOR_PLAYERS' || state.bothPlayersConnectedAt) {
    return
  }

  const updated: StoredGameState = { ...state, bothPlayersConnectedAt: nowIso() }
  await persistState(roomCode, updated)
  logger.info('Both players now connected — countdown started', { roomCode })

  await emitStateToRoom(io, roomCode)
  scheduleNextTimer(io, roomCode, updated)
}

/**
 * Handles `game:select_cipher` events from players during PRE_ROUND.
 * Once both players have selected, transitions to IN_ROUND.
 */
export async function handleCipherSelect(
  io: Server,
  roomCode: string,
  playerNumber: 1 | 2,
  cipher: string,
): Promise<void> {
  const room = await getRoomByCode(roomCode)
  if (!room?.room_state) {
    return
  }

  const state = JSON.parse(room.room_state) as StoredGameState
  if (state.phase !== 'PRE_ROUND') {
    return
  }

  // Idempotent: ignore duplicate submissions
  if (playerNumber === 1 && state.player1Ready) {
    return
  }

  if (playerNumber === 2 && state.player2Ready) {
    return
  }

  const updated: StoredGameState = {
    ...state,
    ...(playerNumber === 1
      ? { player1Cipher: cipher, player1Ready: true }
      : { player2Cipher: cipher, player2Ready: true }),
  }

  await persistState(roomCode, updated)
  logger.info('Cipher selected', { roomCode, playerNumber })

  await (
    updated.player1Ready && updated.player2Ready
      ? transitionTo(io, roomCode, 'IN_ROUND')
      : emitStateToRoom(io, roomCode)
  )
}
