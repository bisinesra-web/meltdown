import React from 'react'
import { useDraggable } from '@dnd-kit/react'
import type { BlockTypeInfo } from '../lib/cipher-validator'

export interface CipherDraftBlock {
  id: string
  type: string
  arg1: string
  arg2: string
}

interface CipherBlockRowProperties {
  block: CipherDraftBlock
  index: number
  info?: BlockTypeInfo
  canEdit: boolean
  onChange: (id: string, updates: Partial<CipherDraftBlock>) => void
  onRemove: (id: string) => void
  onMove: (id: string, direction: 'up' | 'down') => void
}

function isUnusedLabel(label: string | undefined): boolean {
  return Boolean(label?.toLowerCase().includes('unused'))
}

export default function CipherBlockRow({
  block,
  index,
  info,
  canEdit,
  onChange,
  onRemove,
  onMove,
}: CipherBlockRowProperties) {
  const {
    ref,
    handleRef,
    isDragging,
  } = useDraggable({
    id: `cipher-${block.id}`,
    data: {
      source: 'cipher',
      blockId: block.id,
    },
    disabled: !canEdit,
  })

  const argument1Disabled = isUnusedLabel(info?.arg1Label)
  const argument2Disabled = isUnusedLabel(info?.arg2Label)

  return (
    <div
      ref={ref}
      className={[
        'cipher-block-row',
        isDragging ? 'cipher-block-row--dragging' : '',
      ].join(' ')}
    >
      <div className='cipher-block-row__header'>
        <div className='cipher-block-row__title'>
          <span className='cipher-block-row__index'>{String(index + 1)}</span>
          <span>{info?.displayName ?? block.type}</span>
        </div>
        <div className='cipher-block-row__actions'>
          <button
            type='button'
            className='cipher-block-row__btn'
            onClick={() => {
              onMove(block.id, 'up')
            }}
            disabled={!canEdit || index === 0}
          >
            UP
          </button>
          <button
            type='button'
            className='cipher-block-row__btn'
            onClick={() => {
              onMove(block.id, 'down')
            }}
            disabled={!canEdit}
          >
            DOWN
          </button>
          <button
            type='button'
            className='cipher-block-row__btn cipher-block-row__btn--danger'
            onClick={() => {
              onRemove(block.id)
            }}
            disabled={!canEdit}
          >
            REMOVE
          </button>
          <button
            type='button'
            className='cipher-block-row__drag'
            disabled={!canEdit}
            ref={handleRef}
          >
            DRAG
          </button>
        </div>
      </div>

      <div className='cipher-block-row__inputs'>
        <label className='cipher-block-row__field'>
          <span>{info?.arg1Label ?? 'Arg 1'}</span>
          <input
            value={block.arg1}
            onChange={(event) => {
              onChange(block.id, { arg1: event.target.value })
            }}
            disabled={!canEdit || argument1Disabled}
            placeholder={argument1Disabled ? 'N/A' : 'Enter value'}
          />
        </label>
        <label className='cipher-block-row__field'>
          <span>{info?.arg2Label ?? 'Arg 2'}</span>
          <input
            value={block.arg2}
            onChange={(event) => {
              onChange(block.id, { arg2: event.target.value })
            }}
            disabled={!canEdit || argument2Disabled}
            placeholder={argument2Disabled ? 'N/A' : 'Enter value'}
          />
        </label>
      </div>
    </div>
  )
}
