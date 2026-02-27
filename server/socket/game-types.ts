import type { Cipher } from './cipher-types.js'

// ---------------------------------------------------------------------------
// Game FSM — type definitions
// ---------------------------------------------------------------------------

export type GamePhase
  = | 'WAITING_FOR_PLAYERS' // Till both players have connected
    | 'ALL_PLAYERS_CONNECTED' // Brief transitional phase (5s)
    | 'COIN_TOSSING' // Coin toss animation (3s)
    | 'COIN_TOSSED' // Coin toss result (10s)
    | 'PRE_ROUND' // Min of (60s OR cipher selection by controller)
    | 'CHALL_CONTROL' // Min of (30s OR valid command submission by controller)
    | 'CHALL_SABOTAGE' // Min of (30s OR valid guess submission by sabotager)
    | 'ROUND_RESOLUTION' // Brief transitional phase (5s) — compare & decide winner
    | 'ROUND_WIN_CONTROL' // Display round win for controller (10s)
    | 'ROUND_WIN_SABOTAGE' // Display round win for sabotager (10s)
    | 'POST_ROUND' // Min of (60s OR both players ready) — displays scores
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
 * Round structure:
 *   Each of the 5 levels is played twice — sub-round A and sub-round B.
 *   In sub-round A the coin-toss winner is the controller.
 *   In sub-round B the roles are swapped.
 *   This gives 10 rounds total (5 levels × 2 sub-rounds).
 */
export interface StoredGameState {
  phase: GamePhase
  /** ISO-8601 timestamp of when the current phase was entered. */
  phaseEnteredAt: string

  // --- Progression ---
  /** Current level (1–5). Advances when both sub-rounds of a level finish. */
  currentLevel: number
  /** 'A' = toss winner is controller; 'B' = roles are swapped. */
  subRound: 'A' | 'B'
  /** Overall round counter (1–10), used for display. */
  roundNumber: number
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

  // --- Derived roles (set when entering PRE_ROUND) ---
  /**
   * Controller for the current round.
   * Sub-round A: coinTossWinner. Sub-round B: the other player.
   */
  controller?: 1 | 2
  /** Sabotager for the current round (always the player who is not controller). */
  sabotager?: 1 | 2

  // --- Round transient data ---
  /** Controller's cipher — private to the controller. Set during PRE_ROUND. */
  controllerCipher?: Cipher
  /** Whether the controller has already submitted a cipher this round. */
  cipherSelected: boolean

  /**
   * Random command recommended by the server for the controller to submit.
   * Public — sent to all players during CHALL_CONTROL.
   */
  recommendedCommand?: string

  /**
   * The actual command the controller chose to submit.
   * Private to the controller until ROUND_RESOLUTION.
   * null if the controller did not submit within the time limit.
   */
  controllerCommand?: string | null

  /**
   * The controller's command after passing through their cipher.
   * Public — revealed to all players during CHALL_SABOTAGE.
   */
  encryptedCommand?: string

  /**
   * The sabotager's guess at what the controller's original command was.
   * Private to the sabotager until ROUND_RESOLUTION.
   * null if the sabotager did not submit within the time limit.
   */
  sabotagerGuess?: string | null

  /** Winner of the current/most recent round. Set in ROUND_RESOLUTION. */
  roundWinner?: 1 | 2

  /** Set when transitioning POST_ROUND → GAME_OVER. */
  gameWinner?: 1 | 2 | 'draw'

  /** True once the player has clicked "ready" during POST_ROUND. */
  player1Ready: boolean
  player2Ready: boolean
}

// ---------------------------------------------------------------------------
// Wire types — what actually travels over the socket
// ---------------------------------------------------------------------------

/** Broadcast to every socket in the room.  Contains no sensitive information. */
export interface PublicState {
  phase: GamePhase
  phaseEnteredAt: string
  currentLevel: number
  subRound: 'A' | 'B'
  roundNumber: number
  scores: { player1: number, player2: number }
  player1Name: string
  player2Name: string
  coinTossWinner?: 1 | 2
  controller?: 1 | 2
  sabotager?: 1 | 2
  player1Ready: boolean
  player2Ready: boolean
  gameWinner?: 1 | 2 | 'draw'
  roundWinner?: 1 | 2

  // PRE_ROUND
  cipherSelected: boolean

  // CHALL_CONTROL (public: recommended command only)
  recommendedCommand?: string

  // CHALL_SABOTAGE
  encryptedCommand?: string

  // ROUND_RESOLUTION and later: full reveal
  controllerCommand?: string | null
  sabotagerGuess?: string | null
}

/** Sent only to the owning player via a direct `socket.emit`. */
export interface PrivateState {
  playerNumber: 1 | 2
  role?: 'controller' | 'sabotager'
  /** Controller's cipher — shown only to the controller. */
  cipher?: Cipher
  /**
   * Controller's submitted command — shown only to the controller
   * while the sabotager is still guessing.
   */
  controllerCommand?: string | null
  /**
   * Sabotager's submitted guess — shown only to the sabotager
   * while the round is still in play.
   */
  sabotagerGuess?: string | null
}
