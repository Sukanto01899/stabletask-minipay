'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

export type BottomNavItem = {
  label: string
  href: string
}

export function BottomNav(props: { items: BottomNavItem[] }) {
  const pathname = usePathname()

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-blue-200/70 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        {props.items.map((item) => {
          const isActive = item.href === '/tasks' ? pathname === '/' || pathname === '/tasks' : pathname === item.href
          return (
            <Link
              key={item.label}
              className={cn(
                'flex min-w-20 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold transition',
                isActive
                  ? 'bg-blue-600 text-white shadow-[0_10px_30px_rgba(37,99,235,0.28)]'
                  : 'text-slate-500 hover:bg-blue-50 hover:text-blue-700',
              )}
              href={item.href}
            >
              <span className={cn('h-2 w-2 rounded-full', isActive ? 'bg-cyan-200' : 'bg-slate-300')}></span>
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
