/* eslint-disable camelcase */
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAdminStore } from '../stores/admin-store'

// --- Zod Schemas ---

export const RoomSchema = z.object({
  room_id: z.number(),
  room_code: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  player_1_name: z.string(),
  player_2_name: z.string(),
  player_1_secret: z.string().nullable().optional(),
  player_2_secret: z.string().nullable().optional(),
  room_state: z.string().nullable(),
})

export const RoomListSchema = z.array(RoomSchema)

export type Room = z.infer<typeof RoomSchema>

// --- API Functions ---

const API_BASE = 'http://localhost:3000' // Assuming this based on server/index.ts

async function fetchWithAuth(url: string, method = 'GET', body?: unknown): Promise<unknown> {
  const { token } = useAdminStore.getState()

  if (!token) {
    throw new Error('Authentication token missing')
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }

  const response = await fetch(`${API_BASE}${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(errorData.error ?? `HTTP error! status: ${String(response.status)}`)
  }

  return response.json()
}

// --- Hooks ---

export const useListRooms = () => useQuery({
  queryKey: ['rooms'],
  async queryFn() {
    const data = await fetchWithAuth('/rooms/list')
    return RoomListSchema.parse(data)
  },
  enabled: Boolean(useAdminStore.getState().token), // Only run if token exists
})

export const useCreateRoom = () => {
  const queryClient = useQueryClient()
  return useMutation({
    async mutationFn(parameters: { player1: string, player2: string }) {
      const data = await fetchWithAuth('/rooms/create', 'POST', parameters)
      return RoomSchema.parse(data)
    },
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export const useGetRoom = () => useMutation({
  async mutationFn(code: string) {
    const data = await fetchWithAuth(`/rooms/get/${code}`)
    return RoomSchema.parse(data)
  },
})

export const useDeleteRoom = () => {
  const queryClient = useQueryClient()
  return useMutation({
    async mutationFn(code: string) {
      await fetchWithAuth(`/rooms/delete/${code}`, 'DELETE')
    },
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}
