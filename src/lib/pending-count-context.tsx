'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

type PendingCountContextValue = {
  pendingPayoutsCount: number
  setPendingPayoutsCount: (count: number) => void
  activeTasksCount: number
  setActiveTasksCount: (count: number) => void
}

const PendingCountContext = createContext<PendingCountContextValue>({
  pendingPayoutsCount: 0,
  setPendingPayoutsCount: () => {},
  activeTasksCount: 0,
  setActiveTasksCount: () => {},
})

export function PendingCountProvider({ children }: { children: ReactNode }) {
  const [pendingPayoutsCount, setPendingPayoutsCount] = useState(0)
  const [activeTasksCount, setActiveTasksCount] = useState(0)
  return (
    <PendingCountContext.Provider
      value={{
        pendingPayoutsCount,
        setPendingPayoutsCount,
        activeTasksCount,
        setActiveTasksCount,
      }}
    >
      {children}
    </PendingCountContext.Provider>
  )
}

export function usePendingCount() {
  return useContext(PendingCountContext)
}
