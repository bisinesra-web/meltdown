import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import { database } from '../database.js'

interface RoomRow {
  room_id: number
  room_code: string
  created_at: string
  updated_at: string
  player_1: string | null
  player_2: string | null
  room_state: string | null
}

// eslint-disable-next-line new-cap
const router = express.Router()

const HARDCODED_PASSPHRASE = 'reactor-secret-2026'

const authMiddleware = (
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  const authHeader = request.headers.authorization
  if (!authHeader || authHeader !== `Bearer ${HARDCODED_PASSPHRASE}`) {
    response.status(401).json({ error: 'Unauthorized' })
    return
  }

  next()
}

const generateRoomCode = () => Math.random().toString(36).slice(2, 7).toUpperCase()

router.post('/create', authMiddleware, async (_request, response) => {
  try {
    const roomCode = generateRoomCode()
    await database.run(
      'INSERT INTO rooms (room_code) VALUES (?)',
      roomCode,
    )

    const room = await database.get<RoomRow>(
      'SELECT * FROM rooms WHERE room_code = ?',
      roomCode,
    )

    if (!room) {
      response.status(404).json({ error: 'Room not found' })
      return
    }

    response.status(201).json(room)
  }
  catch (error) {
    console.error('Error creating room:', error)
    response.status(500).json({ error: 'Failed to create room' })
  }
})

router.get('/list', authMiddleware, async (_request, response) => {
  try {
    const rooms = await database.all<RoomRow>('SELECT * FROM rooms')
    response.json(rooms)
  }
  catch (error) {
    console.error('Error fetching rooms:', error)
    response.status(500).json({ error: 'Failed to fetch rooms' })
  }
})

router.get('/get/:code', authMiddleware, async (request, response) => {
  const roomCode = request.params.code
  if (typeof roomCode !== 'string') {
    response.status(400).json({ error: 'Invalid room code' })
    return
  }

  try {
    const room = await getRoomByCode(roomCode)

    if (!room) {
      response.status(404).json({ error: 'Room not found' })
      return
    }

    response.json(room)
  }
  catch (error) {
    console.error('Error fetching room:', error)
    response.status(500).json({ error: 'Failed to fetch room' })
  }
})

export async function getRoomByCode(roomCode: string): Promise<RoomRow | undefined> {
  const room = await database.get<RoomRow>(
    'SELECT * FROM rooms WHERE room_code = ?',
    roomCode,
  )

  return room ?? undefined
}

export default router
