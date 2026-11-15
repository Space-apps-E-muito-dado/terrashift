import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudLightning,
  Coins,
  Columns3,
  Droplets,
  Eye,
  FlaskConical,
  History,
  Info,
  Layers,
  Minus,
  UserRound,
} from 'lucide-react'
import { AppHeader, Button, DemoBadge, EstTag, SourceLabel } from '../components/ui'
import { CropThumb } from '../components/CropThumb'
import { MyRotationDialog } from '../components/MyRotationDialog'
import { FarmMap } from '../components/FarmMap'
import type { ScenarioId, YearOutcome } from '../lib/api'
import { isDiagnosisOnly } from '../lib/api'
import { SCENARIOS, cropMeta, STRATEGY_ICONS, brlMil, cropName, cropShort, farmLabel, fmtDec, fmtInt, fmtNum, fmtPrice, level, safra, scenarioName, strategyName } from '../lib/meta'
import { useI18n } from '../lib/i18n'
import { useStore } from '../lib/store'

type Better = 'higher' | 'lower'

function Metric({
  icon,
  iconBg,
  iconColor,
  name,
  value,
  unit,
  pct,
  base,
  delta,
  better,
  barColor,
  caption,
  tip,
  deltaLabel,
}: {
  icon: ReactNode
  iconBg: string
  iconColor: string
  name: string
  value: string
  unit?: string
  pct: number
  base: number
  delta: number
  better: Better
  barColor: string
  caption: string
  tip: string
  deltaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const { t } = useI18n()
  const good = better === 'higher' ? delta > 0 : delta < 0
  const cls = delta === 0 ? 'flat' : good ? 'good' : 'bad'
  return (
    <section className="card metric">
      <div className="metric-top">
        <span className="icon-wrap" style={{ background: iconBg, color: iconColor }}>{icon}</span>
        {name}
        <button
          className="info"
          aria-label={t('lab.about', { name })}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        >
          <Info size={14} />
        </button>
      </div>
      <div className="metric-val">
        <strong>{value}</strong>
        {unit && <span>{unit}</span>}
        {deltaLabel !== '—' && <span className={`delta ${cls}`} title={t('lab.diffCurrent')}>
          {delta === 0 ? <Minus size={12} /> : delta > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {deltaLabel ?? (delta > 0 ? `+${delta}` : delta)}
        </span>}
      </div>
      <div className="track" aria-hidden>
        <b style={{ width: `${pct}%`, background: barColor }} />
        <i style={{ left: `${base}%` }} />
      </div>
      <small>{caption}</small>
      {open && (
        <div className="tooltip" role="tooltip">
          <strong>{name}</strong>
          {tip}
        </div>
      )}
    </section>
  )
}

export default function Lab() {
  const nav = useNavigate()
  const { s, set } = useStore()
  const { t } = useI18n()
  const [flash, setFlash] = useState(false)
  const [pulse, setPulse] = useState(false)
  const [building, setBuilding] = useState(false)
  const climateRef = useRef<HTMLDivElement>(null)
  const flashTimer = useRef<number>()
  useEffect(() => () => window.clearTimeout(flashTimer.current), [])

  const sim = s.simulation
  if (isDiagnosisOnly(s.diagnosis)) return <Navigate to="/diagnostico" replace />
  if (!s.farm || !sim) return <Navigate to={s.farm ? '/objetivos' : '/terra'} replace />

  const strategy = sim.strategies.find((x) => x.id === s.strategyId) ?? sim.strategies[0]
  const scen = strategy.scenarios[s.scenario]
  const y: YearOutcome = scen.years[s.yearIdx]
  const b: YearOutcome = sim.baseline.scenarios[s.scenario].years[s.yearIdx]
  const crop = cropMeta(y.crop)
  const scenMeta = SCENARIOS.find((x) => x.id === s.scenario)!
  const analog = sim.analogYears[s.scenario]

  function chooseStrategy(id: string) {
    if (id === strategy.id) return
    set({ strategyId: id })
    setFlash(true)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(false), 2600)
  }
  function chooseScenario(id: ScenarioId) {
    set({ scenario: id })
  }
  function whatIf() {
    climateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setPulse(false)
    requestAnimationFrame(() => setPulse(true))
  }
  const setYear = (i: number) => set({ yearIdx: Math.max(0, Math.min(2, i)) })

  const water = level(y.waterDemandIdx, [70, 90], t('lab.level.water'))
  const risk = level(y.riskIdx, [15, 30], t('lab.level.risk'))
  const scenLabel = scenarioName(t, s.scenario)
  const stratLabel = strategyName(t, strategy.id)
  const thisCrop = cropName(t, y.crop, y.cropName)
  const lossPct = Math.round((1 - sim.calibration.lossThreshold) * 100)
  const calib = sim.calibration
  const cal = calib.crops.find((c) => c.crop === y.crop)
  const revDelta = y.revenueBrlHa !== null && b.revenueBrlHa !== null ? y.revenueBrlHa - b.revenueBrlHa : null

  return (
    <div className="screen">
      <AppHeader
        demo={s.farm.isDemo}
        farmName={farmLabel(t, s.farm)}
        page={t('lab.page')}
        step={4}
        action={<Button onClick={() => nav('/comparar')} icon={<Columns3 size={16} />}>{t('lab.compare')}</Button>}
      />
      <div className="lab">
        <aside className="lab-left">
          <div>
            <h1>{t('lab.title')}</h1>
            <p className="lead">{t('lab.lead')}</p>
          </div>

          <div className="sec">
            <span className="section-label">{t('lab.strategy')}</span>
            {sim.strategies.map((st) => {
              const Icon = STRATEGY_ICONS[st.icon] ?? History
              const on = st.id === strategy.id
              return (
                <button key={st.id} className={`strat-opt ${on ? 'on' : ''}`} onClick={() => chooseStrategy(st.id)} aria-pressed={on}>
                  <Icon size={16} />
                  {strategyName(t, st.id)}
                  {st.estimated && <EstTag />}
                  {on ? <span className="tick"><Check size={11} /></span> : st.id === sim.recommended ? <span className="rec">{t('lab.yourGoal')}</span> : null}
                </button>
              )
            })}
            {flash && <span className="microtext">{t('lab.applied')}</span>}
            <button className="strat-opt build" onClick={() => setBuilding(true)}>
              <UserRound size={16} />
              {s.myRotation ? t('mine.edit') : t('mine.open')}
            </button>
          </div>

          <div className="sec" ref={climateRef}>
            <span className="section-label">{t('lab.climate')}</span>
            <div className={`seg ${pulse ? 'pulse' : ''}`} role="radiogroup" aria-label={t('lab.climate')} onAnimationEnd={() => setPulse(false)}>
              {SCENARIOS.map((c) => (
                <button key={c.id} role="radio" aria-checked={s.scenario === c.id} className={s.scenario === c.id ? 'on' : ''} onClick={() => chooseScenario(c.id)}>
                  <c.icon size={20} color={c.id === 'seco' ? '#D9A65E' : c.id === 'chuvoso' ? '#75B9DF' : undefined} />
                  {scenarioName(t, c.id)}
                </button>
              ))}
            </div>
            <p className="note">
              <History size={13} />
              <span>
                {t('lab.analogNote', { kind: t(`lab.analog.${s.scenario}`), years: analog.map(safra).join(', ') })}
              </span>
            </p>
          </div>

          <div className="sec">
            <span className="section-label">{t('lab.crops')}</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[...new Set(strategy.sequence)].map((c) => {
                const C = cropMeta(c)
                return (
                  <span key={c} className="chip" style={{ padding: '7px 10px', fontSize: 12 }}>
                    <C.icon size={14} color="var(--forest-700)" /> {cropShort(t, c)}
                    {C.estimated && <EstTag />}
                  </span>
                )
              })}
            </div>
          </div>

          <div className="demo-note">
            <FlaskConical size={14} style={{ flex: 'none', marginTop: 1 }} />
            {t('lab.dataNote')}
          </div>
        </aside>

        <section className="lab-center">
          <FarmMap className="lab-map" polygon={s.farm.polygon} fill={crop.tint} fillOpacity={0.5}>
            <div className="map-ui" style={{ top: 20, left: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="glass"><scenMeta.icon size={16} /> {t('lab.scenarioChip', { name: scenLabel })}</span>
              <span className="glass">{(() => { const I = STRATEGY_ICONS[strategy.icon] ?? History; return <I size={16} /> })()} {strategy.id === 'minha' ? stratLabel : t('strategy.chip', { name: stratLabel.toLowerCase() })}</span>
            </div>
            <div className="year-card" key={`${strategy.id}-${s.yearIdx}`}>
              <CropThumb crop={y.crop} className="yc-thumb" />
              <div>
                <small>{t('lab.seasonRain', { year: y.year, mm: fmtInt(y.seasonRainMm) })}</small>
                <strong>{thisCrop}</strong>
                {y.estimated && <EstTag />}
              </div>
            </div>
            <div className="map-ui map-caption" style={{ left: 20, bottom: 20 }}>
              <Eye size={13} /> {t('lab.illustration')}
            </div>
            <button className="fab" onClick={whatIf}>
              <span className="icon-wrap"><CloudLightning size={15} /></span>
              {t('lab.whatIf')}
            </button>
          </FarmMap>

          <div className="card timeline">
            <button className="icon-btn" onClick={() => setYear(s.yearIdx - 1)} disabled={s.yearIdx === 0} aria-label={t('lab.prevYear')}>
              <ChevronLeft size={18} />
            </button>
            <div className="tl-track">
              <i className="tl-line" />
              <i className="tl-fill" style={{ width: `${(s.yearIdx / 2) * 66.66}%` }} />
              {scen.years.map((yy, i) => {
                const C = cropMeta(yy.crop)
                const on = i === s.yearIdx
                return (
                  <button key={yy.year} className="tl-step" onClick={() => setYear(i)} aria-current={on}>
                    <span className={`tl-node ${on ? 'on' : i < s.yearIdx ? 'done' : ''}`} />
                    <span className={`tl-label ${on ? 'on' : ''}`}>
                      <C.icon size={14} /> <strong>{yy.year}</strong> {cropName(t, yy.crop, yy.cropName)}
                    </span>
                  </button>
                )
              })}
              <input
                className="tl-range"
                type="range"
                min={0}
                max={2}
                step={1}
                value={s.yearIdx}
                onChange={(e) => setYear(+e.target.value)}
                aria-label={t('lab.yearAria')}
              />
            </div>
            <button className="icon-btn" onClick={() => setYear(s.yearIdx + 1)} disabled={s.yearIdx === 2} aria-label={t('lab.nextYear')}>
              <ChevronRight size={18} />
            </button>
          </div>
        </section>

        <aside className="lab-right">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong style={{ fontSize: 19, color: 'var(--forest-900)', letterSpacing: -0.3 }}>{t('lab.results')}</strong>
            <span className="muted" style={{ fontSize: 13 }}>{y.year} · {thisCrop} · {scenLabel}</span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {sim.demo ? <DemoBadge label={t('common.offlineIncluded')} /> : <SourceLabel kind="estimate" dataset={t('common.realData')} />}
              <span className="legend-bar"><b /> {t('lab.thisFuture')} <i /> {t('lab.current')}</span>
            </div>
          </div>
          <Metric
            icon={<Coins size={16} />} iconBg="rgba(36,90,67,.1)" iconColor="var(--forest-700)"
            name={t('lab.revenue')} value={y.revenueBrlHa === null ? t('common.na') : y.harvest ? `R$ ${brlMil(y.revenueBrlHa)}` : 'R$ 0'} unit={y.revenueBrlHa === null ? undefined : '/ha'}
            pct={y.returnIdx ?? 0} base={b.returnIdx ?? 0} delta={revDelta ?? 0} better="higher" barColor="var(--forest-700)"
            deltaLabel={revDelta === null ? '—' : `${revDelta >= 0 ? '+' : '−'}${brlMil(Math.abs(revDelta))}`}
            caption={
              y.revenueBrlHa === null
                ? t('lab.revenueNa')
                : y.harvest && cal
                  ? t('lab.revenueCaption', { yield: fmtInt(y.yieldKgHa ?? 0), price: fmtPrice(cal.priceBrlKg), place: calib.yieldPlace })
                  : y.crop === 'pousio'
                    ? t('lab.revenueFallow')
                    : t('lab.revenueNone')
            }
            tip={y.revenueBrlHa === null ? t('common.naTitle') : t('lab.revenueTip', { years: cal ? `${cal.firstYear}–${cal.lastYear}` : '' })}
          />
          <Metric
            icon={<Droplets size={16} />} iconBg="rgba(117,185,223,.18)" iconColor="var(--sky-ink)"
            name={t('lab.water')} value={water} unit={t('lab.waterUnit', { etc: fmtInt(y.etcMm), pe: fmtInt(y.effRainMm) })}
            pct={y.waterDemandIdx} base={b.waterDemandIdx} delta={y.etcMm - b.etcMm} better="lower" barColor="var(--sky-400)"
            deltaLabel={`${y.etcMm - b.etcMm >= 0 ? '+' : '−'}${fmtInt(Math.abs(y.etcMm - b.etcMm))} mm`}
            caption={y.deficitMm > 0 ? t('lab.waterDeficit', { mm: fmtInt(y.deficitMm) }) : t('lab.waterOk')}
            tip={t('lab.waterTip')}
          />
          <Metric
            icon={<Layers size={16} />} iconBg="rgba(217,166,94,.2)" iconColor="#9a6b2c"
            name={t('lab.soil')} value={fmtDec(y.soilLossTHa)} unit={t('lab.soilUnit')}
            pct={y.soilIdx} base={b.soilIdx} delta={y.soilLossTHa - b.soilLossTHa} better="lower" barColor="#C98F45"
            deltaLabel={`${y.soilLossTHa - b.soilLossTHa >= 0 ? '+' : '−'}${fmtDec(Math.abs(y.soilLossTHa - b.soilLossTHa))} t`}
            caption={t('lab.soilCaption', { slope: fmtDec(calib.soil.slopePct) })}
            tip={t('lab.soilTip', { r: fmtInt(calib.soil.rFactorTipico), k: fmtNum(calib.soil.kFactor, 4), ls: fmtNum(calib.soil.lsFactor, 3) })}
          />
          <Metric
            icon={<CloudLightning size={16} />} iconBg="rgba(232,176,62,.18)" iconColor="#b5852a"
            name={t('lab.risk')} value={y.harvest ? t('lab.riskValue', { n: y.lossSeasons, total: y.analogSeasons }) : t('lab.noHarvest')} unit={y.harvest ? t('lab.riskUnit', { level: risk }) : undefined}
            pct={y.riskIdx} base={b.riskIdx} delta={y.riskIdx - b.riskIdx} better="lower" barColor="var(--alert-amber)"
            caption={y.estimated ? t('lab.riskCaptionKy', { pct: lossPct }) : t('lab.riskCaption', { pct: lossPct })}
            tip={y.estimated ? t('lab.riskTipKy', { years: analog.map(safra).join(', '), pct: lossPct }) : t('lab.riskTip', { years: analog.map(safra).join(', '), pct: lossPct })}
          />
        </aside>
      </div>
      {building && <MyRotationDialog onClose={() => setBuilding(false)} onDone={() => setBuilding(false)} />}
    </div>
  )
}
