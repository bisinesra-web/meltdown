import { useState, useEffect } from 'react'
import { useGameState, gameStateSelectors } from '../../../hooks/useGameState'
import { submitGuess } from '../../../lib/socket-actions'
import { ReactorHPBar } from '../../../components/reactor-hp-bar'
import { useCrtGlitch } from '../../../hooks/useCrtGlitch'
import '../../game/game-tokens.css'

const PHASE_DURATION_MS = 30_000

function clampToZero(v: number): number {
  return Math.max(0, v)
}

export default function SubmitGuessPage() {
  const encryptedCommand = useGameState(gameStateSelectors.encryptedCommand)
  const phaseEnteredAt = useGameState(gameStateSelectors.phaseEnteredAt)
  const errorMessage = useGameState(gameStateSelectors.errorMessage)
  const sabotagerGuess = useGameState(gameStateSelectors.sabotagerGuess)
  const plaintextCiphertextPairs = useGameState(gameStateSelectors.plaintextCiphertextPairs)
  const reactorHP = useGameState(gameStateSelectors.reactorHP)

  const [guess, setGuess] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitted'>('idle')
  const [timerSeconds, setTimerSeconds] = useState(30)
  const isGlitching = useCrtGlitch()

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

  useEffect(() => {
    if (sabotagerGuess !== undefined && sabotagerGuess !== null) {
      setStatus('submitted')
    }
  }, [sabotagerGuess])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!guess.trim() || status === 'submitted') {
      return
    }

    submitGuess(guess.trim())
  }

  const isSubmitted = status === 'submitted'

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

          <p className='game-phase__title'>Submit Guess</p>

          <ReactorHPBar hp={reactorHP} phaseEnteredAt={phaseEnteredAt} ticking={false} />

          <div style={{ textAlign: 'center' }}>
            <p className={`game-phase__timer${timerSeconds <= 10 ? ' game-phase__timer--urgent' : ''}`}>
              {timerSeconds}
            </p>
            <p className='game-phase__timer-label'>seconds remaining</p>
          </div>

          <div className='game-phase__info-row'>
            <span className='game-phase__info-label'>Encrypted Command</span>
            <code className='game-phase__info-value'>{encryptedCommand ?? '—'}</code>
          </div>

          {plaintextCiphertextPairs && plaintextCiphertextPairs.length > 0 && (
            <div>
              <p className='game-phase__subtitle' style={{ marginBottom: '0.5rem' }}>Plaintext / Ciphertext Pairs</p>
              <table className='game-phase__pairs-table'>
                <thead>
                  <tr>
                    <th>Plaintext</th>
                    <th>Ciphertext</th>
                  </tr>
                </thead>
                <tbody>
                  {plaintextCiphertextPairs.map((pair, index) => (
                    <tr key={index}>
                      <td><code>{pair.plaintext}</code></td>
                      <td><code>{pair.ciphertext}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className='game-phase__subtitle'>Guess the original command:</p>

          {isSubmitted
            ? (
                <p className='game-phase__success'>
                  ✓ Guess submitted:&nbsp;
                  <code>{sabotagerGuess}</code>
                </p>
              )
            : (
                <form onSubmit={handleSubmit} className='game-phase__input-row'>
                  <input
                    className='game-phase__input'
                    disabled={isSubmitted}
                    onChange={(e) => {
                      setGuess(e.target.value)
                    }}
                    placeholder='Enter your guess…'
                    type='text'
                    value={guess}
                  />
                  <button
                    className='game-phase__btn'
                    disabled={!guess.trim() || isSubmitted}
                    type='submit'
                  >
                    Submit
                  </button>
                </form>
              )}

          {errorMessage && (
            <p className='game-phase__error'>{errorMessage}</p>
          )}
        </div>
      </main>
    </div>
  )
}
