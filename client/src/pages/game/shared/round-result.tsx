import { useGameState } from '../../../hooks/useGameState'

export default function RoundResultPage() {
  const phase = useGameState(s => s.phase)
  const roundWinner = useGameState(s => s.roundWinner)
  const scores = useGameState(s => s.scores)
  const player1Name = useGameState(s => s.player1Name)
  const player2Name = useGameState(s => s.player2Name)
  const role = useGameState(s => s.role)
  const roundNumber = useGameState(s => s.roundNumber)
  const currentLevel = useGameState(s => s.currentLevel)
  const subRound = useGameState(s => s.subRound)
  const controller = useGameState(s => s.controller)

  const controllerWon = phase === 'ROUND_WIN_CONTROL'
  const playerWon = (controllerWon && role === 'controller') || (!controllerWon && role === 'sabotager')
  const controllerName = controller === 1 ? player1Name : player2Name

  function nameOf(n: 1 | 2 | undefined): string {
    if (n === 1) {
      return player1Name
    }

    if (n === 2) {
      return player2Name
    }

    return '?'
  }

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1 style={{ color: playerWon ? 'green' : 'red' }}>
        {playerWon ? 'You Win This Round!' : 'You Lose This Round'}
      </h1>
      <p>
        Round
        {' '}
        {roundNumber}
        {' '}
        — Level
        {' '}
        {currentLevel}
        {' '}
        Sub-round
        {' '}
        {subRound}
      </p>
      <p>
        {controllerWon ? `${controllerName} (controller) successfully defended` : 'Sabotager cracked the command!'}
      </p>
      {roundWinner !== undefined && (
        <p>
          Winner:
          {' '}
          {nameOf(roundWinner as 1 | 2)}
        </p>
      )}
      <div style={{
        marginTop: '16px', border: '1px solid #ccc', padding: '12px', display: 'inline-block',
      }}
      >
        <h3>Scores</h3>
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
      <p style={{ marginTop: '12px', color: '#888' }}>Advancing to post-round…</p>
    </div>
  )
}
