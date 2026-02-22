import express from 'express'
import type { Request, Response } from 'express'
import { database } from '../database.js'
import { RoomRow, generateCode } from './rooms.js'
import { logger } from '../logger.js'

// eslint-disable-next-line new-cap
const router = express.Router()

// POST /game/teamnames
router.post('/teamnames', async (request: Request, response: Response) => {
  try {
    const { roomCode } = request.body as { roomCode?: string }
    if (!roomCode) {
      response.status(400).json({ error: 'roomCode is required' })
      return
    }

    let room: RoomRow | undefined
    try {
      room = await database.get<RoomRow>(
        'SELECT * FROM rooms WHERE room_code = ?',
        roomCode,
      )
    }
    catch (error) {
      logger.error('Error fetching room:', { error })
      response.status(404).json({ error: 'Room not found' })
      return
    }

    if (!room) {
      response.status(404).json({ error: 'Room not found' })
      return
    }

    response.json({
      player1: room.player_1_name,
      player2: room.player_2_name,
    })
  }
  catch (error) {
    logger.error('Error fetching team names:', { error })
    response.status(500).json({ error: 'Internal server error' })
  }
})

// Ask for room code and team name, generate a secret for the team, and return it.
//  The secret will be used to identify the team in future requests.
router.post('/join', async (request: Request, response: Response) => {
  try {
    const { roomCode, teamName } = request.body as { roomCode?: string, teamName?: string }
    if (!roomCode) {
      response.status(400).json({ error: 'roomCode is required' })
      return
    }

    if (!teamName) {
      response.status(400).json({ error: 'teamName is required' })
      return
    }

    let room: RoomRow | undefined
    try {
      room = await database.get<RoomRow>(
        'SELECT * FROM rooms WHERE room_code = ?',
        roomCode,
      )
    }
    catch (error) {
      logger.error('Error fetching room:', { error })
      response.status(404).json({ error: 'Room not found' })
      return
    }

    if (!room) {
      response.status(404).json({ error: 'Room not found' })
      return
    }

    // Determine which player is joining
    let playerNumber: 1 | 2 | undefined
    if (room.player_1_name === teamName) {
      playerNumber = 1
    }
    else if (room.player_2_name === teamName) {
      playerNumber = 2
    }
    else {
      logger.warn('Team name does not match any player', { roomCode, teamName })
      response.status(400).json({ error: 'Team name does not match any player in this room' })
      return
    }

    // Check if team already has a secret
    if (playerNumber === 1 && room.player_1_secret) {
      logger.info('Player 1 already joined', { roomCode, teamName })
      response.status(409).json({ error: 'Player 1 already joined' })
      return
    }

    if (playerNumber === 2 && room.player_2_secret) {
      logger.info('Player 2 already joined', { roomCode, teamName })
      response.status(409).json({ error: 'Player 2 already joined' })
      return
    }

    // Generate a new secret and update the database
    const secret = generateCode(8)
    const updateQuery = playerNumber === 1
      ? 'UPDATE rooms SET player_1_secret = ? WHERE room_code = ?'
      : 'UPDATE rooms SET player_2_secret = ? WHERE room_code = ?'

    await database.run(updateQuery, secret, roomCode)

    logger.info('Player joined successfully', { roomCode, teamName, playerNumber })
    response.json({ secret })
  }
  catch (error) {
    logger.error('Error joining game:', { error })
    response.status(500).json({ error: 'Internal server error' })
  }
})

// GET /game/status/:roomCode/:secret
router.get('/status/:roomCode/:secret', async (request: Request, response: Response) => {
  try {
    const { roomCode, secret } = request.params as { roomCode?: string, secret?: string }
    if (!roomCode || !secret) {
      response.status(400).json({ error: 'roomCode and secret are required' })
      return
    }

    let room: RoomRow | undefined
    try {
      room = await database.get<RoomRow>(
        'SELECT * FROM rooms WHERE room_code = ?',
        roomCode,
      )
    }
    catch (error) {
      logger.error('Error fetching room:', { error })
      response.status(404).json({ error: 'Room not found' })
      return
    }

    if (!room) {
      response.status(404).json({ error: 'Room not found' })
      return
    }

    // Verify the secret matches one of the players
    const playerNumber = room.player_1_secret === secret
      ? 1
      : (room.player_2_secret === secret ? 2 : undefined)
    if (!playerNumber) {
      logger.warn('Invalid secret provided', { roomCode, secret })
      response.status(401).json({ error: 'Invalid secret' })
      return
    }

    response.json({
      roomCode: room.room_code,
      player1: room.player_1_name,
      player2: room.player_2_name,
      roomState: room.room_state,
      yourPlayerNumber: playerNumber,
    })
  }
  catch (error) {
    logger.error('Error fetching game status:', { error })
    response.status(500).json({ error: 'Internal server error' })
  }
})

export default router
