import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useSocketStore } from '../stores/socket-store'
import { useRoomStore } from '../stores/room-store'
import { useGameState } from '../hooks/useGameState'
import type { GamePhase } from '../lib/socket-message-validator'

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

    case 'PRE_ROUND': {
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

    case 'ROUND_RESOLUTION': {
      return <RoundResolutionPage />
    }

    case 'ROUND_WIN_CONTROL':
    case 'ROUND_WIN_SABOTAGE': {
      return <RoundResultPage />
    }

    case 'POST_ROUND': {
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
    return <div style={{ padding: '20px' }}>Connecting…</div>
  }

  if (status === 'error') {
    return (
      <div style={{ padding: '20px' }}>
        <p>Connection error. Please try again.</p>
        <button onClick={() => {
          navigate({ to: '/join' }).catch(console.error)
        }}
        >
          Back to Lobby
        </button>
      </div>
    )
  }

  return <PhaseView phase={phase} role={role} />
}
