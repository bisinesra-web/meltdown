import { useCallback, useState } from "react";

type Player = {
  id: string;
  name: string;
  role?: string;
};

type GameState = {
  reactorHealth: number;
  isRunning: boolean;
  players: Player[];
};

type GameStateUpdates = Partial<GameState>;

const useGameState = () => {
  const [gameState, setGameState] = useState<GameState>({
    reactorHealth: 100,
    isRunning: false,
    players: [],
  });

  const updateGameState = useCallback((updates: GameStateUpdates) => {
    setGameState((prev) => ({
      ...prev,
      ...updates,
    }));
  }, []);

  return { gameState, updateGameState };
};

export default useGameState;
