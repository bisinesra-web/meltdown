import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

interface AdminState {
  token: string | undefined
  setToken: (token: string | undefined) => void
}

export const useAdminStore = create<AdminState>()(devtools(
  persist(
    immer(set => ({
      token: undefined,
      setToken(token) {
        set((state) => {
          state.token = token
        })
      },
    })),
    { name: 'admin-store' }, // Persisted key in localStorage
  ),
  { name: 'AdminStore' }, // Devtools store name
))
