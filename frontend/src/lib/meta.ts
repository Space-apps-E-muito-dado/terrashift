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

export const PLAN_YEARS = [2027, 2028, 2029]

export const CROPS: Record<CropId, { name: string; short: string; icon: LucideIcon; photo: string; tint: string }> = {
  soja: { name: 'Soja', short: 'Soja', icon: Bean, photo: '/img/soja.jpg', tint: '#8CC63F' },
  milho: { name: 'Milho', short: 'Milho', icon: Wheat, photo: '/img/milho.jpg', tint: '#E8C35A' },
  cobertura: { name: 'Cobertura vegetal', short: 'Cobertura', icon: Leaf, photo: '/img/cobertura.jpg', tint: '#2E8B57' },
}

/** What a crop does in the rotation, given the crop before it. */
export function cropRole(crop: CropId, prev?: CropId): string {
  if (crop === 'cobertura') return 'Protege e recupera o solo entre safras.'
  if (crop === 'milho') {
    if (prev === 'soja') return 'Aproveita o nitrogênio deixado pela soja.'
    if (prev === 'cobertura') return 'Planta sobre a palhada, que guarda umidade.'
    if (prev === 'milho') return 'Repete o milho: mais receita, mais desgaste do solo.'
    return 'Cultura de maior potencial de receita.'
  }
  if (prev === 'cobertura') return 'Planta sobre a palhada e fixa nitrogênio.'
  if (prev === 'soja') return 'Repete a soja: simples, mas favorece pragas e doenças.'
  return 'Fixa nitrogênio e abre o ciclo com boa liquidez.'
}

export const STRATEGY_ICONS: Record<string, LucideIcon> = {
  'trending-up': TrendingUp,
  scale: Scale,
  'shield-check': ShieldCheck,
  sprout: Sprout,
  history: History,
}

export const SCENARIOS: { id: ScenarioId; name: string; icon: LucideIcon }[] = [
  { id: 'seco', name: 'Ano seco', icon: Sun },
  { id: 'tipico', name: 'Ano típico', icon: CloudSun },
  { id: 'chuvoso', name: 'Ano chuvoso', icon: CloudRain },
]

export const OBJECTIVES: { id: Objective; title: string; desc: string; icon: LucideIcon; color: string }[] = [
  { id: 'lucro', title: 'Ganhar mais', desc: 'Priorizar retorno econômico.', icon: TrendingUp, color: '#245A43' },
  { id: 'solo', title: 'Cuidar da terra', desc: 'Priorizar conservação do solo.', icon: Sprout, color: '#9A6B2C' },
  { id: 'seguranca', title: 'Ter mais segurança', desc: 'Reduzir riscos ligados ao clima.', icon: ShieldCheck, color: '#2F7FAE' },
  { id: 'equilibrio', title: 'Equilibrar tudo', desc: 'Combinar retorno, conservação e segurança.', icon: Scale, color: '#153E2F' },
]

export const STEPS = ['Sua terra', 'Diagnóstico', 'Objetivos', 'Futuros']

/** Harvest year 2016 → "2015/16". */
export const safra = (y: number) => `${y - 1}/${String(y).slice(2)}`

const brl = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const int = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const dec = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

/** R$ 8.630 → "8,6 mil" */
export const brlMil = (v: number) => `${brl.format(v / 1000)} mil`
export const fmtInt = (v: number) => int.format(v)
export const fmtDec = (v: number) => dec.format(v)
export const fmtPrice = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function level(v: number, [low, high]: [number, number], labels: [string, string, string]) {
  return v < low ? labels[0] : v < high ? labels[1] : labels[2]
}
