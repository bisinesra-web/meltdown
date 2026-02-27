import { useGameState } from '../../../hooks/useGameState'

export default function AllConnectedPage() {
  const player1Name = useGameState(s => s.player1Name)
  const player2Name = useGameState(s => s.player2Name)

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Both Players Connected</h1>
      <p>
        {player1Name}
        {' '}
        vs
        {' '}
        {player2Name}
      </p>
      <p>Coin toss incoming…</p>
    </div>
  )
}
