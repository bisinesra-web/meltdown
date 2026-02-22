import http from 'node:http'
import express from 'express'
import cors from 'cors'
import { Server } from 'socket.io'
import { initializeDatabase } from './database.js'
import roomsRouter, { getRoomByCode } from './routes/rooms.js'
import gameRouter from './routes/game.js'
import { logger } from './logger.js'

// Extend Socket type to include custom properties
declare module 'socket.io' {
  interface Socket {
    roomId: number
  }
}

await initializeDatabase()
logger.info('Database initialized')

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
app.use('/game', gameRouter)

io.use((socket, next) => {
  const auth = socket.handshake.auth as Record<string, unknown>
  const roomCodeValue = auth.room_code

  if (typeof roomCodeValue !== 'string') {
    logger.warn('Invalid room code provided', { socketId: socket.id })
    next(new Error('Invalid room code'))
    return
  }

  const authenticateSocket = async (): Promise<boolean> => {
    const room = await getRoomByCode(roomCodeValue)
    if (!room) {
      logger.warn('Room not found', { roomCode: roomCodeValue })
      return false
    }

    socket.roomId = room.room_id
    return true
  }

  authenticateSocket()
    .then((isValid) => {
      if (!isValid) {
        logger.warn('Socket authentication failed', { socketId: socket.id })
        next(new Error('Invalid room code'))
        return
      }

      logger.info('Socket authenticated', { socketId: socket.id, roomId: socket.roomId })
      next()
    })
    .catch((error: unknown) => {
      logger.error('Socket auth error', { socketId: socket.id, error })
      next(new Error('Invalid room code'))
    })
})

const port = Number(process.env.PORT ?? 3000)
httpServer.listen(port, () => {
  logger.info(`Server running on port ${port.toString()}`)
})
