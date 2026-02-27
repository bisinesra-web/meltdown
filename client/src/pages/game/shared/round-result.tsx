import { useGameState, gameStateSelectors } from '../../../hooks/useGameState'
import '../../game/game-tokens.css'

/**
 * TURN_END: Displays turn victory message and updated scores.
 * Shown after all subrounds of a turn are complete (either HP <= 0 or all 3 subrounds done).
 */
export default function TurnEndPage() {
  const turnWinner = useGameState(gameStateSelectors.turnWinner)
  const scores = useGameState(gameStateSelectors.scores)
  const player1Name = useGameState(gameStateSelectors.player1Name)
  const player2Name = useGameState(gameStateSelectors.player2Name)
  const role = useGameState(gameStateSelectors.role)
  const turnNumber = useGameState(gameStateSelectors.turnNumber)
  const currentLevel = useGameState(gameStateSelectors.currentLevel)
  const currentTurn = useGameState(gameStateSelectors.currentTurn)
  const controller = useGameState(gameStateSelectors.controller)
  const reactorHP = useGameState(gameStateSelectors.reactorHP)

  const controllerWon = turnWinner === controller
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

          <p className='game-phase__subtitle' style={{ textAlign: 'center' }}>
            Turn&nbsp;
            {turnNumber}
            &nbsp;— Level&nbsp;
            {currentLevel}
            &nbsp;(Turn&nbsp;
            {currentTurn}
            /2)
          </p>

          <p
            className={`game-phase__title${playerWon ? ' game-phase__title--win' : ' game-phase__title--lose'}`}
            style={{ textAlign: 'center' }}
          >
            {playerWon ? 'You Win This Turn!' : 'You Lose This Turn'}
          </p>

          <p className='game-phase__subtitle' style={{ textAlign: 'center' }}>
            {controllerWon
              ? `${controllerName} (controller) successfully defended the reactor at ${reactorHP} HP`
              : 'Sabotager destroyed the reactor!'}
          </p>

          {turnWinner !== undefined && (
            <p className='game-phase__subtitle' style={{ textAlign: 'center' }}>
              Turn Winner:&nbsp;
              <span style={{ color: 'var(--gp-green)' }}>{nameOf(turnWinner as 1 | 2)}</span>
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <p className='game-phase__subtitle' style={{ textAlign: 'center' }}>Scores</p>
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

          <p className='game-phase__subtitle' style={{ textAlign: 'center' }}>
            Ready for next action
            <span className='game-phase__waiting-dot' />
            <span className='game-phase__waiting-dot' />
            <span className='game-phase__waiting-dot' />
          </p>
        </div>
      </main>
    </div>
  )
}
