// ---------------------------------------------------------------------------
// Game FSM — type definitions
// ---------------------------------------------------------------------------

export type GamePhase
  = | 'WAITING_FOR_PLAYERS'
    | 'COIN_TOSSING'
    | 'COIN_TOSSED'
    | 'PRE_ROUND'
    | 'IN_ROUND'
    | 'POST_ROUND'
    | 'GAME_OVER'

/**
 * Full game state persisted in the `room_state` JSON column.
 * Contains both public and private fields; never send this object verbatim to
 * any client — use {@link buildPublicState} / {@link buildPrivateState} instead.
 */
export interface StoredGameState {
  phase: GamePhase
  /** ISO-8601 timestamp of when the current phase was entered. */
  phaseEnteredAt: string
  roundNumber: number
  scores: { player1: number, player2: number }
  /**
   * Set the moment the second player's socket connects (while in
   * WAITING_FOR_PLAYERS). The COIN_TOSSING transition fires 5 s after this.
   */
  bothPlayersConnectedAt?: string
  /** Determined at the start of COIN_TOSSING; revealed in COIN_TOSSED. */
  coinTossWinner?: 1 | 2
  /** Private — only ever sent directly to player 1. */
  player1Cipher?: string
  /** Private — only ever sent directly to player 2. */
  player2Cipher?: string
  /** True once the player has submitted a cipher selection this round. */
  player1Ready: boolean
  player2Ready: boolean
  /** Set when transitioning IN_ROUND → POST_ROUND. */
  roundWinner?: 1 | 2 | 'draw'
  /** Set when transitioning POST_ROUND → GAME_OVER. */
  gameWinner?: 1 | 2
}

// ---------------------------------------------------------------------------
// Wire types — what actually travels over the socket
// ---------------------------------------------------------------------------

/** Broadcast to every socket in the room. Contains no sensitive information. */
export interface PublicState {
  phase: GamePhase
  phaseEnteredAt: string
  roundNumber: number
  scores: { player1: number, player2: number }
  player1Name: string
  player2Name: string
  coinTossWinner?: 1 | 2
  player1Ready: boolean
  player2Ready: boolean
  roundWinner?: 1 | 2 | 'draw'
  gameWinner?: 1 | 2
}

/** Sent only to the owning player via a direct `socket.emit`. */
export interface PrivateState {
  playerNumber: 1 | 2
  cipher?: string
}
