import { useNavigate } from '@tanstack/react-router'
import { useGameState } from '../../hooks/useGameState'

export function GameRoute2() {
  const { phase, roundNumber, scores, playerNumber } = useGameState()
  const navigate = useNavigate()

  console.log('[GameRoute2] Rendered, phase:', phase)

  return (
    <div
      style={{
        padding: '20px',
        border: '2px solid green',
        borderRadius: '8px',
      }}
    >
      <h1>Game Route 2 (Saboteur)</h1>
      <div>
        <p>
          Phase:
          {phase}
        </p>
        <p>
          Round:
          {roundNumber}
        </p>
        <p>
          Player Number:
          {playerNumber}
        </p>
        <p>
          Scores: Player 1:
          {' '}
          {scores.player1}
          {' '}
          | Player 2:
          {' '}
          {scores.player2}
        </p>
      </div>
      <button onClick={() => {
        navigate({ to: '/game/1' }).catch(console.error)
      }}
      >
        Go to Route 1
      </button>
    </div>
  )
}

export default GameRoute2
