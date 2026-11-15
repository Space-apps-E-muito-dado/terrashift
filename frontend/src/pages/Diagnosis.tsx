import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, CloudRain, Droplets, Eye, Image, Layers, Leaf, Mountain, Sparkles, Thermometer } from 'lucide-react'
import { AppHeader, Button, DemoBadge, SourceLabel } from '../components/ui'
import { FarmMap, OVERLAYS, type MapLayer } from '../components/FarmMap'
import { isDiagnosisOnly, type Diagnosis } from '../lib/api'
import { countryName } from '../lib/geo'
import { useI18n, type Lang } from '../lib/i18n'
import { farmLabel, fmtInt, fmtOne } from '../lib/meta'
import { useStore } from '../lib/store'

const LAYERS: { id: MapLayer; icon: typeof Image }[] = [
  { id: 'real', icon: Image },
  { id: 'agua', icon: Droplets },
  { id: 'vegetacao', icon: Leaf },
  { id: 'solo', icon: Layers },
  { id: 'relevo', icon: Mountain },
]

const SOIL_COLORS = ['#C98F45', '#D9A65E', '#E9CB98']

/** "Luís Eduardo Magalhães (BA)" in Brazil; "Worth Township, Iowa · United States" elsewhere. */
function placeLabel(d: Diagnosis, lang: Lang): string {
  if (d.place) return `${d.place.municipality} (${d.place.uf})`
  const f = d.foreignPlace
  if (!f) return ''
  const local = [f.name, f.region].filter(Boolean).join(', ')
  const country = countryName(f.countryCode, lang)
  return local ? `${local} · ${country}` : country
}

