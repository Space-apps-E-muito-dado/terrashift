import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ChevronDown, Coins, Columns3, Download, Layers, MapPin, Microscope, ShieldCheck } from 'lucide-react'
import { AppHeader, Button, DemoBadge, SourceLabel } from '../components/ui'
import type { Simulation, Strategy } from '../lib/api'
import { CROPS, SCENARIOS, STRATEGY_ICONS, brlMil, cropRole, fmtDec, fmtInt, fmtPrice, safra } from '../lib/meta'
import { useStore, type FarmSel } from '../lib/store'

function report(farm: FarmSel, sim: Simulation, st: Strategy): string {
  const t = st.scenarios.tipico
  const c = sim.calibration
  const lines = [
    `# Plano de rotação — ${farm.name}`,
    '',
    `Área: ${farm.areaHa} ha · ${farm.region}`,
    `Estratégia: ${st.name} (${st.sequence.map((x) => CROPS[x].name).join(' → ')})`,
    '',
    '> Estimativas calculadas com dados públicos (NASA POWER, IBGE PAM, SoilGrids, SRTM). Não substituem análise agronômica local nem garantem resultados. Receita bruta: custos de produção não incluídos.',
    '',
    '## Rotação 2027–2029 (safra típica)',
    '',
    '| Ano | Cultura | Produtividade (kg/ha) | Receita bruta (R$/ha) | ETc / chuva efetiva (mm) | Perda de solo (t/ha) | Safras análogas com quebra |',
    '|---|---|---|---|---|---|---|',
    ...t.years.map(
      (y) =>
        `| ${y.year} | ${y.cropName} | ${y.harvest ? fmtInt(y.yieldKgHa) : '—'} | ${fmtInt(y.revenueBrlHa)} | ${y.etcMm} / ${y.effRainMm} | ${fmtDec(y.soilLossTHa)} | ${y.harvest ? `${y.lossSeasons} de ${y.analogSeasons}` : '—'} |`,
    ),
    '',
    '## Resumo por cenário climático',
    '',
    '| Cenário | Safras de referência | Receita média (R$/ha/ano) | Folga hídrica | Perda de solo (t/ha/ano) | Resiliência |',
    '|---|---|---|---|---|---|',
    ...SCENARIOS.map((sc) => {
      const v = st.scenarios[sc.id].summary
      return `| ${sc.name} | ${sim.analogYears[sc.id].map(safra).join(', ')} | ${fmtInt(v.revenueBrlHa)} | ${v.waterSavingIdx} | ${fmtDec(v.soilLossTHa)} | ${v.resilienceIdx} |`
    }),
    '',
    `## Calibração (${c.yieldPlace}, ${c.yieldLevel})`,
    '',
    '| Cultura | Série IBGE | Tendência (kg/ha) | Preço (R$/kg) | Razão seca / típica / chuvosa |',
    '|---|---|---|---|---|',
    ...c.crops.map((x) => `| ${CROPS[x.crop].name} | ${x.firstYear}–${x.lastYear} | ${fmtInt(x.trendYieldKgHa)} | ${fmtPrice(x.priceBrlKg)} | ${x.seco.ratio} / ${x.tipico.ratio} / ${x.chuvoso.ratio} |`),
    '',
    `Solo (RUSLE): K = ${c.soil.kFactor}, LS = ${c.soil.lsFactor} (declividade ${c.soil.slopePct}% · rampa ${c.soil.slopeLengthM} m), R típico = ${c.soil.rFactorTipico}. ET₀ nov–mar = ${c.et0SeasonMm} mm.`,
    '',
    '## Fontes',
    '',
    ...sim.sources.map((x) => `- ${x.dataset} — ${x.detail}${x.live ? '' : ' (exemplo offline)'}`),
    '',
    '## Hipóteses',
    '',
    ...sim.assumptions.map((a) => `- ${a}`),
    '',
  ]
  return lines.join('\n')
}

