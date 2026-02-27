/**
 * Socket action utilities.
 *
 * Components should call these functions instead of emitting socket events
 * directly. This keeps socket coupling out of UI code.
 */
import { getSocketInstance } from '../stores/socket-store'
import type { Cipher } from './cipher-validator'

/**
 * PRE_TURN — controller selects their cipher.
 */
export function selectCipher(cipher: Cipher): void {
  getSocketInstance().emit('game:select_cipher', cipher)
}

/**
 * CHALL_CONTROL — controller selects one of 3 server-generated command options.
 * The server will restore HP based on the effectiveness tier.
 */
export function selectCommand(commandIndex: 0 | 1 | 2): void {
  getSocketInstance().emit('game:select_command', { commandIndex })
}

/**
 * CHALL_SABOTAGE — sabotager guesses the original command.
 * Format: "Component type attribute value"
 */
export function submitGuess(guess: string): void {
  getSocketInstance().emit('game:submit_guess', { guess })
}

/**
 * POST_TURN — either player signals readiness for the next turn.
 */
export function playerReady(): void {
  getSocketInstance().emit('game:player_ready')
}
