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
import type { Cipher } from './cipher-types.js'
import { CipherSchema } from './cipher-types.js'
import { isCipherValid, sanitizeCipher } from './cipher-validator.js'
import { encrypt, isValidCommandFormat, generateRandomCommand } from './cipher-engine.js'

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
// Role helpers
// ---------------------------------------------------------------------------

function deriveController(coinTossWinner: 1 | 2, subRound: 'A' | 'B'): 1 | 2 {
  if (subRound === 'A') {
    return coinTossWinner
  }

  return coinTossWinner === 1 ? 2 : 1
}

/**
 * Compares two command strings using parsed 4-component comparison.
 * Each component is compared individually, case-insensitively, after trimming.
 */
function compareCommands(a: string, b: string): boolean {
  const partsA = a.trim().split(/\s+/)
  const partsB = b.trim().split(/\s+/)
  if (partsA.length !== 4 || partsB.length !== 4) {
    return false
  }

  return partsA.every((part, index) => part.toLowerCase() === partsB[index].toLowerCase())
}

/** Cleared per-round transient fields when entering PRE_ROUND. */
function freshRoundFields(): Partial<StoredGameState> {
  return {
    controllerCipher: undefined,
    cipherSelected: false,
    recommendedCommand: undefined,
    controllerCommand: undefined,
    encryptedCommand: undefined,
    sabotagerGuess: undefined,
    roundWinner: undefined,
    player1Ready: false,
    player2Ready: false,
  }
}

// ---------------------------------------------------------------------------
// State factory
// ---------------------------------------------------------------------------

