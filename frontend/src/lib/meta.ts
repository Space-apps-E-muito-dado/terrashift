import {
  Bean,
  CloudRain,
  CloudSun,
  History,
  Leaf,
  Scale,
  ShieldCheck,
  Sprout,
  Sun,
  TrendingUp,
  UserRound,
  Wheat,
  type LucideIcon,
} from 'lucide-react'
import type { CropKey, Objective, ScenarioId, SimulateReq } from './api'
import { FALLOW_ICON, isBuiltin, typeMeta, type BuiltinCrop, type CustomCrop } from './crops'
import type { T } from './i18n'

export { brlMil, fmtDec, fmtInt, fmtNum, fmtOne, fmtPrice } from './i18n'

export const PLAN_YEARS = [2027, 2028, 2029]
/** Harvest years of the three seasons the farmer declares (2023/24, 2024/25, 2025/26). */
export const PAST_YEARS = [2024, 2025, 2026]

export const CROPS: Record<BuiltinCrop, { icon: LucideIcon; photo?: string; tint: string }> = {
  soja: { icon: Bean, photo: '/img/soja.jpg', tint: '#8CC63F' },
  milho: { icon: Wheat, photo: '/img/milho.jpg', tint: '#E8C35A' },
  cobertura: { icon: Leaf, photo: '/img/cobertura.jpg', tint: '#2E8B57' },
  pousio: { icon: FALLOW_ICON, tint: '#B9A58A' },
}

// Farmer-defined crops, kept in sync by the store so labels resolve anywhere.
let CUSTOM: CustomCrop[] = []
export function setCustomRegistry(list: CustomCrop[]) {
  CUSTOM = list
}
export const customCrop = (key: CropKey) => CUSTOM.find((c) => c.id === key)

export interface CropMeta {
  icon: LucideIcon
  photo?: string
  tint: string
  estimated: boolean
  custom?: CustomCrop
}

export function cropMeta(key: CropKey): CropMeta {
  if (isBuiltin(key)) return { ...CROPS[key], estimated: false }
  const c = customCrop(key)
  const tm = typeMeta(c?.type ?? 'legume')
  return { icon: tm.icon, tint: tm.tint, estimated: true, custom: c }
}

type Key = Parameters<T>[0]
/** `fallback` = name sent back by the API, used if the crop was deleted from this browser. */
export const cropName = (t: T, c: CropKey, fallback?: string) => (isBuiltin(c) ? t(`crop.${c}` as Key) : (customCrop(c)?.name ?? fallback ?? c))
export const cropShort = (t: T, c: CropKey, fallback?: string) => (isBuiltin(c) ? t(`cropShort.${c}` as Key) : (customCrop(c)?.name ?? fallback ?? c))
export const strategyName = (t: T, id: string) => t(`strategy.${id}` as Key)
export const strategyTagline = (t: T, id: string) => t(`tagline.${id}` as Key)
export const scenarioName = (t: T, id: ScenarioId) => t(`scenario.${id}` as Key)

/** What a crop does in the rotation, given the crop before it. */
export function cropRole(t: T, crop: CropKey, prev?: CropKey): string {
  if (crop === 'pousio') return t('role.fallow')
  if (!isBuiltin(crop)) {
    const c = customCrop(crop)
    return c?.type === 'legume' ? `${t('role.custom')} ${t('role.customLegume')}` : t('role.custom')
  }
  if (crop === 'cobertura') return t('role.cover')
  if (crop === 'milho') {
    if (prev === 'soja') return t('role.maizeAfterSoy')
    if (prev === 'cobertura') return t('role.maizeAfterCover')
    if (prev === 'milho') return t('role.maizeAfterMaize')
    return t('role.maize')
  }
  if (prev === 'cobertura') return t('role.soyAfterCover')
  if (prev === 'soja') return t('role.soyAfterSoy')
  return t('role.soy')
}

/** Simulation request for the current choices; only the custom crops in use are sent. */
export function simulateRequest(s: {
  farm?: { polygon: SimulateReq['polygon'] }
  objective: Objective
  currentRotation: CropKey[]
  myRotation?: CropKey[]
  customCrops: CustomCrop[]
}): SimulateReq {
  const used = new Set([...s.currentRotation, ...(s.myRotation ?? [])])
  return {
    polygon: s.farm?.polygon ?? [],
    objective: s.objective,
    currentRotation: s.currentRotation,
    myRotation: s.myRotation,
    customCrops: s.customCrops.filter((c) => used.has(c.id)),
  }
}

export const STRATEGY_ICONS: Record<string, LucideIcon> = {
  'trending-up': TrendingUp,
  scale: Scale,
  'shield-check': ShieldCheck,
  sprout: Sprout,
  history: History,
  'user-round': UserRound,
}

export const SCENARIOS: { id: ScenarioId; icon: LucideIcon }[] = [
  { id: 'seco', icon: Sun },
  { id: 'tipico', icon: CloudSun },
  { id: 'chuvoso', icon: CloudRain },
]

export const OBJECTIVES: { id: Objective; icon: LucideIcon; color: string }[] = [
  { id: 'lucro', icon: TrendingUp, color: '#245A43' },
  { id: 'solo', icon: Sprout, color: '#9A6B2C' },
  { id: 'seguranca', icon: ShieldCheck, color: '#2F7FAE' },
  { id: 'equilibrio', icon: Scale, color: '#153E2F' },
]

export const STEP_COUNT = 5

/** Harvest year 2016 → "2015/16". */
export const safra = (y: number) => `${y - 1}/${String(y).slice(2)}`

/** Picks one of three comma-separated labels by thresholds. */
export function level(v: number, [low, high]: [number, number], labels: string): string {
  const [a, b, c] = labels.split(',')
  return v < low ? a : v < high ? b : c
}

/** Display name and region of the selected farm (demo farm keeps its proper name). */
export const farmLabel = (t: T, farm: { name: string }) => farm.name || t('select.myProperty')
export const regionLabel = (t: T, farm: { isDemo: boolean }) => (farm.isDemo ? t('select.demoRegion') : t('select.drawnRegion'))
