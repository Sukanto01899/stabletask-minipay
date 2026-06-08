'use client'

import { useEffect, useState } from 'react'

/**
 * ScrollToTop — a floating action button that fades in once the user has
 * scrolled past a threshold and smoothly returns them to the top on tap.
 * Sits above the BottomNav (offset for it + the safe-area inset).
 */
export function ScrollToTop({ threshold = 320 }: { threshold?: number }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  const scrollToTop = () => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      tabIndex={visible ? 0 : -1}
      className={`fixed right-5 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] z-40 flex h-11 w-11 items-center justify-center rounded-full border border-cyan-300/30 bg-slate-900/85 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.18)] backdrop-blur-xl transition-all duration-300 hover:bg-cyan-300/15 hover:text-cyan-100 active:scale-95 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path
          fillRule="evenodd"
          d="M10 17a.75.75 0 01-.75-.75V6.31L5.78 9.78a.75.75 0 01-1.06-1.06l4.75-4.75a.75.75 0 011.06 0l4.75 4.75a.75.75 0 11-1.06 1.06L10.75 6.31v9.94A.75.75 0 0110 17z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  )
}
