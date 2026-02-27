import { z } from 'zod'

/**
 * Client-side Cipher Validation
 *
 * Mirrors the server-side cipher types and validation schemas
 */

// ---------------------------------------------------------------------------
// TypeScript Types
// ---------------------------------------------------------------------------

export interface CipherBlock {
  type: string
  arg1: string
  arg2: string
}

export interface Cipher {
  level: number
  blocks: CipherBlock[]
}

export interface LevelConfig {
  level: number
  maxBlockLimit: number
  acceptedBlocks: {
    name: string
    maxQuantity: number
  }[]
}

// ---------------------------------------------------------------------------
// Zod Schemas for Runtime Validation
// ---------------------------------------------------------------------------

export const CipherBlockSchema = z.object({
  type: z.string().min(1).max(50),
  arg1: z.string().max(50),
  arg2: z.string().max(50),
})

export const CipherSchema = z.object({
  level: z.number().int().min(1).max(100),
  blocks: z.array(CipherBlockSchema).min(0).max(20),
})

// ---------------------------------------------------------------------------
// Validation Functions
// ---------------------------------------------------------------------------

/**
 * Local level configurations (should match server-side)
 */
const LEVEL_CONFIGS: LevelConfig[] = [
  {
    level: 1,
    maxBlockLimit: 3,
    acceptedBlocks: [
      { name: 'swap-word', maxQuantity: 2 },
      { name: 'shift-number', maxQuantity: 1 },
    ],
  },
  {
    level: 2,
    maxBlockLimit: 5,
    acceptedBlocks: [
      { name: 'swap-word', maxQuantity: 2 },
      { name: 'shift-number', maxQuantity: 2 },
      { name: 'substitute-char', maxQuantity: 1 },
    ],
  },
  {
    level: 3,
    maxBlockLimit: 6,
    acceptedBlocks: [
      { name: 'swap-word', maxQuantity: 2 },
      { name: 'shift-number', maxQuantity: 2 },
      { name: 'substitute-char', maxQuantity: 1 },
      { name: 'reverse-string', maxQuantity: 1 },
    ],
  },
  {
    level: 4,
    maxBlockLimit: 7,
    acceptedBlocks: [
      { name: 'swap-word', maxQuantity: 2 },
      { name: 'shift-number', maxQuantity: 2 },
      { name: 'substitute-char', maxQuantity: 2 },
      { name: 'insert-noise', maxQuantity: 1 },
      { name: 'rotate-words', maxQuantity: 1 },
    ],
  },
  {
    level: 5,
    maxBlockLimit: 8,
    acceptedBlocks: [
      { name: 'swap-word', maxQuantity: 2 },
      { name: 'shift-number', maxQuantity: 2 },
      { name: 'substitute-char', maxQuantity: 2 },
      { name: 'insert-noise', maxQuantity: 1 },
      { name: 'case-transform', maxQuantity: 1 },
      { name: 'rotate-words', maxQuantity: 1 },
      { name: 'multiply-number', maxQuantity: 1 },
    ],
  },
]

export function getLevelConfig(level: number): LevelConfig | undefined {
  return LEVEL_CONFIGS.find(c => c.level === level)
}

/**
 * Block type metadata for UI display
 */
export interface BlockTypeInfo {
  name: string
  displayName: string
  description: string
  arg1Label: string
  arg2Label: string
  arg1Required: boolean
  arg2Required: boolean
}

