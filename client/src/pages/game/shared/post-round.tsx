import { useGameState } from '../../../hooks/useGameState'
import { playerReady } from '../../../lib/socket-actions'

export default function PostRoundPage() {
  const scores = useGameState(s => s.scores)
  const player1Name = useGameState(s => s.player1Name)
  const player2Name = useGameState(s => s.player2Name)
  const player1Ready = useGameState(s => s.player1Ready)
  const player2Ready = useGameState(s => s.player2Ready)
  const playerNumber = useGameState(s => s.playerNumber)
  const roundNumber = useGameState(s => s.roundNumber)
  const currentLevel = useGameState(s => s.currentLevel)
  const subRound = useGameState(s => s.subRound)

  const myReady = playerNumber === 1 ? player1Ready : player2Ready

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Post Round</h1>
      <p>
        Round
        {' '}
        {roundNumber}
        {' '}
        complete — Level
        {' '}
        {currentLevel}
        {' '}
        Sub-round
        {' '}
        {subRound}
      </p>
      <div style={{
        margin: '16px auto', border: '1px solid #ccc', padding: '16px', display: 'inline-block',
      }}
      >
        <h2>Scores</h2>
        <p>
          {player1Name}
          :
          {' '}
          {scores.player1}
          {player1Ready ? ' ✓' : ''}
        </p>
        <p>
          {player2Name}
          :
          {' '}
          {scores.player2}
          {player2Ready ? ' ✓' : ''}
        </p>
      </div>
      <div style={{ marginTop: '20px' }}>
        <button
          disabled={myReady}
          onClick={playerReady}
          style={{ padding: '10px 20px', fontSize: '16px', cursor: myReady ? 'default' : 'pointer' }}
        >
          {myReady ? 'Waiting for opponent…' : 'Ready for Next Round'}
        </button>
      </div>
    </div>
  )
}
