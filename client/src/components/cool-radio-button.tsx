import React, { useCallback, useRef, useState } from 'react'
import './cool-radio-btn.css'

/* ─── Types ───────────────────────────────────────────────────────── */

export type CrbColorTheme = 'cyan' | 'magenta' | 'green' | 'red'
export type CrbSizePreset = 'sm' | 'md' | 'lg'
export type CrbGlowIntensity = 'low' | 'medium' | 'high'
export type CrbLayout = 'horizontal' | 'vertical'

export interface CrbOption {
  /** Display text shown beside the bracket */
  label: string
  /** Unique value for this option */
  value: string
  /** Render the option as non-interactive */
  disabled?: boolean
}

export interface CoolRadioButtonProperties {
  /** Options to render */
  options: CrbOption[]

  /** Currently selected value. Pass '' or undefined for nothing selected. */
  value?: string

  /** Called with the newly selected value, or '' when deselected */
  onChange?: (value: string) => void

  /**
   * Named color theme.
   * Use 'cyan' | 'magenta' | 'green' | 'red', or pass any valid CSS color
   * string via `customColor` for a bespoke look.
   */
  color?: CrbColorTheme

  /**
   * Override all neon color variables with a single custom CSS color.
   * Takes precedence over `color` when provided.
   * Example: "#ff8800" or "hsl(200, 100%, 60%)"
   */
  customColor?: string

  /** 'sm' | 'md' (default) | 'lg', or an exact pixel size as a number */
  size?: CrbSizePreset | number

  /** Arrange options in a row or column (default: 'vertical') */
  layout?: CrbLayout

  /** Controls how intense the neon glow spreads (default: 'medium') */
  glowIntensity?: CrbGlowIntensity

  /**
   * Enable the slow ambient pulse animation on the active option.
   * Subtle neon breathing effect when at rest.
   */
  idlePulse?: boolean

  /**
   * Allow clicking an already-selected option to deselect it.
   * When false (default) behaves as a classic radio group.
   */
  allowDeselect?: boolean

  /**
   * Add CSS scanline overlay on each bracket frame for extra cyberpunk flair.
   */
  scanlines?: boolean

  /** Extra class for the outer group wrapper */
  className?: string

  /** Accessible group label (used as aria-label on the role="radiogroup") */
  groupLabel?: string

  fontSize?: number
}

/* ─── Component ───────────────────────────────────────────────────── */

const FLICKER_DURATION_MS = 280

