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
  phase: 'WAITING_FOR_PLAYERS' as const,
  phaseEnteredAt: new Date().toISOString(),
  roundNumber: 0,
  scores: { player1: 0, player2: 0 },
  player1Name: '',
  player2Name: '',
  player1Ready: false,
  player2Ready: false,
  playerNumber: undefined as undefined | 1 | 2,
  cipher: undefined as undefined | string,
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
      state.roundNumber = publicState.roundNumber
      state.scores = publicState.scores
      state.player1Name = publicState.player1Name
      state.player2Name = publicState.player2Name
      state.coinTossWinner = publicState.coinTossWinner
      state.player1Ready = publicState.player1Ready
      state.player2Ready = publicState.player2Ready
      state.roundWinner = publicState.roundWinner
      state.gameWinner = publicState.gameWinner
      if (publicState.level !== undefined) {
        state.level = publicState.level
      }

      if (phaseChanged) {
        state.errorMessage = undefined
      }

      state.isHydrated = true
      console.log('[GameStore] Updated public state, phase:', publicState.phase)
    })
  },

  updatePrivateState(privateState: PrivateState) {
    set((state) => {
      state.playerNumber = privateState.playerNumber
      state.cipher = privateState.cipher
      console.log(
        '[GameStore] Updated private state, player:',
        privateState.playerNumber,
      )
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
