import http from 'node:http'
import express from 'express'
import cors from 'cors'
import { Server } from 'socket.io'
import { database, initializeDatabase } from './database.js'

// Extend Socket type to include custom properties
declare module 'socket.io' {
  interface Socket {
    room_id: number
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

// Auth middleware
const HARDCODED_PASSPHRASE = 'reactor-secret-2026'

const authMiddleware = (request: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = request.headers.authorization
  if (!authHeader || authHeader !== `Bearer ${HARDCODED_PASSPHRASE}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  next()
}

// Generate alphanumeric room code of 5 characters
const generateRoomCode = () => Math.random().toString(36).slice(2, 7).toUpperCase()

// POST /rooms - Create a new room
app.post('/rooms', authMiddleware, async (request, res) => {
  try {
    const roomCode = generateRoomCode()
    const result = await database.run(
      'INSERT INTO rooms (room_code) VALUES (?)',
      roomCode,
    )

    const room = await database.get(
      'SELECT * FROM rooms WHERE rowid = ?',
      result.lastID,
    )

    res.status(201).json(room)
  }
  catch (error) {
    console.error('Error creating room:', error)
    res.status(500).json({ error: 'Failed to create room' })
  }
})

io.use(async (socket, next) => {
  const { room_code } = socket.handshake.auth
  const room_row = await database.get('SELECT * FROM rooms WHERE room_code = ?', room_code)
  if (!room_row) {
    next(new Error('Invalid room code')); return
  }

  const { room_id } = room_row

  socket.room_id = room_id
  next()
})

const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
