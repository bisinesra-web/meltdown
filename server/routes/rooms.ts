import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import { database } from '../database.js'
import { logger } from '../logger.js'

export interface RoomRow {
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
    logger.warn('Unauthorized access attempt', { path: request.path })
    response.status(401).json({ error: 'Unauthorized' })
    return
  }

  next()
}

export const generateCode = (length: number) => {
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
      logger.warn('Missing player names in room creation', { player1, player2 })
      response.status(400).json({ error: 'player1 and player2 names are required' })
      return
    }

    const roomCode = generateCode(5)
    // Generate 8-digit capital alphanumeric secrets

    await database.run(
      `INSERT INTO rooms (
        room_code, 
        player_1_name, 
        player_2_name, 
        player_1_secret, 
        player_2_secret
      ) VALUES (?, ?, ?, NULL, NULL)`,
      roomCode,
      player1,
      player2,
    )

    const room = await database.get<RoomRow>(
      'SELECT * FROM rooms WHERE room_code = ?',
      roomCode,
    )

    if (!room) {
      logger.error('Room not found after creation', { roomCode })
      response.status(404).json({ error: 'Room not found' })
      return
    }

    logger.info('Room created successfully', { roomCode, player1, player2 })
    response.status(201).json(room)
  }
  catch (error) {
    logger.error('Error creating room', { error })
    response.status(500).json({ error: 'Failed to create room' })
  }
})

router.get('/list', authMiddleware, async (_request, response) => {
  try {
    const rooms = await database.all<RoomRow[]>('SELECT * FROM rooms')
    logger.debug('Fetched rooms list', { count: rooms.length })
    response.json(rooms)
  }
  catch (error) {
    logger.error('Error fetching rooms', { error })
    response.status(500).json({ error: 'Failed to fetch rooms' })
  }
})

router.get('/get/:code', authMiddleware, async (request, response) => {
  const roomCode = request.params.code
  if (typeof roomCode !== 'string') {
    logger.warn('Invalid room code format', { roomCode })
    response.status(400).json({ error: 'Invalid room code' })
    return
  }

  try {
    const room = await getRoomByCode(roomCode)

    if (!room) {
      logger.warn('Room not found', { roomCode })
      response.status(404).json({ error: 'Room not found' })
      return
    }

    logger.debug('Room retrieved', { roomCode })
    response.json(room)
  }
  catch (error) {
    logger.error('Error fetching room', { roomCode, error })
    response.status(500).json({ error: 'Failed to fetch room' })
  }
})

router.delete('/delete/:code', authMiddleware, async (request, response) => {
  const roomCode = request.params.code
  if (typeof roomCode !== 'string') {
    logger.warn('Invalid room code format for deletion', { roomCode })
    response.status(400).json({ error: 'Invalid room code' })
    return
  }

  try {
    const result = await database.run(
      'DELETE FROM rooms WHERE room_code = ?',
      roomCode,
    )

    if (result.changes === 0) {
      logger.warn('Room not found for deletion', { roomCode })
      response.status(404).json({ error: 'Room not found' })
      return
    }

    logger.info('Room deleted successfully', { roomCode })
    response.json({ message: 'Room deleted successfully' })
  }
  catch (error) {
    logger.error('Error deleting room', { roomCode, error })
    response.status(500).json({ error: 'Failed to delete room' })
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
