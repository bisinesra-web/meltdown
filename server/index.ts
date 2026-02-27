import http from 'node:http'
import express from 'express'
import cors from 'cors'
import { Server } from 'socket.io'
import { initializeDatabase } from './database.js'
import roomsRouter from './routes/rooms.js'
import gameRouter from './routes/game.js'
import { logger } from './logger.js'
import { createAuthMiddleware, registerGameHandlers } from './socket/game-logic.js'

await initializeDatabase()
logger.info('Database initialized')

const app = express()
const httpServer = http.createServer(app)
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'

const io = new Server(httpServer, {
  cors: {
    origin: clientOrigin,
  },
})

// Middleware
app.use(cors({ origin: clientOrigin }))
app.use(express.json())

app.use('/rooms', roomsRouter)
app.use('/game', gameRouter)

io.use(createAuthMiddleware())
registerGameHandlers(io)

const port = Number(process.env.PORT ?? 3000)
httpServer.listen(port, () => {
  logger.info(`Server running on port ${port.toString()}`)
})
