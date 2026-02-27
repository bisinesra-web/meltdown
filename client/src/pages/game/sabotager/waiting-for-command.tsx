import { useEffect, useState } from 'react'
import { useGameState } from '../../../hooks/useGameState'

const PHASE_DURATION_MS = 30_000

function clampToZero(v: number): number {
  return Math.max(0, v)
}

export default function WaitingForCommandPage() {
  const phaseEnteredAt = useGameState(s => s.phaseEnteredAt)
  const recommendedCommand = useGameState(s => s.recommendedCommand)
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
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>CHALL_CONTROL (Sabotager)</h1>
      {recommendedCommand && (
        <p>
          Server recommended command (public):
          {' '}
          <code>{recommendedCommand}</code>
        </p>
      )}
      <p>Controller is selecting and submitting their command…</p>
      <p>
        Time remaining:
        {' '}
        <strong>
          {timerSeconds}
          s
        </strong>
      </p>
    </div>
  )
}
