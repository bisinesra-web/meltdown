import { useEffect, useState } from 'react'
import { useGameState, gameStateSelectors } from '../../../hooks/useGameState'
import '../../game/game-tokens.css'

const PHASE_DURATION_MS = 60_000

function clampToZero(v: number): number {
  return Math.max(0, v)
}

export default function WaitingForCipherPage() {
  const phaseEnteredAt = useGameState(gameStateSelectors.phaseEnteredAt)
  const cipherSelected = useGameState(gameStateSelectors.cipherSelected)
  const currentLevel = useGameState(gameStateSelectors.currentLevel)
  const currentTurn = useGameState(gameStateSelectors.currentTurn)
  const [timerSeconds, setTimerSeconds] = useState(60)

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

          <p className='game-phase__title' style={{ textAlign: 'center' }}>
            {cipherSelected ? 'Cipher Locked In' : 'Awaiting Cipher'}
          </p>

          <p className='game-phase__subtitle' style={{ textAlign: 'center' }}>
            Level&nbsp;
            {currentLevel}
            &nbsp;—&nbsp;Turn&nbsp;
            {currentTurn}
            /2
          </p>

          {cipherSelected
            ? (
                <p className='game-phase__success'>
                  ✓ Controller has selected a cipher. Subround starting soon…
                </p>
              )
            : (
                <>
                  <p className='game-phase__subtitle' style={{ textAlign: 'center' }}>
                    Controller is building their cipher
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
                </>
              )}
        </div>
      </main>
    </div>
  )
}
