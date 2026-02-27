import { useGameState, gameStateSelectors } from '../../../hooks/useGameState'
import { useCrtGlitch } from '../../../hooks/useCrtGlitch'
import '../../game/game-tokens.css'

/**
 * SUBROUND_RESOLUTION: Shows the result of a single subround (command vs. guess).
 * Displays damage tiers and HP changes.
 * reactorHP here is pre-damage (damage is applied after the 5s animation).
 * We calculate expected damage client-side to show the outcome and determine if the turn ends.
 */
export default function SubroundResolutionPage() {
  const encryptedCommand = useGameState(gameStateSelectors.encryptedCommand)
  const controllerCommand = useGameState(gameStateSelectors.controllerCommand)
  const sabotagerGuess = useGameState(gameStateSelectors.sabotagerGuess)
  const reactorHP = useGameState(gameStateSelectors.reactorHP)
  const controller = useGameState(gameStateSelectors.controller)
  const sabotager = useGameState(gameStateSelectors.sabotager)
  const player1Name = useGameState(gameStateSelectors.player1Name)
  const player2Name = useGameState(gameStateSelectors.player2Name)
  const currentSubround = useGameState(gameStateSelectors.currentSubround)
  const isGlitching = useCrtGlitch(6000, 10_000)

  function nameOf(n: 1 | 2 | undefined): string {
    if (n === 1) {
      return player1Name
    }

    if (n === 2) {
      return player2Name
    }

    return '?'
  }

  function countMatches(cmd1: string | null | undefined, cmd2: string | null | undefined): number {
    if (!cmd1 || !cmd2) {
      return 0
    }

    const parts1 = cmd1.trim().toLowerCase().split(/\s+/)
    const parts2 = cmd2.trim().toLowerCase().split(/\s+/)
    if (parts1.length !== 4 || parts2.length !== 4) {
      return 0
    }

    let matches = 0
    for (let index = 0; index < 4; index++) {
      if (parts1[index] === parts2[index]) {
        matches++
      }
    }

    return matches
  }

  const matches = countMatches(controllerCommand, sabotagerGuess)

  let damageDescription = ''
  let damageDisplay = ''
  let expectedHPAfter = reactorHP

  if (controllerCommand === null) {
    damageDescription = 'Controller forfeited'
    damageDisplay = '−50 HP'
    expectedHPAfter = Math.max(0, reactorHP - 50)
  }
  else if (sabotagerGuess === null) {
    damageDescription = 'Sabotager timed out'
    damageDisplay = 'No damage'
  }
  else {
    switch (matches) {
      case 4: {
        damageDescription = 'Perfect match (4/4)'; damageDisplay = 'HP → 0'; expectedHPAfter = 0; break
      }

      case 3: {
        damageDescription = '3/4 components match'; damageDisplay = '−70 HP'; expectedHPAfter = Math.max(0, reactorHP - 70); break
      }

      case 2: {
        damageDescription = '2/4 components match'; damageDisplay = '−50 HP'; expectedHPAfter = Math.max(0, reactorHP - 50); break
      }

      case 1: {
        damageDescription = '1/4 components match'; damageDisplay = '−30 HP'; expectedHPAfter = Math.max(0, reactorHP - 30); break
      }

      default: {
        damageDescription = 'No components matched'; damageDisplay = 'No damage'
      }
    }
  }

  const isTurnEnding = expectedHPAfter <= 0 || currentSubround >= 3
  const reactorDestroyed = expectedHPAfter <= 0
  const noDamage = damageDisplay === 'No damage'

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

          <p className='game-phase__title'>
            Subround&nbsp;
            {currentSubround}
            /3 — Resolution
          </p>

          <table className='game-phase__table'>
            <tbody>
              <tr>
                <td>Controller</td>
                <td>{nameOf(controller)}</td>
              </tr>
              <tr>
                <td>Sabotager</td>
                <td>{nameOf(sabotager)}</td>
              </tr>
              <tr>
                <td>Encrypted command</td>
                <td><code>{encryptedCommand ?? '—'}</code></td>
              </tr>
              <tr>
                <td>Original command</td>
                <td><code>{controllerCommand === null ? '(forfeited)' : (controllerCommand ?? '…')}</code></td>
              </tr>
              <tr>
                <td>Sabotager's guess</td>
                <td><code>{sabotagerGuess === null ? '(timeout)' : (sabotagerGuess ?? '…')}</code></td>
              </tr>
              <tr>
                <td>Match result</td>
                <td className={matches > 0 ? 'game-phase__outcome--match' : 'game-phase__outcome--safe'}>
                  {matches}
                  /4 components
                </td>
              </tr>
              <tr>
                <td>Outcome</td>
                <td className={noDamage ? 'game-phase__outcome--safe' : 'game-phase__outcome--damage'}>
                  {damageDescription}
                  &nbsp;
                  <code>
                    (
                    {damageDisplay}
                    )
                  </code>
                </td>
              </tr>
            </tbody>
          </table>

          <div className='game-phase__hp-transition'>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span className='game-phase__hp-label'>Reactor HP</span>
              <span
                className='game-phase__hp-value'
                style={{ color: reactorHP <= 30 ? 'var(--gp-red)' : (reactorHP <= 60 ? 'var(--gp-warn)' : 'var(--gp-green)') }}
              >
                {reactorHP}
              </span>
            </div>
            <span className='game-phase__hp-arrow'>→</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span className='game-phase__hp-label'>After</span>
              <span
                className='game-phase__hp-value'
                style={{ color: expectedHPAfter <= 0 ? 'var(--gp-danger)' : expectedHPAfter <= 30 ? 'var(--gp-red)' : expectedHPAfter <= 60 ? 'var(--gp-warn)' : 'var(--gp-green)' }}
              >
                {expectedHPAfter}
                {expectedHPAfter <= 0 && ' ☠'}
              </span>
            </div>
          </div>

          {isTurnEnding
            ? (
                <div className={`game-phase__turn-banner${reactorDestroyed ? ' game-phase__turn-banner--sabotager-wins' : ' game-phase__turn-banner--controller-wins'}`}>
                  {reactorDestroyed
                    ? 'Reactor destroyed — sabotager wins the turn!'
                    : 'All subrounds complete — controller wins the turn!'}
                </div>
              )
            : (
                <div className='game-phase__turn-banner game-phase__turn-banner--continuing'>
                  → Continuing to subround&nbsp;
                  {currentSubround + 1}
                  /3
                  <span className='game-phase__waiting-dot' />
                  <span className='game-phase__waiting-dot' />
                  <span className='game-phase__waiting-dot' />
                </div>
              )}
        </div>
      </main>
    </div>
  )
}
