import { useEffect, useState } from 'react'
import { useGameState, gameStateSelectors } from '../../../hooks/useGameState'
import { ReactorHPBar } from '../../../components/reactor-hp-bar'
import '../../game/game-tokens.css'

const PHASE_DURATION_MS = 30_000

function clampToZero(v: number): number {
  return Math.max(0, v)
}

export default function WaitingForGuessPage() {
  const phaseEnteredAt = useGameState(gameStateSelectors.phaseEnteredAt)
  const encryptedCommand = useGameState(gameStateSelectors.encryptedCommand)
  const controllerCommand = useGameState(gameStateSelectors.controllerCommand)
  const reactorHP = useGameState(gameStateSelectors.reactorHP)
  const currentSubround = useGameState(gameStateSelectors.currentSubround)
  const [timerSeconds, setTimerSeconds] = useState(30)

  useEffect(() => {
    const startedAt = phaseEnteredAt ? new Date(phaseEnteredAt) : new Date()
    const update = () => {
      const remaining = clampToZero(PHASE_DURATION_MS - (Date.now() - startedAt.getTime()))
      setTimerSeconds(Math.ceil(remaining / 1000))
    }

    update()
    const id = globalThis.setInterval(update, 1000)
    return () => {
      globalThis.clearInterval(id)
    }
  }, [phaseEnteredAt])

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

          <p className='game-phase__title'>Awaiting Sabotager Guess</p>
          <p className='game-phase__subtitle'>
            Subround&nbsp;
            {currentSubround}
            /3
          </p>

          <ReactorHPBar hp={reactorHP} phaseEnteredAt={phaseEnteredAt} ticking={false} />

          <div className='game-phase__info-row'>
            <span className='game-phase__info-label'>Your Original Command</span>
            <code className='game-phase__info-value'>{controllerCommand ?? '—'}</code>
          </div>

          <div className='game-phase__info-row'>
            <span className='game-phase__info-label'>Encrypted (shown to sabotager)</span>
            <code className='game-phase__info-value'>{encryptedCommand ?? '—'}</code>
          </div>

          <p className='game-phase__subtitle' style={{ textAlign: 'center' }}>
            Waiting for the sabotager to submit their guess
            <span className='game-phase__waiting-dot' />
            <span className='game-phase__waiting-dot' />
            <span className='game-phase__waiting-dot' />
          </p>

          <div style={{ textAlign: 'center' }}>
            <p className={`game-phase__timer${timerSeconds <= 10 ? ' game-phase__timer--urgent' : ''}`}>
              {timerSeconds}
            </p>
            <p className='game-phase__timer-label'>seconds remaining</p>
          </div>
        </div>
      </main>
    </div>
  )
}
