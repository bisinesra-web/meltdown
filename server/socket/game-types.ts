import type { Cipher } from './cipher-types.js'

// ---------------------------------------------------------------------------
// Game FSM — type definitions (Turn/Subround System)
// ---------------------------------------------------------------------------

/**
 * Turn/Subround-based game phases.
 *
 * Flow for each turn (up to 3 subrounds):
 *   PRE_TURN → CHALL_CONTROL → CHALL_SABOTAGE → SUBROUND_RESOLUTION
 *   ↓ (if HP > 0 and subround < 3)
 *   CHALL_CONTROL → ... (repeat up to 3 subrounds)
 *   ↓ (if HP ≤ 0 or all 3 subrounds done)
 *   TURN_END → POST_TURN → [next turn or GAME_OVER]
 */
export type GamePhase
  = | 'WAITING_FOR_PLAYERS' // Till both players have connected
    | 'ALL_PLAYERS_CONNECTED' // Brief transitional phase (5s)
    | 'COIN_TOSSING' // Coin toss animation (3s)
    | 'COIN_TOSSED' // Coin toss result (10s)
    | 'PRE_TURN' // Cipher selection; HP reset to 100; subround count reset
    | 'CHALL_CONTROL' // Controller selects 1 of 3 command options; HP ticks down
    | 'CHALL_SABOTAGE' // Sabotager guesses; damage applied on submission
    | 'SUBROUND_RESOLUTION' // 5s animation; determine if guess was correct
    | 'TURN_END' // 10s display; award 1 point to turn winner
    | 'POST_TURN' // Min of (60s OR both players ready); display scores
    | 'GAME_OVER'

// ---------------------------------------------------------------------------
// Stored game state — persisted in `room_state` JSON column
// ---------------------------------------------------------------------------

/**
 * Full game state persisted in the `room_state` JSON column.
 *
 * IMPORTANT: Never send this object verbatim to any client — use
 * {@link buildPublicState} / {@link buildPrivateState} instead.
 *
 * Turn structure (Turn/Subround System):
 *   - 3 levels, each with 2 turns (6 turns total)
 *   - Each turn has up to 3 subrounds (command/guess cycles)
 *   - Controller stays same for all subrounds within a turn using one cipher
 *   - Sabotager can study plaintext/ciphertext pairs across subrounds
 *   - Reactor health (HP) resets to 100 at turn start, ticks down during CHALL_CONTROL
 *   - Turn ends when HP ≤ 0 (sabotager wins) or all 3 subrounds complete (controller wins if HP > 0)
 */
export interface StoredGameState {
  phase: GamePhase
  /** ISO-8601 timestamp of when the current phase was entered. */
  phaseEnteredAt: string

  // --- Progression ---
  /** Current level (1–3). */
  currentLevel: number
  /** Current turn within the level (1–2). */
  currentTurn: 1 | 2
  /** Current subround within the turn (1–3). */
  currentSubround: 1 | 2 | 3
  /** Overall turn counter (1–6), used for display. */
  turnNumber: number
  scores: { player1: number, player2: number }

  // --- Connection / coin toss ---
  /**
   * Set the moment the second player's socket connects while in
   * WAITING_FOR_PLAYERS.  The ALL_PLAYERS_CONNECTED transition fires
   * immediately after this is recorded.
   */
  bothPlayersConnectedAt?: string
  /** Determined at the start of ALL_PLAYERS_CONNECTED; revealed in COIN_TOSSED. */
  coinTossWinner?: 1 | 2

  // --- Derived roles (set when entering PRE_TURN) ---
  /**
   * Controller for the current turn.
   * Turn 1: coinTossWinner. Turn 2: the other player.
   */
  controller?: 1 | 2
  /** Sabotager for the current turn (always the player who is not controller). */
  sabotager?: 1 | 2

  // --- Turn transient data (reset at PRE_TURN) ---
  /** Controller's cipher — private to the controller. Set during PRE_TURN. */
  controllerCipher?: Cipher
  /** Whether the controller has already submitted a cipher this turn. */
  cipherSelected: boolean

  /** Reactor health (0–100). Resets to 100 at turn start. */
  reactorHP: number

  /**
   * 3 server-generated command options.
   * Generated fresh at the start of each subround (CHALL_CONTROL entry).
   * Controller picks one via commandIndex.
   */
  commandOptions?: string[]

