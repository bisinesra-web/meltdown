import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Triggers a CRT-style glitch at random intervals.
 * Returns `isGlitching` — true for the duration of each glitch burst.
 */
export function useCrtGlitch(minInterval = 10_000, maxInterval = 15_000, duration = 250) {
  const [isGlitching, setIsGlitching] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleNext = useCallback(() => {
    const delay = minInterval + Math.random() * (maxInterval - minInterval)
    timerRef.current = setTimeout(() => {
      setIsGlitching(true)
      setTimeout(() => {
        setIsGlitching(false)
        scheduleNext()
      }, duration)
    }, delay)
  }, [minInterval, maxInterval, duration])

  useEffect(() => {
    scheduleNext()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [scheduleNext])

  return isGlitching
}
