import { useGameState } from '../../../hooks/useGameState'
import { useSocketStore } from '../../../stores/socket-store'
import { useCrtGlitch } from '../../../hooks/useCrtGlitch'
import '../../game/game-tokens.css'

export default function GameOverPage() {
  const scores = useGameState(s => s.scores)
  const player1Name = useGameState(s => s.player1Name)
  const player2Name = useGameState(s => s.player2Name)
  const gameWinner = useGameState(s => s.gameWinner)
  const playerNumber = useGameState(s => s.playerNumber)
  const disconnect = useSocketStore(s => s.disconnect)
  const isGlitching = useCrtGlitch(8000, 13_000)

  function winnerText(): string {
    if (!gameWinner) {
      return ''
    }

    if (gameWinner === 'draw') {
      return 'Draw!'
    }

    const winnerName = gameWinner === 1 ? player1Name : player2Name
    if (gameWinner === playerNumber) {
      return 'You Win!'
    }

    return `${winnerName} Wins!`
  }

  const isWin = gameWinner !== undefined && gameWinner !== 'draw' && gameWinner === playerNumber
  const isDraw = gameWinner === 'draw'
  const titleModifier = isWin ? ' game-phase__title--win' : (isDraw ? '' : ' game-phase__title--lose')

  return (
    <div className={`game-phase${isGlitching ? ' game-phase--glitching' : ''}`}>
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

          <p className='game-phase__subtitle' style={{ textAlign: 'center' }}>Game Over</p>

          <p
            className={`game-phase__title${titleModifier}`}
            style={{ textAlign: 'center' }}
          >
            {winnerText()}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <p className='game-phase__subtitle' style={{ textAlign: 'center' }}>Final Scores</p>
            <div className='game-phase__scores'>
              <div className='game-phase__score-player'>
                <span className='game-phase__score-name'>{player1Name}</span>
                <span className='game-phase__score-value'>{scores.player1}</span>
              </div>
              <span className='game-phase__score-vs'>VS</span>
              <div className='game-phase__score-player'>
                <span className='game-phase__score-name'>{player2Name}</span>
                <span className='game-phase__score-value'>{scores.player2}</span>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button className='game-phase__btn game-phase__btn--danger' onClick={disconnect}>
              Return to Lobby
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
