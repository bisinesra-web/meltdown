import { useState, useEffect } from 'react'
import { useGameState } from '../../../hooks/useGameState'
import { submitGuess } from '../../../lib/socket-actions'

const PHASE_DURATION_MS = 30_000

function clampToZero(v: number): number {
  return Math.max(0, v)
}

export default function SubmitGuessPage() {
  const encryptedCommand = useGameState(s => s.encryptedCommand)
  const phaseEnteredAt = useGameState(s => s.phaseEnteredAt)
  const errorMessage = useGameState(s => s.errorMessage)
  const sabotagerGuess = useGameState(s => s.sabotagerGuess)

  const [guess, setGuess] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitted'>('idle')
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

  // Once private sabotagerGuess is set, server has accepted our submission
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

  return (
    <div style={{ padding: '20px' }}>
      <h1>Submit Guess (Sabotager)</h1>
      <p>
        Time remaining:
        {' '}
        <strong>
          {timerSeconds}
          s
        </strong>
      </p>
      <div style={{
        margin: '12px 0', padding: '12px', background: '#f5f5f5', borderRadius: '4px',
      }}
      >
        <strong>Encrypted command:</strong>
        {' '}
        <code style={{ fontSize: '16px' }}>{encryptedCommand ?? '—'}</code>
      </div>
      <p>Guess the original command that was encrypted above:</p>
      {status === 'submitted'
        ? (
            <p style={{ color: 'green' }}>
              ✓ Guess submitted:
              {' '}
              <code>{sabotagerGuess}</code>
            </p>
          )
        : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                disabled={status === 'submitted'}
                onChange={(e) => {
                  setGuess(e.target.value)
                }}
                placeholder='Component type attribute value'
                style={{ flex: 1, padding: '8px', fontFamily: 'monospace' }}
                type='text'
                value={guess}
              />
              <button
                disabled={!guess.trim() || status === 'submitted'}
                style={{ padding: '8px 16px' }}
                type='submit'
              >
                Submit Guess
              </button>
            </form>
          )}
      {errorMessage && (
        <p style={{ color: 'red', marginTop: '8px' }}>
          Error:
          {' '}
          {errorMessage}
        </p>
      )}
    </div>
  )
}
