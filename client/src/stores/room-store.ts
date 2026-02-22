import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

interface RoomState {
  roomCode: string | undefined
  player1Name: string | undefined
  player2Name: string | undefined
  playerSecret: string | undefined
  playerNumber: 1 | 2 | undefined
  setRoom: (roomCode: string, player1Name: string, player2Name: string) => void
  setPlayerSecret: (secret: string, playerNumber: 1 | 2) => void
  clearRoom: () => void
}

export const useRoomStore = create<RoomState>()(devtools(
  persist(
    immer(set => ({
      roomCode: undefined,
      player1Name: undefined,
      player2Name: undefined,
      playerSecret: undefined,
      playerNumber: undefined,
      setRoom(roomCode, player1Name, player2Name) {
        set((state) => {
          state.roomCode = roomCode
          state.player1Name = player1Name
          state.player2Name = player2Name
          // Clear previous session data when entering a new room
          state.playerSecret = undefined
          state.playerNumber = undefined
        })
      },
      setPlayerSecret(secret, playerNumber) {
        set((state) => {
          state.playerSecret = secret
          state.playerNumber = playerNumber
        })
      },
      clearRoom() {
        set((state) => {
          state.roomCode = undefined
          state.player1Name = undefined
          state.player2Name = undefined
          state.playerSecret = undefined
          state.playerNumber = undefined
        })
      },
    })),
    { name: 'room-store' },
  ),
  { name: 'RoomStore' },
))
