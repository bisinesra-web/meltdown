import React, {
  useEffect, useRef, useState, useCallback,
} from 'react'
import {
  BoxGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three'
import { gsap } from 'gsap'
import '@fontsource-variable/jetbrains-mono'

import Squares from '../../components/scrolling-bg'
import HexScramble from '../../components/hex-scramble'
import { useCrtGlitch } from '../../hooks/useCrtGlitch'
import { useGameState } from '../../hooks/useGameState'
import './toss.css'

// ---------------------------------------------------------------------------
// Drifting background hex stream items (purely decorative)
// ---------------------------------------------------------------------------
const STREAM_LINES = Array.from({ length: 7 }, (_, index) => ({
  id: index,
  top: `${10 + index * 12}%`,
  duration: `${7 + index * 1.4}s`,
  delay: `${index * 0.9}s`,
  text: Array.from({ length: 42 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()).join(' '),
}))

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function TossPage() {
  /* ── Three.js refs ── */
  const cubeWrapReference = useRef<HTMLDivElement>(null) // Container for cube during arena phase
  const cubeResultReference = useRef<HTMLDivElement>(null) // Container for cube during result phase
  const mountedContainerReference = useRef<HTMLDivElement | null>(null)
  const rendererReference = useRef<WebGLRenderer | null>(null)
  const cubeReference = useRef<LineSegments | null>(null)
  const spinSpeedReference = useRef({ value: 0.006 })
  const animFrameReference = useRef<number>(0)
  const threeInitReference = useRef(false)
  const sceneReference = useRef<Scene | null>(null)
  const cameraReference = useRef<PerspectiveCamera | null>(null)

  /* ── Game state ── */
  const phase = useGameState(s => s.phase)
  const coinTossWinner = useGameState(s => s.coinTossWinner)
  const playerNumber = useGameState(s => s.playerNumber)
  const player1Name = useGameState(s => s.player1Name)
  const player2Name = useGameState(s => s.player2Name)

  /* ── Derived ── */
  const myName = playerNumber === 1 ? player1Name : player2Name
  const opponentName = playerNumber === 1 ? player2Name : player1Name
  const isController: boolean | null
    = coinTossWinner !== undefined && playerNumber !== undefined
      ? coinTossWinner === playerNumber
      : null

  /* ── UI state ── */
  const [revealStage, setRevealStage] = useState<'idle' | 'cinematic' | 'revealed'>('idle')
  const [isScrambling, setIsScrambling] = useState(false)
  const [statusText, setStatusText] = useState('AWAITING PROTOCOL INITIALIZATION...')
  const [fastRing, setFastRing] = useState(false)

  const isGlitching = useCrtGlitch(8000, 14_000, 280)

  // ── Move renderer canvas between parent containers ──────────────────────
  const attachRenderer = useCallback((container: HTMLDivElement | null) => {
    if (!container || !rendererReference.current) {
      return
    }

    const canvas = rendererReference.current.domElement
    if (canvas.parentElement !== container) {
      container.append(canvas)
    }

    mountedContainerReference.current = container
    const size = Math.min(container.clientWidth, container.clientHeight)
    rendererReference.current.setSize(size, size)
    if (cameraReference.current) {
      cameraReference.current.aspect = 1
      cameraReference.current.updateProjectionMatrix()
    }
  }, [])

  // ── Three.js setup ───────────────────────────────────────────────────────
  useEffect(() => {
    if (threeInitReference.current) {
      return
    }

    threeInitReference.current = true

    const scene = new Scene()
    sceneReference.current = scene

    const camera = new PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.set(0, 0, 4.5)
    cameraReference.current = camera

    const renderer = new WebGLRenderer({ antialias: true, alpha: true })
    renderer.setClearColor(0x00_00_00, 0)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(260, 260)
    rendererReference.current = renderer

    // Wireframe cube: edges only
    const geo = new BoxGeometry(2, 2, 2)
    const edges = new EdgesGeometry(geo)
    geo.dispose()
    const mat = new LineBasicMaterial({ color: 0xC2_D6_85 })
    const cube = new LineSegments(edges, mat)
    scene.add(cube)
    cubeReference.current = cube

    const animate = () => {
      animFrameReference.current = requestAnimationFrame(animate)
      cube.rotation.x += spinSpeedReference.current.value * 0.6
      cube.rotation.y += spinSpeedReference.current.value
      cube.rotation.z += spinSpeedReference.current.value * 0.35
      renderer.render(scene, camera)
    }

    animate()

    // Attach to initial container once layout has settled
    requestAnimationFrame(() => {
      if (cubeWrapReference.current) {
        attachRenderer(cubeWrapReference.current)
      }
    })

    return () => {
      cancelAnimationFrame(animFrameReference.current)
      renderer.dispose()
      edges.dispose()
      mat.dispose()
    }
  }, [attachRenderer])

  // ── COIN_TOSSING → spin up ───────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'COIN_TOSSING') {
      setStatusText('EXCHANGING CRYPTOGRAPHIC KEYS...')
      setIsScrambling(true)

      // Spin up: slow → violent
      gsap.to(spinSpeedReference.current, {
        value: 0.18,
        duration: 2.6,
        ease: 'power2.in',
        onUpdate() {
          if (spinSpeedReference.current.value > 0.08 && !fastRing) {
            setFastRing(true)
          }
        },
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── COIN_TOSSED → cinematic reveal ───────────────────────────────────────
  useEffect(() => {
    console.log({ phase, coinTossWinner, playerNumber })
    if (
      phase === 'COIN_TOSSED'
      && coinTossWinner !== undefined
      && playerNumber !== undefined
    ) {
      setStatusText('RESOLVING SECURITY CLEARANCE...')

      // Brief pause → cinematic glitch burst → reveal
      const t1 = setTimeout(() => {
        setRevealStage('cinematic')

        const t2 = setTimeout(() => {
          setRevealStage('revealed')
          setIsScrambling(false)
          setFastRing(false)

          // Spin down gently
          gsap.to(spinSpeedReference.current, {
            value: 0.003,
            duration: 1.8,
            ease: 'power3.out',
          })

          // Tint the cube to match role
          if (cubeReference.current) {
            const mat = cubeReference.current.material as LineBasicMaterial
            gsap.to(mat.color, {
              ...(coinTossWinner === playerNumber
                ? { r: 0.761, g: 0.839, b: 0.522 } // #C2D685
                : { r: 0.447, g: 0.204, b: 0.208 }), // #723435
              duration: 0.5,
            })
          }

          // Move canvas to result container
          requestAnimationFrame(() => {
            if (cubeResultReference.current) {
              attachRenderer(cubeResultReference.current)
            }
          })
        }, 620)

        return () => {
          clearTimeout(t2)
        }
      }, 350)

      return () => {
        clearTimeout(t1)
      }
    }
  }, [phase, coinTossWinner, playerNumber, attachRenderer])

  // ── Resize handler ───────────────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      if (!mountedContainerReference.current || !rendererReference.current) {
        return
      }

      const c = mountedContainerReference.current
      const size = Math.min(c.clientWidth, c.clientHeight)
      rendererReference.current.setSize(size, size)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // ── Derived flags ────────────────────────────────────────────────────────
  const revealed = revealStage === 'revealed'
  const isRed = revealed && isController === false
  const isGreen = revealed && isController === true

  // TODO: redirect to /play when the next phase arrives

  return (
    <div
      className={[
        'toss-page',
        isGreen ? 'toss-page--controller-locked' : '',
      ].join(' ').trim()}
    >
      {/* Entry fade-in overlay */}
      <div className='toss-page__entry-overlay' />

      {/* ── Background ── */}
      <Squares
        speed={isRed ? 0.65 : 0.2}
        squareSize={40}
        direction={isRed ? 'diagonal' : 'up'}
        borderColor='rgba(55,55,55,0.31)'
        bgColor='rgba(10,10,10,0.55)'
        hoverFillColor='#111'
      />

      {/* ── Drifting hex streams (ambient, purely decorative) ── */}
      {STREAM_LINES.map(line => (
        <div
          key={line.id}
          className='toss-page__hex-stream'
          style={{
            '--stream-top': line.top,
            '--stream-duration': line.duration,
            'animationDelay': line.delay,
          } as React.CSSProperties}
        >
          {line.text}
        </div>
      ))}

      {/* ── Scanlines ── */}
      <div className='toss-page__scanlines' />

      {/* ── Vignette ── */}
      <div
        className={[
          'toss-page__vignette',
          isRed ? 'toss-page__vignette--alarm' : '',
        ].join(' ').trim()}
      />

      {/* ── CRT ambient glitch ── */}
      <div
        className={[
          'toss-page__glitch-layer',
          isGlitching ? 'toss-page__glitch-layer--active' : '',
        ].join(' ').trim()}
      />

      {/* ── Cinematic reveal burst ── */}
      {revealStage === 'cinematic' && (
        <div className='toss-page__cinematic-glitch' />
      )}

      {/* ── Alarm border pulse (sabotager only) ── */}
      {isRed && <div className='toss-page__alarm-border' />}

      {/* ── Header ── */}
      <header className='toss-page__header'>
        <h1 className='toss-page__title'>MELTDOWN</h1>
      </header>

      {/* ── Corner decorations ── */}
      {(['tl', 'tr', 'bl', 'br'] as const).map(pos => (
        <div
          key={pos}
          className={[
            'toss-page__corner',
            `toss-page__corner--${pos}`,
            isRed ? 'toss-page__corner--alarm' : '',
          ].join(' ').trim()}
        >
          <span />
          <span />
        </div>
      ))}

      {/* ── Main content ── */}
      <main className='toss-page__main'>

        {/* ARENA — visible before reveal */}
        <div className={[
          'toss-page__arena',
          revealed ? 'toss-page__arena--hidden' : '',
        ].join(' ').trim()}
        >
          {/* NODE-A (self) */}
          <div className='toss-page__node toss-page__node--a'>
            <div className='toss-page__node-label'>NODE-A</div>
            <div className='toss-page__node-name'>
              {isScrambling
                ? <HexScramble text={myName || 'PLAYER_1'} active mode='hex' />
                : (myName || 'PLAYER_1')}
            </div>
            <div className='toss-page__node-status'>● CONNECTED</div>
          </div>

          {/* Center: wireframe cube */}
          <div className='toss-page__cube-wrap'>
            <div className='toss-page__protocol-label'>CRYPTOGRAPHIC HANDSHAKE</div>
            <div className='toss-page__cube-wrap-inner'>
              {/* Canvas will be injected here by Three.js */}
              <div ref={cubeWrapReference} className='toss-page__cube-mount' />
              <div className={[
                'toss-page__spin-ring',
                fastRing ? 'toss-page__spin-ring--fast' : '',
              ].join(' ').trim()}
              />
            </div>
            <div className='toss-page__protocol-sub'>
              {phase === 'COIN_TOSSING'
                ? 'KEY EXCHANGE IN PROGRESS...'
                : 'PROTOCOL STANDBY'}
            </div>
          </div>

          {/* NODE-B (opponent) */}
          <div className='toss-page__node toss-page__node--b'>
            <div className='toss-page__node-label'>NODE-B</div>
            <div className='toss-page__node-name'>
              {isScrambling
                ? <HexScramble text={opponentName || 'PLAYER_2'} active mode='hex' />
                : (opponentName || 'PLAYER_2')}
            </div>
            <div className='toss-page__node-status'>● CONNECTED</div>
          </div>
        </div>

        {/* RESULT — visible after reveal */}
        <div className={[
          'toss-page__result',
          revealed ? `toss-page__result--visible toss-page__result--${isController ? 'controller' : 'sabotager'}` : '',
        ].join(' ').trim()}
        >
          <div className='toss-page__result-message'>
            {isController
              ? '> CLEARANCE VERIFIED.'
              : '> CRITICAL ERROR: UNAUTHORIZED OVERRIDE DETECTED.'}
          </div>

          <div className='toss-page__result-role'>
            {isController
              ? (
                  <HexScramble text='[CONTROLLER]' active={false} mode='hex' />
                )
              : (
                  <HexScramble text='[ SABOTAGER ]' active={false} mode='corrupt' />
                )}
          </div>

          <div className='toss-page__result-sub'>
            {isController
              ? 'SECURITY CLEARANCE GRANTED — REACTOR OVERSIGHT AUTHORIZED'
              : 'MALICIOUS INTRUSION AUTHENTICATED — INFILTRATION PROTOCOL ACTIVE'}
          </div>
        </div>

      </main>

      {/* Small cube in corner during result view */}
      {revealed && (
        <div ref={cubeResultReference} className='toss-page__cube-mount toss-page__cube-mount--result' />
      )}

      {/* ── Status bar ── */}
      <footer className='toss-page__status-bar'>
        <span className={[
          'toss-page__status-text',
          isRed ? 'toss-page__status-text--red' : '',
        ].join(' ').trim()}
        >
          {revealed
            ? (isController
                ? 'ROLE ASSIGNMENT COMPLETE — CONTROLLER ONLINE'
                : 'ROLE ASSIGNMENT COMPLETE — SABOTAGER DETECTED')
            : statusText}
        </span>
        <span className={[
          'toss-page__cursor',
          isRed ? 'toss-page__cursor--red' : '',
        ].join(' ').trim()}
        />
      </footer>
    </div>
  )
}
