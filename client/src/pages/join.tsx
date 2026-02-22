import React, { useState, useRef, useEffect } from 'react'
import '@fontsource-variable/jetbrains-mono'
import { useNavigate } from '@tanstack/react-router'
import Squares from '../components/scrolling-bg'
import { useFetchTeamNames } from '../netcode/joining'
import './join.css'

export default function Join() {
  const [code, setCode] = useState('')
  const [isExiting, setIsExiting] = useState(false)
  const inputReference = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const fetchTeamNames = useFetchTeamNames()

  useEffect(() => {
    // Focus input on mount
    inputReference.current?.focus()
  }, [])

  const handleCodeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.toUpperCase()
    // Only allow alphanumeric characters, max 5
    const filtered = value.replaceAll(/[^A-Z0-9]/gv, '').slice(0, 5)
    setCode(filtered)
    // Clear previous error when the user starts typing again
    if (fetchTeamNames.isError) {
      fetchTeamNames.reset()
    }
  }

  const handleSubmit = () => {
    if (code.length !== 5 || fetchTeamNames.isPending) {
      return
    }

    fetchTeamNames.mutate(code, {
      onSuccess() {
        setIsExiting(true)
        setTimeout(() => {
          navigate({ to: '/team-setup' }).catch(console.error)
        }, 620)
      },
    })
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && code.length === 5) {
      handleSubmit()
    }
  }

  const errorMessage = fetchTeamNames.isError
    ? (fetchTeamNames.error.message.toLowerCase().includes('not found')
        ? 'NO ROOM WITH THAT CODE FOUND'
        : fetchTeamNames.error.message)
    : undefined

  return (
    <>
      <Squares
        speed={0.25}
        squareSize={40}
        direction='up'
        borderColor='#3e3e3e53'
        bgColor='rgba(55, 55, 55, 0.31)'
      />
      <div className={`join-container${isExiting ? ' join-container--exiting' : ''}`}>

        <div className='vignette' />
        {isExiting && <div className='join-blackout' aria-hidden='true' />}

        <header className='join-header'>
          <h1 className='join-title'>MELTDOWN</h1>
        </header>

        <main className='join-main'>
          <div className='join-form'>
            <label className='code-label'>ENTER CODE</label>
            <input
              ref={inputReference}
              type='text'
              className='code-input'
              value={code}
              onChange={handleCodeChange}
              onKeyDown={handleKeyDown}
              maxLength={5}
              disabled={fetchTeamNames.isPending}
            />
            {errorMessage && (
              <p className='join-error'>{errorMessage}</p>
            )}
            <button
              className='btn join-submit-btn'
              onClick={handleSubmit}
              disabled={code.length !== 5 || fetchTeamNames.isPending}
            >
              {fetchTeamNames.isPending ? 'SEARCHING...' : 'JOIN'}
            </button>
          </div>
        </main>
      </div>
    </>
  )
}