export const BLOCK_TYPE_INFO: Record<string, BlockTypeInfo> = {
  'swap-word': {
    name: 'swap-word',
    displayName: 'Swap Words',
    description: 'Swaps all occurrences of two words/strings',
    arg1Label: 'Word 1',
    arg2Label: 'Word 2',
    arg1Required: true,
    arg2Required: true,
  },
  'shift-number': {
    name: 'shift-number',
    displayName: 'Shift Number',
    description: 'Shifts all numbers by a fixed amount',
    arg1Label: 'Shift Amount',
    arg2Label: '(unused)',
    arg1Required: true,
    arg2Required: false,
  },
  'reverse-string': {
    name: 'reverse-string',
    displayName: 'Reverse String',
    description: 'Reverses the entire string',
    arg1Label: '(unused)',
    arg2Label: '(unused)',
    arg1Required: false,
    arg2Required: false,
  },
  'substitute-char': {
    name: 'substitute-char',
    displayName: 'Substitute Character',
    description: 'Replaces all occurrences of one character with another',
    arg1Label: 'From Char',
    arg2Label: 'To Char',
    arg1Required: true,
    arg2Required: true,
  },
  'insert-noise': {
    name: 'insert-noise',
    displayName: 'Insert Noise',
    description: 'Inserts a string at a specific position',
    arg1Label: 'Noise Text',
    arg2Label: 'Position',
    arg1Required: true,
    arg2Required: true,
  },
  'case-transform': {
    name: 'case-transform',
    displayName: 'Transform Case',
    description: 'Transforms character case (upper/lower/toggle)',
    arg1Label: 'Mode',
    arg2Label: '(unused)',
    arg1Required: true,
    arg2Required: false,
  },
  'rotate-words': {
    name: 'rotate-words',
    displayName: 'Rotate Words',
    description: 'Rotates word positions by N positions',
    arg1Label: 'Rotation',
    arg2Label: '(unused)',
    arg1Required: true,
    arg2Required: false,
  },
  'multiply-number': {
    name: 'multiply-number',
    displayName: 'Multiply Number',
    description: 'Multiplies all numbers by a factor',
    arg1Label: 'Multiplier',
    arg2Label: '(unused)',
    arg1Required: true,
    arg2Required: false,
  },
  'digit-shuffle': {
    name: 'digit-shuffle',
    displayName: 'Digit Shuffle',
    description: 'Shuffles digits within numbers using a seed',
    arg1Label: 'Seed',
    arg2Label: '(unused)',
    arg1Required: true,
    arg2Required: false,
  },
  'remove-spaces': {
    name: 'remove-spaces',
    displayName: 'Remove Spaces',
    description: 'Removes all whitespace characters',
    arg1Label: '(unused)',
    arg2Label: '(unused)',
    arg1Required: false,
    arg2Required: false,
  },
}

/**
 * Validates a cipher on the client side (before sending to server)
 */
export function validateCipherClient(cipher: Cipher): { valid: boolean, errors: string[] } {
  const errors: string[] = []

  // Basic schema validation
  const parseResult = CipherSchema.safeParse(cipher)
  if (!parseResult.success) {
    return {
      valid: false,
      errors: parseResult.error.issues.map(issue => issue.message),
    }
  }

  // Get level config
  const levelConfig = getLevelConfig(cipher.level)
  if (!levelConfig) {
    return {
      valid: false,
      errors: [`Invalid level: ${String(cipher.level)}`],
    }
  }

  // Check total block count
  if (cipher.blocks.length > levelConfig.maxBlockLimit) {
    errors.push(`Too many blocks: ${String(cipher.blocks.length)} (max: ${String(levelConfig.maxBlockLimit)})`)
  }

  // Build map of allowed blocks
  const allowedBlocks = new Map<string, number>()
  for (const restriction of levelConfig.acceptedBlocks) {
    allowedBlocks.set(restriction.name, restriction.maxQuantity)
  }

  // Count block usage
  const blockCounts = new Map<string, number>()
  for (const block of cipher.blocks) {
    blockCounts.set(block.type, (blockCounts.get(block.type) ?? 0) + 1)
  }

  // Validate each block type
  for (const [blockType, count] of blockCounts.entries()) {
    const maxAllowed = allowedBlocks.get(blockType)
    if (maxAllowed === undefined) {
      errors.push(`Block type "${blockType}" not allowed at level ${String(levelConfig.level)}`)
      continue
    }

    if (count > maxAllowed) {
      errors.push(`Too many "${blockType}" blocks: ${String(count)} (max: ${String(maxAllowed)})`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Gets available block types for a given level
 */
export function getAvailableBlocks(level: number): string[] {
  const config = getLevelConfig(level)
  if (!config) {
    return []
  }

  return config.acceptedBlocks.map(b => b.name)
}
