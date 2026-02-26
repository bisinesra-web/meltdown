import { useEffect, useRef, useState } from 'react'

const HEX_CHARS = '0123456789ABCDEF'
const CORRUPT_CHARS = '█▓▒░▪▫◆◇○●□■△▽'

function randomHex(length: number): string {
  return Array.from({ length }, () => HEX_CHARS[Math.floor(Math.random() * HEX_CHARS.length)]).join('')
}

function randomCorrupt(length: number): string {
  const pool = HEX_CHARS + CORRUPT_CHARS
  return Array.from({ length }, () => pool[Math.floor(Math.random() * pool.length)]).join('')
}

interface HexScrambleProperties {
  /** The real text to eventually display (when active=false or on lock-in). */
  text: string
  /**
   * When true the text continuously scrambles.
   * When false gracefully locks into `text`.
   */
  active?: boolean
  /**
   * Use 'corrupt' for red/sabotager-style broken symbols;
   * 'hex' for normal hex stream.
   */
  mode?: 'hex' | 'corrupt'
  /** Extra class forwarded to the wrapping <span>. */
  className?: string
}

/**
 * Continuously scrambles text using hex/corrupted characters while `active`.
 * Gracefully locks each character in place once deactivated.
 */
export default function HexScramble({
  text,
  active = true,
  mode = 'hex',
  className = '',
}: HexScrambleProperties) {
  const [displayed, setDisplayed] = useState<string>(() =>
    active ? (mode === 'hex' ? randomHex(text.length) : randomCorrupt(text.length)) : text)
  const lockedReference = useRef(0) // Number of chars locked into final text
  const intervalReference = useRef<ReturnType<typeof setInterval> | null>(null)
  const lockTimerReference = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeReference = useRef(active)
  activeReference.current = active

  // Scramble loop
  useEffect(() => {
    if (!active) {
      // Lock characters one by one into the real text
      lockedReference.current = 0

      lockTimerReference.current = setInterval(() => {
        lockedReference.current += 1

        setDisplayed(text
          .split('')
          .map((char, index) => {
            if (index < lockedReference.current) {
              return char
            }

            return mode === 'hex'
              ? HEX_CHARS[Math.floor(Math.random() * HEX_CHARS.length)]!
              : (HEX_CHARS + CORRUPT_CHARS)[Math.floor(Math.random() * (HEX_CHARS.length + CORRUPT_CHARS.length))]!
          })
          .join(''))

        if (lockedReference.current >= text.length) {
          clearInterval(lockTimerReference.current!)
          lockTimerReference.current = null
          setDisplayed(text)
        }
      }, 60)

      // Clear scramble loop
      if (intervalReference.current) {
        clearInterval(intervalReference.current)
        intervalReference.current = null
      }

      return
    }

    // Active: continuous scramble
    intervalReference.current = setInterval(() => {
      setDisplayed(text
        .split('')
        .map((_, index) => {
          if (index < lockedReference.current) {
            return text[index]!
          }

          return mode === 'hex'
            ? HEX_CHARS[Math.floor(Math.random() * HEX_CHARS.length)]!
            : (HEX_CHARS + CORRUPT_CHARS)[Math.floor(Math.random() * (HEX_CHARS.length + CORRUPT_CHARS.length))]!
        })
        .join(''))
    }, 1000 / 20)

    return () => {
      if (intervalReference.current) {
        clearInterval(intervalReference.current)
      }
    }
  }, [active, text, mode])

  // Cleanup on unmount
  useEffect(() => () => {
    if (intervalReference.current) {
      clearInterval(intervalReference.current)
    }

    if (lockTimerReference.current) {
      clearInterval(lockTimerReference.current)
    }
  }, [])

  return <span className={className}>{displayed}</span>
}
