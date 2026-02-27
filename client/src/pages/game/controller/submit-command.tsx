import { useEffect, useState } from 'react'
import { useGameState, gameStateSelectors } from '../../../hooks/useGameState'
import { selectCommand } from '../../../lib/socket-actions'
import { ReactorHPBar } from '../../../components/reactor-hp-bar'
import { useCrtGlitch } from '../../../hooks/useCrtGlitch'
import '../../game/game-tokens.css'

const PHASE_DURATION_MS = 30_000

function clampToZero(v: number): number {
  return Math.max(0, v)
}

export default function SubmitCommandPage() {
  const commandOptions = useGameState(gameStateSelectors.commandOptions)
  const commandEffectiveness = useGameState(gameStateSelectors.commandEffectiveness)
  const selectedCommandIndex = useGameState(gameStateSelectors.selectedCommandIndex)
  const phaseEnteredAt = useGameState(gameStateSelectors.phaseEnteredAt)
  const reactorHP = useGameState(gameStateSelectors.reactorHP)
  const errorMessage = useGameState(gameStateSelectors.errorMessage)
  const encryptedCommand = useGameState(gameStateSelectors.encryptedCommand)

  const [timerSeconds, setTimerSeconds] = useState(30)
  const [submitted, setSubmitted] = useState(false)
  const isGlitching = useCrtGlitch()

  // Countdown timer
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

  // Once encrypted command appears, server has accepted our submission
  useEffect(() => {
    if (encryptedCommand) {
      setSubmitted(true)
    }
  }, [encryptedCommand])

  const handleSelectCommand = (index: 0 | 1 | 2) => {
    if (!submitted) {
      selectCommand(index)
    }
  }

  const getEffectivenessLabel = (effectiveness: number): string => `+${effectiveness} HP`

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

          <p className='game-phase__title'>Select Command</p>

          <ReactorHPBar hp={reactorHP} phaseEnteredAt={phaseEnteredAt} ticking={!submitted} />

          <div style={{ textAlign: 'center' }}>
            <p className={`game-phase__timer${timerSeconds <= 10 ? ' game-phase__timer--urgent' : ''}`}>
              {timerSeconds}
            </p>
            <p className='game-phase__timer-label'>seconds remaining</p>
          </div>

          {submitted
            ? (
                <p className='game-phase__success'>
                  ✓ Command submitted — waiting for sabotager to guess
                  <span className='game-phase__waiting-dot' />
                  <span className='game-phase__waiting-dot' />
                  <span className='game-phase__waiting-dot' />
                </p>
              )
            : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <p className='game-phase__subtitle'>Choose one of 3 command options:</p>
                  {commandOptions && commandEffectiveness
                    ? commandOptions.map((option, index) => (
                        <button
                          key={index}
                          className='game-phase__command-option'
                          onClick={() => {
                            handleSelectCommand(index as 0 | 1 | 2)
                          }}
                        >
                          <code className='game-phase__command-text'>{option}</code>
                          <span className='game-phase__command-effectiveness'>
                            {getEffectivenessLabel(commandEffectiveness[index] ?? 0)}
                          </span>
                        </button>
                      ))
                    : (
                        <p className='game-phase__subtitle'>
                          Loading command options
                          <span className='game-phase__waiting-dot' />
                          <span className='game-phase__waiting-dot' />
                          <span className='game-phase__waiting-dot' />
                        </p>
                      )}
                </div>
              )}

          {errorMessage && (
            <p className='game-phase__error'>{errorMessage}</p>
          )}
        </div>
      </main>
    </div>
  )
}
