import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import { database } from '../database.js'

interface RoomRow {
  room_id: number
  room_code: string
  created_at: string
  updated_at: string
  player_1_name: string
  player_2_name: string
  player_1_secret: string | null
  player_2_secret: string | null
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

const generateCode = (length: number) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let index = 0; index < length; index++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return result
}

router.post('/create', authMiddleware, async (request, response) => {
  try {
    const { player1, player2 } = request.body as { player1?: string, player2?: string }

    if (!player1 || !player2) {
      response.status(400).json({ error: 'player1 and player2 names are required' })
      return
    }

    const roomCode = generateCode(5)
    // Generate 8-digit capital alphanumeric secrets
    const p1Secret = generateCode(8)
    const p2Secret = generateCode(8)

    await database.run(
      `INSERT INTO rooms (
        room_code, 
        player_1_name, 
        player_2_name, 
        player_1_secret, 
        player_2_secret
      ) VALUES (?, ?, ?, ?, ?)`,
      roomCode,
      player1,
      player2,
      p1Secret,
      p2Secret,
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
