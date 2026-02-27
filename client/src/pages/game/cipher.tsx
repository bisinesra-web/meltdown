import React, { useEffect, useMemo, useState } from 'react'
import { DragDropProvider, useDroppable } from '@dnd-kit/react'
import '@fontsource-variable/jetbrains-mono'
import Squares from '../../components/scrolling-bg'
import { useGameState } from '../../hooks/useGameState'
import {
  BLOCK_TYPE_INFO,
  getLevelConfig,
  validateCipherClient,
} from '../../lib/cipher-validator'
import { getSocketInstance } from '../../stores/socket-store'
import CipherBlockTile from '../../components/cipher-block-tile'
import CipherBlockRow, { type CipherDraftBlock } from '../../components/cipher-block-row'
import './cipher.css'

interface DragDropEvent {
  canceled?: boolean
  source?: { id: string | number, data?: Record<string, unknown> }
  target?: { id: string | number } | null
  operation?: {
    source?: { id: string | number, data?: Record<string, unknown> }
    target?: { id: string | number } | null
  }
}

const ROUND_DURATION_MS = 30_000

function createBlockId(): string {
  return `${String(Date.now())}-${Math.random().toString(16).slice(2)}`
}

function clampToZero(value: number): number {
  return Math.max(value, 0)
}

export default function CipherPage() {
  const phase = useGameState(s => s.phase)
  const phaseEnteredAt = useGameState(s => s.phaseEnteredAt)
  const level = useGameState(s => s.level ?? 1)
  const player1Ready = useGameState(s => s.player1Ready)
  const player2Ready = useGameState(s => s.player2Ready)
  const errorMessage = useGameState(s => s.errorMessage)
  const setErrorMessage = useGameState(s => s.setErrorMessage)

  const [draftBlocks, setDraftBlocks] = useState<CipherDraftBlock[]>([])
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [submitError, setSubmitError] = useState<string | undefined>()
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'submitted'>('idle')

  const levelConfig = getLevelConfig(level)
  const acceptedBlocks = levelConfig?.acceptedBlocks ?? []

  const blockCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const block of draftBlocks) {
      map.set(block.type, (map.get(block.type) ?? 0) + 1)
    }

    return map
  }, [draftBlocks])

  const canAddBlock = (blockName: string) => {
    if (!canEdit || !levelConfig) {
      return false
    }

    const restriction = levelConfig.acceptedBlocks.find(block => block.name === blockName)
    if (!restriction) {
      return false
    }

    const currentCount = blockCounts.get(blockName) ?? 0
    return draftBlocks.length < levelConfig.maxBlockLimit && currentCount < restriction.maxQuantity
  }

  const requiredErrors = useMemo(() => {
    const errors: string[] = []

    for (const [index, block] of draftBlocks.entries()) {
      const info = BLOCK_TYPE_INFO[block.type]
      if (!info) {
        continue
      }

      if (info.arg1Required && !block.arg1.trim()) {
        errors.push(`Block ${String(index + 1)} (${info.displayName}) missing ${info.arg1Label}`)
      }

      if (info.arg2Required && !block.arg2.trim()) {
        errors.push(`Block ${String(index + 1)} (${info.displayName}) missing ${info.arg2Label}`)
      }
    }

    return errors
  }, [draftBlocks])

  const cipherValidation = useMemo(() => {
    if (!levelConfig) {
      return {
        valid: false,
        errors: ['Awaiting level configuration.'],
      }
    }

    return validateCipherClient({
      level,
      blocks: draftBlocks.map(block => ({
        type: block.type,
        arg1: block.arg1,
        arg2: block.arg2,
      })),
    })
  }, [draftBlocks, level, levelConfig])

  const allErrors = useMemo(() => {
    const merged = [...cipherValidation.errors, ...requiredErrors]
    return [...new Set(merged)]
  }, [cipherValidation.errors, requiredErrors])

  const canSubmit = cipherValidation.valid && requiredErrors.length === 0 && submitStatus !== 'submitted'
  const canEdit = phase === 'PRE_ROUND' && submitStatus !== 'submitted'
  const isWaitingForOpponent = submitStatus === 'submitted' && !(player1Ready && player2Ready)

  useEffect(() => {
    if (phase !== 'PRE_ROUND') {
      setTimerSeconds(0)
      return
    }

    const startedAt = phaseEnteredAt ? new Date(phaseEnteredAt) : new Date()

    const updateTimer = () => {
      const elapsed = Date.now() - startedAt.getTime()
      const remaining = clampToZero(ROUND_DURATION_MS - elapsed)
      setTimerSeconds(Math.ceil(remaining / 1000))
    }

    updateTimer()
    const interval = globalThis.setInterval(updateTimer, 1000)
    return () => {
      globalThis.clearInterval(interval)
    }
  }, [phase, phaseEnteredAt])

  useEffect(() => {
    const socket = getSocketInstance()

    const handleConfirmation = (data: { success: boolean, error?: string }) => {
      if (data.success) {
        setSubmitStatus('submitted')
        setSubmitError(undefined)
        setErrorMessage(undefined)
      }
      else {
        setSubmitStatus('idle')
        setSubmitError(data.error ?? 'Invalid cipher configuration.')
      }
    }

    socket.on('game:cipher_confirmation', handleConfirmation)
    return () => {
      socket.off('game:cipher_confirmation', handleConfirmation)
    }
  }, [])

  useEffect(() => {
    if (errorMessage) {
      setSubmitStatus('idle')
    }
  }, [errorMessage])

  const addBlock = (blockName: string) => {
    if (!levelConfig) {
      return
    }

    const restriction = levelConfig.acceptedBlocks.find(block => block.name === blockName)
    const currentCount = blockCounts.get(blockName) ?? 0

    if (!restriction) {
      setSubmitError(`Block ${blockName} is not allowed at this level.`)
      return
    }

    if (draftBlocks.length >= levelConfig.maxBlockLimit) {
      setSubmitError(`Max blocks reached (${String(levelConfig.maxBlockLimit)}).`)
      return
    }

    if (currentCount >= restriction.maxQuantity) {
      setSubmitError(`Max quantity reached for ${blockName}.`)
      return
    }

    setSubmitError(undefined)
    setDraftBlocks(previous => ([
      ...previous,
      {
        id: createBlockId(),
        type: blockName,
        arg1: '',
        arg2: '',
      },
    ]))
  }

  const removeBlock = (blockId: string) => {
    setDraftBlocks(previous => previous.filter(block => block.id !== blockId))
  }

  const moveBlock = (blockId: string, direction: 'up' | 'down') => {
    setDraftBlocks((previous) => {
      const index = previous.findIndex(block => block.id === blockId)
      if (index === -1) {
        return previous
      }

      const newIndex = direction === 'up' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= previous.length) {
        return previous
      }

      const updated = [...previous]
      const moved = updated[index]
      if (!moved) {
        return previous
      }

      updated.splice(index, 1)
      updated.splice(newIndex, 0, moved)
      return updated
    })
  }

  const updateBlock = (blockId: string, updates: Partial<CipherDraftBlock>) => {
    setDraftBlocks(previous => previous.map(block => (
      block.id === blockId ? { ...block, ...updates } : block
    )))
  }

  const handleDragEnd = (event: DragDropEvent) => {
    if (event.canceled) {
      return
    }

    const source = event.source ?? event.operation?.source
    const target = event.target ?? event.operation?.target
    if (!target || !canEdit || !source) {
      return
    }

    // Extract data from source's data property
    const data = source.data as {
      source?: string
      blockName?: string
      blockId?: string
    } | undefined

    if (String(target.id) === 'cipher-builder' && data?.source === 'pool' && data.blockName) {
      addBlock(data.blockName)
    }

    if (String(target.id) === 'cipher-trash' && data?.source === 'cipher' && data.blockId) {
      removeBlock(data.blockId)
    }
  }

  const handleSubmit = () => {
    if (!canSubmit || !canEdit) {
      return
    }

    const socket = getSocketInstance()
    if (!socket.connected) {
      setSubmitError('Socket offline. Check connection.')
      return
    }

    setSubmitStatus('sending')
    setSubmitError(undefined)
    socket.emit('game:select_cipher', {
      level,
      blocks: draftBlocks.map(block => ({
        type: block.type,
        arg1: block.arg1,
        arg2: block.arg2,
      })),
    })
  }

  return (
    <>
      <Squares
        speed={0.2}
        squareSize={48}
        direction='diagonal'
        borderColor='rgba(194, 214, 133, 0.12)'
        bgColor='rgba(10, 10, 10, 0.4)'
        className='cipher-page__bg'
      />
      <div className='cipher-page'>
        <div className='cipher-page__vignette' aria-hidden='true' />
        <div className='cipher-page__scanlines' aria-hidden='true' />

        <header className='cipher-page__header'>
          <div>
            <p className='cipher-page__eyebrow'>PRE-ROUND PROTOCOL</p>
            <h1 className='cipher-page__title'>CIPHER CONFIGURATION</h1>
          </div>
          <div className='cipher-page__timer'>
            <span className='cipher-page__timer-label'>TIME LEFT</span>
            <span className='cipher-page__timer-value'>
              {String(timerSeconds).padStart(2, '0')}
              s
            </span>
          </div>
        </header>

        <DragDropProvider onDragEnd={handleDragEnd}>
          <main className='cipher-page__main'>
            <section className='cipher-page__panel cipher-page__panel--blocks'>
              <div className='cipher-page__panel-header'>
                <h2>AVAILABLE BLOCKS</h2>
                <p>
                  LEVEL
                  {String(level)}
                  {' '}
                  · LIMIT
                  {String(levelConfig?.maxBlockLimit ?? 0)}
                </p>
              </div>
              <div className='cipher-page__block-list'>
                {acceptedBlocks.length === 0 && (
                  <div className='cipher-page__empty'>No blocks available.</div>
                )}
                {acceptedBlocks.map(block => (
                  <CipherBlockTile
                    key={block.name}
                    blockName={block.name}
                    info={BLOCK_TYPE_INFO[block.name]}
                    maxQuantity={block.maxQuantity}
                    usedCount={blockCounts.get(block.name) ?? 0}
                    canAdd={canAddBlock(block.name)}
                  />
                ))}
              </div>
            </section>

            <section className='cipher-page__panel cipher-page__panel--builder'>
              <div className='cipher-page__panel-header'>
                <h2>CIPHER BUILDER</h2>
                <p>DRAG BLOCKS OR USE CONTROLS</p>
              </div>

              <div className='cipher-page__builder-zone'>
                <CipherDropZone zoneId='cipher-builder' className='cipher-page__dropzone'>
                  {draftBlocks.length === 0 && (
                    <div className='cipher-page__empty'>Drop blocks here to build your cipher.</div>
                  )}
                  {draftBlocks.map((block, index) => (
                    <CipherBlockRow
                      key={block.id}
                      block={block}
                      index={index}
                      info={BLOCK_TYPE_INFO[block.type]}
                      canEdit={canEdit}
                      onChange={updateBlock}
                      onRemove={removeBlock}
                      onMove={moveBlock}
                    />
                  ))}
                </CipherDropZone>
                <CipherDropZone zoneId='cipher-trash' className='cipher-page__trash'>
                  DROP HERE TO REMOVE
                </CipherDropZone>
                {isWaitingForOpponent && (
                  <div className='cipher-page__waiting'>
                    WAITING FOR OPPONENT...
                  </div>
                )}
              </div>
            </section>

            <aside className='cipher-page__panel cipher-page__panel--status'>
              <div className='cipher-page__panel-header'>
                <h2>VALIDATION</h2>
                <p>REAL-TIME CHECKS</p>
              </div>

              <div className='cipher-page__status-grid'>
                <div className='cipher-page__stat'>
                  <span>BLOCKS USED</span>
                  <strong>
                    {String(draftBlocks.length)}
                    {' '}
                    /
                    {String(levelConfig?.maxBlockLimit ?? 0)}
                  </strong>
                </div>
                <div className='cipher-page__stat'>
                  <span>STATUS</span>
                  <strong className={canSubmit ? 'cipher-page__ok' : 'cipher-page__bad'}>
                    {canSubmit ? 'READY' : 'INVALID'}
                  </strong>
                </div>
              </div>

              <div className='cipher-page__errors'>
                {errorMessage && (
                  <p className='cipher-page__error-line'>
                    ERROR:
                    {errorMessage}
                  </p>
                )}
                {submitError && (
                  <p className='cipher-page__error-line'>
                    ERROR:
                    {submitError}
                  </p>
                )}
                {allErrors.length === 0 && !submitError && !errorMessage && (
                  <p className='cipher-page__ok'>No errors detected.</p>
                )}
                {allErrors.map(error => (
                  <p className='cipher-page__error-line' key={error}>
                    ERROR:
                    {error}
                  </p>
                ))}
              </div>

              <button
                type='button'
                className='cipher-page__confirm'
                onClick={handleSubmit}
                disabled={!canSubmit || submitStatus === 'sending' || !canEdit}
              >
                {submitStatus === 'sending' ? 'TRANSMITTING...' : 'CONFIRM CIPHER'}
              </button>

              <p className='cipher-page__note'>
                {phase === 'PRE_ROUND'
                  ? 'SUBMIT BEFORE TIMER EXPIRES.'
                  : 'AWAITING PRE-ROUND PHASE.'}
              </p>
            </aside>
          </main>
        </DragDropProvider>
      </div>
    </>
  )
}

interface CipherDropZoneProperties {
  zoneId: string
  className: string
  children: React.ReactNode
}

function CipherDropZone({ zoneId, className, children }: CipherDropZoneProperties) {
  const { ref, isDropTarget } = useDroppable({
    id: zoneId,
  })

  return (
    <div
      ref={ref}
      className={`${className} ${isDropTarget ? 'cipher-page__dropzone--active' : ''}`.trim()}
      data-zone={zoneId}
    >
      {children}
    </div>
  )
}
