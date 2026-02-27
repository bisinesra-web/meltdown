/**
 * Cipher Block Implementations
 *
 * Each block type is a pure transformation function with:
 * - validate: check if arguments are valid
 * - apply: encrypt by applying the transformation
 * - inverse: decrypt by reversing the transformation
 */

export interface CipherBlockType {
  name: string
  description: string
  validate: (argument1: string, argument2: string) => { valid: boolean, error?: string }
  apply: (text: string, argument1: string, argument2: string) => string
  inverse: (text: string, argument1: string, argument2: string) => string
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function extractNumbers(text: string): { value: string, start: number, end: number }[] {
  const matches: { value: string, start: number, end: number }[] = []
  const regex = /-?\d+/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    matches.push({
      value: match[0],
      start: match.index,
      end: match.index + match[0].length,
    })
  }

  return matches
}

function replaceNumbers(text: string, replacements: Map<number, string>): string {
  let offset = 0
  let result = text

  // Sort by position to apply replacements left-to-right
  const positions = [...replacements.keys()].sort((a, b) => a - b)

  for (const pos of positions) {
    const replacement = replacements.get(pos)!
    const numbers = extractNumbers(text)
    const target = numbers.find(n => n.start === pos)

    if (target) {
      const adjustedStart = target.start + offset
      const adjustedEnd = target.end + offset
      result = result.slice(0, adjustedStart) + replacement + result.slice(adjustedEnd)
      offset += replacement.length - target.value.length
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Block Type: swap-word
// ---------------------------------------------------------------------------

const swapWord: CipherBlockType = {
  name: 'swap-word',
  description: 'Swaps occurrences of two words/strings bidirectionally',

  validate(argument1: string, argument2: string) {
    if (!argument1 || !argument2) {
      return { valid: false, error: 'Both arguments required for swap-word' }
    }

    if (argument1 === argument2) {
      return { valid: false, error: 'Arguments must be different' }
    }

    if (argument1.length > 50 || argument2.length > 50) {
      return { valid: false, error: 'Arguments must be ≤50 characters' }
    }

    return { valid: true }
  },

  apply(text: string, argument1: string, argument2: string) {
    // Use a temporary placeholder to avoid double-swapping
    const placeholder = `__SWAP_${Math.random().toString(36).slice(2)}__`
    return text
      .split(argument1).join(placeholder)
      .split(argument2).join(argument1)
      .split(placeholder).join(argument2)
  },

  inverse(text: string, argument1: string, argument2: string) {
    // Swap is symmetric, so inverse is the same operation
    return swapWord.apply(text, argument1, argument2)
  },
}

// ---------------------------------------------------------------------------
// Block Type: shift-number
// ---------------------------------------------------------------------------

const shiftNumber: CipherBlockType = {
  name: 'shift-number',
  description: 'Shifts all numbers by a fixed amount (Caesar shift for digits)',

  validate(argument1: string, argument2: string) {
    const shift = Number.parseInt(argument1, 10)
    if (Number.isNaN(shift)) {
      return { valid: false, error: 'arg1 must be a valid integer' }
    }

    if (Math.abs(shift) > 10_000) {
      return { valid: false, error: 'Shift must be between -10000 and 10000' }
    }

    return { valid: true }
  },

  apply(text: string, argument1: string, argument2: string) {
    const shift = Number.parseInt(argument1, 10)
    const numbers = extractNumbers(text)
    const replacements = new Map<number, string>()

    for (const number_ of numbers) {
      const value = Number.parseInt(number_.value, 10)
      replacements.set(number_.start, String(value + shift))
    }

    return replaceNumbers(text, replacements)
  },

  inverse(text: string, argument1: string, argument2: string) {
    const shift = Number.parseInt(argument1, 10)
    return shiftNumber.apply(text, String(-shift), argument2)
  },
}

// ---------------------------------------------------------------------------
// Block Type: reverse-string
// ---------------------------------------------------------------------------

const reverseString: CipherBlockType = {
  name: 'reverse-string',
  description: 'Reverses the entire string',

  validate(argument1: string, argument2: string) {
    return { valid: true }
  },

  apply(text: string, argument1: string, argument2: string) {
    return text.split('').reverse().join('')
  },

  inverse(text: string, argument1: string, argument2: string) {
    // Reverse is self-inverse
    return text.split('').reverse().join('')
  },
}

// ---------------------------------------------------------------------------
// Block Type: substitute-char
// ---------------------------------------------------------------------------

const substituteChar: CipherBlockType = {
  name: 'substitute-char',
  description: 'Replaces all occurrences of one character with another',

  validate(argument1: string, argument2: string) {
    if (argument1.length !== 1 || argument2.length !== 1) {
      return { valid: false, error: 'Both arguments must be single characters' }
    }

    if (argument1 === argument2) {
      return { valid: false, error: 'Characters must be different' }
    }

    return { valid: true }
  },

  apply(text: string, argument1: string, argument2: string) {
    return text.split(argument1).join(argument2)
  },

  inverse(text: string, argument1: string, argument2: string) {
    // Swap back: arg2 → arg1
    return text.split(argument2).join(argument1)
  },
}

// ---------------------------------------------------------------------------
// Block Type: insert-noise
// ---------------------------------------------------------------------------

const insertNoise: CipherBlockType = {
  name: 'insert-noise',
  description: 'Inserts a noise string at a specific position',

  validate(argument1: string, argument2: string) {
    if (!argument1) {
      return { valid: false, error: 'arg1 (noise string) is required' }
    }

    if (argument1.length > 50) {
      return { valid: false, error: 'Noise string must be ≤50 characters' }
    }

    const position = Number.parseInt(argument2, 10)
    if (Number.isNaN(position) || position < 0) {
      return { valid: false, error: 'arg2 must be a non-negative integer (position)' }
    }

    return { valid: true }
  },

  apply(text: string, argument1: string, argument2: string) {
    const position = Number.parseInt(argument2, 10)
    const insertAt = Math.min(position, text.length)
    return text.slice(0, insertAt) + argument1 + text.slice(insertAt)
  },

  inverse(text: string, argument1: string, argument2: string) {
    const position = Number.parseInt(argument2, 10)
    const insertAt = Math.min(position, text.length)
    const noiseLength = argument1.length

    // Remove the noise that was inserted
    if (text.slice(insertAt, insertAt + noiseLength) === argument1) {
      return text.slice(0, insertAt) + text.slice(insertAt + noiseLength)
    }

    // If noise not found at expected position, return as-is (decryption failed)
    return text
  },
}

// ---------------------------------------------------------------------------
// Block Type: case-transform
// ---------------------------------------------------------------------------

const caseTransform: CipherBlockType = {
  name: 'case-transform',
  description: 'Transforms character case',

  validate(argument1: string, argument2: string) {
    const validModes = ['upper', 'lower', 'toggle']
    if (!validModes.includes(argument1.toLowerCase())) {
      return { valid: false, error: 'arg1 must be "upper", "lower", or "toggle"' }
    }

    return { valid: true }
  },

  apply(text: string, argument1: string, argument2: string) {
    const mode = argument1.toLowerCase()

    switch (mode) {
      case 'upper': {
        return text.toUpperCase()
      }

      case 'lower': {
        return text.toLowerCase()
      }

      case 'toggle': {
        return text.split('').map((char) => {
          if (char === char.toUpperCase()) {
            return char.toLowerCase()
          }

          return char.toUpperCase()
        }).join('')
      }

      default: {
        return text
      }
    }
  },

  inverse(text: string, argument1: string, argument2: string) {
    const mode = argument1.toLowerCase()

    // For upper/lower, we can't truly reverse without knowing original case
    // This is a lossy transformation. For toggle, it's self-inverse.
    switch (mode) {
      case 'upper': {
        return text.toLowerCase()
      } // Assumption: original was lowercase

      case 'lower': {
        return text.toUpperCase()
      } // Assumption: original was uppercase

      case 'toggle': {
        return caseTransform.apply(text, argument1, argument2)
      } // Self-inverse

      default: {
        return text
      }
    }
  },
}

// ---------------------------------------------------------------------------
// Block Type: rotate-words
// ---------------------------------------------------------------------------

const rotateWords: CipherBlockType = {
  name: 'rotate-words',
  description: 'Rotates word positions by N positions',

  validate(argument1: string, argument2: string) {
    const rotate = Number.parseInt(argument1, 10)
    if (Number.isNaN(rotate)) {
      return { valid: false, error: 'arg1 must be an integer (rotation amount)' }
    }

    if (Math.abs(rotate) > 100) {
      return { valid: false, error: 'Rotation must be between -100 and 100' }
    }

    return { valid: true }
  },

  apply(text: string, argument1: string, argument2: string) {
    const rotate = Number.parseInt(argument1, 10)
    const words = text.split(/\s+/)

    if (words.length === 0) {
      return text
    }

    // Normalize rotation to positive range
    const normalizedRotate = ((rotate % words.length) + words.length) % words.length

    // Rotate: take last N items and move to front
    const rotated = [
      ...words.slice(-normalizedRotate),
      ...words.slice(0, -normalizedRotate || words.length),
    ]

    return rotated.join(' ')
  },

  inverse(text: string, argument1: string, argument2: string) {
    const rotate = Number.parseInt(argument1, 10)
    return rotateWords.apply(text, String(-rotate), argument2)
  },
}

// ---------------------------------------------------------------------------
// Block Type: multiply-number
// ---------------------------------------------------------------------------

const multiplyNumber: CipherBlockType = {
  name: 'multiply-number',
  description: 'Multiplies all numbers by a factor',

  validate(argument1: string, argument2: string) {
    const multiplier = Number.parseInt(argument1, 10)
    if (Number.isNaN(multiplier)) {
      return { valid: false, error: 'arg1 must be a valid integer' }
    }

    if (multiplier === 0) {
      return { valid: false, error: 'Multiplier cannot be 0 (not invertible)' }
    }

    if (Math.abs(multiplier) > 1000) {
      return { valid: false, error: 'Multiplier must be between -1000 and 1000' }
    }

    return { valid: true }
  },

  apply(text: string, argument1: string, argument2: string) {
    const multiplier = Number.parseInt(argument1, 10)
    const numbers = extractNumbers(text)
    const replacements = new Map<number, string>()

    for (const number_ of numbers) {
      const value = Number.parseInt(number_.value, 10)
      replacements.set(number_.start, String(value * multiplier))
    }

    return replaceNumbers(text, replacements)
  },

  inverse(text: string, argument1: string, argument2: string) {
    const multiplier = Number.parseInt(argument1, 10)
    const numbers = extractNumbers(text)
    const replacements = new Map<number, string>()

    for (const number_ of numbers) {
      const value = Number.parseInt(number_.value, 10)
      // Integer division - may lose precision!
      replacements.set(number_.start, String(Math.floor(value / multiplier)))
    }

    return replaceNumbers(text, replacements)
  },
}

// ---------------------------------------------------------------------------
// Block Type: digit-shuffle
// ---------------------------------------------------------------------------

const digitShuffle: CipherBlockType = {
  name: 'digit-shuffle',
  description: 'Shuffles digits within each number using a seed',

  validate(argument1: string, argument2: string) {
    if (!argument1 || argument1.length === 0) {
      return { valid: false, error: 'arg1 (seed) is required' }
    }

    if (argument1.length > 20) {
      return { valid: false, error: 'Seed must be ≤20 characters' }
    }

    return { valid: true }
  },

  apply(text: string, argument1: string, argument2: string) {
    const numbers = extractNumbers(text)
    const replacements = new Map<number, string>()

    // Simple seeded random using seed string
    function seededRandom(seed: string, index: number): number {
      let hash = 0
      const combined = seed + index
      for (let index_ = 0; index_ < combined.length; index_++) {
        hash = ((hash << 5) - hash) + combined.charCodeAt(index_)
        hash &= hash
      }

      return Math.abs(hash)
    }

    for (const [index, number_] of numbers.entries()) {
      const digits = number_.value.split('')
      const sign = digits[0] === '-' ? '-' : ''
      const numberDigits = digits[0] === '-' ? digits.slice(1) : digits

      // Fisher-Yates shuffle with seeded random
      const shuffled = [...numberDigits]
      for (let index_ = shuffled.length - 1; index_ > 0; index_--) {
        const randomIndex = seededRandom(argument1, index * 1000 + index_) % (index_ + 1);
        [shuffled[index_], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index_]]
      }

      replacements.set(number_.start, sign + shuffled.join(''))
    }

    return replaceNumbers(text, replacements)
  },

  inverse(text: string, argument1: string, argument2: string) {
    // To properly invert, we need to track the shuffle permutation
    // This is complex; for now, return a warning that this is lossy
    // In a real implementation, you'd need to store the permutation order

    // For demonstration, we'll just return the text as-is
    // A proper implementation would require storing shuffle indices
    return text + ' [UNSHUFFLE_FAILED]'
  },
}

// ---------------------------------------------------------------------------
// Block Type: remove-spaces
// ---------------------------------------------------------------------------

const removeSpaces: CipherBlockType = {
  name: 'remove-spaces',
  description: 'Removes all whitespace characters',

  validate(argument1: string, argument2: string) {
    return { valid: true }
  },

  apply(text: string, argument1: string, argument2: string) {
    return text.replaceAll(/\s+/g, '')
  },

  inverse(text: string, argument1: string, argument2: string) {
    // Heuristic: add space before uppercase letters and between letter-number boundaries
    // This is lossy - can't perfectly reconstruct original spacing
    return text
      .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
      .replaceAll(/([a-zA-Z])(\d)/g, '$1 $2')
      .replaceAll(/(\d)([a-zA-Z])/g, '$1 $2')
  },
}

// ---------------------------------------------------------------------------
// Block Registry
// ---------------------------------------------------------------------------

export const BLOCK_REGISTRY: Record<string, CipherBlockType> = {
  'swap-word': swapWord,
  'shift-number': shiftNumber,
  'reverse-string': reverseString,
  'substitute-char': substituteChar,
  'insert-noise': insertNoise,
  'case-transform': caseTransform,
  'rotate-words': rotateWords,
  'multiply-number': multiplyNumber,
  'digit-shuffle': digitShuffle,
  'remove-spaces': removeSpaces,
}

export const BLOCK_TYPES = Object.keys(BLOCK_REGISTRY)
