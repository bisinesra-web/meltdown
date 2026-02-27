/**
 * Socket action utilities.
 *
 * Components should call these functions instead of emitting socket events
 * directly. This keeps socket coupling out of UI code.
 */
import { getSocketInstance } from '../stores/socket-store'
import type { Cipher } from './cipher-validator'

/**
 * PRE_ROUND — controller selects their cipher.
 */
export function selectCipher(cipher: Cipher): void {
  getSocketInstance().emit('game:select_cipher', cipher)
}

/**
 * CHALL_CONTROL — controller submits their reactor command.
 * Format: "Component type attribute value"
 */
export function submitCommand(command: string): void {
  getSocketInstance().emit('game:submit_command', { command })
}

/**
 * CHALL_SABOTAGE — sabotager guesses the original command.
 * Format: "Component type attribute value"
 */
export function submitGuess(guess: string): void {
  getSocketInstance().emit('game:submit_guess', { guess })
}

/**
 * POST_ROUND — either player signals readiness for the next round.
 */
export function playerReady(): void {
  getSocketInstance().emit('game:player_ready')
}
