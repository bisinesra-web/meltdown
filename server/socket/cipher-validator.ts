import type { Cipher, CipherBlock } from './cipher-types.js'
import type { LevelConfig } from '../config/level-schema.js'
import { loadLevelConfig } from '../config/level-schema.js'
import { BLOCK_REGISTRY } from './cipher-blocks.js'

/**
 * Cipher Validation
 *
 * Validates cipher configurations against level restrictions
 */

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validates a cipher block's arguments using its block type validator
 */
function validateBlockArguments(block: CipherBlock): { valid: boolean, error?: string } {
  const blockType = BLOCK_REGISTRY[block.type]

  if (!blockType) {
    return { valid: false, error: `Unknown block type: ${block.type}` }
  }

  return blockType.validate(block.arg1, block.arg2)
}

/**
 * Counts how many times each block type is used
 */
function countBlockTypes(blocks: CipherBlock[]): Map<string, number> {
  const counts = new Map<string, number>()

  for (const block of blocks) {
    counts.set(block.type, (counts.get(block.type) || 0) + 1)
  }

  return counts
}

/**
 * Validates a cipher against level configuration
 */
export function validateCipher(cipher: Cipher, levelConfig: LevelConfig): ValidationResult {
  const errors: string[] = []

  // Check total block count
  if (cipher.blocks.length > levelConfig.maxBlockLimit) {
    errors.push(`Too many blocks: ${cipher.blocks.length} (max: ${levelConfig.maxBlockLimit})`)
  }

  // Build a map of allowed block types
  const allowedBlocks = new Map<string, number>()
  for (const restriction of levelConfig.acceptedBlocks) {
    allowedBlocks.set(restriction.name, restriction.maxQuantity)
  }

  // Count block usage
  const blockCounts = countBlockTypes(cipher.blocks)

  // Validate each block type
  for (const [blockType, count] of blockCounts.entries()) {
    // Check if block type exists in registry
    if (!BLOCK_REGISTRY[blockType]) {
      errors.push(`Unknown block type: ${blockType}`)
      continue
    }

    // Check if block type is allowed at this level
    const maxAllowed = allowedBlocks.get(blockType)
    if (maxAllowed === undefined) {
      errors.push(`Block type "${blockType}" not allowed at level ${levelConfig.level}`)
      continue
    }

    // Check if quantity exceeds limit
    if (count > maxAllowed) {
      errors.push(`Too many "${blockType}" blocks: ${count} (max: ${maxAllowed})`)
    }
  }

  // Validate each block's arguments
  for (let index = 0; index < cipher.blocks.length; index++) {
    const block = cipher.blocks[index]
    const argumentValidation = validateBlockArguments(block)

    if (!argumentValidation.valid && argumentValidation.error) {
      errors.push(`Block ${index + 1} (${block.type}): ${argumentValidation.error}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Convenience function that loads level config and validates cipher
 */
export function isCipherValid(cipher: Cipher): ValidationResult {
  const levelConfig = loadLevelConfig(cipher.level)

  if (!levelConfig) {
    return {
      valid: false,
      errors: [`Invalid level: ${cipher.level}`],
    }
  }

  return validateCipher(cipher, levelConfig)
}

/**
 * Sanitizes cipher input (trims strings, enforces length limits)
 */
export function sanitizeCipher(cipher: Cipher): Cipher {
  return {
    level: cipher.level,
    blocks: cipher.blocks.map(block => ({
      type: block.type.trim().toLowerCase(),
      arg1: block.arg1.slice(0, 50).trim(),
      arg2: block.arg2.slice(0, 50).trim(),
    })),
  }
}
