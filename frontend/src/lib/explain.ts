import type { Simulation } from './api'
import { fmtDec } from './i18n'
import type { T } from './i18n'

export interface SourceLine {
  dataset: string
  detail: string
  live: boolean
}

/** Localised list of data sources, built from the simulation (the API only provides live flags). */
export function sourceLines(t: T, sim: Simulation): SourceLine[] {
  const live = (i: number) => sim.sources[i]?.live ?? true
  const c = sim.calibration
  const level = t(`plan.level.${c.yieldLevel}` as 'plan.level.município')
  return [
    { dataset: 'NASA POWER', detail: t('source.powerClimate', { period: '2001–2025' }), live: live(0) },
    { dataset: 'NASA POWER', detail: t('source.powerRain'), live: live(1) },
    { dataset: 'IBGE PAM', detail: t('source.ibge', { place: c.yieldPlace, level }), live: live(2) },
    { dataset: 'ISRIC SoilGrids', detail: t('source.soilgrids'), live: live(3) },
    { dataset: 'SRTM', detail: t('source.srtm', { slope: fmtDec(c.soil.slopePct) }), live: live(4) },
    { dataset: 'MODIS Terra NDVI', detail: t('source.modis'), live: true },
    { dataset: 'SMAP L4', detail: t('source.smap'), live: true },
    { dataset: 'Copernicus Sentinel-2', detail: t('source.s2'), live: true },
  ]
}

/** Localised model assumptions, built from the calibration values. */
export function assumptionLines(t: T, sim: Simulation): string[] {
  const c = sim.calibration
  return [
    t('assume.scenarios'),
    t('assume.revenue', { place: c.yieldPlace, last: Math.max(0, ...c.crops.map((x) => x.lastYear)) }),
    t('assume.risk', { pct: Math.round((1 - c.lossThreshold) * 100) }),
    t('assume.water'),
    t('assume.soil', { slope: fmtDec(c.soil.slopePct), len: c.soil.slopeLengthM }),
    t('assume.season'),
    ...(sim.customParams.length || [sim.baseline, ...sim.strategies].some((x) => x.sequence.includes('pousio')) ? [t('assume.custom')] : []),
  ]
}
