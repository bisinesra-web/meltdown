import { useGameStore } from '../stores/game-store'
import type { GameState } from '../stores/game-store'

/**
 * Primary hook for accessing game state throughout components.
 * Returns the full game state object.
 *
 * Usage:
 *   const { phase, scores, playerNumber } = useGameState()
 *
 * Or with selector for performance optimization:
 *   const phase = useGameState(s => s.phase)
 *   const scores = useGameState(s => s.scores)
 */
export function useGameState(): GameState
export function useGameState<T>(selector: (state: GameState) => T): T
export function useGameState<T>(selector?: (state: GameState) => T): T | GameState {
  if (selector) {
    return useGameStore(selector)
  }

  return useGameStore(state => state)
}

/**
 * Convenience selectors for common game state queries.
 * Use these to avoid creating inline selectors.
 */
export const gameStateSelectors = {
  // Phase / progression
  phase: (state: GameState) => state.phase,
  currentLevel: (state: GameState) => state.currentLevel,
  currentTurn: (state: GameState) => state.currentTurn,
  currentSubround: (state: GameState) => state.currentSubround,
  turnNumber: (state: GameState) => state.turnNumber,
  phaseEnteredAt: (state: GameState) => state.phaseEnteredAt,

  // Scores / players
  scores: (state: GameState) => state.scores,
  player1Name: (state: GameState) => state.player1Name,
  player2Name: (state: GameState) => state.player2Name,
  player1Ready: (state: GameState) => state.player1Ready,
  player2Ready: (state: GameState) => state.player2Ready,
  bothReadyForTurn: (state: GameState) =>
    state.player1Ready && state.player2Ready,

  // Coin toss / roles
  coinTossWinner: (state: GameState) => state.coinTossWinner,
  controller: (state: GameState) => state.controller,
  sabotager: (state: GameState) => state.sabotager,

  // Private player info
  playerNumber: (state: GameState) => state.playerNumber,
  role: (state: GameState) => state.role,
  cipher: (state: GameState) => state.cipher,

  // Reactor and command mechanics
  reactorHP: (state: GameState) => state.reactorHP,
  commandOptions: (state: GameState) => state.commandOptions,
  commandEffectiveness: (state: GameState) => state.commandEffectiveness,
  selectedCommandIndex: (state: GameState) => state.selectedCommandIndex,
  cipherSelected: (state: GameState) => state.cipherSelected,

  // Turn data (public)
  encryptedCommand: (state: GameState) => state.encryptedCommand,
  controllerCommand: (state: GameState) => state.controllerCommand,
  sabotagerGuess: (state: GameState) => state.sabotagerGuess,
  plaintextCiphertextPairs: (state: GameState) => state.plaintextCiphertextPairs,

  // Turn/game outcome
  turnWinner: (state: GameState) => state.turnWinner,
  gameWinner: (state: GameState) => state.gameWinner,

  // Misc
  errorMessage: (state: GameState) => state.errorMessage,
  isHydrated: (state: GameState) => state.isHydrated,
} as const