export const CoolRadioButton: React.FC<CoolRadioButtonProperties> = ({
  options,
  value = '',
  onChange,
  color = 'cyan',
  customColor,
  size = 'md',
  layout = 'vertical',
  glowIntensity = 'medium',
  idlePulse = false,
  allowDeselect = false,
  scanlines = false,
  className = '',
  groupLabel,
  fontSize = 1,
}) => {
  /* Track which option is currently running the LED-flicker animation */
  const [flickeringValue, setFlickeringValue] = useState<string | undefined>()
  /* Store timeout ids so we can cancel stale flickers */
  const flickerTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  /* ── Click handler ─────────────────────────────────────────────── */
  const handleSelect = useCallback(
    (optionValue: string) => {
      const isCurrentlySelected = value === optionValue

      if (isCurrentlySelected && !allowDeselect) {
        return
      }

      const nextValue = isCurrentlySelected ? '' : optionValue

      /* Trigger flicker only when switching ON */
      if (nextValue !== '') {
        /* Cancel any pending flicker for this value */
        const existing = flickerTimers.current.get(optionValue)
        if (existing) {
          clearTimeout(existing)
        }

        setFlickeringValue(optionValue)

        const timer = setTimeout(() => {
          setFlickeringValue(previous => (previous === optionValue ? undefined : previous))
          flickerTimers.current.delete(optionValue)
        }, FLICKER_DURATION_MS)

        flickerTimers.current.set(optionValue, timer)
      }

      onChange?.(nextValue)
    },
    [value, allowDeselect, onChange],
  )

  /* ── Keyboard support ──────────────────────────────────────────── */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, optionValue: string) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        handleSelect(optionValue)
      }
    },
    [handleSelect],
  )

  /* ── Derive CSS variables ──────────────────────────────────────── */
  const cssVariables: React.CSSProperties = {}

  if (customColor) {
    /* User supplied a raw CSS color — synthesise all neon vars from it */
    (cssVariables as Record<string, string>)['--crb-neon'] = customColor;
    (cssVariables as Record<string, string>)['--crb-neon-dim'] = blendAlpha(customColor, 0.18);
    (cssVariables as Record<string, string>)['--crb-neon-glow'] = blendAlpha(customColor, 0.5);
    (cssVariables as Record<string, string>)['--crb-neon-outer'] = blendAlpha(customColor, 0.14);
    (cssVariables as Record<string, string>)['--crb-neon-halo'] = blendAlpha(customColor, 0.07)
  }

  if (typeof size === 'number') {
    (cssVariables as Record<string, string>)['--crb-size'] = `${size.toString()}px`;
    (cssVariables as Record<string, string>)['--crb-corner'] = `${Math.round(size * 0.32).toString()}px`
  }

  /* ── Derived class flags ───────────────────────────────────────── */
  const sizeAttribute = typeof size === 'string' ? size : undefined
  const themeAttribute = customColor ? undefined : color

  return (
    <div
      role='radiogroup'
      aria-label={groupLabel}
      className={[
        'crb-group',
        `crb-group--${layout}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      data-theme={themeAttribute}
      data-size={sizeAttribute}
      data-glow={glowIntensity}
      style={cssVariables}
    >
      {options.map((option) => {
        const isChecked = value === option.value
        const isFlicker = flickeringValue === option.value
        const isDisabled = Boolean(option.disabled)

        const optionClasses = [
          'crb-option',
          isChecked && 'crb-option--checked',
          isFlicker && 'crb-option--flicker',
          isDisabled && 'crb-option--disabled',
          isChecked && idlePulse && 'crb-option--pulse',
          scanlines && 'crb-option--scanlines',
        ]
          .filter(Boolean)
          .join(' ')

        const frameClasses = [
          'crb-frame',
          scanlines && 'crb-frame--scanlines',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <div
            key={option.value}
            role='radio'
            aria-checked={isChecked}
            aria-disabled={isDisabled}
            tabIndex={isDisabled ? -1 : 0}
            className={optionClasses}
            onClick={() => {
              if (!isDisabled) {
                handleSelect(option.value)
              }
            }}
            onKeyDown={(event) => {
              if (!isDisabled) {
                handleKeyDown(event, option.value)
              }
            }}
          >
            {/* Bracket frame + inner square */}
            <div className={frameClasses} aria-hidden='true'>
              <div className='crb-inner' />
            </div>

            {/* Label */}
            <span className='crb-label' style={{ fontSize: `${fontSize.toString()}rem` }}>{option.label}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Utility ─────────────────────────────────────────────────────── */

/**
 * Naively convert a CSS hex color to rgba with the given alpha.
 * Handles 3-digit and 6-digit hex. Falls back to the original color.
 */
function blendAlpha(color: string, alpha: number): string {
  const hex = color.trim().replace(/^#/v, '')

  if (hex.length === 3) {
    const r = Number.parseInt(hex.charAt(0) + hex.charAt(0), 16)
    const g = Number.parseInt(hex.charAt(1) + hex.charAt(1), 16)
    const b = Number.parseInt(hex.charAt(2) + hex.charAt(2), 16)
    return `rgba(${r.toString()}, ${g.toString()}, ${b.toString()}, ${alpha.toString()})`
  }

  if (hex.length === 6) {
    const r = Number.parseInt(hex.slice(0, 2), 16)
    const g = Number.parseInt(hex.slice(2, 4), 16)
    const b = Number.parseInt(hex.slice(4, 6), 16)
    return `rgba(${r.toString()}, ${g.toString()}, ${b.toString()}, ${alpha.toString()})`
  }

  /* For named colors / hsl / etc., fall back to the raw value */
  return color
}

export default CoolRadioButton
