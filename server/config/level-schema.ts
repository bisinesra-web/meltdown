/**
 * Level Configuration Schema
 *
 * Defines the structure for level-based cipher restrictions
 */

export interface BlockRestriction {
  name: string
  maxQuantity: number
}

export interface LevelConfig {
  level: number
  maxBlockLimit: number
  acceptedBlocks: BlockRestriction[]
}

/**
 * Loads level configuration for a specific level number.
 * Returns undefined if level doesn't exist.
 */
export function loadLevelConfig(level: number): LevelConfig | undefined {
  // Import levels dynamically
  // For now, we'll use a hardcoded configuration
  // In production, you'd read from levels.json
  //
  // Mapping: old levels 1, 3, 5 → new levels 1, 2, 3
  // This provides an easy/medium/hard progression

  const configs: LevelConfig[] = [
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
      maxBlockLimit: 6,
      acceptedBlocks: [
        { name: 'swap-word', maxQuantity: 2 },
        { name: 'shift-number', maxQuantity: 2 },
        { name: 'substitute-char', maxQuantity: 1 },
        { name: 'reverse-string', maxQuantity: 1 },
      ],
    },
    {
      level: 3,
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

  return configs.find(c => c.level === level)
}

/**
 * Gets the maximum level available
 */
export function getMaxLevel(): number {
  return 3
}
