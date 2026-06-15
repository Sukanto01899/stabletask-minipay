'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

type PendingCountContextValue = {
  pendingPayoutsCount: number
  setPendingPayoutsCount: (count: number) => void
  activeTasksCount: number
  setActiveTasksCount: (count: number) => void
  claimedTodayCount: number
  setClaimedTodayCount: (count: number) => void
}

const PendingCountContext = createContext<PendingCountContextValue>({
  pendingPayoutsCount: 0,
  setPendingPayoutsCount: () => {},
  activeTasksCount: 0,
  setActiveTasksCount: () => {},
  claimedTodayCount: 0,
  setClaimedTodayCount: () => {},
})

export function PendingCountProvider({ children }: { children: ReactNode }) {
  const [pendingPayoutsCount, setPendingPayoutsCount] = useState(0)
  const [activeTasksCount, setActiveTasksCount] = useState(0)
  const [claimedTodayCount, setClaimedTodayCount] = useState(0)
  return (
    <PendingCountContext.Provider
      value={{
        pendingPayoutsCount,
        setPendingPayoutsCount,
        activeTasksCount,
        setActiveTasksCount,
        claimedTodayCount,
        setClaimedTodayCount,
      }}
    >
      {children}
    </PendingCountContext.Provider>
  )
}

export function usePendingCount() {
  return useContext(PendingCountContext)
}
