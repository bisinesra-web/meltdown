import { useState, useEffect } from 'react'
import './reactor-hp-bar.css'

interface ReactorHPBarProperties {
  hp: number
  phaseEnteredAt: string
  ticking: boolean
}

/**
 * Reactor HP Bar component.
 *
 * When ticking=true, interpolates HP locally using elapsed time since phaseEnteredAt.
 * Decrements by 1/sec. Syncs back to server HP on prop change.
 * Displays color: green > 60%, yellow > 30%, red <= 30%.
 */
export function ReactorHPBar({ hp, phaseEnteredAt: _phaseEnteredAt, ticking }: ReactorHPBarProperties) {
  const [displayHP, setDisplayHP] = useState(hp)

  useEffect(() => {
    setDisplayHP(hp)
  }, [hp])

  useEffect(() => {
    if (!ticking) return
    const interval = setInterval(() => {
      setDisplayHP(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [ticking])

  const percentage = Math.min(100, Math.max(0, displayHP))
  const tier = percentage <= 30 ? 'crit' : percentage <= 60 ? 'warn' : null

  return (
    <div className='reactor-hp-bar'>
      <div className='reactor-hp-bar__label'>
        <span>Reactor HP</span>
        <span className={`reactor-hp-bar__value${tier ? ` reactor-hp-bar__value--${tier}` : ''}`}>
          {displayHP}
          /100
        </span>
      </div>
      <div className='reactor-hp-bar__track'>
        <div
          className={`reactor-hp-bar__fill${tier ? ` reactor-hp-bar__fill--${tier}` : ''}`}
          style={{
            width: `${String(percentage)}%`,
            transition: ticking ? 'none' : 'width 0.4s ease-out',
          }}
        />
        <div className='reactor-hp-bar__pct'>
          {Math.round(percentage)}
          %
        </div>
      </div>
    </div>
  )
}
