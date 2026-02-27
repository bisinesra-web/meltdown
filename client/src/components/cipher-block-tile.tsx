import React from 'react'
import { useDraggable } from '@dnd-kit/react'
import type { BlockTypeInfo } from '../lib/cipher-validator'

interface CipherBlockTileProperties {
  blockName: string
  info?: BlockTypeInfo
  maxQuantity: number
  usedCount: number
  canAdd: boolean
}

export default function CipherBlockTile({
  blockName,
  info,
  maxQuantity,
  usedCount,
  canAdd,
}: CipherBlockTileProperties) {
  const {
    ref,
    isDragging,
  } = useDraggable({
    id: `pool-${blockName}`,
    data: {
      source: 'pool',
      blockName,
    },
    disabled: !canAdd,
  })

  return (
    <div
      ref={ref}
      className={[
        'cipher-block-tile',
        isDragging ? 'cipher-block-tile--dragging' : '',
        canAdd ? '' : 'cipher-block-tile--disabled',
      ].join(' ')}
    >
      <div className='cipher-block-tile__header'>
        <span className='cipher-block-tile__name'>
          {info?.displayName ?? blockName}
        </span>
        <span className='cipher-block-tile__count'>
          {String(usedCount)}
          /
          {String(maxQuantity)}
        </span>
      </div>
      <p className='cipher-block-tile__desc'>
        {info?.description ?? 'No metadata available.'}
      </p>
      <div className='cipher-block-tile__meta'>
        <span>DRAG TO ADD</span>
        <span className='cipher-block-tile__tag'>{blockName}</span>
      </div>
    </div>
  )
}