export default function DiagnosisPage() {
  const nav = useNavigate()
  const { s } = useStore()
  const { t, lang } = useI18n()
  const [layer, setLayer] = useState<MapLayer>('real')
  const d = s.diagnosis
  if (!s.farm || !d) return <Navigate to="/terra" replace />
  const only = isDiagnosisOnly(d)

  const monthsShort = t('months.short').split(',')
  const monthsLong = t('months.long').split(',')
  const maxP = Math.max(...d.climate.months.map((m) => m.precipMm), 1)
  const temps = d.climate.months.map((m) => m.tempC)
  const tMin = Math.min(...temps)
  const tMax = Math.max(...temps)
  const texture = t(`texture.${d.soil.textureClass}` as 'texture.Argiloso')
  const caption =
    layer === 'real'
      ? t('map.s2Caption')
      : layer === 'solo'
        ? t('diag.soilCaption', { texture: texture.toLowerCase() })
        : layer === 'relevo'
          ? t('diag.reliefCaption', { slope: fmtOne(d.terrain.slopePct) })
          : t(OVERLAYS[layer].label)

  return (
    <div className="screen">
      <AppHeader
        demo={s.farm.isDemo}
        farmName={farmLabel(t, s.farm)}
        page={t('diag.page')}
        step={1}
        action={only ? undefined : <Button onClick={() => nav('/rotacao')} icon={<ArrowRight size={16} />}>{t('common.continue')}</Button>}
      />
      <main className="page fit">
        <div className="page-title">
          <span className="eyebrow">
            {farmLabel(t, s.farm)} · {d.areaHa} ha · {placeLabel(d, lang)}
            {d.place && !d.place.live && <> <DemoBadge label={t('common.offlineExample')} /></>}
          </span>
          <h1>{t('diag.title')}</h1>
          <p>{t('diag.lead')}</p>
        </div>

        <div className="diag-grid">
          <FarmMap
            className="diag-map"
            polygon={s.farm.polygon}
            layer={layer}
            fill={layer === 'solo' ? SOIL_COLORS[0] : '#A8D66D'}
            fillOpacity={layer === 'solo' ? 0.55 : layer === 'real' ? 0.12 : 0.02}
          >
            <div className="map-ui map-caption" style={{ top: 16, left: 16 }}>
              <Eye size={13} /> {caption}
            </div>
            <div className="layer-sel" role="tablist" aria-label={t('diag.layersAria')}>
              {LAYERS.map((l) => (
                <button key={l.id} role="tab" aria-selected={layer === l.id} className={layer === l.id ? 'on' : ''} onClick={() => setLayer(l.id)}>
                  <l.icon size={15} /> {t(`diag.layer.${l.id}`)}
                </button>
              ))}
            </div>
          </FarmMap>

          <div className="data-col">
            <div className="data-grid">
              <section className="card dcard">
                <div className="dcard-top">
                  <span className="icon-wrap" style={{ background: 'rgba(117,185,223,.18)', color: 'var(--sky-ink)' }}><CloudRain size={15} /></span>
                  {t('diag.rain')}
                </div>
                <span className="big">{fmtInt(d.climate.annualPrecipMm)} mm<span className="muted" style={{ fontSize: 12, fontWeight: 500 }}> {t('diag.perYear')}</span></span>
                <div className="bars" aria-label={t('diag.rainAria')}>
                  {d.climate.months.map((m, i) => (
                    <i key={i} className={m.precipMm < 40 ? 'dry' : ''} style={{ height: `${Math.max(4, (m.precipMm / maxP) * 100)}%` }} title={`${monthsLong[i]}: ${fmtInt(m.precipMm)} mm`} />
                  ))}
                </div>
                <div className="months">{monthsShort.map((m, i) => <span key={i}>{m}</span>)}</div>
                <p>{t('diag.rainNote')}</p>
                <SourceLabel kind="regional" dataset="NASA POWER" live={d.climate.live} />
              </section>

              <section className="card dcard">
                <div className="dcard-top">
                  <span className="icon-wrap" style={{ background: 'rgba(232,176,62,.18)', color: '#b5852a' }}><Thermometer size={15} /></span>
                  {t('diag.temp')}
                </div>
                <span className="big">{fmtOne(d.climate.meanTempC)} °C<span className="muted" style={{ fontSize: 12, fontWeight: 500 }}> {t('diag.mean')}</span></span>
                <div className="bars temp">
                  {d.climate.months.map((m, i) => (
                    <i key={i} style={{ height: `${20 + ((m.tempC - tMin) / Math.max(tMax - tMin, 0.1)) * 80}%` }} title={`${monthsLong[i]}: ${fmtOne(m.tempC)} °C`} />
                  ))}
                </div>
                <div className="months">{monthsShort.map((m, i) => <span key={i}>{m}</span>)}</div>
                <p>{t('diag.tempNote', { min: fmtOne(tMin), max: fmtOne(tMax) })}</p>
                <SourceLabel kind="regional" dataset="NASA POWER" live={d.climate.live} />
              </section>

              <section className="card dcard">
                <div className="dcard-top">
                  <span className="icon-wrap" style={{ background: 'rgba(36,90,67,.1)', color: 'var(--forest-700)' }}><Leaf size={15} /></span>
                  {t('diag.veg')}
                </div>
                <p>
                  {t('diag.vegNote')}{' '}
                  <button className="linkish" onClick={() => setLayer('vegetacao')}>{t('diag.layer.vegetacao')}</button>.
                </p>
                <div style={{ height: 8, borderRadius: 4, background: 'linear-gradient(90deg,#D98E4A,#E8D36A,#A8D66D,#2E8B3E)' }} />
                <div className="months" style={{ justifyContent: 'space-between' }}><span style={{ textAlign: 'left' }}>{t('diag.little')}</span><span style={{ textAlign: 'right' }}>{t('diag.lots')}</span></div>
                <SourceLabel kind="satellite" dataset="MODIS" />
              </section>

              <section className="card dcard">
                <div className="dcard-top">
                  <span className="icon-wrap" style={{ background: 'rgba(217,166,94,.2)', color: '#9a6b2c' }}><Layers size={15} /></span>
                  {t('diag.soil')}
                </div>
                <span className="big" style={{ fontSize: 18 }}>{texture}</span>
                <div className="soil-layers">
                  {d.soil.layers.map((l, i) => (
                    <div key={l.depth} style={{ background: SOIL_COLORS[i] }}>
                      <span>{l.depth}</span>
                      <span>{t('diag.soilLayer', { clay: Math.round(l.clayPct), sand: Math.round(l.sandPct) })}</span>
                    </div>
                  ))}
                </div>
                <p>{t('diag.soilNote')}</p>
                <SourceLabel kind="estimate" dataset="SoilGrids" live={d.soil.live} />
              </section>
            </div>

            {only || !d.analogYears ? (
              <div className="insight">
                <span className="eyebrow"><Sparkles size={16} /> {t('diag.coverageTitle')}</span>
                <p>{t('diag.coverageBody')}</p>
                <Button variant="accent" onClick={() => nav('/terra')} icon={<ArrowRight size={18} />} style={{ alignSelf: 'flex-start' }}>
                  {t('diag.coverageAction')}
                </Button>
              </div>
            ) : (
              <div className="insight">
                <span className="eyebrow"><Sparkles size={16} /> {t('diag.next')}</span>
                <p>{t('diag.insight')}</p>
                <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,.72)', lineHeight: 1.45 }}>
                  {t('diag.insightNote', { n: d.analogYears.seasons.length, place: d.yieldPlace ?? '' })}
                </span>
                <Button variant="accent" onClick={() => nav('/rotacao')} icon={<ArrowRight size={18} />} style={{ alignSelf: 'flex-start' }}>
                  {t('diag.explore')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