export function createInitialState(): StoredGameState {
  return {
    phase: 'WAITING_FOR_PLAYERS',
    phaseEnteredAt: nowIso(),
    currentLevel: 1,
    subRound: 'A',
    roundNumber: 1,
    scores: { player1: 0, player2: 0 },
    cipherSelected: false,
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
  const revealRound = (
    stored.phase === 'ROUND_RESOLUTION'
    || stored.phase === 'ROUND_WIN_CONTROL'
    || stored.phase === 'ROUND_WIN_SABOTAGE'
    || stored.phase === 'POST_ROUND'
    || stored.phase === 'GAME_OVER'
  )

  return {
    phase: stored.phase,
    phaseEnteredAt: stored.phaseEnteredAt,
    currentLevel: stored.currentLevel,
    subRound: stored.subRound,
    roundNumber: stored.roundNumber,
    scores: stored.scores,
    player1Name: room.player_1_name,
    player2Name: room.player_2_name,
    coinTossWinner: stored.coinTossWinner,
    controller: stored.controller,
    sabotager: stored.sabotager,
    player1Ready: stored.player1Ready,
    player2Ready: stored.player2Ready,
    roundWinner: stored.roundWinner,
    gameWinner: stored.gameWinner,
    cipherSelected: stored.cipherSelected,
    recommendedCommand: stored.recommendedCommand,
    encryptedCommand: stored.encryptedCommand,
    controllerCommand: revealRound ? stored.controllerCommand : undefined,
    sabotagerGuess: revealRound ? stored.sabotagerGuess : undefined,
  }
}

export function buildPrivateState(stored: StoredGameState, playerNumber: 1 | 2): PrivateState {
  const role: 'controller' | 'sabotager' | undefined
    = stored.controller === undefined
      ? undefined
      : (stored.controller === playerNumber ? 'controller' : 'sabotager')

  const isController = role === 'controller'
  const isSabotager = role === 'sabotager'

  const revealRound = (
    stored.phase === 'ROUND_RESOLUTION'
    || stored.phase === 'ROUND_WIN_CONTROL'
    || stored.phase === 'ROUND_WIN_SABOTAGE'
    || stored.phase === 'POST_ROUND'
    || stored.phase === 'GAME_OVER'
  )

  return {
    playerNumber,
    role,
    cipher: isController ? stored.controllerCipher : undefined,
    controllerCommand:
      isController && !revealRound ? stored.controllerCommand : undefined,
    sabotagerGuess:
      isSabotager && !revealRound ? stored.sabotagerGuess : undefined,
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

export function scheduleNextTimer(io: Server, roomCode: string, state: StoredGameState): void {
  clearRoomTimer(roomCode)

  switch (state.phase) {
    // ALL_PLAYERS_CONNECTED → COIN_TOSSING after 5 s
    case 'ALL_PLAYERS_CONNECTED': {
      const delay = msRemaining(state.phaseEnteredAt, 5000)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          transitionTo(io, roomCode, 'COIN_TOSSING', () => ({
            coinTossWinner: (Math.random() < 0.5 ? 1 : 2),
          })).catch((error: unknown) => {
            logger.error('Timer error: ALL_PLAYERS_CONNECTED->COIN_TOSSING', { roomCode, error })
          })
        }, delay),
      )
      break
    }

    // COIN_TOSSING → COIN_TOSSED after 3 s
    case 'COIN_TOSSING': {
      const delay = msRemaining(state.phaseEnteredAt, 3000)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          transitionTo(io, roomCode, 'COIN_TOSSED').catch((error: unknown) => {
            logger.error('Timer error: COIN_TOSSING->COIN_TOSSED', { roomCode, error })
          })
        }, delay),
      )
      break
    }

    // COIN_TOSSED → PRE_ROUND after 10 s
    case 'COIN_TOSSED': {
      const delay = msRemaining(state.phaseEnteredAt, 10_000)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          transitionTo(io, roomCode, 'PRE_ROUND', (s) => {
            const ctrlr = s.coinTossWinner
              ? deriveController(s.coinTossWinner, s.subRound)
              : 1
            return {
              ...freshRoundFields(),
              controller: ctrlr,
              sabotager: (ctrlr === 1 ? 2 : 1),
            }
          }).catch((error: unknown) => {
            logger.error('Timer error: COIN_TOSSED->PRE_ROUND', { roomCode, error })
          })
        }, delay),
      )
      break
    }

    // PRE_ROUND → CHALL_CONTROL after 60 s (empty cipher on timeout)
    case 'PRE_ROUND': {
      const delay = msRemaining(state.phaseEnteredAt, 60_000)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          transitionTo(io, roomCode, 'CHALL_CONTROL', (s) => {
            const cipher: Cipher = s.controllerCipher ?? { level: s.currentLevel, blocks: [] }
            return {
              controllerCipher: cipher,
              cipherSelected: s.cipherSelected,
              recommendedCommand: generateRandomCommand(),
            }
          }).catch((error: unknown) => {
            logger.error('Timer error: PRE_ROUND->CHALL_CONTROL', { roomCode, error })
          })
        }, delay),
      )
      break
    }

    // CHALL_CONTROL → CHALL_SABOTAGE after 30 s (null command = controller forfeit)
    case 'CHALL_CONTROL': {
      const delay = msRemaining(state.phaseEnteredAt, 30_000)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          transitionTo(io, roomCode, 'CHALL_SABOTAGE', (s) => {
            const cmd = s.controllerCommand ?? null
            let encrypted: string | undefined
            if (cmd !== null && s.controllerCipher) {
              const result = encrypt(cmd, s.controllerCipher)
              encrypted = result.success ? result.result : cmd
            }

            return { controllerCommand: cmd, encryptedCommand: encrypted }
          }).catch((error: unknown) => {
            logger.error('Timer error: CHALL_CONTROL->CHALL_SABOTAGE', { roomCode, error })
          })
        }, delay),
      )
      break
    }

    // CHALL_SABOTAGE → ROUND_RESOLUTION after 30 s (null guess = sabotager forfeit)
    case 'CHALL_SABOTAGE': {
      const delay = msRemaining(state.phaseEnteredAt, 30_000)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          transitionTo(io, roomCode, 'ROUND_RESOLUTION', s => ({
            sabotagerGuess: s.sabotagerGuess ?? null,
          })).catch((error: unknown) => {
            logger.error('Timer error: CHALL_SABOTAGE->ROUND_RESOLUTION', { roomCode, error })
          })
        }, delay),
      )
      break
    }

    // ROUND_RESOLUTION → ROUND_WIN_CONTROL or ROUND_WIN_SABOTAGE after 5 s
    case 'ROUND_RESOLUTION': {
      const delay = msRemaining(state.phaseEnteredAt, 5000)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          const { controllerCommand, sabotagerGuess, controller, sabotager } = state
          let sabotageWins = false
          if (controllerCommand === null) {
            sabotageWins = true // Controller forfeited
          }
          else if (
            sabotagerGuess !== null && sabotagerGuess !== undefined
            && controllerCommand !== null && controllerCommand !== undefined
          ) {
            sabotageWins = compareCommands(controllerCommand, sabotagerGuess)
          }

          const roundWinner = sabotageWins ? sabotager : controller
          const nextPhase: GamePhase = sabotageWins ? 'ROUND_WIN_SABOTAGE' : 'ROUND_WIN_CONTROL'
          transitionTo(io, roomCode, nextPhase, () => ({ roundWinner })).catch((error: unknown) => {
            logger.error(`Timer error: ROUND_RESOLUTION->${nextPhase}`, { roomCode, error })
          })
        }, delay),
      )
      break
    }

    // ROUND_WIN_CONTROL → POST_ROUND after 10 s (award point to controller)
    case 'ROUND_WIN_CONTROL': {
      const delay = msRemaining(state.phaseEnteredAt, 10_000)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          transitionTo(io, roomCode, 'POST_ROUND', (s) => {
            const scores = { ...s.scores }
            if (s.controller === 1) {
              scores.player1 += 1
            }
            else if (s.controller === 2) {
              scores.player2 += 1
            }

            return { scores, player1Ready: false, player2Ready: false }
          }).catch((error: unknown) => {
            logger.error('Timer error: ROUND_WIN_CONTROL->POST_ROUND', { roomCode, error })
          })
        }, delay),
      )
      break
    }

    // ROUND_WIN_SABOTAGE → POST_ROUND after 10 s (award point to sabotager)
    case 'ROUND_WIN_SABOTAGE': {
      const delay = msRemaining(state.phaseEnteredAt, 10_000)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          transitionTo(io, roomCode, 'POST_ROUND', (s) => {
            const scores = { ...s.scores }
            if (s.sabotager === 1) {
              scores.player1 += 1
            }
            else if (s.sabotager === 2) {
              scores.player2 += 1
            }

            return { scores, player1Ready: false, player2Ready: false }
          }).catch((error: unknown) => {
            logger.error('Timer error: ROUND_WIN_SABOTAGE->POST_ROUND', { roomCode, error })
          })
        }, delay),
      )
      break
    }

    // POST_ROUND → next PRE_ROUND or GAME_OVER after 60 s
    case 'POST_ROUND': {
      const delay = msRemaining(state.phaseEnteredAt, 60_000)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          advanceFromPostRound(io, roomCode).catch((error: unknown) => {
            logger.error('Timer error: POST_ROUND->next', { roomCode, error })
          })
        }, delay),
      )
      break
    }

    // WAITING_FOR_PLAYERS, GAME_OVER — no automatic timed transitions
    default: {
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Post-round progression logic
// ---------------------------------------------------------------------------

async function advanceFromPostRound(io: Server, roomCode: string): Promise<void> {
  const room = await getRoomByCode(roomCode)
  if (!room?.room_state) {
    return
  }

  const state = JSON.parse(room.room_state) as StoredGameState
  if (state.phase !== 'POST_ROUND') {
    return
  }

  if (state.subRound === 'A') {
    // Same level — play sub-round B with roles swapped
    await transitionTo(io, roomCode, 'PRE_ROUND', (s) => {
      const ctrlr = s.coinTossWinner
        ? deriveController(s.coinTossWinner, 'B')
        : ((s.controller === 1 ? 2 : 1))
      return {
        ...freshRoundFields(),
        subRound: 'B' as const,
        roundNumber: s.roundNumber + 1,
        controller: ctrlr,
        sabotager: (ctrlr === 1 ? 2 : 1),
      }
    })
  }
  else if (state.currentLevel < 5) {
    // Advance to next level — sub-round A
    await transitionTo(io, roomCode, 'PRE_ROUND', (s) => {
      const ctrlr = s.coinTossWinner
        ? deriveController(s.coinTossWinner, 'A')
        : (1 as 1 | 2)
      return {
        ...freshRoundFields(),
        subRound: 'A' as const,
        currentLevel: s.currentLevel + 1,
        roundNumber: s.roundNumber + 1,
        controller: ctrlr,
        sabotager: (ctrlr === 1 ? 2 : 1),
      }
    })
  }
  else {
    // All 5 levels done — game over
    await transitionTo(io, roomCode, 'GAME_OVER', (s) => {
      let gameWinner: 1 | 2 | 'draw'
      if (s.scores.player1 > s.scores.player2) {
        gameWinner = 1
      }
      else if (s.scores.player2 > s.scores.player1) {
        gameWinner = 2
      }
      else {
        gameWinner = 'draw'
      }

      return { gameWinner }
    })
  }
}

// ---------------------------------------------------------------------------
// Public handlers called from game-logic.ts
// ---------------------------------------------------------------------------

export async function ensureTimersScheduled(io: Server, roomCode: string): Promise<void> {
  if (pendingTimers.has(roomCode)) {
    return
  }

  const room = await getRoomByCode(roomCode)
  if (!room?.room_state) {
    return
  }

  const state = JSON.parse(room.room_state) as StoredGameState
  scheduleNextTimer(io, roomCode, state)
}

/**
 * Immediately transitions to ALL_PLAYERS_CONNECTED when both players are
 * present in WAITING_FOR_PLAYERS for the first time.
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

  logger.info('Both players connected — transitioning to ALL_PLAYERS_CONNECTED', { roomCode })
  await transitionTo(io, roomCode, 'ALL_PLAYERS_CONNECTED', () => ({
    bothPlayersConnectedAt: nowIso(),
  }))
}

/**
 * Handles `game:select_cipher` — controller only, during PRE_ROUND.
 * Transitions to CHALL_CONTROL on success.
 */
export async function handleCipherSelect(
  io: Server,
  roomCode: string,
  playerNumber: 1 | 2,
  cipherData: unknown,
): Promise<{ success: boolean, error?: string }> {
  const room = await getRoomByCode(roomCode)
  if (!room?.room_state) {
    return { success: false, error: 'Room not found' }
  }

  const state = JSON.parse(room.room_state) as StoredGameState
  if (state.phase !== 'PRE_ROUND') {
    return { success: false, error: 'Not in PRE_ROUND phase' }
  }

  if (state.controller !== playerNumber) {
    return { success: false, error: 'Only the controller can select a cipher' }
  }

  if (state.cipherSelected) {
    return { success: true }
  }

  const parseResult = CipherSchema.safeParse(cipherData)
  if (!parseResult.success) {
    return {
      success: false,
      error: `Invalid cipher format: ${parseResult.error.errors[0]?.message}`,
    }
  }

  const cipher = sanitizeCipher(parseResult.data)
  const validation = isCipherValid(cipher)
  if (!validation.valid) {
    return { success: false, error: validation.errors.join('; ') }
  }

  logger.info('Cipher selected — transitioning to CHALL_CONTROL', { roomCode, playerNumber })
  await transitionTo(io, roomCode, 'CHALL_CONTROL', () => ({
    controllerCipher: cipher,
    cipherSelected: true,
    recommendedCommand: generateRandomCommand(),
  }))

  return { success: true }
}

/**
 * Handles `game:submit_command` — controller only, during CHALL_CONTROL.
 * Encrypts the command and transitions to CHALL_SABOTAGE.
 */
export async function handleSubmitCommand(
  io: Server,
  roomCode: string,
  playerNumber: 1 | 2,
  command: unknown,
): Promise<{ success: boolean, error?: string }> {
  if (typeof command !== 'string') {
    return { success: false, error: 'command must be a string' }
  }

  const room = await getRoomByCode(roomCode)
  if (!room?.room_state) {
    return { success: false, error: 'Room not found' }
  }

  const state = JSON.parse(room.room_state) as StoredGameState
  if (state.phase !== 'CHALL_CONTROL') {
    return { success: false, error: 'Not in CHALL_CONTROL phase' }
  }

  if (state.controller !== playerNumber) {
    return { success: false, error: 'Only the controller can submit a command' }
  }

  if (state.controllerCommand !== undefined) {
    return { success: true }
  }

  if (!isValidCommandFormat(command)) {
    return { success: false, error: 'Invalid command format. Expected: "Component type attribute value"' }
  }

  const cipher: Cipher = state.controllerCipher ?? { level: state.currentLevel, blocks: [] }
  const encResult = encrypt(command, cipher)
  if (!encResult.success) {
    return { success: false, error: `Encryption failed: ${encResult.error}` }
  }

  logger.info('Controller submitted command — transitioning to CHALL_SABOTAGE', { roomCode, playerNumber })
  await transitionTo(io, roomCode, 'CHALL_SABOTAGE', () => ({
    controllerCommand: command,
    encryptedCommand: encResult.result,
  }))

  return { success: true }
}

/**
 * Handles `game:submit_guess` — sabotager only, during CHALL_SABOTAGE.
 * Transitions to ROUND_RESOLUTION.
 */
export async function handleSubmitGuess(
  io: Server,
  roomCode: string,
  playerNumber: 1 | 2,
  guess: unknown,
): Promise<{ success: boolean, error?: string }> {
  if (typeof guess !== 'string') {
    return { success: false, error: 'guess must be a string' }
  }

  const room = await getRoomByCode(roomCode)
  if (!room?.room_state) {
    return { success: false, error: 'Room not found' }
  }

  const state = JSON.parse(room.room_state) as StoredGameState
  if (state.phase !== 'CHALL_SABOTAGE') {
    return { success: false, error: 'Not in CHALL_SABOTAGE phase' }
  }

  if (state.sabotager !== playerNumber) {
    return { success: false, error: 'Only the sabotager can submit a guess' }
  }

  if (state.sabotagerGuess !== undefined) {
    return { success: true }
  }

  if (!isValidCommandFormat(guess)) {
    return { success: false, error: 'Invalid guess format. Expected: "Component type attribute value"' }
  }

  logger.info('Sabotager submitted guess — transitioning to ROUND_RESOLUTION', { roomCode, playerNumber })
  await transitionTo(io, roomCode, 'ROUND_RESOLUTION', () => ({
    sabotagerGuess: guess,
  }))

  return { success: true }
}

/**
 * Handles `game:player_ready` during POST_ROUND.
 * Immediately advances if both players are ready.
 */
export async function handlePlayerReady(
  io: Server,
  roomCode: string,
  playerNumber: 1 | 2,
): Promise<{ success: boolean, error?: string }> {
  const room = await getRoomByCode(roomCode)
  if (!room?.room_state) {
    return { success: false, error: 'Room not found' }
  }

  const state = JSON.parse(room.room_state) as StoredGameState
  if (state.phase !== 'POST_ROUND') {
    return { success: false, error: 'Not in POST_ROUND phase' }
  }

  const alreadyReady = playerNumber === 1 ? state.player1Ready : state.player2Ready
  if (alreadyReady) {
    return { success: true }
  }

  const updated: StoredGameState = {
    ...state,
    ...(playerNumber === 1 ? { player1Ready: true } : { player2Ready: true }),
  }

  await persistState(roomCode, updated)
  logger.info('Player ready', { roomCode, playerNumber })

  await (updated.player1Ready && updated.player2Ready ? advanceFromPostRound(io, roomCode) : emitStateToRoom(io, roomCode))

  return { success: true }
}
