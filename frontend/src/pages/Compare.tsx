import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, ChevronsLeftRight, Coins, Droplets, FlaskConical, History, Layers, ShieldCheck, Star, Sun } from 'lucide-react'
import { AppHeader, Button, DemoBadge, EstTag, SourceLabel } from '../components/ui'
import { FarmMap } from '../components/FarmMap'
import type { Strategy } from '../lib/api'
import { CROPS, SCENARIOS, STRATEGY_ICONS, brlMil, cropMeta, cropShort, farmLabel, fmtDec, scenarioName, strategyName, strategyTagline } from '../lib/meta'
import { useI18n } from '../lib/i18n'
import { useStore } from '../lib/store'

const ORDER = ['retorno', 'equilibrada', 'resiliencia', 'sustentavel', 'minha']

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
  const { t } = useI18n()
  const [split, setSplit] = useState(50)
  const sim = s.simulation
  if (!s.farm || !sim) return <Navigate to={s.farm ? '/objetivos' : '/terra'} replace />

  const selected = s.strategyId ?? sim.recommended
  const hasMine = sim.strategies.some((x) => x.id === 'minha')
  const cards = pickThree(sim.strategies, [sim.recommended, selected, ...(hasMine ? ['minha'] : [])])
  const sel = sim.strategies.find((x) => x.id === selected)!
  const scen = s.scenario
  const last = sel.scenarios[scen].years[2]
  const baseLast = sim.baseline.scenarios[scen].years[2]
  const lastCrop = cropMeta(last.crop)

  const rows = (st: Strategy) => {
    const v = st.scenarios[scen].summary
    return [
      { k: t('cmp.row.revenue'), icon: Coins, v: v.returnIdx ?? 0, label: v.revenueBrlHa === null ? t('common.na') : `R$ ${brlMil(v.revenueBrlHa)}`, tip: v.revenueBrlHa === null ? t('cmp.naNote') : t('cmp.tip.revenue') },
      { k: t('cmp.row.water'), icon: Droplets, v: v.waterSavingIdx, label: `${v.waterSavingIdx}`, tip: t('cmp.tip.water') },
      { k: t('cmp.row.soil'), icon: Layers, v: v.soilIdx, label: `${fmtDec(v.soilLossTHa)} t`, tip: t('cmp.tip.soil') },
      { k: t('cmp.row.climate'), icon: ShieldCheck, v: v.resilienceIdx, label: `${v.resilienceIdx}`, tip: t('cmp.tip.climate') },
    ]
  }

  return (
    <div className="screen">
      <AppHeader demo={s.farm.isDemo} farmName={farmLabel(t, s.farm)} page={t('cmp.page')} />
      <main className="page wide">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div className="page-title">
            <h1>{t('cmp.title')}</h1>
            <p>{t('cmp.hint')}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="seg" style={{ padding: 3 }} role="radiogroup" aria-label={t('lab.climate')}>
              {SCENARIOS.map((c) => (
                <button key={c.id} role="radio" aria-checked={scen === c.id} className={scen === c.id ? 'on' : ''} onClick={() => set({ scenario: c.id })} style={{ flexDirection: 'row', padding: '7px 12px' }}>
                  <c.icon size={15} /> {scenarioName(t, c.id)}
                </button>
              ))}
            </div>
            {sim.demo ? <DemoBadge label={t('common.offlineIncluded')} /> : <SourceLabel kind="estimate" dataset={t('common.realData')} />}
          </div>
        </div>

        <div className="cmp-cards" role="radiogroup" aria-label={t('cmp.strategiesAria')}>
          {cards.map((st) => {
            const Icon = STRATEGY_ICONS[st.icon] ?? History
            const aligned = st.id === sim.recommended
            const on = st.id === selected
            return (
              <button key={st.id} role="radio" aria-checked={on} className={`scard ${aligned ? 'aligned' : ''} ${on ? 'on' : ''}`} onClick={() => set({ strategyId: st.id })}>
                <div className="scard-top">
                  <span className="icon-wrap"><Icon size={20} /></span>
                  <strong>{strategyName(t, st.id)}</strong>
                  {st.estimated && <EstTag dark={aligned} />}
                  {aligned && <span className="aligned-badge"><Star size={11} /> {t('lab.yourGoal')}</span>}
                  <span className="radio">{on && <Check size={14} />}</span>
                </div>
                <div className="seq">
                  {st.sequence.map((c, i) => {
                    const C = cropMeta(c)
                    return (
                      <span key={i} className={C.estimated ? 'est' : ''} title={C.estimated ? t('common.estimatedTitle') : undefined}>
                        <C.icon size={13} /> {cropShort(t, c, st.scenarios[scen].years[i]?.cropName)}
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
                <span className="tagline">{strategyTagline(t, st.id)}</span>
                {st.scenarios[scen].summary.revenueBrlHa === null && <span className="na-note">{t('cmp.naNote')}</span>}
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
            <span className="split-tag" style={{ left: 14 }}><Sun size={13} /> {t('cmp.today')}</span>
            <span className="split-tag" style={{ right: 14 }}><lastCrop.icon size={13} color="var(--lime-400)" /> 2029 · {cropShort(t, last.crop, last.cropName)}</span>
            <input className="split-range" type="range" min={5} max={95} value={split} onChange={(e) => setSplit(+e.target.value)} aria-label={t('landing.rangeAria')} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 12 }}>
            <strong style={{ fontSize: 22, letterSpacing: -0.4, color: 'var(--forest-900)' }}>{t('cmp.twoFutures')}</strong>
            <p className="muted" style={{ fontSize: 15, lineHeight: 1.5 }}>
              {t(sel.id === 'minha' ? 'cmp.soilTextMine' : 'cmp.soilText', { name: strategyName(t, sel.id).toLowerCase(), loss: fmtDec(last.soilLossTHa), base: fmtDec(baseLast.soilLossTHa) })}
            </p>
            <span className="note"><FlaskConical size={13} /> {t('cmp.note')}</span>
            <Button className="btn-block" onClick={() => nav('/plano')} icon={<ArrowRight size={18} />}>
              {t('cmp.seePlan', { name: strategyName(t, sel.id) })}
            </Button>
            <Button variant="ghost" className="btn-block" onClick={() => nav('/laboratorio')}>
              {t('cmp.adjust')}
            </Button>
          </div>
        </section>
      </main>
    </div>
  )
}
