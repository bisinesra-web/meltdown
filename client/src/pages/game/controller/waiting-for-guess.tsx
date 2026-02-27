import { useEffect, useState } from 'react'
import { useGameState } from '../../../hooks/useGameState'

const PHASE_DURATION_MS = 30_000

function clampToZero(v: number): number {
  return Math.max(0, v)
}

export default function WaitingForGuessPage() {
  const phaseEnteredAt = useGameState(s => s.phaseEnteredAt)
  const encryptedCommand = useGameState(s => s.encryptedCommand)
  const controllerCommand = useGameState(s => s.controllerCommand)
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
    <div style={{ padding: '20px' }}>
      <h1>Waiting for Sabotager (Controller)</h1>
      <p>
        Your command:
        {' '}
        <code>{controllerCommand ?? '—'}</code>
      </p>
      <p>
        Encrypted for sabotager:
        {' '}
        <code>{encryptedCommand ?? '—'}</code>
      </p>
      <p>
        Time remaining:
        {' '}
        <strong>
          {timerSeconds}
          s
        </strong>
      </p>
      <p style={{ color: '#888' }}>Waiting for the sabotager to submit their guess…</p>
    </div>
  )
}
