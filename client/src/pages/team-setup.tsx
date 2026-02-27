import React, { useState, useEffect } from 'react'
import '@fontsource-variable/jetbrains-mono'
import { useNavigate } from '@tanstack/react-router'
import Squares from '../components/scrolling-bg'
import { CoolRadioButton } from '../components/cool-radio-button'
import { useRoomStore } from '../stores/room-store'
import { useJoinTeam } from '../netcode/joining'
import './team-setup.css'

export default function TeamSetup() {
  const [selectedTeam, setSelectedTeam] = useState('')
  const navigate = useNavigate()

  const roomCode = useRoomStore(state => state.roomCode)
  const player1Name = useRoomStore(state => state.player1Name)
  const player2Name = useRoomStore(state => state.player2Name)

  const joinTeam = useJoinTeam()

  const hasRoomData = Boolean(roomCode && player1Name && player2Name)

  // Guard: if no room data in store, redirect back to join
  useEffect(() => {
    if (!hasRoomData) {
      navigate({ to: '/join' }).catch(console.error)
    }
  }, [hasRoomData, navigate])

  if (!hasRoomData || !roomCode || !player1Name || !player2Name) {
    return
  }

  const teamOptions = [
    { label: '\u00A0' + player1Name, value: player1Name },
    { label: '\u00A0' + player2Name, value: player2Name },
  ]

  const handleConfirm = async () => {
    if (!selectedTeam || joinTeam.isPending) {
      return
    }

    try {
      await joinTeam.mutateAsync({ roomCode, teamName: selectedTeam })
      navigate({ to: '/game/wait' }).catch(console.error)
    }
    catch {
      // Error is already reflected in joinTeam state.
    }
  }

  const errorMessage = joinTeam.isError
    ? (joinTeam.error.message.toLowerCase().includes('already joined')
        ? `SLOT OCCUPIED — ${selectedTeam} HAS ALREADY JOINED`
        : joinTeam.error.message.toUpperCase())
    : undefined

  return (
    <>
      <Squares
        speed={0.15}
        squareSize={40}
        direction='diagonal'
        borderColor='#3e3e3e53'
        bgColor='rgba(55, 55, 55, 0.31)'
      />
      <div className='team-setup-page'>
        <div className='team-setup-page__vignette' />
        <div className='team-setup-page__entry-overlay' aria-hidden='true' />

        <header className='team-setup-page__header'>
          <h1 className='team-setup-page__title'>MELTDOWN</h1>
        </header>

        <main className='team-setup-page__main'>
          <div className='team-setup-page__card'>
            <div className='team-setup-page__card-corner team-setup-page__card-corner--tl' />
            <div className='team-setup-page__card-corner team-setup-page__card-corner--tr' />
            <div className='team-setup-page__card-corner team-setup-page__card-corner--bl' />
            <div className='team-setup-page__card-corner team-setup-page__card-corner--br' />

            <p className='team-setup-page__room-badge'>
              {'ROOM '}
              <span>{roomCode}</span>
            </p>

            <h2 className='team-setup-page__prompt'>PLEASE SELECT YOUR TEAM</h2>

            <div className='team-setup-page__selector'>
              <CoolRadioButton
                options={teamOptions}
                value={selectedTeam}
                onChange={(value) => {
                  setSelectedTeam(value)
                  if (joinTeam.isError) {
                    joinTeam.reset()
                  }
                }}
                customColor='#C2D685'
                size={90}
                fontSize={2}
                glowIntensity='high'
                idlePulse={true}
                scanlines={true}
                layout='vertical'
              />
            </div>

            {errorMessage && (
              <p className='team-setup-page__error'>{errorMessage}</p>
            )}

            <button
              className='team-setup-page__confirm-btn'
              onClick={() => {
                handleConfirm().catch(console.error)
              }}
              disabled={!selectedTeam || joinTeam.isPending}
            >
              {joinTeam.isPending ? 'AUTHENTICATING...' : 'CONFIRM TEAM'}
            </button>
          </div>
        </main>
      </div>
    </>
  )
}
