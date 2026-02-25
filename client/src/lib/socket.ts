import { io, Socket } from 'socket.io-client'

let socket: Socket | undefined

export function getSocket(): Socket {
  if (!socket) {
    const socketUrl = import.meta.env.VITE_SOCKET_URL as string || 'http://localhost:3000'
    console.log('[Socket] Initializing Socket.IO connection to:', socketUrl)

    socket = io(socketUrl, {
      autoConnect: false,
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    })
  }

  return socket
}

export function destroySocket() {
  console.log('[Socket] Destroying socket connection')
  socket?.disconnect()
  socket = undefined
}
