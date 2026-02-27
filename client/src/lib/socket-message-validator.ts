import { z } from 'zod'
import { CipherSchema } from './cipher-validator.js'

// ---------------------------------------------------------------------------
// Zod schemas mirroring server/socket/game-types.ts
// ---------------------------------------------------------------------------

export const GamePhaseSchema = z.enum([
  'WAITING_FOR_PLAYERS',
  'COIN_TOSSING',
  'COIN_TOSSED',
  'PRE_ROUND',
  'IN_ROUND',
  'POST_ROUND',
  'GAME_OVER',
])

export type GamePhase = z.infer<typeof GamePhaseSchema>

/**
 * Schema for public game state broadcast to all clients in a room.
 */
export const PublicStateSchema = z.object({
  phase: GamePhaseSchema,
  phaseEnteredAt: z.string(),
  roundNumber: z.number(),
  scores: z.object({
    player1: z.number(),
    player2: z.number(),
  }),
  player1Name: z.string(),
  player2Name: z.string(),
  coinTossWinner: z.union([z.literal(1), z.literal(2)]).optional(),
  player1Ready: z.boolean(),
  player2Ready: z.boolean(),
  roundWinner: z.union([z.literal(1), z.literal(2), z.literal('draw')]).optional(),
  gameWinner: z.union([z.literal(1), z.literal(2)]).optional(),
  // IN_ROUND public data
  reactorHealth: z.number().optional(),
  droppedCommandCount: z.number().optional(),
  crackedCount: z.object({
    player1: z.number(),
    player2: z.number(),
  }).optional(),
  roundStartedAt: z.string().optional(),
  level: z.number().optional(),
})

export type PublicState = z.infer<typeof PublicStateSchema>

/**
 * Schema for private state sent to individual players.
 */
export const PrivateStateSchema = z.object({
  playerNumber: z.union([z.literal(1), z.literal(2)]),
  cipher: CipherSchema.optional(),
  myCommands: z.array(z.object({
    id: z.string(),
    text: z.string(),
    cracked: z.boolean(),
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
