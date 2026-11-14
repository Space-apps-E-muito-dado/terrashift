import { currentLang } from './i18n'
import type { CropType, CustomCrop, Straw, Water } from './crops'

export type LatLng = [number, number]

export interface Farm {
  name: string
  region: string
  polygon: LatLng[]
  centroid: { lat: number; lng: number }
  areaHa: number
}

export interface SourceInfo {
  kind: 'satellite' | 'regional' | 'estimate' | 'user'
  dataset: string
  detail: string
  live: boolean
}

export interface Climate {
  live: boolean
  source: string
  period: string
  months: { month: string; precipMm: number; tempC: number }[]
  annualPrecipMm: number
  meanTempC: number
}

export interface ScenarioProfile {
  months: number[]
  octMarMm: number
  driestMonthMm: number
}

export interface AnalogYears {
  criterion: string
  seco: number[]
  tipico: number[]
  chuvoso: number[]
  seasons: { year: number; octMarMm: number; driestMonthMm: number }[]
  profileSeco: ScenarioProfile
  profileTipico: ScenarioProfile
  profileChuvoso: ScenarioProfile
}

export interface PamYear {
  year: number
  yieldKgHa: number
  areaHa: number
  valueThousandBrl: number
}

export interface Soil {
  live: boolean
  source: string
  layers: { depth: string; clayPct: number; sandPct: number; siltPct: number }[]
  socGKg: number | null
  textureClass: string
}

export interface Diagnosis {
  centroid: { lat: number; lng: number }
  areaHa: number
  climate: Climate
  rainSeries: { live: boolean; source: string; years: { year: number; totalMm: number }[] }
  analogYears: AnalogYears
  soil: Soil
  terrain: { live: boolean; source: string; elevationM: number; slopePct: number; samples: number }
  place: { live: boolean; municipality: string; uf: string; ibgeCode: string | null }
  yieldSource: string
  yieldLevel: string
  yieldPlace: string
  yieldsLive: boolean
  crops: { crop: 'soja' | 'milho'; years: PamYear[] }[]
  sources: SourceInfo[]
}

/** Built-in crop id ("soja", "milho", "cobertura", "pousio") or a farmer-defined id ("custom-1"). */
export type CropKey = string
export type ScenarioId = 'seco' | 'tipico' | 'chuvoso'
export type Objective = 'lucro' | 'solo' | 'seguranca' | 'equilibrio'

export interface YearOutcome {
  year: number
  crop: CropKey
  cropName: string
  seasonRainMm: number
  /** null = not available (crops described by the farmer have no price or yield). */
  returnIdx: number | null
  waterDemandIdx: number
  waterBalanceIdx: number
  soilIdx: number
  riskIdx: number
  revenueBrlHa: number | null
  yieldKgHa: number | null
  etcMm: number
  effRainMm: number
  deficitMm: number
  soilLossTHa: number
  lossSeasons: number
  analogSeasons: number
  harvest: boolean
  estimated: boolean
}

export interface Summary {
  returnIdx: number | null
  waterSavingIdx: number
  soilIdx: number
  resilienceIdx: number
  revenueBrlHa: number | null
  soilLossTHa: number
  deficitMm: number
}

export interface ScenarioYield {
  ratio: number
  lossSeasons: number
  seasons: number
}

export interface CropCalibration {
  crop: CropKey
  firstYear: number
  lastYear: number
  years: number
  trendYieldKgHa: number
  trendGainKgHaYr: number
  priceBrlKg: number
  priceYears: number[]
  seco: ScenarioYield
  tipico: ScenarioYield
  chuvoso: ScenarioYield
}

export interface Calibration {
  yieldSource: string
  yieldLevel: string
  yieldPlace: string
  crops: CropCalibration[]
  soil: { kFactor: number; lsFactor: number; slopePct: number; rFactorTipico: number; slopeLengthM: number }
  et0SeasonMm: number
  lossThreshold: number
}

export interface ScenarioResult {
  years: YearOutcome[]
  summary: Summary
}

export interface Strategy {
  id: string
  name: string
  icon: string
  sequence: CropKey[]
  tagline: string
  estimated: boolean
  scenarios: Record<ScenarioId, ScenarioResult>
}

export interface Simulation {
  baseline: Strategy
  strategies: Strategy[]
  recommended: string
  calibration: Calibration
  customParams: CustomParams[]
  analogYears: AnalogYears
  demo: boolean
  assumptions: string[]
  sources: SourceInfo[]
}

export interface CustomParams {
  key: string
  name: string
  type: CropType
  cycleDays: number
  plantingMonth: number
  water: Water
  straw: Straw
  kcMid: number
  ky: number | null
  cFactor: number
  source: string
}

export interface SimulateReq {
  polygon: LatLng[]
  objective: Objective
  currentRotation: CropKey[]
  myRotation?: CropKey[]
  customCrops: CustomCrop[]
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    // The API answers in Portuguese; in English we show a generic message.
    const pt = currentLang() === 'pt'
    let msg = pt ? 'Não conseguimos falar com o servidor.' : 'We could not reach the server.'
    try {
      const j = await res.json()
      if (j?.error && pt) msg = j.error
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export const api = {
  demoFarm: () => call<Farm>('/demo-farm'),
  diagnosis: (polygon: LatLng[]) => call<Diagnosis>('/diagnosis', { polygon }),
  simulate: (req: SimulateReq) => call<Simulation>('/simulate', req),
}
