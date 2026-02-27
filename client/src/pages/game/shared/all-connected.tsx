import { useGameState } from '../../../hooks/useGameState'
import '../../game/game-tokens.css'

export default function AllConnectedPage() {
  const player1Name = useGameState(s => s.player1Name)
  const player2Name = useGameState(s => s.player2Name)

  return (
    <div className='game-phase'>
      <div className='game-phase__entry-overlay' />
      <div className='game-phase__vignette' />
      <div className='game-phase__scanlines' />

      <header className='game-phase__header'>
        <h1 className='game-phase__brand'>MELTDOWN</h1>
      </header>

      <main className='game-phase__main'>
        <div className='game-phase__card'>
          <span className='game-phase__card-corner-tr' />
          <span className='game-phase__card-corner-bl' />

          <p className='game-phase__title' style={{ textAlign: 'center' }}>Both Players Connected</p>

          <div className='game-phase__players'>
            <span className='game-phase__player-name'>{player1Name}</span>
            <span className='game-phase__player-vs'>VS</span>
            <span className='game-phase__player-name'>{player2Name}</span>
          </div>

          <p className='game-phase__subtitle' style={{ textAlign: 'center' }}>
            Coin toss incoming
            <span className='game-phase__waiting-dot' />
            <span className='game-phase__waiting-dot' />
            <span className='game-phase__waiting-dot' />
          </p>
        </div>
      </main>
    </div>
  )
}
