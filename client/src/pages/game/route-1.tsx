import { useNavigate } from '@tanstack/react-router'
import { useGameState } from '../../hooks/useGameState'

export function GameRoute1() {
  const { phase, roundNumber, scores, playerNumber } = useGameState()
  const navigate = useNavigate()

  console.log('[GameRoute1] Rendered, phase:', phase)

  return (
    <div
      style={{
        padding: '20px',
        border: '2px solid blue',
        borderRadius: '8px',
      }}
    >
      <h1>Game Route 1 (Operator)</h1>
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
        navigate({ to: '/game/2' }).catch(console.error)
      }}
      >
        Go to Route 2
      </button>
    </div>
  )
}

export default GameRoute1
