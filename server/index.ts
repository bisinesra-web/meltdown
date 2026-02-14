import http from 'node:http'
import express from 'express'
import cors from 'cors'
import { Server } from 'socket.io'
import { initializeDatabase } from './database.js'
import roomsRouter, { getRoomByCode } from './routes/rooms.js'

// Extend Socket type to include custom properties
declare module 'socket.io' {
  interface Socket {
    roomId: number
  }
}

await initializeDatabase()

const app = express()
const httpServer = http.createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
  },
})

// Middleware
app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.use('/rooms', roomsRouter)

io.use((socket, next) => {
  const auth = socket.handshake.auth as Record<string, unknown>
  const roomCodeValue = auth.room_code

  if (typeof roomCodeValue !== 'string') {
    next(new Error('Invalid room code'))
    return
  }

  const authenticateSocket = async (): Promise<boolean> => {
    const room = await getRoomByCode(roomCodeValue)
    if (!room) {
      return false
    }

    socket.roomId = room.room_id
    return true
  }

  authenticateSocket()
    .then((isValid) => {
      if (!isValid) {
        next(new Error('Invalid room code'))
        return
      }

      next()
    })
    .catch((error: unknown) => {
      console.error('Socket auth error:', error)
      next(new Error('Invalid room code'))
    })
})

const port = Number(process.env.PORT ?? 3000)
httpServer.listen(port, () => {
  console.log(`Server running on port ${String(port)}`)
})
