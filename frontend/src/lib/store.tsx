import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CropKey, Diagnosis, LatLng, Objective, ScenarioId, Simulation } from './api'
import { loadCustomCrops, saveCustomCrops, type CustomCrop } from './crops'
import { setCustomRegistry } from './meta'

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
  /** The last three seasons, oldest first (2023/24, 2024/25, 2025/26). */
  currentRotation: CropKey[]
  /** The rotation the farmer built for 2027–2029, if any. */
  myRotation?: CropKey[]
  /** Farmer-defined crops (also kept in localStorage, so they survive a reload). */
  customCrops: CustomCrop[]
  simulation?: Simulation
  strategyId?: string
  scenario: ScenarioId
  yearIdx: number
}

export const DEFAULT_ROTATION: CropKey[] = ['soja', 'soja', 'soja']
const initial: AppState = { objective: 'equilibrio', currentRotation: DEFAULT_ROTATION, customCrops: [], scenario: 'tipico', yearIdx: 1 }
const KEY = 'terrashift-state-v2'

function load(): AppState {
  let st = initial
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) st = { ...initial, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  const customCrops = loadCustomCrops()
  const known = (k: CropKey) => !k.startsWith('custom-') || customCrops.some((c) => c.id === k)
  const currentRotation = st.currentRotation?.length === 3 && st.currentRotation.every(known) ? st.currentRotation : DEFAULT_ROTATION
  const myRotation = st.myRotation?.every(known) ? st.myRotation : undefined
  setCustomRegistry(customCrops)
  return { ...st, customCrops, currentRotation, myRotation }
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
    setCustomRegistry(s.customCrops)
    saveCustomCrops(s.customCrops)
  }, [s.customCrops])
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
      reset: () => setS((prev) => ({ ...initial, customCrops: prev.customCrops })),
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
