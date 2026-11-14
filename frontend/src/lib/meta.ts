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
  Wheat,
  type LucideIcon,
} from 'lucide-react'
import type { CropId, Objective, ScenarioId } from './api'
import type { T } from './i18n'

export { brlMil, fmtDec, fmtInt, fmtNum, fmtOne, fmtPrice } from './i18n'

export const PLAN_YEARS = [2027, 2028, 2029]

export const CROPS: Record<CropId, { icon: LucideIcon; photo: string; tint: string }> = {
  soja: { icon: Bean, photo: '/img/soja.jpg', tint: '#8CC63F' },
  milho: { icon: Wheat, photo: '/img/milho.jpg', tint: '#E8C35A' },
  cobertura: { icon: Leaf, photo: '/img/cobertura.jpg', tint: '#2E8B57' },
}

type Key = Parameters<T>[0]
export const cropName = (t: T, c: CropId) => t(`crop.${c}` as Key)
export const cropShort = (t: T, c: CropId) => t(`cropShort.${c}` as Key)
export const strategyName = (t: T, id: string) => t(`strategy.${id}` as Key)
export const strategyTagline = (t: T, id: string) => t(`tagline.${id}` as Key)
export const scenarioName = (t: T, id: ScenarioId) => t(`scenario.${id}` as Key)

/** What a crop does in the rotation, given the crop before it. */
export function cropRole(t: T, crop: CropId, prev?: CropId): string {
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

export const STRATEGY_ICONS: Record<string, LucideIcon> = {
  'trending-up': TrendingUp,
  scale: Scale,
  'shield-check': ShieldCheck,
  sprout: Sprout,
  history: History,
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

export const STEP_COUNT = 4

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
