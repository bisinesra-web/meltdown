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
  phase: (state: GameState) => state.phase,
  scores: (state: GameState) => state.scores,
  roundNumber: (state: GameState) => state.roundNumber,
  playerNumber: (state: GameState) => state.playerNumber,
  cipher: (state: GameState) => state.cipher,
  level: (state: GameState) => state.level,
  errorMessage: (state: GameState) => state.errorMessage,
  isHydrated: (state: GameState) => state.isHydrated,
  player1Ready: (state: GameState) => state.player1Ready,
  player2Ready: (state: GameState) => state.player2Ready,
  bothReadyForRound: (state: GameState) =>
    state.player1Ready && state.player2Ready,
} as const
