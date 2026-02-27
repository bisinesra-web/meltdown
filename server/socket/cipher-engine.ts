import type { Cipher } from './cipher-types.js'
import { BLOCK_REGISTRY } from './cipher-blocks.js'
import { logger } from '../logger.js'

/**
 * Cipher Encryption/Decryption Engine
 *
 * Applies cipher transformations to plaintext and reverses them
 */

export interface EncryptionResult {
  success: boolean
  result: string
  error?: string
}

/**
 * Encrypts plaintext by sequentially applying all cipher blocks
 */
export function encrypt(plaintext: string, cipher: Cipher): EncryptionResult {
  try {
    let result = plaintext

    for (let index = 0; index < cipher.blocks.length; index++) {
      const block = cipher.blocks[index]
      const blockType = BLOCK_REGISTRY[block.type]

      if (!blockType) {
        logger.warn('Unknown block type during encryption', {
          blockType: block.type,
          blockIndex: index,
        })
        return {
          success: false,
          result: plaintext,
          error: `Unknown block type: ${block.type}`,
        }
      }

      try {
        result = blockType.apply(result, block.arg1, block.arg2)
      }
      catch (error) {
        logger.error('Block apply error', {
          blockType: block.type,
          blockIndex: index,
          error,
        })
        return {
          success: false,
          result: plaintext,
          error: `Error in block ${index + 1} (${block.type}): ${String(error)}`,
        }
      }
    }

    return {
      success: true,
      result,
    }
  }
  catch (error) {
    logger.error('Encryption error', { error })
    return {
      success: false,
      result: plaintext,
      error: `Encryption failed: ${String(error)}`,
    }
  }
}

/**
 * Decrypts ciphertext by applying inverse transformations in reverse order
 */
export function decrypt(ciphertext: string, cipher: Cipher): EncryptionResult {
  try {
    let result = ciphertext

    // Apply inverse transformations in reverse order
    for (let index = cipher.blocks.length - 1; index >= 0; index--) {
      const block = cipher.blocks[index]
      const blockType = BLOCK_REGISTRY[block.type]

      if (!blockType) {
        logger.warn('Unknown block type during decryption', {
          blockType: block.type,
          blockIndex: index,
        })
        return {
          success: false,
          result: ciphertext,
          error: `Unknown block type: ${block.type}`,
        }
      }

      try {
        result = blockType.inverse(result, block.arg1, block.arg2)
      }
      catch (error) {
        logger.error('Block inverse error', {
          blockType: block.type,
          blockIndex: index,
          error,
        })
        return {
          success: false,
          result: ciphertext,
          error: `Error in block ${index + 1} (${block.type}): ${String(error)}`,
        }
      }
    }

    return {
      success: true,
      result,
    }
  }
  catch (error) {
    logger.error('Decryption error', { error })
    return {
      success: false,
      result: ciphertext,
      error: `Decryption failed: ${String(error)}`,
    }
  }
}

/**
 * Tests if encryption and decryption are inverse operations for a given cipher
 */
export function testCipherRoundTrip(plaintext: string, cipher: Cipher): boolean {
  const encrypted = encrypt(plaintext, cipher)
  if (!encrypted.success) {
    return false
  }

  const decrypted = decrypt(encrypted.result, cipher)
  if (!decrypted.success) {
    return false
  }

  return decrypted.result === plaintext
}

/**
 * Validates reactor command format
 * Expected format: "Component type attribute value"
 * Example: "waterpipe B pressure +50"
 */
export function isValidCommandFormat(command: string): boolean {
  // Split by spaces
  const parts = command.trim().split(/\s+/)

  // Must have exactly 4 parts
  if (parts.length !== 4) {
    return false
  }

  const [component, type, attribute, value] = parts

  // Component: non-empty alphanumeric
  if (!/^[a-zA-Z]+$/.test(component)) {
    return false
  }

  // Type: single uppercase letter or alphanumeric identifier
  if (!/^[a-zA-Z0-9]+$/.test(type)) {
    return false
  }

  // Attribute: non-empty alphanumeric
  if (!/^[a-zA-Z]+$/.test(attribute)) {
    return false
  }

  // Value: must start with +, -, or digit
  if (!/^[+\-]?\d+$/.test(value)) {
    return false
  }

  return true
}

/**
 * Generates a random reactor command for testing
 */
export function generateRandomCommand(): string {
  const components = ['waterpipe', 'valve', 'reactor', 'coolant', 'turbine', 'pump']
  const types = ['A', 'B', 'C', 'D', 'primary', 'secondary']
  const attributes = ['pressure', 'temperature', 'flow', 'status', 'level']
  const values = ['+50', '-20', '+100', '-5', '+75', '0']

  const randomChoice = <T>(array: T[]): T => array[Math.floor(Math.random() * array.length)]

  return `${randomChoice(components)} ${randomChoice(types)} ${randomChoice(attributes)} ${randomChoice(values)}`
}
