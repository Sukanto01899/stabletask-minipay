'use client'

import { useCallback, useRef, useState, type TouchEvent } from 'react'

interface PullToRefreshOptions {
  /** When true, pull gestures are ignored (e.g. a refresh is already in flight). */
  disabled?: boolean
  /** Pull distance, in px, required to trigger a refresh on release. */
  threshold?: number
  /** Maximum rendered pull distance, in px. */
  maxDistance?: number
}

interface PullToRefreshState {
  /** Current eased pull offset in px — apply to the content's translateY. */
  pullDistance: number
  /** True once the pull has passed the threshold and a release would refresh. */
  pullReady: boolean
  /** True while a finger is actively dragging — use to disable CSS transitions. */
  isPulling: boolean
  /** Spread onto the scroll container to wire up the gesture. */
  handlers: {
    onTouchStart: (event: TouchEvent<HTMLDivElement>) => void
    onTouchMove: (event: TouchEvent<HTMLDivElement>) => void
    onTouchEnd: () => void
    onTouchCancel: () => void
  }
}

/**
 * usePullToRefresh — pull-down-to-refresh for a top-anchored scroll view.
 *
 * Only engages when the window is scrolled to the top, so it never fights with
 * normal mid-page scrolling. Calls `onRefresh` when the user releases past the
 * threshold.
 */
export function usePullToRefresh(
  onRefresh: () => Promise<void> | void,
  { disabled = false, threshold = 70, maxDistance = 120 }: PullToRefreshOptions = {},
): PullToRefreshState {
  const [pullDistance, setPullDistance] = useState(0)
  const [pullReady, setPullReady] = useState(false)
  const pullStartYRef = useRef<number | null>(null)
  const isPullingRef = useRef(false)

  const resetPull = useCallback(() => {
    pullStartYRef.current = null
    isPullingRef.current = false
    setPullDistance(0)
    setPullReady(false)
  }, [])

  const onTouchStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (disabled) return
      if (event.touches.length !== 1) return
      if (typeof window !== 'undefined' && window.scrollY > 0) return
      pullStartYRef.current = event.touches[0]?.clientY ?? null
      isPullingRef.current = false
    },
    [disabled],
  )

  const onTouchMove = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (disabled) return
      const startY = pullStartYRef.current
      if (startY === null) return
      if (event.touches.length !== 1) return
      if (typeof window !== 'undefined' && window.scrollY > 0) return

      const currentY = event.touches[0]?.clientY ?? startY
      const deltaY = currentY - startY
      if (deltaY <= 0) return

      isPullingRef.current = true
      const eased = Math.min(maxDistance, Math.round(deltaY * 0.6))
      setPullDistance(eased)
      setPullReady(eased >= threshold)
    },
    [disabled, maxDistance, threshold],
  )

  const onTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) {
      resetPull()
      return
    }
    const shouldRefresh = pullReady && !disabled
    resetPull()
    if (shouldRefresh) {
      await onRefresh()
    }
  }, [disabled, onRefresh, pullReady, resetPull])

  return {
    pullDistance,
    pullReady,
    isPulling: isPullingRef.current,
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd },
  }
}
