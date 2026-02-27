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
import { encrypt, isValidCommandFormat } from './cipher-engine.js'
import {
  MAX_LEVELS,
  PHASE_DURATIONS,
  EFFECTIVENESS,
  GUESS_DAMAGE_TIERS,
  CONTROLLER_FORFEIT_DAMAGE,
  COMMAND_COMPONENTS,
  COMMAND_TYPES,
  COMMAND_ATTRIBUTES,
  COMMAND_VALUES,
  SUBROUNDS_PER_TURN,
} from './game-constants.js'

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

/**
 * Derives the controller for a given turn.
 * Turn 1: coin-toss winner is the controller.
 * Turn 2: the other player is the controller.
 */
function deriveController(coinTossWinner: 1 | 2, turnIndex: 1 | 2): 1 | 2 {
  if (turnIndex === 1) {
    return coinTossWinner
  }

  return coinTossWinner === 1 ? 2 : 1
}

/**
 * Counts how many components (out of 4: component, type, attribute, value)
 * match between two command strings (case-insensitive).
 *
 * Returns 0–4.
 */
function countMatchingComponents(a: string, b: string): number {
  const partsA = a.trim().split(/\s+/)
  const partsB = b.trim().split(/\s+/)

  if (partsA.length !== 4 || partsB.length !== 4) {
    return 0
  }

  let matches = 0
  for (let index = 0; index < 4; index++) {
    if (partsA[index].toLowerCase() === partsB[index].toLowerCase()) {
      matches++
    }
  }

  return matches
}

/**
 * Counts how many of a command's component/type/attribute
 * (first 3 parts, not value) appear in the turn history.
 *
 * Returns 0–3.
 */
function countComponentReuse(command: string, history: string[]): number {
  const parts = command.trim().split(/\s+/)
  if (parts.length !== 4) {
    return 0
  }

  const [component, type, attribute] = parts

  let reuseCount = 0

  for (const histCmd of history) {
    const histParts = histCmd.trim().split(/\s+/)
    if (histParts.length !== 4) {
      continue
    }

    const [histComponent, histType, histAttribute] = histParts

    if (component.toLowerCase() === histComponent.toLowerCase()) {
      reuseCount++
    }

    if (type.toLowerCase() === histType.toLowerCase()) {
      reuseCount++
    }

    if (attribute.toLowerCase() === histAttribute.toLowerCase()) {
      reuseCount++
    }
  }

  return Math.min(reuseCount, 3) // Cap at 3
}

/**
 * Maps component reuse count (0–3) to effectiveness value (HP restoration).
 */
function mapReuseToEffectiveness(reuseCount: number): number {
  if (reuseCount === 0) {
    return EFFECTIVENESS.reuse0
  }

  if (reuseCount === 1) {
    return EFFECTIVENESS.reuse1
  }

  // 2–3 use the same value
  return EFFECTIVENESS.reuse2to3
}

/** Cleared per-subround transient fields. */
function freshSubroundFields(): Partial<StoredGameState> {
  return {
    commandOptions: undefined,
    commandEffectiveness: undefined,
    selectedCommandIndex: undefined,
    controllerCommand: undefined,
    encryptedCommand: undefined,
    sabotagerGuess: undefined,
  }
}

/** Cleared per-turn transient fields; resets HP and turn-wide history. */
function freshTurnFields(): Partial<StoredGameState> {
  return {
    ...freshSubroundFields(),
    controllerCipher: undefined,
    cipherSelected: false,
    reactorHP: 100,
    turnCommandHistory: [],
    plaintextCiphertextPairs: [],
  }
}

// ---------------------------------------------------------------------------
// Command generation
// ---------------------------------------------------------------------------

/**
 * Generates a random command (plaintext).
 */
function generateRandomCommand(): string {
  const randomChoice = <T>(array: T[]): T => array[Math.floor(Math.random() * array.length)]
  return `${randomChoice(COMMAND_COMPONENTS)} ${randomChoice(COMMAND_TYPES)} ${randomChoice(COMMAND_ATTRIBUTES)} ${randomChoice(COMMAND_VALUES)}`
}

