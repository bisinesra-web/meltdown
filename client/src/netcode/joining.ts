import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useRoomStore } from '../stores/room-store'

const API_BASE = import.meta.env.VITE_API_BASE as string

// --- Zod Schemas ---

export const TeamNamesSchema = z.object({
  player1: z.string(),
  player2: z.string(),
})

export type TeamNames = z.infer<typeof TeamNamesSchema>

export const JoinResponseSchema = z.object({
  secret: z.string(),
})

export type JoinResponse = z.infer<typeof JoinResponseSchema>

// --- API Functions ---

async function apiFetch(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(errorData.error ?? `HTTP error! status: ${String(response.status)}`)
  }

  return response.json()
}

// --- Hooks ---

/**
 * Fetches the team names for a given room code and stores them in the room store.
 * Returns a mutation; call `mutate(roomCode)` to trigger.
 */
export const useFetchTeamNames = () => {
  const setRoom = useRoomStore(state => state.setRoom)

  return useMutation({
    async mutationFn(roomCode: string): Promise<TeamNames & { roomCode: string }> {
      const data = await apiFetch('/game/teamnames', { roomCode })
      const parsed = TeamNamesSchema.parse(data)
      return { ...parsed, roomCode }
    },
    onSuccess({ roomCode, player1, player2 }) {
      setRoom(roomCode, player1, player2)
    },
  })
}

interface JoinMutationParameters { roomCode: string, teamName: string }

/**
 * Joins as a specific team in a room and stores the secret in the room store.
 * Returns a mutation; call `mutate({ roomCode, teamName })` to trigger.
 */
export const useJoinTeam = () => {
  const setPlayerSecret = useRoomStore(state => state.setPlayerSecret)
  const player1Name = useRoomStore(state => state.player1Name)

  return useMutation({
    async mutationFn({ roomCode, teamName }: JoinMutationParameters): Promise<JoinResponse> {
      const data = await apiFetch('/game/join', { roomCode, teamName })
      return JoinResponseSchema.parse(data)
    },
    onSuccess({ secret }, { teamName }) {
      const playerNumber: 1 | 2 = teamName === player1Name ? 1 : 2
      setPlayerSecret(secret, playerNumber)
    },
  })
}
