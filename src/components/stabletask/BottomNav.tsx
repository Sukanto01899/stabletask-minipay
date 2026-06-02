'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'

import { cn } from '@/lib/utils'

export type BottomNavItem = {
  label: string
  href: string
  icon: IconSvgElement
  badge?: number
}

export function BottomNav(props: { items: BottomNavItem[] }) {
  const pathname = usePathname()

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-cyan-300/20 bg-slate-950/82 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        {props.items.map((item) => {
          const isActive = item.href === '/tasks' ? pathname === '/' || pathname === '/tasks' : pathname === item.href
          return (
            <Link
              key={item.label}
              className={cn(
                'group flex min-w-20 flex-col items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold transition',
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
                  className={cn('transition', isActive ? 'text-lime-100' : 'text-slate-400 group-hover:text-cyan-100')}
                />
                {item.badge != null && item.badge > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-slate-950 bg-amber-400 px-0.5 text-[9px] font-black leading-none text-slate-950">
                    {item.badge > 99 ? '99+' : item.badge}
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
