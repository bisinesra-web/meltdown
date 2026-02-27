import { useGameState, gameStateSelectors } from '../../../hooks/useGameState'
import { playerReady } from '../../../lib/socket-actions'
import '../../game/game-tokens.css'

/**
 * POST_TURN: Displays scores and allows players to signal readiness.
 * Once both are ready (or 60s timeout), game advances to next turn or GAME_OVER.
 */
export default function PostTurnPage() {
  const scores = useGameState(gameStateSelectors.scores)
  const player1Name = useGameState(s => s.player1Name)
  const player2Name = useGameState(s => s.player2Name)
  const player1Ready = useGameState(gameStateSelectors.player1Ready)
  const player2Ready = useGameState(gameStateSelectors.player2Ready)
  const playerNumber = useGameState(gameStateSelectors.playerNumber)
  const turnNumber = useGameState(s => s.turnNumber)
  const currentLevel = useGameState(s => s.currentLevel)
  const currentTurn = useGameState(s => s.currentTurn)

  const myReady = playerNumber === 1 ? player1Ready : player2Ready

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

          <p className='game-phase__title' style={{ textAlign: 'center' }}>Post Turn</p>
          <p className='game-phase__subtitle' style={{ textAlign: 'center' }}>
            Turn&nbsp;
            {turnNumber}
            &nbsp;complete — Level&nbsp;
            {currentLevel}
            &nbsp;(Turn&nbsp;
            {currentTurn}
            /2)
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <p className='game-phase__subtitle' style={{ textAlign: 'center' }}>Scores</p>
            <div className='game-phase__scores'>
              <div className='game-phase__score-player'>
                <span className='game-phase__score-name'>{player1Name}</span>
                <span className='game-phase__score-value'>{scores.player1}</span>
                {player1Ready && (
                  <span className='game-phase__score-ready'>✓ Ready</span>
                )}
              </div>
              <span className='game-phase__score-vs'>VS</span>
              <div className='game-phase__score-player'>
                <span className='game-phase__score-name'>{player2Name}</span>
                <span className='game-phase__score-value'>{scores.player2}</span>
                {player2Ready && (
                  <span className='game-phase__score-ready'>✓ Ready</span>
                )}
              </div>
            </div>
          </div>

          <div style={{
            textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
          }}
          >
            <button
              className={`game-phase__btn${myReady ? ' game-phase__btn--ready' : ''}`}
              disabled={myReady}
              onClick={playerReady}
            >
              {myReady ? '✓ Ready — Waiting for opponent…' : 'Ready for Next Turn'}
            </button>
            <p className='game-phase__subtitle'>Both players must be ready to continue</p>
          </div>
        </div>
      </main>
    </div>
  )
}
