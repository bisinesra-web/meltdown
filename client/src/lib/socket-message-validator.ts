import { z } from 'zod'
import { CipherSchema } from './cipher-validator.js'

// ---------------------------------------------------------------------------
// Zod schemas mirroring server/socket/game-types.ts
// ---------------------------------------------------------------------------

export const GamePhaseSchema = z.enum([
  'WAITING_FOR_PLAYERS',
  'ALL_PLAYERS_CONNECTED',
  'COIN_TOSSING',
  'COIN_TOSSED',
  'PRE_TURN',
  'CHALL_CONTROL',
  'CHALL_SABOTAGE',
  'SUBROUND_RESOLUTION',
  'TURN_END',
  'POST_TURN',
  'GAME_OVER',
])

export type GamePhase = z.infer<typeof GamePhaseSchema>

/**
 * Schema for public game state broadcast to all clients in a room.
 */
export const PublicStateSchema = z.object({
  phase: GamePhaseSchema,
  phaseEnteredAt: z.string(),
  currentLevel: z.number(),
  currentTurn: z.union([z.literal(1), z.literal(2)]),
  currentSubround: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  turnNumber: z.number(),
  scores: z.object({
    player1: z.number(),
    player2: z.number(),
  }),
  player1Name: z.string(),
  player2Name: z.string(),
  coinTossWinner: z.union([z.literal(1), z.literal(2)]).optional(),
  controller: z.union([z.literal(1), z.literal(2)]).optional(),
  sabotager: z.union([z.literal(1), z.literal(2)]).optional(),
  player1Ready: z.boolean(),
  player2Ready: z.boolean(),
  turnWinner: z.union([z.literal(1), z.literal(2)]).optional(),
  gameWinner: z.union([z.literal(1), z.literal(2), z.literal('draw')]).optional(),
  cipherSelected: z.boolean(),
  reactorHP: z.number(),
  commandOptions: z.array(z.string()).optional(),
  encryptedCommand: z.string().optional(),
  controllerCommand: z.string().nullable().optional(),
  sabotagerGuess: z.string().nullable().optional(),
  plaintextCiphertextPairs: z.array(z.object({
    plaintext: z.string(),
    ciphertext: z.string(),
  })),
})

export type PublicState = z.infer<typeof PublicStateSchema>

/**
 * Schema for private state sent to individual players.
 */
export const PrivateStateSchema = z.object({
  playerNumber: z.union([z.literal(1), z.literal(2)]),
  role: z.enum(['controller', 'sabotager']).optional(),
  cipher: CipherSchema.optional(),
  cipherSelected: z.boolean().optional(),
  commandOptions: z.array(z.string()).optional(),
  commandEffectiveness: z.array(z.number()).optional(),
  selectedCommandIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.null()]).optional(),
  controllerCommand: z.string().nullable().optional(),
  sabotagerGuess: z.string().nullable().optional(),
  plaintextCiphertextPairs: z.array(z.object({
    plaintext: z.string(),
    ciphertext: z.string(),
  })).optional(),
})

export type PrivateState = z.infer<typeof PrivateStateSchema>

/**
 * Schema for game state events that contain public and/or private data.
 */
export const GameStateEventSchema = z.object({
  public: PublicStateSchema.optional(),
  private: PrivateStateSchema.optional(),
})

export type GameStateEvent = z.infer<typeof GameStateEventSchema>

/**
 * Schema for game error messages sent over the socket.
 */
export const GameErrorEventSchema = z.object({
  message: z.string(),
})

export type GameErrorEvent = z.infer<typeof GameErrorEventSchema>

/**
 * Parse and validate incoming socket data.
 * Returns the validated data or throws a ZodError if validation fails.
 */
export function parseSocketMessage<T>(schema: z.ZodType<T>, data: unknown): T {
  return schema.parse(data)
}

/**
 * Parse and validate incoming socket data safely.
 * Returns either a success result with validated data or an error result.
 */
export function safeParseSocketMessage<T>(
  schema: z.ZodType<T>,
  data: unknown,
): { success: true, data: T } | { success: false, error: z.ZodError } {
  const result = schema.safeParse(data)
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: result.error }
}
