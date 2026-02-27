import { useState, useEffect } from 'react'
import { useGameState } from '../../../hooks/useGameState'
import { submitCommand } from '../../../lib/socket-actions'

const PHASE_DURATION_MS = 30_000

function clampToZero(v: number): number {
  return Math.max(0, v)
}

export default function SubmitCommandPage() {
  const recommendedCommand = useGameState(s => s.recommendedCommand)
  const phaseEnteredAt = useGameState(s => s.phaseEnteredAt)
  const errorMessage = useGameState(s => s.errorMessage)
  const encryptedCommand = useGameState(s => s.encryptedCommand)

  const [command, setCommand] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitted'>('idle')
  const [timerSeconds, setTimerSeconds] = useState(30)

  // Prefill with the recommended command for convenience
  useEffect(() => {
    if (recommendedCommand && !command) {
      setCommand(recommendedCommand)
    }
  }, [recommendedCommand])

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

  // Once encrypted command appears server has accepted our submission
  useEffect(() => {
    if (encryptedCommand) {
      setStatus('submitted')
    }
  }, [encryptedCommand])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!command.trim() || status === 'submitted') {
      return
    }

    submitCommand(command.trim())
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Submit Command (Controller)</h1>
      <p>
        Time remaining:
        {' '}
        <strong>
          {timerSeconds}
          s
        </strong>
      </p>
      {recommendedCommand && (
        <p>
          Recommended command:
          {' '}
          <code>{recommendedCommand}</code>
        </p>
      )}
      {status === 'submitted'
        ? (
            <p style={{ color: 'green' }}>✓ Command submitted. Waiting for sabotager…</p>
          )
        : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                disabled={status === 'submitted'}
                onChange={(e) => {
                  setCommand(e.target.value)
                }}
                placeholder='Component type attribute value'
                style={{ flex: 1, padding: '8px', fontFamily: 'monospace' }}
                type='text'
                value={command}
              />
              <button
                disabled={!command.trim() || status === 'submitted'}
                style={{ padding: '8px 16px' }}
                type='submit'
              >
                Submit
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
