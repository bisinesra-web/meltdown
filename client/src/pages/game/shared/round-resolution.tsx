import { useGameState } from '../../../hooks/useGameState'

export default function RoundResolutionPage() {
  const encryptedCommand = useGameState(s => s.encryptedCommand)
  const controllerCommand = useGameState(s => s.controllerCommand)
  const sabotagerGuess = useGameState(s => s.sabotagerGuess)
  const roundWinner = useGameState(s => s.roundWinner)
  const controller = useGameState(s => s.controller)
  const sabotager = useGameState(s => s.sabotager)
  const player1Name = useGameState(s => s.player1Name)
  const player2Name = useGameState(s => s.player2Name)
  const playerNumber = useGameState(s => s.playerNumber)

  function nameOf(n: 1 | 2 | undefined): string {
    if (n === 1) {
      return player1Name
    }

    if (n === 2) {
      return player2Name
    }

    return '?'
  }

  const match
    = controllerCommand !== null
      && controllerCommand !== undefined
      && sabotagerGuess !== null
      && sabotagerGuess !== undefined
      && controllerCommand.trim().toLowerCase() === sabotagerGuess.trim().toLowerCase()

  return (
    <div style={{ padding: '20px' }}>
      <h1>Round Resolution</h1>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          <tr>
            <td style={{ padding: '8px', fontWeight: 'bold' }}>Controller</td>
            <td style={{ padding: '8px' }}>{nameOf(controller)}</td>
          </tr>
          <tr>
            <td style={{ padding: '8px', fontWeight: 'bold' }}>Sabotager</td>
            <td style={{ padding: '8px' }}>{nameOf(sabotager)}</td>
          </tr>
          <tr>
            <td style={{ padding: '8px', fontWeight: 'bold' }}>Encrypted command</td>
            <td style={{ padding: '8px', fontFamily: 'monospace' }}>{encryptedCommand ?? '—'}</td>
          </tr>
          <tr>
            <td style={{ padding: '8px', fontWeight: 'bold' }}>Controller's command</td>
            <td style={{ padding: '8px', fontFamily: 'monospace' }}>
              {controllerCommand === null ? '(forfeited)' : (controllerCommand ?? '…')}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '8px', fontWeight: 'bold' }}>Sabotager's guess</td>
            <td style={{ padding: '8px', fontFamily: 'monospace' }}>
              {sabotagerGuess === null ? '(forfeited)' : (sabotagerGuess ?? '…')}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '8px', fontWeight: 'bold' }}>Match</td>
            <td style={{ padding: '8px', color: match ? 'green' : 'red' }}>
              {match ? '✓ Commands match' : '✗ Commands differ'}
            </td>
          </tr>
        </tbody>
      </table>
      {roundWinner !== undefined && (
        <p style={{ marginTop: '16px', fontWeight: 'bold' }}>
          Round winner:
          {' '}
          {nameOf(roundWinner as 1 | 2)}
          {' '}
          (you are player
          {' '}
          {playerNumber}
          )
        </p>
      )}
    </div>
  )
}