  /**
   * HP restoration values for the 3 command options.
   * Computed based on component re-use within the turn.
   * Private to the controller.
   */
  commandEffectiveness?: number[]

  /**
   * Controller's selected command option index (0, 1, or 2).
   * null if controller timed out / forfeited.
   */
  selectedCommandIndex?: 0 | 1 | 2 | null

  /**
   * The actual command the controller chose (derives from commandOptions[selectedCommandIndex]).
   * Private to the controller until SUBROUND_RESOLUTION.
   * null if the controller forfeited.
   */
  controllerCommand?: string | null

  /**
   * Turn-wide history of executed (plaintext) commands.
   * Used to compute effectiveness-tier bonuses on next command selection.
   * Cleared when entering PRE_TURN.
   */
  turnCommandHistory: string[]

  /**
   * The controller's command after passing through their cipher.
   * Public — revealed to all players during CHALL_SABOTAGE onward.
   */
  encryptedCommand?: string

  /**
   * Accumulated plaintext/ciphertext pairs from earlier subrounds of this turn.
   * Public after SUBROUND_RESOLUTION, but also sent as private state to sabotager
   * during CHALL_SABOTAGE so they can study patterns.
   * Cleared when entering the next turn.
   */
  plaintextCiphertextPairs: { plaintext: string, ciphertext: string }[]

  /**
   * The sabotager's guess at what the controller's original command was.
   * Private to the sabotager until SUBROUND_RESOLUTION.
   * null if the sabotager did not submit within the time limit.
   */
  sabotagerGuess?: string | null

  /** Winner of the current/most recent turn. Set in TURN_END. */
  turnWinner?: 1 | 2

  /** Set when transitioning POST_TURN → GAME_OVER. */
  gameWinner?: 1 | 2 | 'draw'

  /** True once the player has clicked "ready" during POST_TURN. */
  player1Ready: boolean
  player2Ready: boolean
}

// ---------------------------------------------------------------------------
// Wire types — what actually travels over the socket
// ---------------------------------------------------------------------------

/** Broadcast to every socket in the room. Contains no sensitive information. */
export interface PublicState {
  phase: GamePhase
  phaseEnteredAt: string
  currentLevel: number
  currentTurn: 1 | 2
  currentSubround: 1 | 2 | 3
  turnNumber: number
  scores: { player1: number, player2: number }
  player1Name: string
  player2Name: string
  coinTossWinner?: 1 | 2
  controller?: 1 | 2
  sabotager?: 1 | 2
  player1Ready: boolean
  player2Ready: boolean
  gameWinner?: 1 | 2 | 'draw'
  turnWinner?: 1 | 2

  // PRE_TURN
  cipherSelected: boolean
  reactorHP: number

  // CHALL_CONTROL
  commandOptions?: string[]

  // CHALL_SABOTAGE
  encryptedCommand?: string

  // SUBROUND_RESOLUTION and later: full reveal
  controllerCommand?: string | null
  sabotagerGuess?: string | null

  // Learning mechanic (public after SUBROUND_RESOLUTION)
  plaintextCiphertextPairs: { plaintext: string, ciphertext: string }[]
}

/** Sent only to the owning player via a direct `socket.emit`. */
export interface PrivateState {
  playerNumber: 1 | 2
  role?: 'controller' | 'sabotager'

  // Controller-only fields
  /** Controller's cipher — shown only to the controller. */
  cipher?: Cipher
  /** Whether the controller has already submitted a cipher this turn. */
  cipherSelected?: boolean
  /** 3 command options available to this controller in CHALL_CONTROL. */
  commandOptions?: string[]
  /** HP restoration values for each command option. */
  commandEffectiveness?: number[]
  /** Controller's selected command index (0/1/2) or null if forfeited. */
  selectedCommandIndex?: 0 | 1 | 2 | null
  /**
   * Controller's submitted command — shown only to the controller
   * while the sabotager is still guessing.
   */
  controllerCommand?: string | null

  // Sabotager-only fields
  /**
   * Sabotager's submitted guess — shown only to the sabotager
   * while the subround is still in play.
   */
  sabotagerGuess?: string | null
  /**
   * Plaintext/ciphertext pairs accumulated so far in this turn.
   * Sent to sabotager during CHALL_SABOTAGE so they can study patterns.
   * Helps them learn the cipher for better guessing.
   */
  plaintextCiphertextPairs?: { plaintext: string, ciphertext: string }[]
}
