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
} from 'lucide-react'
import { AppHeader, Button, DemoBadge, SourceLabel } from '../components/ui'
import { FarmMap } from '../components/FarmMap'
import type { ScenarioId, YearOutcome } from '../lib/api'
import { CROPS, SCENARIOS, STRATEGY_ICONS, brlMil, fmtDec, fmtInt, fmtPrice, level, safra } from '../lib/meta'
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
  const good = better === 'higher' ? delta > 0 : delta < 0
  const cls = delta === 0 ? 'flat' : good ? 'good' : 'bad'
  return (
    <section className="card metric">
      <div className="metric-top">
        <span className="icon-wrap" style={{ background: iconBg, color: iconColor }}>{icon}</span>
        {name}
        <button
          className="info"
          aria-label={`Sobre ${name}`}
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
        <span className={`delta ${cls}`} title="Diferença para a rotação atual">
          {delta === 0 ? <Minus size={12} /> : delta > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {deltaLabel ?? (delta > 0 ? `+${delta}` : delta)}
        </span>
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
  const [flash, setFlash] = useState(false)
  const [pulse, setPulse] = useState(false)
  const climateRef = useRef<HTMLDivElement>(null)
  const flashTimer = useRef<number>()
  useEffect(() => () => window.clearTimeout(flashTimer.current), [])

  const sim = s.simulation
  if (!s.farm || !sim) return <Navigate to={s.farm ? '/objetivos' : '/terra'} replace />

  const strategy = sim.strategies.find((x) => x.id === s.strategyId) ?? sim.strategies[0]
  const scen = strategy.scenarios[s.scenario]
  const y: YearOutcome = scen.years[s.yearIdx]
  const b: YearOutcome = sim.baseline.scenarios[s.scenario].years[s.yearIdx]
  const crop = CROPS[y.crop]
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

  const water = level(y.waterDemandIdx, [70, 90], ['Baixa', 'Média', 'Alta'])
  const risk = level(y.riskIdx, [15, 30], ['risco baixo', 'risco moderado', 'risco alto'])
  const calib = sim.calibration
  const cal = calib.crops.find((c) => c.crop === y.crop)

  return (
    <div className="screen">
      <AppHeader
        demo={s.farm.isDemo}
        farmName={s.farm.name}
        page="Laboratório de Futuros"
        step={3}
        action={<Button onClick={() => nav('/comparar')} icon={<Columns3 size={16} />}>Comparar resultados</Button>}
      />
      <div className="lab">
        <aside className="lab-left">
          <div>
            <h1>Explore diferentes futuros</h1>
            <p className="lead">Veja como escolhas de cultivo e condições climáticas podem transformar os resultados da sua terra.</p>
          </div>

          <div className="sec">
            <span className="section-label">Estratégia</span>
            {sim.strategies.map((st) => {
              const Icon = STRATEGY_ICONS[st.icon] ?? History
              const on = st.id === strategy.id
              return (
                <button key={st.id} className={`strat-opt ${on ? 'on' : ''}`} onClick={() => chooseStrategy(st.id)} aria-pressed={on}>
                  <Icon size={16} />
                  {st.name}
                  {on ? <span className="tick"><Check size={11} /></span> : st.id === sim.recommended ? <span className="rec">Seu objetivo</span> : null}
                </button>
              )
            })}
            {flash && <span className="microtext">Nova estratégia aplicada</span>}
          </div>

          <div className="sec" ref={climateRef}>
            <span className="section-label">Cenário climático</span>
            <div className={`seg ${pulse ? 'pulse' : ''}`} role="radiogroup" aria-label="Cenário climático" onAnimationEnd={() => setPulse(false)}>
              {SCENARIOS.map((c) => (
                <button key={c.id} role="radio" aria-checked={s.scenario === c.id} className={s.scenario === c.id ? 'on' : ''} onClick={() => chooseScenario(c.id)}>
                  <c.icon size={20} color={c.id === 'seco' ? '#D9A65E' : c.id === 'chuvoso' ? '#75B9DF' : undefined} />
                  {c.name}
                </button>
              ))}
            </div>
            <p className="note">
              <History size={13} />
              <span>
                {s.scenario === 'seco' ? 'Safras com veranico forte' : s.scenario === 'chuvoso' ? 'Safras sem veranico' : 'Safras com veranico moderado'} (mês mais seco de nov–mar, NASA POWER): {analog.map(safra).join(', ')}.
              </span>
            </p>
          </div>

          <div className="sec">
            <span className="section-label">Culturas no plano</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[...new Set(strategy.sequence)].map((c) => {
                const C = CROPS[c]
                return (
                  <span key={c} className="chip" style={{ padding: '7px 10px', fontSize: 12 }}>
                    <C.icon size={14} color="var(--forest-700)" /> {C.short}
                  </span>
                )
              })}
            </div>
          </div>

          <div className="demo-note">
            <FlaskConical size={14} style={{ flex: 'none', marginTop: 1 }} />
            Calculado com NASA POWER, IBGE PAM, SoilGrids e SRTM. Receita bruta: custos de produção não incluídos.
          </div>
        </aside>

        <section className="lab-center">
          <FarmMap className="lab-map" polygon={s.farm.polygon} fill={crop.tint} fillOpacity={0.5}>
            <div className="map-ui" style={{ top: 20, left: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="glass"><scenMeta.icon size={16} /> Cenário: {scenMeta.name}</span>
              <span className="glass">{(() => { const I = STRATEGY_ICONS[strategy.icon] ?? History; return <I size={16} /> })()} Estratégia {strategy.name.toLowerCase()}</span>
            </div>
            <div className="year-card" key={`${strategy.id}-${s.yearIdx}`}>
              <img src={crop.photo} alt="" />
              <div>
                <small>{y.year} · chuva da safra {y.seasonRainMm} mm</small>
                <strong>{crop.name}</strong>
              </div>
            </div>
            <div className="map-ui map-caption" style={{ left: 20, bottom: 20 }}>
              <Eye size={13} /> Ilustração do cenário · base Sentinel-2
            </div>
            <button className="fab" onClick={whatIf}>
              <span className="icon-wrap"><CloudLightning size={15} /></span>
              E se eu mudar o clima?
            </button>
          </FarmMap>

          <div className="card timeline">
            <button className="icon-btn" onClick={() => setYear(s.yearIdx - 1)} disabled={s.yearIdx === 0} aria-label="Ano anterior">
              <ChevronLeft size={18} />
            </button>
            <div className="tl-track">
              <i className="tl-line" />
              <i className="tl-fill" style={{ width: `${(s.yearIdx / 2) * 66.66}%` }} />
              {scen.years.map((yy, i) => {
                const C = CROPS[yy.crop]
                const on = i === s.yearIdx
                return (
                  <button key={yy.year} className="tl-step" onClick={() => setYear(i)} aria-current={on}>
                    <span className={`tl-node ${on ? 'on' : i < s.yearIdx ? 'done' : ''}`} />
                    <span className={`tl-label ${on ? 'on' : ''}`}>
                      <C.icon size={14} /> <strong>{yy.year}</strong> {C.name}
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
                aria-label="Ano da simulação"
              />
            </div>
            <button className="icon-btn" onClick={() => setYear(s.yearIdx + 1)} disabled={s.yearIdx === 2} aria-label="Próximo ano">
              <ChevronRight size={18} />
            </button>
          </div>
        </section>

        <aside className="lab-right">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong style={{ fontSize: 19, color: 'var(--forest-900)', letterSpacing: -0.3 }}>Resultados deste futuro</strong>
            <span className="muted" style={{ fontSize: 13 }}>{y.year} · {crop.name} · {scenMeta.name}</span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {sim.demo ? <DemoBadge label="Inclui dados offline de exemplo" /> : <SourceLabel kind="estimate" dataset="dados reais + modelo" />}
              <span className="legend-bar"><b /> este futuro <i /> rotação atual</span>
            </div>
          </div>
          <Metric
            icon={<Coins size={16} />} iconBg="rgba(36,90,67,.1)" iconColor="var(--forest-700)"
            name="Receita bruta estimada" value={y.harvest ? `R$ ${brlMil(y.revenueBrlHa)}` : 'R$ 0'} unit="/ha"
            pct={y.returnIdx} base={b.returnIdx} delta={y.revenueBrlHa - b.revenueBrlHa} better="higher" barColor="var(--forest-700)"
            deltaLabel={`${y.revenueBrlHa - b.revenueBrlHa >= 0 ? '+' : '−'}${brlMil(Math.abs(y.revenueBrlHa - b.revenueBrlHa))}`}
            caption={y.harvest && cal ? `${fmtInt(y.yieldKgHa)} kg/ha × R$ ${fmtPrice(cal.priceBrlKg)}/kg · IBGE PAM ${calib.yieldPlace}` : 'Cobertura vegetal não gera receita direta'}
            tip={`Produtividade de tendência do município (IBGE PAM ${cal ? `${cal.firstYear}–${cal.lastYear}` : ''}) ajustada pelo desempenho médio nas safras análogas, × preço médio implícito dos últimos 3 anos. Receita bruta: custos não incluídos.`}
          />
          <Metric
            icon={<Droplets size={16} />} iconBg="rgba(117,185,223,.18)" iconColor="var(--sky-ink)"
            name="Demanda de água" value={water} unit={`${fmtInt(y.etcMm)} de ${fmtInt(y.effRainMm)} mm`}
            pct={y.waterDemandIdx} base={b.waterDemandIdx} delta={y.etcMm - b.etcMm} better="lower" barColor="var(--sky-400)"
            deltaLabel={`${y.etcMm - b.etcMm >= 0 ? '+' : '−'}${fmtInt(Math.abs(y.etcMm - b.etcMm))} mm`}
            caption={y.deficitMm > 0 ? `Déficit de ${fmtInt(y.deficitMm)} mm · FAO-56 com NASA POWER` : 'Chuva efetiva cobre a necessidade · FAO-56 com NASA POWER'}
            tip="Evapotranspiração da cultura no ciclo (Penman–Monteith FAO-56 com dados NASA POWER × Kc) comparada com a chuva efetiva (USDA-SCS) das safras análogas."
          />
          <Metric
            icon={<Layers size={16} />} iconBg="rgba(217,166,94,.2)" iconColor="#9a6b2c"
            name="Perda de solo estimada" value={fmtDec(y.soilLossTHa)} unit="t/ha/ano"
            pct={y.soilIdx} base={b.soilIdx} delta={y.soilLossTHa - b.soilLossTHa} better="lower" barColor="#C98F45"
            deltaLabel={`${y.soilLossTHa - b.soilLossTHa >= 0 ? '+' : '−'}${fmtDec(Math.abs(y.soilLossTHa - b.soilLossTHa))} t`}
            caption={`RUSLE · solo SoilGrids, declividade SRTM ${fmtDec(calib.soil.slopePct)}%, chuva NASA POWER`}
            tip={`Barra = proteção do solo pela cobertura (1 − fator C). Perda = R ${fmtInt(calib.soil.rFactorTipico)} × K ${calib.soil.kFactor} × LS ${calib.soil.lsFactor} × C.`}
          />
          <Metric
            icon={<CloudLightning size={16} />} iconBg="rgba(232,176,62,.18)" iconColor="#b5852a"
            name="Risco climático" value={y.harvest ? `${y.lossSeasons} de ${y.analogSeasons}` : 'Sem colheita'} unit={y.harvest ? `safras com quebra · ${risk}` : undefined}
            pct={y.riskIdx} base={b.riskIdx} delta={y.riskIdx - b.riskIdx} better="lower" barColor="var(--alert-amber)"
            caption={`Quebra = produtividade ${Math.round((1 - calib.lossThreshold) * 100)}% abaixo da tendência · IBGE PAM × NASA POWER`}
            tip={`Em quantas safras parecidas com este cenário (${analog.map(safra).join(', ')}) a produtividade do município caiu ${Math.round((1 - calib.lossThreshold) * 100)}% ou mais abaixo da tendência.`}
          />
        </aside>
      </div>
    </div>
  )
}
