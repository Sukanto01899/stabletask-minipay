'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'

import { cn } from '@/lib/utils'

export type BottomNavItem = {
  label: string
  href: string
  icon: IconSvgElement
  badge?: number
  /** Small pulsing warning dot (e.g. streak about to expire) — independent of `badge`. */
  warning?: boolean
}

const INDICATOR_WIDTH = 32

/** Nav badge count that plays a quick pop when its value changes (not on initial mount). */
function NavBadge({ value }: { value: number }) {
  const prevValueRef = useRef(value)
  const [popping, setPopping] = useState(false)

  useEffect(() => {
    if (value !== prevValueRef.current) {
      setPopping(true)
      prevValueRef.current = value
    }
  }, [value])

  return (
    <span
      className={cn(
        'absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-slate-950 bg-amber-400 px-0.5 text-[9px] font-black leading-none text-slate-950',
        popping && 'animate-badge-pop',
      )}
      onAnimationEnd={() => setPopping(false)}
    >
      {value > 99 ? '99+' : value}
    </span>
  )
}

export function BottomNav(props: { items: BottomNavItem[] }) {
  const pathname = usePathname()
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const [indicatorLeft, setIndicatorLeft] = useState<number | null>(null)

  const activeIndex = props.items.findIndex((item) =>
    item.href === '/tasks' ? pathname === '/' || pathname === '/tasks' : pathname === item.href,
  )

  useEffect(() => {
    const container = containerRef.current
    const activeEl = itemRefs.current[activeIndex]
    if (!container || !activeEl) return

    const updatePosition = () => {
      const containerRect = container.getBoundingClientRect()
      const activeRect = activeEl.getBoundingClientRect()
      setIndicatorLeft(activeRect.left - containerRect.left + activeRect.width / 2 - INDICATOR_WIDTH / 2)
    }

    updatePosition()
    const observer = new ResizeObserver(updatePosition)
    observer.observe(container)
    return () => observer.disconnect()
  }, [activeIndex])

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-cyan-300/20 bg-slate-950/82 backdrop-blur-xl">
      <div ref={containerRef} className="relative mx-auto flex max-w-md items-center justify-between px-4 py-3">
        {/* Active-tab indicator: a single glowing bar that slides between tabs. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-px h-0.5 rounded-full bg-linear-to-r from-lime-300 via-cyan-200 to-amber-300 shadow-[0_0_8px_rgba(132,204,22,0.8)] transition-[left,opacity] duration-300 ease-out"
          style={{
            width: INDICATOR_WIDTH,
            left: indicatorLeft ?? 0,
            opacity: indicatorLeft === null ? 0 : 1,
          }}
        />
        {props.items.map((item, index) => {
          const isActive = index === activeIndex
          return (
            <Link
              key={item.label}
              ref={(el) => {
                itemRefs.current[index] = el
              }}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group relative flex min-w-20 flex-col items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold transition',
                isActive
                  ? 'border-lime-300/35 bg-lime-300/14 text-lime-100 shadow-[0_0_28px_rgba(132,204,22,0.18)]'
                  : 'border-transparent text-slate-400 hover:border-cyan-300/20 hover:bg-cyan-300/10 hover:text-cyan-100',
              )}
              href={item.href}
            >
              <span className="relative">
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={item.icon}
                  size={22}
                  strokeWidth={2}
                  className={cn(
                    'transition',
                    isActive
                      ? 'text-lime-100 drop-shadow-[0_0_8px_rgba(163,230,53,0.8)]'
                      : 'text-slate-400 group-hover:text-cyan-100',
                  )}
                />
                {item.badge != null && item.badge > 0 && <NavBadge value={item.badge} />}
                {item.warning && (
                  <span
                    title="Streak expiring soon"
                    className="absolute -bottom-1 -right-1.5 flex h-3 w-3"
                  >
                    <span className="animate-tap-pulse absolute inset-0 rounded-full bg-amber-400/70 blur-[2px]" />
                    <span className="relative h-3 w-3 rounded-full border border-slate-950 bg-amber-400" />
                  </span>
                )}
              </span>
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