export default function Plan() {
  const nav = useNavigate()
  const { s } = useStore()
  const sim = s.simulation
  if (!s.farm || !sim) return <Navigate to={s.farm ? '/objetivos' : '/terra'} replace />
  const st = sim.strategies.find((x) => x.id === (s.strategyId ?? sim.recommended))!
  const t = st.scenarios.tipico
  const StIcon = STRATEGY_ICONS[st.icon]
  // Real data in every index, but small samples (8–9 analog seasons) and literature coefficients:
  // "moderada" while everything is live, "baixa" when any source fell back to offline data.
  const conf = sim.demo ? 2 : 3
  const cal = sim.calibration
  // Worst cash crop of the plan in seasons with a strong veranico (same historical seasons for every year,
  // so they must not be summed across the three years).
  const worstDry = st.scenarios.seco.years
    .filter((y) => y.harvest && y.analogSeasons > 0)
    .sort((a, b) => b.lossSeasons / b.analogSeasons - a.lossSeasons / a.analogSeasons)[0]

  function exportReport() {
    const blob = new Blob([report(s.farm!, sim!, st)], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `plano-${s.farm!.name.toLowerCase().replace(/\s+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="screen">
      <AppHeader demo={s.farm.isDemo} farmName={s.farm.name} page="Meu plano agrícola" />
      <main className="page wide">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div className="page-title">
            <h1>Seu plano para os próximos anos.</h1>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <span className="chip"><StIcon size={14} color="var(--forest-700)" /> Estratégia {st.name.toLowerCase()}</span>
              <span className="chip"><MapPin size={14} color="var(--forest-700)" /> {s.farm.name} · {s.farm.areaHa} ha</span>
            </div>
          </div>
          {sim.demo ? <DemoBadge label="Inclui dados offline" /> : <SourceLabel kind="estimate" dataset="dados reais + modelo" />}
        </div>

        <div className="plan-row">
          {t.years.flatMap((y, i) => {
            const C = CROPS[y.crop]
            const el = (
              <article key={y.year} className="plan-step">
                <img src={C.photo} alt={C.name} />
                <span className="yr">{y.year}</span>
                <div className="txt">
                  <strong><C.icon size={20} /> {C.name}</strong>
                  <p>{cropRole(y.crop, i > 0 ? t.years[i - 1].crop : undefined)}</p>
                </div>
              </article>
            )
            return i < 2 ? [el, <span key={`a${i}`} className="round-arrow"><ArrowRight size={16} /></span>] : [el]
          })}
        </div>

        <div className="why">
          <div>
            <span className="icon-wrap" style={{ background: 'rgba(36,90,67,.1)', color: 'var(--forest-700)' }}><Coins size={20} /></span>
            <span><strong>R$ {brlMil(t.summary.revenueBrlHa)}</strong><small>/ha/ano</small><p>Receita bruta média na safra típica</p></span>
          </div>
          <div>
            <span className="icon-wrap" style={{ background: 'rgba(217,166,94,.2)', color: '#9a6b2c' }}><Layers size={20} /></span>
            <span><strong>{fmtDec(t.summary.soilLossTHa)} t</strong><small>/ha/ano</small><p>Perda de solo estimada (rotação atual: {fmtDec(sim.baseline.scenarios.tipico.summary.soilLossTHa)} t)</p></span>
          </div>
          <div>
            <span className="icon-wrap" style={{ background: 'rgba(117,185,223,.18)', color: 'var(--sky-ink)' }}><ShieldCheck size={20} /></span>
            {worstDry ? (
              <span><strong>{worstDry.lossSeasons} de {worstDry.analogSeasons}</strong><small> safras</small><p>Safras com veranico em que a produtividade de {worstDry.cropName.toLowerCase()} quebrou</p></span>
            ) : (
              <span><strong>Sem colheita</strong><p>Nenhuma cultura comercial exposta ao veranico</p></span>
            )}
          </div>
        </div>

        <details className="card how">
          <summary>
            <Microscope size={18} color="var(--forest-700)" />
            <strong>Como calculamos esses resultados?</strong>
            <span className="chips">
              {[...new Set(sim.sources.map((x) => x.dataset))].map((d) => <span key={d}>{d}</span>)}
            </span>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 12 }} className="muted">
              Confiabilidade
              <span className="meter">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < conf ? 'on' : ''} />)}</span>
              <strong style={{ color: 'var(--earth-ink)' }}>{conf >= 3 ? 'Moderada' : 'Baixa'}</strong>
            </span>
            <ChevronDown size={18} className="chev" />
          </summary>
          <div className="how-body">
            <div style={{ gridColumn: '1 / -1' }}>
              <h4>Calibração com {cal.yieldPlace} ({cal.yieldLevel}, {cal.yieldSource})</h4>
              <table className="calib">
                <thead>
                  <tr><th>Cultura</th><th>Série</th><th>Tendência</th><th>Preço</th><th>Safras secas</th><th>Típicas</th><th>Chuvosas</th></tr>
                </thead>
                <tbody>
                  {cal.crops.map((c) => (
                    <tr key={c.crop}>
                      <td>{CROPS[c.crop].name}</td>
                      <td>{c.firstYear}–{c.lastYear}</td>
                      <td>{fmtInt(c.trendYieldKgHa)} kg/ha (+{fmtInt(c.trendGainKgHaYr)}/ano)</td>
                      <td>R$ {fmtPrice(c.priceBrlKg)}/kg</td>
                      {(['seco', 'tipico', 'chuvoso'] as const).map((k) => (
                        <td key={k}>{Math.round(c[k].ratio * 100)}% da tendência · {c[k].lossSeasons}/{c[k].seasons} quebras</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted" style={{ marginTop: 8 }}>
                Solo (RUSLE): K {cal.soil.kFactor} · LS {cal.soil.lsFactor} (declividade {fmtDec(cal.soil.slopePct)}%, rampa {cal.soil.slopeLengthM} m) · R típico {fmtInt(cal.soil.rFactorTipico)} MJ·mm/ha·h·ano. ET₀ nov–mar: {fmtInt(cal.et0SeasonMm)} mm.
              </p>
            </div>
            <div>
              <h4>Dados utilizados</h4>
              <ul>{sim.sources.map((x) => <li key={x.detail}>{x.dataset}: {x.detail}{x.live ? '' : ' — exemplo offline'}</li>)}</ul>
            </div>
            <div>
              <h4>Hipóteses e limitações</h4>
              <ul>
                {sim.assumptions.map((a) => <li key={a}>{a}</li>)}
                <li>Estimativas com amostras pequenas (8–9 safras por cenário): não substituem análise agronômica local nem garantem resultados.</li>
              </ul>
            </div>
          </div>
        </details>
      </main>
      <div className="footer-bar">
        <Button variant="ghost" onClick={() => nav('/laboratorio')} iconLeft={<ArrowLeft size={18} />}>Voltar ao simulador</Button>
        <span className="spacer" />
        <Button variant="secondary" onClick={() => nav('/comparar')} icon={<Columns3 size={18} />}>Comparar outra estratégia</Button>
        <Button onClick={exportReport} icon={<Download size={18} />}>Exportar relatório</Button>
      </div>
    </div>
  )
}
