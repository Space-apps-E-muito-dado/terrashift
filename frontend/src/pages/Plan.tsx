import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ChevronDown, Coins, Columns3, Download, Layers, MapPin, Microscope, ShieldCheck } from 'lucide-react'
import { AppHeader, Button, DemoBadge, EstTag, SourceLabel } from '../components/ui'
import { CropThumb } from '../components/CropThumb'
import type { Simulation, Strategy } from '../lib/api'
import { assumptionLines, sourceLines } from '../lib/explain'
import { useI18n, type T } from '../lib/i18n'
import {
  SCENARIOS,
  cropMeta,
  STRATEGY_ICONS,
  brlMil,
  cropName,
  cropRole,
  farmLabel,
  fmtDec,
  fmtInt,
  fmtNum,
  fmtPrice,
  regionLabel,
  safra,
  scenarioName,
  strategyName,
} from '../lib/meta'
import { useStore, type FarmSel } from '../lib/store'

function report(t: T, farm: FarmSel, sim: Simulation, st: Strategy): string {
  const typ = st.scenarios.tipico
  const c = sim.calibration
  const of = t('report.of')
  const na = t('report.na')
  const lines = [
    `# ${t('report.title', { name: farmLabel(t, farm) })}`,
    '',
    t('report.area', { ha: farm.areaHa, region: regionLabel(t, farm) }),
    t('report.strategy', { name: strategyName(t, st.id), seq: typ.years.map((y) => `${cropName(t, y.crop, y.cropName)}${y.estimated ? ` (${t('common.estimated')})` : ''}`).join(' → ') }),
    '',
    `> ${t('report.disclaimer')}`,
    '',
    `## ${t('report.rotation')}`,
    '',
    t('report.rotationHead'),
    '|---|---|---|---|---|---|---|',
    ...typ.years.map(
      (y) =>
        `| ${y.year} | ${cropName(t, y.crop, y.cropName)}${y.estimated ? ` (${t('common.estimated')})` : ''} | ${y.yieldKgHa === null ? na : y.harvest ? fmtInt(y.yieldKgHa) : '—'} | ${y.revenueBrlHa === null ? na : fmtInt(y.revenueBrlHa)} | ${y.etcMm} / ${y.effRainMm} | ${fmtDec(y.soilLossTHa)} | ${y.harvest ? `${y.lossSeasons} ${of} ${y.analogSeasons}` : '—'} |`,
    ),
    '',
    `## ${t('report.byScenario')}`,
    '',
    t('report.byScenarioHead'),
    '|---|---|---|---|---|---|',
    ...SCENARIOS.map((sc) => {
      const v = st.scenarios[sc.id].summary
      return `| ${scenarioName(t, sc.id)} | ${sim.analogYears[sc.id].map(safra).join(', ')} | ${v.revenueBrlHa === null ? na : fmtInt(v.revenueBrlHa)} | ${v.waterSavingIdx} | ${fmtDec(v.soilLossTHa)} | ${v.resilienceIdx} |`
    }),
    '',
    `## ${t('plan.calib', { place: c.yieldPlace, level: t(`plan.level.${c.yieldLevel}` as 'plan.level.município'), source: t('source.ibgeName', { offline: sim.sources[2]?.live === false ? 1 : 0 }) })}`,
    '',
    t('report.calibHead'),
    '|---|---|---|---|---|',
    ...c.crops.map(
      (x) =>
        `| ${cropName(t, x.crop)} | ${x.firstYear}–${x.lastYear} | ${fmtInt(x.trendYieldKgHa)} | ${fmtPrice(x.priceBrlKg)} | ${fmtNum(x.seco.ratio, 3)} / ${fmtNum(x.tipico.ratio, 3)} / ${fmtNum(x.chuvoso.ratio, 3)} |`,
    ),
    '',
    soilCalib(t, sim),
    '',
    ...customLines(t, sim, st).flatMap((l, i) => (i === 0 ? [`## ${l}`, ''] : [`- ${l}`])),
    '',
    `## ${t('report.sources')}`,
    '',
    ...sourceLines(t, sim).map((x) => `- ${x.dataset} — ${x.detail}${x.live ? '' : ` (${t('common.offlineExample')})`}`),
    '',
    `## ${t('report.assumptions')}`,
    '',
    ...assumptionLines(t, sim).map((a) => `- ${a}`),
    '',
  ]
  return lines.join('\n')
}

