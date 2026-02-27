import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { PublicState, PrivateState } from '../lib/socket-message-validator'

/**
 * Merged game state combining public (broadcast to all) and private (individual player) data.
 * Server is the source-of-truth; this store is a cached client-side view that updates
 * as websocket events arrive. NOT persisted to localStorage.
 */
export interface GameState extends PublicState {
  // Private player-specific fields
  playerNumber?: PrivateState['playerNumber']
  role?: PrivateState['role']
  cipher?: PrivateState['cipher']

  // Latest server error message
  errorMessage?: string

  // Metadata
  isHydrated: boolean

  // Actions
  updatePublicState: (publicState: PublicState) => void
  updatePrivateState: (privateState: PrivateState) => void
  setErrorMessage: (message?: string) => void
  reset: () => void
}

const initialState = {
  // PublicState required fields
  phase: 'WAITING_FOR_PLAYERS' as const,
  phaseEnteredAt: new Date().toISOString(),
  currentLevel: 1,
  subRound: 'A' as const,
  roundNumber: 0,
  scores: { player1: 0, player2: 0 },
  player1Name: '',
  player2Name: '',
  cipherSelected: false,
  player1Ready: false,
  player2Ready: false,
  // PublicState optional fields
  coinTossWinner: undefined as undefined | 1 | 2,
  controller: undefined as undefined | 1 | 2,
  sabotager: undefined as undefined | 1 | 2,
  roundWinner: undefined as undefined | 1 | 2 | 'draw',
  gameWinner: undefined as undefined | 1 | 2,
  recommendedCommand: undefined as undefined | string,
  encryptedCommand: undefined as undefined | string,
  controllerCommand: undefined as undefined | string | null,
  sabotagerGuess: undefined as undefined | string | null,
  // PrivateState fields
  playerNumber: undefined as undefined | 1 | 2,
  role: undefined as undefined | 'controller' | 'sabotager',
  cipher: undefined as PrivateState['cipher'],
  // Store metadata
  errorMessage: undefined as undefined | string,
  isHydrated: false,
}

export const useGameStore = create<GameState>()(devtools(immer(set => ({
  ...initialState,

  updatePublicState(publicState: PublicState) {
    set((state) => {
      const phaseChanged = state.phase !== publicState.phase
      state.phase = publicState.phase
      state.phaseEnteredAt = publicState.phaseEnteredAt
      state.currentLevel = publicState.currentLevel
      state.subRound = publicState.subRound
      state.roundNumber = publicState.roundNumber
      state.scores = publicState.scores
      state.player1Name = publicState.player1Name
      state.player2Name = publicState.player2Name
      state.coinTossWinner = publicState.coinTossWinner
      state.controller = publicState.controller
      state.sabotager = publicState.sabotager
      state.player1Ready = publicState.player1Ready
      state.player2Ready = publicState.player2Ready
      state.roundWinner = publicState.roundWinner
      state.gameWinner = publicState.gameWinner
      state.cipherSelected = publicState.cipherSelected
      state.recommendedCommand = publicState.recommendedCommand
      state.encryptedCommand = publicState.encryptedCommand
      // Only copy these from public during reveal phases (not undefined before reveal)
      if (publicState.controllerCommand !== undefined) {
        state.controllerCommand = publicState.controllerCommand
      }

      if (publicState.sabotagerGuess !== undefined) {
        state.sabotagerGuess = publicState.sabotagerGuess
      }

      if (phaseChanged) {
        state.errorMessage = undefined
        // Clear private command/guess when phase changes
        if (!['ROUND_RESOLUTION', 'ROUND_WIN_CONTROL', 'ROUND_WIN_SABOTAGE', 'POST_ROUND', 'GAME_OVER'].includes(publicState.phase)) {
          state.controllerCommand = undefined
          state.sabotagerGuess = undefined
        }
      }

      state.isHydrated = true
      console.log('[GameStore] Updated public state, phase:', publicState.phase)
    })
  },

  updatePrivateState(privateState: PrivateState) {
    set((state) => {
      state.playerNumber = privateState.playerNumber
      state.role = privateState.role
      state.cipher = privateState.cipher
      // Private command/guess take precedence until the public reveal overwrites them
      if (privateState.controllerCommand !== undefined) {
        state.controllerCommand = privateState.controllerCommand
      }

      if (privateState.sabotagerGuess !== undefined) {
        state.sabotagerGuess = privateState.sabotagerGuess
      }

      console.log('[GameStore] Updated private state, player:', privateState.playerNumber, 'role:', privateState.role)
    })
  },

  setErrorMessage(message) {
    set((state) => {
      state.errorMessage = message
    })
  },

  reset() {
    set(() => initialState)
    console.log('[GameStore] Reset to initial state')
  },
})), { name: 'GameStore' }))
