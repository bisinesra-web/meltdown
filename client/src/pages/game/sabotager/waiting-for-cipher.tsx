import { useEffect, useState } from 'react'
import { useGameState } from '../../../hooks/useGameState'

const PHASE_DURATION_MS = 60_000

function clampToZero(v: number): number {
  return Math.max(0, v)
}

export default function WaitingForCipherPage() {
  const phaseEnteredAt = useGameState(s => s.phaseEnteredAt)
  const cipherSelected = useGameState(s => s.cipherSelected)
  const currentLevel = useGameState(s => s.currentLevel)
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
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>PRE-ROUND (Sabotager)</h1>
      <p>
        Level:
        {' '}
        {currentLevel}
      </p>
      <p>
        {cipherSelected
          ? '✓ Controller has selected a cipher. Round starting soon…'
          : 'Controller is building their cipher…'}
      </p>
      {!cipherSelected && (
        <p>
          Time remaining:
          {' '}
          <strong>
            {timerSeconds}
            s
          </strong>
        </p>
      )}
    </div>
  )
}
