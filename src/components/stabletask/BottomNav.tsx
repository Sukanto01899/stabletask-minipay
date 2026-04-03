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
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between px-6 py-3">
        {props.items.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.label}
              className={cn(
                'flex flex-col items-center gap-1 text-xs font-medium transition',
                isActive ? 'text-foreground' : 'text-muted-foreground',
              )}
              href={item.href}
            >
              <span className={cn('h-2 w-2 rounded-full', isActive ? 'bg-foreground' : 'bg-muted')}></span>
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
