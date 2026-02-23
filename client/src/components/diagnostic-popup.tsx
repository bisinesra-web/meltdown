import { useState, useCallback } from 'react'

interface DiagResult {
  id: number
  hex: string
  sector: string
}

let diagIdCounter = 0

/**
 * Generates a fast hex‐dump string and sector label for the diagnostic ping popups.
 */
function generateDiag(sectorName: string): DiagResult {
  diagIdCounter++
  const hexBytes = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()).join(' ')

  return {
    id: diagIdCounter,
    hex: hexBytes,
    sector: sectorName,
  }
}

/**
 * Displays the hex / sector-scan popup when a model element is clicked.
 */
export default function DiagnosticPopup({
  diag,
}: {
  diag: DiagResult | null
}) {
  if (!diag) {
    return null
  }

  return (
    <div className='waiting-room__diag-popup' key={diag.id}>
      <div className='waiting-room__diag-text'>
        {diag.hex}
      </div>
      <div className='waiting-room__diag-text waiting-room__diag-text--result'>
        SECTOR
        {' '}
        {diag.sector}
        {' '}
        SCANNED. ENCRYPTION LOCK: ACTIVE
      </div>
    </div>
  )
}

/**
 * Hook that manages the diagnostic popup state.
 * Returns `[currentDiag, triggerDiag]`.
 */
export function useDiagnosticPing() {
  const [diag, setDiag] = useState<DiagResult | null>(null)

  const triggerDiag = useCallback((sectorName: string) => {
    setDiag(generateDiag(sectorName))

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setDiag(null)
    }, 3000)
  }, [])

  return [diag, triggerDiag] as const
}
