import { z } from 'zod'

/**
 * Cipher Types and Validation Schemas
 *
 * Defines the structure of cipher objects that players submit
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
// Type Guards
// ---------------------------------------------------------------------------

export function isCipherBlock(value: unknown): value is CipherBlock {
  return CipherBlockSchema.safeParse(value).success
}

export function isCipher(value: unknown): value is Cipher {
  return CipherSchema.safeParse(value).success
}
