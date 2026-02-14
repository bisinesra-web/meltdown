import { useCallback, useState } from 'react'

interface Player {
  id: string
  name: string
  role?: string
}

interface GameState {
  reactorHealth: number
  isRunning: boolean
  players: Player[]
}

type GameStateUpdates = Partial<GameState>

const useGameState = () => {
  const [gameState, setGameState] = useState<GameState>({
    reactorHealth: 100,
    isRunning: false,
    players: [],
  })

  const updateGameState = useCallback((updates: GameStateUpdates) => {
    setGameState(previous => ({
      ...previous,
      ...updates,
    }))
  }, [])

  return { gameState, updateGameState }
}

export default useGameState