/**
 * Generates 3 distinct command options, ensuring they differ in
 * at least one component/type/attribute (for strategic variety).
 *
 * Effectiveness is based on how many encrypted tokens of the candidate command
 * (component / type / attribute — first 3 parts of the ciphertext) appear in
 * the ciphertexts the sabotager has already seen this turn. More overlap means
 * the sabotager has more context to guess, so the controller earns more HP for
 * taking that risk.
 *
 * Returns both the options and the effectiveness value for each.
 */
function generateCommandOptions(
  cipher: Cipher | undefined,
  previousCiphertexts: string[],
): { options: string[], effectiveness: number[] } {
  const cipherToUse: Cipher = cipher ?? { level: 1, blocks: [] }
  const options: string[] = []
  const effectiveness: number[] = []

  // Generate 3 commands, striving for variety in component/type/attribute
  let attempts = 0
  const maxAttempts = 100

  while (options.length < 3 && attempts < maxAttempts) {
    const cmd = generateRandomCommand()

    // Check if already in options
    if (options.includes(cmd)) {
      attempts++
      continue
    }

    // If we have 0–2 commands, check for variety in component/type/attribute
    if (options.length > 0) {
      const newParts = cmd.trim().split(/\s+/).slice(0, 3) // Component, type, attribute
      let isDifferent = false

      for (const existingCmd of options) {
        const existingParts = existingCmd.trim().split(/\s+/).slice(0, 3)
        // Check if at least one part differs
        if (
          newParts[0] !== existingParts[0]
          || newParts[1] !== existingParts[1]
          || newParts[2] !== existingParts[2]
        ) {
          isDifferent = true
          break
        }
      }

      if (!isDifferent) {
        attempts++
        continue
      }
    }

    // Add this command
    options.push(cmd)

    // Compute effectiveness: encrypt the command, then count how many of the
    // resulting ciphertext tokens (first 3 parts) appear in previously seen
    // ciphertexts. Higher overlap → sabotager has more context → bigger HP reward.
    const encResult = encrypt(cmd, cipherToUse)
    const encryptedCmd = encResult.success ? encResult.result : cmd
    const reuseCount = countComponentReuse(encryptedCmd, previousCiphertexts)
    effectiveness.push(mapReuseToEffectiveness(reuseCount))
  }

  // Fallback: if we didn't generate 3 distinct, pad with any random
  while (options.length < 3) {
    const cmd = generateRandomCommand()
    options.push(cmd)
    const encResult = encrypt(cmd, cipherToUse)
    const encryptedCmd = encResult.success ? encResult.result : cmd
    const reuseCount = countComponentReuse(encryptedCmd, previousCiphertexts)
    effectiveness.push(mapReuseToEffectiveness(reuseCount))
  }

  return { options, effectiveness }
}

// ---------------------------------------------------------------------------
// State factory
// ---------------------------------------------------------------------------

