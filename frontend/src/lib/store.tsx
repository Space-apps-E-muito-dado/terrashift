import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Diagnosis, LatLng, Objective, RecentCrop, ScenarioId, Simulation } from './api'

export interface FarmSel {
  name: string
  region: string
  polygon: LatLng[]
  areaHa: number
  isDemo: boolean
}

export interface AppState {
  farm?: FarmSel
  diagnosis?: Diagnosis
  objective: Objective
  recentCrop: RecentCrop
  simulation?: Simulation
  strategyId?: string
  scenario: ScenarioId
  yearIdx: number
}

const initial: AppState = { objective: 'equilibrio', recentCrop: 'soja', scenario: 'tipico', yearIdx: 1 }
const KEY = 'terrashift-state-v2'

function load(): AppState {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? { ...initial, ...JSON.parse(raw) } : initial
  } catch {
    return initial
  }
}

interface Ctx {
  s: AppState
  set: (patch: Partial<AppState>) => void
  reset: () => void
}

const StoreCtx = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<AppState>(load)
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      /* storage may be unavailable; state still works in memory */
    }
  }, [s])
  const value = useMemo<Ctx>(
    () => ({
      s,
      set: (patch) => setS((prev) => ({ ...prev, ...patch })),
      reset: () => setS(initial),
    }),
    [s],
  )
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('useStore outside provider')
  return c
}
