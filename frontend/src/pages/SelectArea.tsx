import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronRight, Map as MapIcon, MapPin, PenTool, Pencil, ScanSearch, Search, Sparkles, SquareDashed, Undo2 } from 'lucide-react'
import { AppHeader, Button, SourceLabel, Spinner } from '../components/ui'
import { FarmMap } from '../components/FarmMap'
import { api, type LatLng } from '../lib/api'
import { areaHa, searchPlace, type Place } from '../lib/geo'
import { useStore } from '../lib/store'
import { useI18n } from '../lib/i18n'
import { farmLabel, regionLabel } from '../lib/meta'

const STEPS = [
  { t: 'select.step.climate', s: 'NASA POWER' },
  { t: 'select.step.soil', s: 'ISRIC SoilGrids · SRTM' },
  { t: 'select.step.yield', s: 'IBGE PAM' },
] as const

export default function SelectArea() {
  const nav = useNavigate()
  const { s, set } = useStore()
  const { t, lang } = useI18n()
  const [mode, setMode] = useState<'idle' | 'draw'>('idle')
  const [draft, setDraft] = useState<LatLng[]>([])
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom: number }>()
  const [analyzing, setAnalyzing] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string>()
  const timer = useRef<number>()

  const farm = s.farm

  useEffect(() => () => window.clearInterval(timer.current), [])

  async function useDemo() {
    setMode('idle')
    setDraft([])
    setError(undefined)
    try {
      const f = await api.demoFarm()
      set({ farm: { name: f.name, region: '', polygon: f.polygon, areaHa: f.areaHa, isDemo: true }, diagnosis: undefined, simulation: undefined })
    } catch {
      setError(t('select.serverDown'))
    }
  }

  function startDraw() {
    setMode('draw')
    setDraft([])
    set({ farm: undefined, diagnosis: undefined, simulation: undefined })
  }

  function finishDraw() {
    if (draft.length < 3) return
    set({
      farm: { name: '', region: '', polygon: draft, areaHa: Math.round(areaHa(draft)), isDemo: false },
      diagnosis: undefined,
      simulation: undefined,
    })
    setMode('idle')
    setDraft([])
  }

  async function doSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!q.trim()) return
    try {
      setResults(await searchPlace(q, lang))
    } catch {
      setResults([])
    }
  }

  async function analyze() {
    if (!farm) return
    setAnalyzing(true)
    setError(undefined)
    setStep(0)
    timer.current = window.setInterval(() => setStep((x) => Math.min(x + 1, STEPS.length - 1)), 900)
    try {
      const [d] = await Promise.all([api.diagnosis(farm.polygon), new Promise((r) => setTimeout(r, 2200))])
      set({ diagnosis: d, farm: { ...farm, areaHa: d.areaHa } })
      nav('/diagnostico')
    } catch (err) {
      setError((err as Error).message)
      setAnalyzing(false)
    } finally {
      window.clearInterval(timer.current)
    }
  }

  return (
    <div className="screen">
      <AppHeader demo={!!farm?.isDemo} farmName={farm ? farmLabel(t, farm) : undefined} page={farm ? t('select.page') : undefined} step={0} />
      <div className="split">
        <aside className="side">
          <div>
            <h1>{t('select.title')}</h1>
            <p className="muted" style={{ marginTop: 8, fontSize: 15, lineHeight: 1.5 }}>
              {t('select.lead')}
            </p>
          </div>

          <form className="search" onSubmit={doSearch}>
            <Search size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('select.search')} aria-label={t('select.searchAria')} />
            {results.length > 0 && (
              <div className="search-results">
                {results.map((r) => (
                  <button
                    type="button"
                    key={r.name}
                    onClick={() => {
                      setFocus({ lat: r.lat, lng: r.lng, zoom: 14 })
                      setResults([])
                      startDraw()
                    }}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            )}
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className={`option ${mode === 'draw' ? 'on' : ''}`} onClick={startDraw}>
              <span className="icon-wrap"><PenTool size={17} /></span>
              <span><strong>{t('select.draw')}</strong><small>{t('select.drawSub')}</small></span>
              <ChevronRight size={16} />
            </button>
            <button className={`option ${farm?.isDemo ? 'on' : ''}`} onClick={useDemo}>
              <span className="icon-wrap"><Sparkles size={17} /></span>
              <span><strong>{t('select.demo')}</strong><small>{t('select.demoSub')}</small></span>
              {farm?.isDemo ? <Check size={16} color="var(--forest-700)" /> : <ChevronRight size={16} />}
            </button>
          </div>

          {mode === 'draw' && (
            <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <strong style={{ fontSize: 14, color: 'var(--forest-900)' }}>
                {draft.length < 3 ? t('select.needPoints', { n: draft.length }) : t('select.points', { n: draft.length, ha: Math.round(areaHa(draft)) })}
              </strong>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" onClick={() => setDraft((d) => d.slice(0, -1))} disabled={!draft.length} iconLeft={<Undo2 size={16} />}>
                  {t('select.undo')}
                </Button>
                <Button onClick={finishDraw} disabled={draft.length < 3} icon={<Check size={16} />}>
                  {t('select.finish')}
                </Button>
              </div>
            </div>
          )}

          <div style={{ flex: 1 }} />
          {error && <div className="error-banner">{error}</div>}

          {farm && mode !== 'draw' && (
            <div className="card area-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="status-dot section-label" style={{ color: 'var(--forest-700)' }}>{t('select.selected')}</span>
                <button className="icon-btn" style={{ width: 32, height: 32, border: 0 }} onClick={startDraw} aria-label={t('select.redraw')}>
                  <Pencil size={15} />
                </button>
              </div>
              <span className="name">{farmLabel(t, farm)}</span>
              <div className="kv">
                <div><small><SquareDashed size={11} /> {t('select.area')}</small><strong className="big tabular">{farm.areaHa} ha</strong></div>
                <div><small><MapIcon size={11} /> {t('select.region')}</small><strong>{regionLabel(t, farm)}</strong></div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <SourceLabel kind={farm.isDemo ? 'estimate' : 'user'} dataset={farm.isDemo ? t('select.demoField') : undefined} />
              </div>
              <Button className="btn-block" onClick={analyze} disabled={analyzing} icon={analyzing ? <Spinner size={16} /> : <ScanSearch size={18} />}>
                {analyzing ? t('select.analyzing') : t('select.analyze')}
              </Button>
            </div>
          )}
        </aside>

        <FarmMap
          polygon={farm?.polygon}
          draft={mode === 'draw' ? draft : undefined}
          onAddPoint={mode === 'draw' ? (p) => setDraft((d) => [...d, p]) : undefined}
          focus={focus}
        >
          {mode === 'draw' && (
            <div className="map-ui draw-hint glass">
              <PenTool size={16} /> {t('select.drawHint')}
            </div>
          )}
          {farm && !analyzing && (
            <div className="map-ui glass" style={{ top: 20, left: 20 }}>
              <MapPin size={16} /> {farmLabel(t, farm)} · {farm.areaHa} ha
            </div>
          )}
          {analyzing && (
            <>
              <div className="scan" />
              <div className="progress-card">
                <strong style={{ fontSize: 16, color: 'var(--forest-900)' }}>{t('select.progressTitle')}</strong>
                {STEPS.map((st, i) => (
                  <div key={st.t} className={`row ${i > step ? 'todo' : ''}`}>
                    {i < step ? <span className="check"><Check size={12} /></span> : i === step ? <Spinner size={20} /> : <span className="pending" />}
                    <span>{t(st.t)}<small>{st.s}</small></span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="map-ui map-caption" style={{ left: 20, bottom: 20 }}>
            {t('map.s2Caption')}
          </div>
        </FarmMap>
      </div>
    </div>
  )
}
