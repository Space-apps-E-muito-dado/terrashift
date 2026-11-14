import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, ChevronsLeftRight, Coins, Droplets, FlaskConical, History, Layers, ShieldCheck, Star, Sun } from 'lucide-react'
import { AppHeader, Button, DemoBadge, SourceLabel } from '../components/ui'
import { FarmMap } from '../components/FarmMap'
import type { Strategy } from '../lib/api'
import { CROPS, SCENARIOS, STRATEGY_ICONS, brlMil, fmtDec } from '../lib/meta'
import { useStore } from '../lib/store'

const ORDER = ['retorno', 'equilibrada', 'resiliencia', 'sustentavel']

/** Always show the aligned and the selected strategy, then fill up to three in a fixed order. */
function pickThree(all: Strategy[], must: string[]): Strategy[] {
  const ids = new Set(must)
  for (const id of ORDER) if (ids.size < 3) ids.add(id)
  return ORDER.filter((id) => ids.has(id))
    .map((id) => all.find((s) => s.id === id))
    .filter((s): s is Strategy => Boolean(s))
}

export default function Compare() {
  const nav = useNavigate()
  const { s, set } = useStore()
  const [split, setSplit] = useState(50)
  const sim = s.simulation
  if (!s.farm || !sim) return <Navigate to={s.farm ? '/objetivos' : '/terra'} replace />

  const selected = s.strategyId ?? sim.recommended
  const cards = pickThree(sim.strategies, [sim.recommended, selected])
  const sel = sim.strategies.find((x) => x.id === selected)!
  const scen = s.scenario
  const last = sel.scenarios[scen].years[2]
  const baseLast = sim.baseline.scenarios[scen].years[2]
  const lastCrop = CROPS[last.crop]

  const rows = (st: Strategy) => {
    const v = st.scenarios[scen].summary
    return [
      { k: 'Receita', icon: Coins, v: v.returnIdx, label: `R$ ${brlMil(v.revenueBrlHa)}`, tip: 'Receita bruta média por hectare e ano (IBGE PAM)' },
      { k: 'Água', icon: Droplets, v: v.waterSavingIdx, label: `${v.waterSavingIdx}`, tip: 'Folga hídrica: 50 = chuva efetiva igual à necessidade da cultura' },
      { k: 'Solo', icon: Layers, v: v.soilIdx, label: `${fmtDec(v.soilLossTHa)} t`, tip: 'Perda de solo média (t/ha/ano, RUSLE); barra = proteção' },
      { k: 'Clima', icon: ShieldCheck, v: v.resilienceIdx, label: `${v.resilienceIdx}`, tip: '100 − % de safras análogas com quebra de produtividade' },
    ]
  }

  return (
    <div className="screen">
      <AppHeader demo={s.farm.isDemo} farmName={s.farm.name} page="Comparação" />
      <main className="page wide">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div className="page-title">
            <h1>Qual futuro combina mais com você?</h1>
            <p>Toque em um futuro para escolher</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="seg" style={{ padding: 3 }} role="radiogroup" aria-label="Cenário climático">
              {SCENARIOS.map((c) => (
                <button key={c.id} role="radio" aria-checked={scen === c.id} className={scen === c.id ? 'on' : ''} onClick={() => set({ scenario: c.id })} style={{ flexDirection: 'row', padding: '7px 12px' }}>
                  <c.icon size={15} /> {c.name}
                </button>
              ))}
            </div>
            {sim.demo ? <DemoBadge label="Inclui dados offline" /> : <SourceLabel kind="estimate" dataset="dados reais + modelo" />}
          </div>
        </div>

        <div className="cmp-cards" role="radiogroup" aria-label="Estratégias">
          {cards.map((st) => {
            const Icon = STRATEGY_ICONS[st.icon] ?? History
            const aligned = st.id === sim.recommended
            const on = st.id === selected
            return (
              <button key={st.id} role="radio" aria-checked={on} className={`scard ${aligned ? 'aligned' : ''} ${on ? 'on' : ''}`} onClick={() => set({ strategyId: st.id })}>
                <div className="scard-top">
                  <span className="icon-wrap"><Icon size={20} /></span>
                  <strong>{st.name}</strong>
                  {aligned && <span className="aligned-badge"><Star size={11} /> Seu objetivo</span>}
                  <span className="radio">{on && <Check size={14} />}</span>
                </div>
                <div className="seq">
                  {st.sequence.map((c, i) => {
                    const C = CROPS[c]
                    return (
                      <span key={i} style={{ background: undefined }}>
                        <C.icon size={13} /> {C.short}
                      </span>
                    )
                  }).flatMap((el, i) => (i < 2 ? [el, <ArrowRight key={`a${i}`} size={12} className="arrow" />] : [el]))}
                </div>
                <div className="idx-rows">
                  {rows(st).map((r) => (
                    <div className="idx-row" key={r.k} title={r.tip}>
                      <r.icon size={14} />
                      <span>{r.k}</span>
                      <span className="track">
                        <b style={{ width: `${r.v}%`, background: aligned ? 'var(--lime-400)' : r.v >= 70 ? 'var(--forest-700)' : '#A9B5AD' }} />
                      </span>
                      <em>{r.label}</em>
                    </div>
                  ))}
                </div>
                <span className="tagline">{st.tagline}</span>
              </button>
            )
          })}
        </div>

        <section className="card twofut">
          <div className="split-map">
            <FarmMap polygon={s.farm.polygon} interactive={false} fill={CROPS.soja.tint} fillOpacity={0.15} className="split-map" />
            <div className="split-overlay" style={{ left: `${split}%`, background: `${lastCrop.tint}88` }} />
            <div className="split-line" style={{ left: `${split}%` }} />
            <div className="split-handle" style={{ left: `${split}%` }}><ChevronsLeftRight size={18} /></div>
            <span className="split-tag" style={{ left: 14 }}><Sun size={13} /> Hoje · rotação atual</span>
            <span className="split-tag" style={{ right: 14 }}><lastCrop.icon size={13} color="var(--lime-400)" /> 2029 · {lastCrop.short}</span>
            <input className="split-range" type="range" min={5} max={95} value={split} onChange={(e) => setSplit(+e.target.value)} aria-label="Comparar hoje e 2029" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 12 }}>
            <strong style={{ fontSize: 22, letterSpacing: -0.4, color: 'var(--forest-900)' }}>Mesma terra, dois futuros</strong>
            <p className="muted" style={{ fontSize: 15, lineHeight: 1.5 }}>
              Em 2029, com a estratégia {sel.name.toLowerCase()}, a perda de solo estimada é de {fmtDec(last.soilLossTHa)} t/ha, contra {fmtDec(baseLast.soilLossTHa)} t/ha se a rotação atual continuar.
            </p>
            <span className="note"><FlaskConical size={13} /> RUSLE com SoilGrids, SRTM e NASA POWER · imagem base Sentinel-2</span>
            <Button className="btn-block" onClick={() => nav('/plano')} icon={<ArrowRight size={18} />}>
              Ver plano · {sel.name}
            </Button>
            <Button variant="ghost" className="btn-block" onClick={() => nav('/laboratorio')}>
              Ajustar no laboratório
            </Button>
          </div>
        </section>
      </main>
    </div>
  )
}
