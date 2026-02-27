import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useSocketStore } from '../stores/socket-store'
import { useRoomStore } from '../stores/room-store'
import { useGameState } from '../hooks/useGameState'
import type { GamePhase } from '../lib/socket-message-validator'
import Squares from '../components/scrolling-bg'

// Shared phase views
import WaitingRoom from './game/waiting'
import AllConnectedPage from './game/shared/all-connected'
import TossPage from './game/toss'
import RoundResolutionPage from './game/shared/round-resolution'
import RoundResultPage from './game/shared/round-result'
import PostRoundPage from './game/shared/post-round'
import GameOverPage from './game/shared/game-over'

// Controller views
import CipherPage from './game/cipher'
import SubmitCommandPage from './game/controller/submit-command'
import WaitingForGuessPage from './game/controller/waiting-for-guess'

// Sabotager views
import WaitingForCipherPage from './game/sabotager/waiting-for-cipher'
import WaitingForCommandPage from './game/sabotager/waiting-for-command'
import SubmitGuessPage from './game/sabotager/submit-guess'

function PhaseView({ phase, role }: { phase: GamePhase, role: 'controller' | 'sabotager' | undefined }) {
  switch (phase) {
    case 'WAITING_FOR_PLAYERS': {
      return <WaitingRoom />
    }

    case 'ALL_PLAYERS_CONNECTED': {
      return <AllConnectedPage />
    }

    case 'COIN_TOSSING':
    case 'COIN_TOSSED': {
      return <TossPage />
    }

    case 'PRE_TURN': {
      if (!role) {
        return <div>Loading role…</div>
      }

      return role === 'controller' ? <CipherPage /> : <WaitingForCipherPage />
    }

    case 'CHALL_CONTROL': {
      if (!role) {
        return <div>Loading role…</div>
      }

      return role === 'controller' ? <SubmitCommandPage /> : <WaitingForCommandPage />
    }

    case 'CHALL_SABOTAGE': {
      if (!role) {
        return <div>Loading role…</div>
      }

      return role === 'controller' ? <WaitingForGuessPage /> : <SubmitGuessPage />
    }

    case 'SUBROUND_RESOLUTION': {
      return <RoundResolutionPage />
    }

    case 'TURN_END': {
      return <RoundResultPage />
    }

    case 'POST_TURN': {
      return <PostRoundPage />
    }

    case 'GAME_OVER': {
      return <GameOverPage />
    }

    default: {
      return <div>Unknown phase</div>
    }
  }
}

export function GameLayout() {
  const navigate = useNavigate()
  const { connect, disconnect, requiresJoin, status } = useSocketStore()
  const roomCode = useRoomStore(state => state.roomCode)
  const playerSecret = useRoomStore(state => state.playerSecret)
  const phase = useGameState(s => s.phase)
  const role = useGameState(s => s.role)
  const isHydrated = useGameState(s => s.isHydrated)

  useEffect(() => {
    if (!roomCode || !playerSecret) {
      console.warn('[GameLayout] Missing room auth, redirecting to /join')
      navigate({ to: '/join' }).catch(console.error)
      return
    }

    console.log('[GameLayout] Credentials ready, connecting socket')
    connect()

    return () => {
      console.log('[GameLayout] Component unmounting (socket stays alive)')
    }
  }, [connect, navigate, playerSecret, roomCode])

  useEffect(() => {
    if (!requiresJoin) {
      return
    }

    console.warn('[GameLayout] Missing or invalid auth, redirecting to /join')
    navigate({ to: '/join' }).catch(console.error)
  }, [requiresJoin, navigate])

  // Return to lobby when game is over and player explicitly chose to leave
  // (GameOverPage calls disconnect() which sets status to 'disconnected')
  useEffect(() => {
    if (status === 'disconnected' && !roomCode) {
      navigate({ to: '/join' }).catch(console.error)
    }
  }, [status, roomCode, navigate])

  if (status === 'connecting' && !isHydrated) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#0a0a0a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"JetBrains Mono Variable", monospace', color: 'rgba(194,214,133,0.6)',
        fontSize: '0.85rem', letterSpacing: '0.2em', textTransform: 'uppercase',
      }}
      >
        Connecting
        <span style={{ marginLeft: '4px' }}>…</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#0a0a0a',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem',
        fontFamily: '"JetBrains Mono Variable", monospace',
      }}
      >
        <p style={{
          color: '#723435', fontSize: '0.9rem', letterSpacing: '0.2em', textTransform: 'uppercase',
        }}
        >
          Connection error. Please try again.
        </p>
        <button
          onClick={() => {
            navigate({ to: '/join' }).catch(console.error)
          }}
          style={{
            fontFamily: 'inherit', fontSize: '0.9rem', letterSpacing: '0.2em', textTransform: 'uppercase',
            padding: '0.8rem 2.5rem', background: 'transparent',
            border: '2px solid #C2D685', color: '#C2D685', cursor: 'pointer',
          }}
        >
          Back to Lobby
        </button>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a' }}>
      {/* Shared scrolling background behind all game phases */}
      <Squares
        speed={0.15}
        squareSize={35}
        direction='up'
        borderColor='#4848483a'
        bgColor='rgba(10, 10, 10, 1)'
        hoverFillColor='#1a1a1a'
      />
      <AnimatePresence mode='wait'>
        <motion.div
          key={phase}
          initial={{ opacity: 0, filter: 'brightness(2.5) saturate(0)' }}
          animate={{ opacity: 1, filter: 'brightness(1) saturate(1)' }}
          exit={{ opacity: 0, filter: 'brightness(0.3) saturate(0)', x: -8 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <PhaseView phase={phase} role={role} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