export function createInitialState(): StoredGameState {
  return {
    phase: 'WAITING_FOR_PLAYERS',
    phaseEnteredAt: nowIso(),
    currentLevel: 1,
    currentTurn: 1,
    currentSubround: 1,
    turnNumber: 1,
    scores: { player1: 0, player2: 0 },
    cipherSelected: false,
    reactorHP: 100,
    turnCommandHistory: [],
    plaintextCiphertextPairs: [],
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
  // Reveal command/guess after SUBROUND_RESOLUTION
  const revealOutcome = (
    stored.phase === 'SUBROUND_RESOLUTION'
    || stored.phase === 'TURN_END'
    || stored.phase === 'POST_TURN'
    || stored.phase === 'GAME_OVER'
  )

  return {
    phase: stored.phase,
    phaseEnteredAt: stored.phaseEnteredAt,
    currentLevel: stored.currentLevel,
    currentTurn: stored.currentTurn,
    currentSubround: stored.currentSubround,
    turnNumber: stored.turnNumber,
    scores: stored.scores,
    player1Name: room.player_1_name,
    player2Name: room.player_2_name,
    coinTossWinner: stored.coinTossWinner,
    controller: stored.controller,
    sabotager: stored.sabotager,
    player1Ready: stored.player1Ready,
    player2Ready: stored.player2Ready,
    turnWinner: stored.turnWinner,
    gameWinner: stored.gameWinner,
    cipherSelected: stored.cipherSelected,
    reactorHP: stored.reactorHP,
    commandOptions: stored.commandOptions,
    encryptedCommand: stored.encryptedCommand,
    controllerCommand: revealOutcome ? stored.controllerCommand : undefined,
    sabotagerGuess: revealOutcome ? stored.sabotagerGuess : undefined,
    plaintextCiphertextPairs: stored.plaintextCiphertextPairs,
  }
}

export function buildPrivateState(stored: StoredGameState, playerNumber: 1 | 2): PrivateState {
  const role: 'controller' | 'sabotager' | undefined
    = stored.controller === undefined
      ? undefined
      : (stored.controller === playerNumber
          ? 'controller'
          : 'sabotager')

  const isController = role === 'controller'
  const isSabotager = role === 'sabotager'

  const revealOutcome = (
    stored.phase === 'SUBROUND_RESOLUTION'
    || stored.phase === 'TURN_END'
    || stored.phase === 'POST_TURN'
    || stored.phase === 'GAME_OVER'
  )

  return {
    playerNumber,
    role,
    // Controller-only
    cipher: isController ? stored.controllerCipher : undefined,
    cipherSelected: isController ? stored.cipherSelected : undefined,
    commandOptions: isController ? stored.commandOptions : undefined,
    commandEffectiveness: isController ? stored.commandEffectiveness : undefined,
    selectedCommandIndex: isController ? stored.selectedCommandIndex : undefined,
    controllerCommand: isController && !revealOutcome ? stored.controllerCommand : undefined,
    // Sabotager-only
    sabotagerGuess: isSabotager && !revealOutcome ? stored.sabotagerGuess : undefined,
    plaintextCiphertextPairs: isSabotager ? stored.plaintextCiphertextPairs : undefined,
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
 * - Private state is dispatched individually to each connected socket.
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
// Timer scheduler — rewritten for turn/subround system
// ---------------------------------------------------------------------------

export function scheduleNextTimer(io: Server, roomCode: string, state: StoredGameState): void {
  clearRoomTimer(roomCode)

  switch (state.phase) {
    // ALL_PLAYERS_CONNECTED → COIN_TOSSING after 5 s
    case 'ALL_PLAYERS_CONNECTED': {
      const delay = msRemaining(state.phaseEnteredAt, PHASE_DURATIONS.ALL_PLAYERS_CONNECTED)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          transitionTo(io, roomCode, 'COIN_TOSSING', () => ({
            coinTossWinner: Math.random() < 0.5 ? 1 : 2,
          })).catch((error: unknown) => {
            logger.error('Timer error: ALL_PLAYERS_CONNECTED->COIN_TOSSING', { roomCode, error })
          })
        }, delay),
      )
      break
    }

    // COIN_TOSSING → COIN_TOSSED after 3 s
    case 'COIN_TOSSING': {
      const delay = msRemaining(state.phaseEnteredAt, PHASE_DURATIONS.COIN_TOSSING)
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

    // COIN_TOSSED → PRE_TURN after 10 s (start turn 1 of level 1)
    case 'COIN_TOSSED': {
      const delay = msRemaining(state.phaseEnteredAt, PHASE_DURATIONS.COIN_TOSSED)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          transitionTo(io, roomCode, 'PRE_TURN', (s) => {
            const ctrlr = s.coinTossWinner
              ? deriveController(s.coinTossWinner, 1) // Turn 1
              : 1
            return {
              ...freshTurnFields(),
              currentLevel: 1,
              currentTurn: 1,
              currentSubround: 1,
              turnNumber: 1,
              controller: ctrlr,
              sabotager: ctrlr === 1 ? 2 : 1,
            }
          }).catch((error: unknown) => {
            logger.error('Timer error: COIN_TOSSED->PRE_TURN', { roomCode, error })
          })
        }, delay),
      )
      break
    }

    // PRE_TURN → CHALL_CONTROL after 60 s
    case 'PRE_TURN': {
      const delay = msRemaining(state.phaseEnteredAt, PHASE_DURATIONS.PRE_TURN)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          transitionTo(io, roomCode, 'CHALL_CONTROL', (s) => {
            const cipher: Cipher = s.controllerCipher ?? { level: s.currentLevel, blocks: [] }
            const previousCiphertexts = s.plaintextCiphertextPairs.map(p => p.ciphertext)
            const { options, effectiveness } = generateCommandOptions(cipher, previousCiphertexts)
            return {
              controllerCipher: cipher,
              cipherSelected: s.cipherSelected,
              commandOptions: options,
              commandEffectiveness: effectiveness,
            }
          }).catch((error: unknown) => {
            logger.error('Timer error: PRE_TURN->CHALL_CONTROL', { roomCode, error })
          })
        }, delay),
      )
      break
    }

    // CHALL_CONTROL → CHALL_SABOTAGE after 30 s
    case 'CHALL_CONTROL': {
      const delay = msRemaining(state.phaseEnteredAt, PHASE_DURATIONS.CHALL_CONTROL)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          transitionTo(io, roomCode, 'CHALL_SABOTAGE', (s) => {
            // If controller didn't select, apply forfeit
            const cmd = s.controllerCommand ?? null
            let encrypted: string | undefined
            let hpAfterTimeout = s.reactorHP

            // HP ticking: subtract elapsed seconds
            const elapsedSecs = Math.ceil((Date.now() - new Date(s.phaseEnteredAt).getTime()) / 1000)
            hpAfterTimeout = Math.max(0, s.reactorHP - elapsedSecs)

            if (cmd !== null && s.controllerCipher) {
              const result = encrypt(cmd, s.controllerCipher)
              encrypted = result.success ? result.result : cmd
            }

            return {
              controllerCommand: cmd,
              encryptedCommand: encrypted,
              reactorHP: hpAfterTimeout,
            }
          }).catch((error: unknown) => {
            logger.error('Timer error: CHALL_CONTROL->CHALL_SABOTAGE', { roomCode, error })
          })
        }, delay),
      )
      break
    }

    // CHALL_SABOTAGE → SUBROUND_RESOLUTION after 30 s
    case 'CHALL_SABOTAGE': {
      const delay = msRemaining(state.phaseEnteredAt, PHASE_DURATIONS.CHALL_SABOTAGE)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          transitionTo(io, roomCode, 'SUBROUND_RESOLUTION', s => ({
            sabotagerGuess: s.sabotagerGuess ?? null,
          })).catch((error: unknown) => {
            logger.error('Timer error: CHALL_SABOTAGE->SUBROUND_RESOLUTION', { roomCode, error })
          })
        }, delay),
      )
      break
    }

    // SUBROUND_RESOLUTION → CHALL_CONTROL (next subround) or TURN_END (turn wins)
    case 'SUBROUND_RESOLUTION': {
      const delay = msRemaining(state.phaseEnteredAt, PHASE_DURATIONS.SUBROUND_RESOLUTION)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          const {
            controllerCommand,
            sabotagerGuess,
            controller,
            sabotager,
            reactorHP,
            currentSubround,
          } = state

          // Determine outcome and apply damage
          let turnWinner: 1 | 2 | undefined
          let hpAfterDamage = reactorHP
          const newPairs = [...state.plaintextCiphertextPairs]

          // Record PT/CT pair if command was executed
          if (controllerCommand !== null && state.encryptedCommand) {
            newPairs.push({
              plaintext: controllerCommand,
              ciphertext: state.encryptedCommand,
            })
          }

          // Apply damage based on guess match quality
          if (controllerCommand === null) {
            // Controller forfeited: apply forfeit damage
            hpAfterDamage = Math.max(0, reactorHP - CONTROLLER_FORFEIT_DAMAGE)
            turnWinner = sabotager
          }
          else if (sabotagerGuess !== null) {
            const matchCount = countMatchingComponents(controllerCommand, sabotagerGuess)
            if (matchCount === 4) {
              // Exact match: immediate turn end, sabotager wins
              hpAfterDamage = 0
              turnWinner = sabotager
            }
            else {
              // Apply damage based on match count
              const damage = GUESS_DAMAGE_TIERS[`match${matchCount}` as keyof typeof GUESS_DAMAGE_TIERS]
              if (damage !== undefined) {
                hpAfterDamage = Math.max(0, reactorHP - damage)
              }
            }
          }
          // If sabotagerGuess === null (timeout), no damage applied

          // Determine next phase
          const shouldEndTurn = hpAfterDamage <= 0 || currentSubround >= SUBROUNDS_PER_TURN
          const nextPhase: GamePhase = shouldEndTurn ? 'TURN_END' : 'CHALL_CONTROL'

          if (shouldEndTurn && !turnWinner) {
            // Controller wins if we've used all subrounds and HP > 0
            // Sabotager wins if HP dropped to 0
            turnWinner = hpAfterDamage > 0 ? controller : sabotager
          }

          transitionTo(io, roomCode, nextPhase, (s) => {
            if (nextPhase === 'TURN_END') {
              return {
                reactorHP: hpAfterDamage,
                turnWinner,
                plaintextCiphertextPairs: newPairs,
                sabotagerGuess: undefined,
              }
            }

            // Next subround in same turn — generate fresh command options.
            // Use newPairs (includes the pair just resolved) so the sabotager's
            // growing ciphertext knowledge is reflected in the effectiveness values.
            const nextCiphertexts = newPairs.map(p => p.ciphertext)
            const { options: nextOptions, effectiveness: nextEffectiveness }
              = generateCommandOptions(s.controllerCipher, nextCiphertexts)

            return {
              reactorHP: hpAfterDamage,
              currentSubround: (currentSubround + 1) as 1 | 2 | 3,
              ...freshSubroundFields(),
              plaintextCiphertextPairs: newPairs,
              commandOptions: nextOptions,
              commandEffectiveness: nextEffectiveness,
            }
          }).catch((error: unknown) => {
            logger.error(`Timer error: SUBROUND_RESOLUTION->${nextPhase}`, { roomCode, error })
          })
        }, delay),
      )
      break
    }

    // TURN_END → POST_TURN after 10 s (award point to turn winner)
    case 'TURN_END': {
      const delay = msRemaining(state.phaseEnteredAt, PHASE_DURATIONS.TURN_END)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          transitionTo(io, roomCode, 'POST_TURN', (s) => {
            const scores = { ...s.scores }
            if (s.turnWinner === 1) {
              scores.player1 += 1
            }
            else if (s.turnWinner === 2) {
              scores.player2 += 1
            }

            return { scores, player1Ready: false, player2Ready: false }
          }).catch((error: unknown) => {
            logger.error('Timer error: TURN_END->POST_TURN', { roomCode, error })
          })
        }, delay),
      )
      break
    }

    // POST_TURN → next PRE_TURN or GAME_OVER after 60 s
    case 'POST_TURN': {
      const delay = msRemaining(state.phaseEnteredAt, PHASE_DURATIONS.POST_TURN)
      pendingTimers.set(
        roomCode,
        setTimeout(() => {
          advanceFromPostTurn(io, roomCode).catch((error: unknown) => {
            logger.error('Timer error: POST_TURN->next', { roomCode, error })
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
// Post-turn progression logic
// ---------------------------------------------------------------------------

async function advanceFromPostTurn(io: Server, roomCode: string): Promise<void> {
  const room = await getRoomByCode(roomCode)
  if (!room?.room_state) {
    return
  }

  const state = JSON.parse(room.room_state) as StoredGameState
  if (state.phase !== 'POST_TURN') {
    return
  }

  // Determine next state based on current level/turn
  if (state.currentTurn === 1) {
    // Play turn 2 of same level with roles swapped
    const ctrlr = state.coinTossWinner
      ? deriveController(state.coinTossWinner, 2)
      : (state.controller === 1 ? 2 : 1)

    await transitionTo(io, roomCode, 'PRE_TURN', s => ({
      ...freshTurnFields(),
      currentLevel: s.currentLevel,
      currentTurn: 2,
      currentSubround: 1,
      turnNumber: s.turnNumber + 1,
      controller: ctrlr,
      sabotager: ctrlr === 1 ? 2 : 1,
    }))
  }
  else if (state.currentLevel < MAX_LEVELS) {
    // Advance to next level, turn 1
    const ctrlr = state.coinTossWinner
      ? deriveController(state.coinTossWinner, 1)
      : 1

    await transitionTo(io, roomCode, 'PRE_TURN', s => ({
      ...freshTurnFields(),
      currentLevel: s.currentLevel + 1,
      currentTurn: 1,
      currentSubround: 1,
      turnNumber: s.turnNumber + 1,
      controller: ctrlr,
      sabotager: ctrlr === 1 ? 2 : 1,
    }))
  }
  else {
    // All turns done — game over
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
 * Handles `game:select_cipher` — controller only, during PRE_TURN.
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
  if (state.phase !== 'PRE_TURN') {
    return { success: false, error: 'Not in PRE_TURN phase' }
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

  // Generate command options before transitioning.
  // At the start of a turn plaintextCiphertextPairs is empty, so all options
  // start at baseline effectiveness (no prior ciphertexts seen by sabotager).
  const previousCiphertexts = state.plaintextCiphertextPairs.map(p => p.ciphertext)
  const { options, effectiveness } = generateCommandOptions(cipher, previousCiphertexts)

  await transitionTo(io, roomCode, 'CHALL_CONTROL', () => ({
    controllerCipher: cipher,
    cipherSelected: true,
    commandOptions: options,
    commandEffectiveness: effectiveness,
  }))

  return { success: true }
}

/**
 * Handles `game:select_command` — controller only, during CHALL_CONTROL.
 * Controller picks one of 3 command options by index (0, 1, 2).
 * Applies effectiveness bonus to HP, encrypts command, transitions to CHALL_SABOTAGE.
 */
export async function handleSelectCommand(
  io: Server,
  roomCode: string,
  playerNumber: 1 | 2,
  commandIndex: unknown,
): Promise<{ success: boolean, error?: string }> {
  if (
    typeof commandIndex !== 'number'
    || ![0, 1, 2].includes(commandIndex)
  ) {
    return { success: false, error: 'commandIndex must be 0, 1, or 2' }
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
    return { success: false, error: 'Only the controller can select a command' }
  }

  if (state.selectedCommandIndex !== undefined) {
    return { success: true }
  }

  if (!state.commandOptions || !state.commandEffectiveness) {
    return { success: false, error: 'Command options not available' }
  }

  const selectedCommand = state.commandOptions[commandIndex]
  const effectiveness = state.commandEffectiveness[commandIndex]

  if (!selectedCommand || !effectiveness) {
    return { success: false, error: 'Invalid command index' }
  }

  // Apply effectiveness bonus to HP
  const elapsedSecs = Math.ceil((Date.now() - new Date(state.phaseEnteredAt).getTime()) / 1000)
  let hpAfterChoice = Math.max(0, state.reactorHP - elapsedSecs)
  hpAfterChoice = Math.min(100, hpAfterChoice + effectiveness)

  // Encrypt the command
  const cipher: Cipher = state.controllerCipher ?? { level: state.currentLevel, blocks: [] }
  const encResult = encrypt(selectedCommand, cipher)
  const encrypted = encResult.success ? encResult.result : selectedCommand

  logger.info('Controller selected command — transitioning to CHALL_SABOTAGE', {
    roomCode,
    playerNumber,
    commandIndex,
  })

  await transitionTo(io, roomCode, 'CHALL_SABOTAGE', () => ({
    selectedCommandIndex: commandIndex as 0 | 1 | 2,
    controllerCommand: selectedCommand,
    encryptedCommand: encrypted,
    reactorHP: hpAfterChoice,
    turnCommandHistory: [...state.turnCommandHistory, selectedCommand],
  }))

  return { success: true }
}

/**
 * Handles `game:submit_guess` — sabotager only, during CHALL_SABOTAGE.
 * Transitions to SUBROUND_RESOLUTION.
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

  logger.info('Sabotager submitted guess — transitioning to SUBROUND_RESOLUTION', {
    roomCode,
    playerNumber,
  })

  await transitionTo(io, roomCode, 'SUBROUND_RESOLUTION', () => ({
    sabotagerGuess: guess,
  }))

  return { success: true }
}

/**
 * Handles `game:player_ready` during POST_TURN.
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
  if (state.phase !== 'POST_TURN') {
    return { success: false, error: 'Not in POST_TURN phase' }
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

  await (updated.player1Ready && updated.player2Ready
    ? advanceFromPostTurn(io, roomCode)
    : emitStateToRoom(io, roomCode))

  return { success: true }
}
