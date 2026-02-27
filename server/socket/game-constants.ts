/**
 * Game Constants for Turn/Subround System
 *
 * Centralized configuration for game flow timing, mechanics, and balance values
 */

// ============================================================================
// Game Structure
// ============================================================================

export const MAX_LEVELS = 3
export const TURNS_PER_LEVEL = 2
export const SUBROUNDS_PER_TURN = 3
export const TOTAL_TURNS = MAX_LEVELS * TURNS_PER_LEVEL // = 6

// ============================================================================
// Reactor HP Mechanics
// ============================================================================

export const REACTOR_MAX_HP = 100
export const HP_TICK_PER_SECOND = 1

// Command effectiveness (HP restoration on selection, based on re-use count)
export const EFFECTIVENESS = {
  reuse0: 10, // All 3 components novel → +10 HP
  reuse1: 20, // 1 component seen before → +20 HP
  reuse2to3: 25, // 2–3 components seen before → +25 HP (high risk, high reward)
} as const

// Guess damage tiers (applied when sabotager guesses)
export const GUESS_DAMAGE_TIERS = {
  match4: Infinity, // Exact match (all 4 components) → HP = 0, sabotager wins
  match3: 70, // 3 components match → −70 HP
  match2: 50, // 2 components match → −50 HP
  match1: 30, // 1 component matches → −30 HP
  match0: 0, // No components match → 0 damage
} as const

// Forfeit penalties
export const CONTROLLER_FORFEIT_DAMAGE = 50 // If controller doesn't submit, sabotager gets −50 damage boost

// ============================================================================
// Phase Durations (milliseconds)
// ============================================================================

export const PHASE_DURATIONS = {
  WAITING_FOR_PLAYERS: 0, // No timeout
  ALL_PLAYERS_CONNECTED: 5000,
  COIN_TOSSING: 3000,
  COIN_TOSSED: 10_000,
  PRE_TURN: 60_000,
  CHALL_CONTROL: 30_000,
  CHALL_SABOTAGE: 30_000,
  SUBROUND_RESOLUTION: 5000,
  TURN_END: 10_000,
  POST_TURN: 60_000,
  GAME_OVER: 0, // No timeout
} as const

// ============================================================================
// Command Generation
// ============================================================================

export const COMMAND_COMPONENTS = [
  'waterpipe',
  'valve',
  'reactor',
  'coolant',
  'turbine',
  'pump',
]

export const COMMAND_TYPES = [
  'A',
  'B',
  'C',
  'D',
  'primary',
  'secondary',
]

export const COMMAND_ATTRIBUTES = [
  'pressure',
  'temperature',
  'flow',
  'status',
  'level',
]

export const COMMAND_VALUES = [
  '+50',
  '-20',
  '+100',
  '-5',
  '+75',
  '0',
]

// ============================================================================
// Scoring
// ============================================================================

export const POINTS_PER_TURN_WIN = 1
export const MAX_GAME_SCORE = TOTAL_TURNS // 6 points possible
