'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

type PendingCountContextValue = {
  pendingPayoutsCount: number
  setPendingPayoutsCount: (count: number) => void
}

const PendingCountContext = createContext<PendingCountContextValue>({
  pendingPayoutsCount: 0,
  setPendingPayoutsCount: () => {},
})

export function PendingCountProvider({ children }: { children: ReactNode }) {
  const [pendingPayoutsCount, setPendingPayoutsCount] = useState(0)
  return (
    <PendingCountContext.Provider value={{ pendingPayoutsCount, setPendingPayoutsCount }}>
      {children}
    </PendingCountContext.Provider>
  )
}

export function usePendingCount() {
  return useContext(PendingCountContext)
}
