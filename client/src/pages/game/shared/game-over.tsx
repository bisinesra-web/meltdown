import { useGameState } from '../../../hooks/useGameState'
import { useSocketStore } from '../../../stores/socket-store'

export default function GameOverPage() {
  const scores = useGameState(s => s.scores)
  const player1Name = useGameState(s => s.player1Name)
  const player2Name = useGameState(s => s.player2Name)
  const gameWinner = useGameState(s => s.gameWinner)
  const playerNumber = useGameState(s => s.playerNumber)
  const disconnect = useSocketStore(s => s.disconnect)

  function winnerText(): string {
    if (!gameWinner) return ''
    if (gameWinner === 'draw') return 'Draw!'
    const winnerName = gameWinner === 1 ? player1Name : player2Name
    if (gameWinner === playerNumber) return `You win! (${winnerName})`
    return `${winnerName} wins!`
  }

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Game Over</h1>
      <h2>{winnerText()}</h2>
      <div style={{ margin: '20px auto', border: '1px solid #ccc', padding: '16px', display: 'inline-block' }}>
        <h3>Final Scores</h3>
        <p>
          {player1Name}
          :
          {' '}
          {scores.player1}
        </p>
        <p>
          {player2Name}
          :
          {' '}
          {scores.player2}
        </p>
      </div>
      <div style={{ marginTop: '20px' }}>
        <button
          onClick={disconnect}
          style={{ padding: '10px 20px', fontSize: '16px' }}
        >
          Return to Lobby
        </button>
      </div>
    </div>
  )
}
