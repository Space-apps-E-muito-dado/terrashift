import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, CloudRain, Droplets, Eye, Image, Layers, Leaf, Mountain, Sparkles, Thermometer } from 'lucide-react'
import { AppHeader, Button, SourceLabel } from '../components/ui'
import { FarmMap, OVERLAYS, type MapLayer } from '../components/FarmMap'
import { useStore } from '../lib/store'

const LAYERS: { id: MapLayer; name: string; icon: typeof Image }[] = [
  { id: 'real', name: 'Visão real', icon: Image },
  { id: 'agua', name: 'Água', icon: Droplets },
  { id: 'vegetacao', name: 'Vegetação', icon: Leaf },
  { id: 'solo', name: 'Solo', icon: Layers },
  { id: 'relevo', name: 'Relevo', icon: Mountain },
]

const SOIL_COLORS = ['#C98F45', '#D9A65E', '#E9CB98']

export default function DiagnosisPage() {
  const nav = useNavigate()
  const { s } = useStore()
  const [layer, setLayer] = useState<MapLayer>('real')
  const d = s.diagnosis
  if (!s.farm || !d) return <Navigate to="/terra" replace />

  const maxP = Math.max(...d.climate.months.map((m) => m.precipMm), 1)
  const temps = d.climate.months.map((m) => m.tempC)
  const tMin = Math.min(...temps)
  const tMax = Math.max(...temps)
  const caption =
    layer === 'real'
      ? 'Imagem: Copernicus Sentinel-2 (EOX s2cloudless) · 10 m'
      : layer === 'solo'
        ? `Solo: ${d.soil.textureClass.toLowerCase()} · SoilGrids 250 m (ponto central)`
        : layer === 'relevo'
          ? `${OVERLAYS.relevo.label} · declividade média ${d.terrain.slopePct.toFixed(1).replace('.', ',')}%`
          : OVERLAYS[layer].label

  return (
    <div className="screen">
      <AppHeader
        demo={s.farm.isDemo}
        farmName={s.farm.name}
        page="Diagnóstico"
        step={1}
        action={<Button onClick={() => nav('/objetivos')} icon={<ArrowRight size={16} />}>Continuar</Button>}
      />
      <main className="page fit">
        <div className="page-title">
          <span className="eyebrow">
            {s.farm.name} · {d.areaHa} ha · {d.place.municipality} ({d.place.uf})
          </span>
          <h1>Conheça sua terra.</h1>
          <p>Combinamos informações ambientais para entender as condições da sua região.</p>
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
            <div className="layer-sel" role="tablist" aria-label="Camadas do mapa">
              {LAYERS.map((l) => (
                <button key={l.id} role="tab" aria-selected={layer === l.id} className={layer === l.id ? 'on' : ''} onClick={() => setLayer(l.id)}>
                  <l.icon size={15} /> {l.name}
                </button>
              ))}
            </div>
          </FarmMap>

          <div className="data-col">
            <div className="data-grid">
              <section className="card dcard">
                <div className="dcard-top">
                  <span className="icon-wrap" style={{ background: 'rgba(117,185,223,.18)', color: 'var(--sky-ink)' }}><CloudRain size={15} /></span>
                  Histórico de chuva
                </div>
                <span className="big">{d.climate.annualPrecipMm} mm<span className="muted" style={{ fontSize: 12, fontWeight: 500 }}> /ano</span></span>
                <div className="bars" aria-label="Chuva média mensal">
                  {d.climate.months.map((m) => (
                    <i key={m.month} className={m.precipMm < 40 ? 'dry' : ''} style={{ height: `${Math.max(4, (m.precipMm / maxP) * 100)}%` }} title={`${m.month}: ${m.precipMm} mm`} />
                  ))}
                </div>
                <div className="months">{d.climate.months.map((m) => <span key={m.month}>{m.month[0]}</span>)}</div>
                <p>Média mensal 2001–2025, em mm</p>
                <SourceLabel kind="regional" dataset="NASA POWER" live={d.climate.live} />
              </section>

              <section className="card dcard">
                <div className="dcard-top">
                  <span className="icon-wrap" style={{ background: 'rgba(232,176,62,.18)', color: '#b5852a' }}><Thermometer size={15} /></span>
                  Temperatura
                </div>
                <span className="big">{d.climate.meanTempC.toFixed(1)} °C<span className="muted" style={{ fontSize: 12, fontWeight: 500 }}> média</span></span>
                <div className="bars temp">
                  {d.climate.months.map((m) => (
                    <i key={m.month} style={{ height: `${20 + ((m.tempC - tMin) / Math.max(tMax - tMin, 0.1)) * 80}%` }} title={`${m.month}: ${m.tempC} °C`} />
                  ))}
                </div>
                <div className="months">{d.climate.months.map((m) => <span key={m.month}>{m.month[0]}</span>)}</div>
                <p>Média mensal de {tMin.toFixed(1)} a {tMax.toFixed(1)} °C</p>
                <SourceLabel kind="regional" dataset="NASA POWER" live={d.climate.live} />
              </section>

              <section className="card dcard">
                <div className="dcard-top">
                  <span className="icon-wrap" style={{ background: 'rgba(36,90,67,.1)', color: 'var(--forest-700)' }}><Leaf size={15} /></span>
                  Vegetação
                </div>
                <p>Índice de vegetação (NDVI) mais recente, composição de 16 dias. Veja na camada <button className="linkish" onClick={() => setLayer('vegetacao')}>Vegetação</button>.</p>
                <div style={{ height: 8, borderRadius: 4, background: 'linear-gradient(90deg,#D98E4A,#E8D36A,#A8D66D,#2E8B3E)' }} />
                <div className="months" style={{ justifyContent: 'space-between' }}><span style={{ textAlign: 'left' }}>Pouca</span><span style={{ textAlign: 'right' }}>Muita</span></div>
                <SourceLabel kind="satellite" dataset="MODIS" />
              </section>

              <section className="card dcard">
                <div className="dcard-top">
                  <span className="icon-wrap" style={{ background: 'rgba(217,166,94,.2)', color: '#9a6b2c' }}><Layers size={15} /></span>
                  Solo
                </div>
                <span className="big" style={{ fontSize: 18 }}>{d.soil.textureClass}</span>
                <div className="soil-layers">
                  {d.soil.layers.map((l, i) => (
                    <div key={l.depth} style={{ background: SOIL_COLORS[i] }}>
                      <span>{l.depth}</span>
                      <span>{Math.round(l.clayPct)}% argila · {Math.round(l.sandPct)}% areia</span>
                    </div>
                  ))}
                </div>
                <p>Estimativa por modelo: confirme com análise local.</p>
                <SourceLabel kind="estimate" dataset="SoilGrids" live={d.soil.live} />
              </section>
            </div>

            <div className="insight">
              <span className="eyebrow"><Sparkles size={16} /> Próximo passo</span>
              <p>Vamos explorar quais estratégias de cultivo podem funcionar melhor para esta terra.</p>
              <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,.72)', lineHeight: 1.45 }}>
                Cada estratégia será testada com {d.analogYears.seasons.length} safras reais de chuva (NASA POWER) e a produtividade de soja e milho em {d.yieldPlace} (IBGE).
              </span>
              <Button variant="accent" onClick={() => nav('/objetivos')} icon={<ArrowRight size={18} />} style={{ alignSelf: 'flex-start' }}>
                Explorar possibilidades
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
