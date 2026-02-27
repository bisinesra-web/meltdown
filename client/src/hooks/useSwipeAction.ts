import { useRef, useCallback } from 'react'

interface SwipeState {
  startX: number
  currentX: number
  isDragging: boolean
}

interface UseSwipeActionOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  threshold?: number
}

/**
 * Hook to handle horizontal swipe gestures
 * Useful for swipe-to-delete or swipe-to-action on mobile
 */
export function useSwipeAction(options: UseSwipeActionOptions = {}) {
  const { onSwipeLeft, onSwipeRight, threshold = 50 } = options
  const swipeStateReference = useRef<SwipeState>({
    startX: 0,
    currentX: 0,
    isDragging: false,
  })

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    swipeStateReference.current.startX = e.clientX
    swipeStateReference.current.isDragging = true
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!swipeStateReference.current.isDragging) {
      return
    }

    swipeStateReference.current.currentX = e.clientX
  }, [])

  const handlePointerUp = useCallback(() => {
    if (!swipeStateReference.current.isDragging) {
      return
    }

    const { startX, currentX } = swipeStateReference.current
    const delta = currentX - startX

    swipeStateReference.current.isDragging = false

    if (Math.abs(delta) > threshold) {
      if (delta < 0) {
        // Swiped left
        onSwipeLeft?.()
      }
      else {
        // Swiped right
        onSwipeRight?.()
      }
    }
  }, [threshold, onSwipeLeft, onSwipeRight])

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  }
}

export default useSwipeAction