/** Title + one line per farmer-defined crop used by the strategy (empty when none). */
function customLines(t: T, sim: Simulation, st: Strategy): string[] {
  const used = sim.customParams.filter((c) => st.sequence.includes(c.key))
  if (!used.length) return []
  return [
    t('plan.custom'),
    ...used.map(
      (c) =>
        `${t('plan.customRow', { name: c.name, days: c.cycleDays, month: t(`month.${c.plantingMonth}` as 'month.1'), kc: fmtNum(c.kcMid, 2), ky: c.ky === null ? '—' : fmtNum(c.ky, 2), c: fmtNum(c.cFactor, 2) })} ${t('plan.customSrc', { src: c.source })}`,
    ),
  ]
}

function soilCalib(t: T, sim: Simulation) {
  const c = sim.calibration
  return t('plan.soilCalib', {
    k: fmtNum(c.soil.kFactor, 4),
    ls: fmtNum(c.soil.lsFactor, 3),
    slope: fmtDec(c.soil.slopePct),
    len: c.soil.slopeLengthM,
    r: fmtInt(c.soil.rFactorTipico),
    et0: fmtInt(c.et0SeasonMm),
  })
}

export default function Plan() {
  const nav = useNavigate()
  const { s } = useStore()
  const { t } = useI18n()
  const sim = s.simulation
  if (!s.farm || !sim) return <Navigate to={s.farm ? '/objetivos' : '/terra'} replace />
  const st = sim.strategies.find((x) => x.id === (s.strategyId ?? sim.recommended))!
  const typ = st.scenarios.tipico
  const StIcon = STRATEGY_ICONS[st.icon]
  // Real data in every index, but small samples (8–9 analog seasons) and literature coefficients:
  // "moderate" while everything is live, "low" when any source fell back to offline data.
  const conf = sim.demo ? 2 : 3
  const cal = sim.calibration
  // Worst cash crop of the plan in seasons with a strong dry spell (the same historical seasons apply
  // to every year, so they must not be summed across the three years).
  const worstDry = st.scenarios.seco.years
    .filter((y) => y.harvest && y.analogSeasons > 0)
    .sort((a, b) => b.lossSeasons / b.analogSeasons - a.lossSeasons / a.analogSeasons)[0]
  const sources = sourceLines(t, sim)
  const farmName = farmLabel(t, s.farm)

  function exportReport() {
    const blob = new Blob([report(t, s.farm!, sim!, st)], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${t('plan.file')}-${farmName.toLowerCase().replace(/\s+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="screen">
      <AppHeader demo={s.farm.isDemo} farmName={farmName} page={t('plan.page')} />
      <main className="page wide">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div className="page-title">
            <h1>{t('plan.title')}</h1>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <span className="chip"><StIcon size={14} color="var(--forest-700)" /> {st.id === 'minha' ? strategyName(t, st.id) : t('strategy.chip', { name: strategyName(t, st.id).toLowerCase() })}</span>
              <span className="chip"><MapPin size={14} color="var(--forest-700)" /> {farmName} · {s.farm.areaHa} ha</span>
            </div>
          </div>
          {sim.demo ? <DemoBadge label={t('common.offlineIncluded')} /> : <SourceLabel kind="estimate" dataset={t('common.realData')} />}
        </div>

        <div className="plan-row">
          {typ.years.flatMap((y, i) => {
            const C = cropMeta(y.crop)
            const name = cropName(t, y.crop, y.cropName)
            const el = (
              <article key={y.year} className="plan-step">
                <CropThumb crop={y.crop} alt={name} className="plan-bg" iconSize={96} />
                <span className="yr">{y.year}</span>
                {y.estimated && <span className="plan-est"><EstTag /></span>}
                <div className="txt">
                  <strong><C.icon size={20} /> {name}</strong>
                  <p>{cropRole(t, y.crop, i > 0 ? typ.years[i - 1].crop : undefined)}</p>
                </div>
              </article>
            )
            return i < 2 ? [el, <span key={`a${i}`} className="round-arrow"><ArrowRight size={16} /></span>] : [el]
          })}
        </div>

        <div className="why">
          <div>
            <span className="icon-wrap" style={{ background: 'rgba(36,90,67,.1)', color: 'var(--forest-700)' }}><Coins size={20} /></span>
            {typ.summary.revenueBrlHa === null ? (
              <span><strong>{t('common.na')}</strong><p>{t('plan.revenueNa')}</p></span>
            ) : (
              <span><strong>R$ {brlMil(typ.summary.revenueBrlHa)}</strong><small>{t('plan.perHaYear')}</small><p>{t('plan.revenue')}</p></span>
            )}
          </div>
          <div>
            <span className="icon-wrap" style={{ background: 'rgba(217,166,94,.2)', color: '#9a6b2c' }}><Layers size={20} /></span>
            <span>
              <strong>{fmtDec(typ.summary.soilLossTHa)} t</strong><small>{t('plan.perHaYear')}</small>
              <p>{t('plan.soil', { base: fmtDec(sim.baseline.scenarios.tipico.summary.soilLossTHa) })}</p>
            </span>
          </div>
          <div>
            <span className="icon-wrap" style={{ background: 'rgba(117,185,223,.18)', color: 'var(--sky-ink)' }}><ShieldCheck size={20} /></span>
            {worstDry ? (
              <span>
                <strong>{t('lab.riskValue', { n: worstDry.lossSeasons, total: worstDry.analogSeasons })}</strong><small> {t('plan.seasons')}</small>
                <p>{t('plan.risk', { crop: cropName(t, worstDry.crop, worstDry.cropName).toLowerCase() })}{worstDry.estimated && <> <EstTag /></>}</p>
              </span>
            ) : (
              <span><strong>{t('lab.noHarvest')}</strong><p>{t('plan.noHarvest')}</p></span>
            )}
          </div>
        </div>

        <details className="card how">
          <summary>
            <Microscope size={18} color="var(--forest-700)" />
            <strong>{t('plan.how')}</strong>
            <span className="chips">
              {[...new Set(sources.map((x) => x.dataset))].map((d) => <span key={d}>{d}</span>)}
            </span>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 12 }} className="muted">
              {t('plan.confidence')}
              <span className="meter">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < conf ? 'on' : ''} />)}</span>
              <strong style={{ color: 'var(--earth-ink)' }}>{conf >= 3 ? t('plan.conf.moderate') : t('plan.conf.low')}</strong>
            </span>
            <ChevronDown size={18} className="chev" />
          </summary>
          <div className="how-body">
            <div style={{ gridColumn: '1 / -1' }}>
              <h4>{t('plan.calib', { place: cal.yieldPlace, level: t(`plan.level.${cal.yieldLevel}` as 'plan.level.município'), source: t('source.ibgeName', { offline: sim.sources[2]?.live === false ? 1 : 0 }) })}</h4>
              <table className="calib">
                <thead>
                  <tr>
                    <th>{t('plan.th.crop')}</th><th>{t('plan.th.series')}</th><th>{t('plan.th.trend')}</th><th>{t('plan.th.price')}</th>
                    <th>{t('plan.th.dry')}</th><th>{t('plan.th.typical')}</th><th>{t('plan.th.wet')}</th>
                  </tr>
                </thead>
                <tbody>
                  {cal.crops.map((c) => (
                    <tr key={c.crop}>
                      <td>{cropName(t, c.crop)}</td>
                      <td>{c.firstYear}–{c.lastYear}</td>
                      <td>{t('plan.trend', { y: fmtInt(c.trendYieldKgHa), g: fmtInt(c.trendGainKgHaYr) })}</td>
                      <td>R$ {fmtPrice(c.priceBrlKg)}/kg</td>
                      {(['seco', 'tipico', 'chuvoso'] as const).map((k) => (
                        <td key={k}>{t('plan.ratio', { pct: Math.round(c[k].ratio * 100), loss: c[k].lossSeasons, n: c[k].seasons })}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted" style={{ marginTop: 8 }}>{soilCalib(t, sim)}</p>
              {(() => {
                const lines = customLines(t, sim, st)
                return lines.length ? (
                  <div className="custom-params">
                    <h4>{lines[0]} <EstTag /></h4>
                    <ul>{lines.slice(1).map((l) => <li key={l}>{l}</li>)}</ul>
                  </div>
                ) : null
              })()}
            </div>
            <div>
              <h4>{t('plan.data')}</h4>
              <ul>{sources.map((x) => <li key={x.detail}>{x.dataset}: {x.detail}{x.live ? '' : ` — ${t('common.offlineExample')}`}</li>)}</ul>
            </div>
            <div>
              <h4>{t('plan.assumptions')}</h4>
              <ul>
                {assumptionLines(t, sim).map((a) => <li key={a}>{a}</li>)}
                <li>{t('plan.disclaimer')}</li>
              </ul>
            </div>
          </div>
        </details>
      </main>
      <div className="footer-bar">
        <Button variant="ghost" onClick={() => nav('/laboratorio')} iconLeft={<ArrowLeft size={18} />}>{t('plan.back')}</Button>
        <span className="spacer" />
        <Button variant="secondary" onClick={() => nav('/comparar')} icon={<Columns3 size={18} />}>{t('plan.compare')}</Button>
        <Button onClick={exportReport} icon={<Download size={18} />}>{t('plan.export')}</Button>
      </div>
    </div>
  )
}
