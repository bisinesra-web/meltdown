import { useRef, useEffect } from 'react'
import './Squares.css'

type Direction = 'right' | 'left' | 'up' | 'down' | 'diagonal'

interface SquaresProperties {
  direction?: Direction
  speed?: number
  borderColor?: string
  squareSize?: number
  hoverFillColor?: string
  bgColor?: string
  className?: string
}

const Squares = ({
  direction = 'right',
  speed = 1,
  borderColor = '#999',
  squareSize = 40,
  hoverFillColor = '#222',
  bgColor = 'rgba(55, 55, 55, 0.18)',
  className = '',
}: SquaresProperties) => {
  const canvasReference = useRef<HTMLCanvasElement | null>(null)
  const requestReference = useRef<number | null>(null)
  const numberSquaresX = useRef<number>(0)
  const numberSquaresY = useRef<number>(0)
  const gridOffset = useRef({ x: 0, y: 0 })
  const hoveredSquare = useRef<{ x: number, y: number } | null>(null)

  useEffect(() => {
    const canvas = canvasReference.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      return
    }

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      numberSquaresX.current = Math.ceil(canvas.width / squareSize) + 1
      numberSquaresY.current = Math.ceil(canvas.height / squareSize) + 1
    }

    window.addEventListener('resize', resizeCanvas)
    resizeCanvas()

    const drawGrid = () => {
      context.clearRect(0, 0, canvas.width, canvas.height)

      const startX = Math.floor(gridOffset.current.x / squareSize) * squareSize
      const startY = Math.floor(gridOffset.current.y / squareSize) * squareSize

      for (let x = startX; x < canvas.width + squareSize; x += squareSize) {
        for (let y = startY; y < canvas.height + squareSize; y += squareSize) {
          const squareX = x - (gridOffset.current.x % squareSize)
          const squareY = y - (gridOffset.current.y % squareSize)

          if (
            Math.floor((x - startX) / squareSize) === hoveredSquare.current?.x
            && Math.floor((y - startY) / squareSize) === hoveredSquare.current.y
          ) {
            context.fillStyle = hoverFillColor
            context.fillRect(squareX, squareY, squareSize, squareSize)
          }

          context.strokeStyle = borderColor
          context.strokeRect(squareX, squareY, squareSize, squareSize)
        }
      }

      const gradient = context.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        Math.hypot(canvas.width, canvas.height) / 2,
      )
      gradient.addColorStop(0, bgColor)

      context.fillStyle = gradient
      context.fillRect(0, 0, canvas.width, canvas.height)
    }

    const updateAnimation = () => {
      const effectiveSpeed = Math.max(speed, 0.1)
      switch (direction) {
        case 'right': {
          gridOffset.current.x = (gridOffset.current.x - effectiveSpeed + squareSize) % squareSize
          break
        }

        case 'left': {
          gridOffset.current.x = (gridOffset.current.x + effectiveSpeed + squareSize) % squareSize
          break
        }

        case 'up': {
          gridOffset.current.y = (gridOffset.current.y + effectiveSpeed + squareSize) % squareSize
          break
        }

        case 'down': {
          gridOffset.current.y = (gridOffset.current.y - effectiveSpeed + squareSize) % squareSize
          break
        }

        case 'diagonal': {
          gridOffset.current.x = (gridOffset.current.x - effectiveSpeed + squareSize) % squareSize
          gridOffset.current.y = (gridOffset.current.y - effectiveSpeed + squareSize) % squareSize
          break
        }

        default: {
          break
        }
      }

      drawGrid()
      requestReference.current = requestAnimationFrame(updateAnimation)
    }

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mouseX = event.clientX - rect.left
      const mouseY = event.clientY - rect.top

      const startX = Math.floor(gridOffset.current.x / squareSize) * squareSize
      const startY = Math.floor(gridOffset.current.y / squareSize) * squareSize

      const hoveredSquareX = Math.floor((mouseX + gridOffset.current.x - startX) / squareSize)
      const hoveredSquareY = Math.floor((mouseY + gridOffset.current.y - startY) / squareSize)

      if (
        hoveredSquare.current?.x !== hoveredSquareX
        || hoveredSquare.current.y !== hoveredSquareY
      ) {
        hoveredSquare.current = { x: hoveredSquareX, y: hoveredSquareY }
      }
    }

    const handleMouseLeave = () => {
      // eslint-disable-next-line unicorn/no-null
      hoveredSquare.current = null
    }

    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseleave', handleMouseLeave)

    requestReference.current = requestAnimationFrame(updateAnimation)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (requestReference.current !== null) {
        cancelAnimationFrame(requestReference.current)
      }

      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [direction, speed, borderColor, hoverFillColor, squareSize, bgColor])

  return <canvas ref={canvasReference} className={`squares-canvas ${className}`}></canvas>
}

export default Squares
