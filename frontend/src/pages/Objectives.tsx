import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Bean, Check, CircleDashed, Sparkles, Sprout, Wheat } from 'lucide-react'
import { AppHeader, Button, Spinner } from '../components/ui'
import { api, type RecentCrop } from '../lib/api'
import { OBJECTIVES } from '../lib/meta'
import { useStore } from '../lib/store'

const RECENT: { id: RecentCrop; name: string; icon: typeof Bean }[] = [
  { id: 'soja', name: 'Soja', icon: Bean },
  { id: 'milho', name: 'Milho', icon: Wheat },
  { id: 'outra', name: 'Outra cultura', icon: Sprout },
  { id: 'naosei', name: 'Não sei', icon: CircleDashed },
]

const ART: Record<string, string> = {
  lucro: 'M0 70 C40 66 70 50 100 44 S160 20 200 6',
  solo: 'M100 80 C100 50 100 30 100 10 M100 50 C80 40 70 30 64 14 C84 18 96 30 100 50 M100 40 C120 30 130 20 138 6 C120 10 106 22 100 40',
  seguranca: 'M20 50 C40 30 60 30 80 50 S120 70 140 50 S180 30 200 50',
  equilibrio: 'M20 60 L180 60 M100 60 L100 14 M40 60 C40 40 60 30 100 30 C140 30 160 40 160 60',
}

export default function Objectives() {
  const nav = useNavigate()
  const { s, set } = useStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  if (!s.farm) return <Navigate to="/terra" replace />

  async function simulate() {
    if (!s.farm) return
    setBusy(true)
    setError(undefined)
    try {
      const sim = await api.simulate(s.farm.polygon, s.objective, s.recentCrop)
      set({ simulation: sim, strategyId: sim.recommended, scenario: 'tipico', yearIdx: 1 })
      nav('/laboratorio')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <AppHeader demo={s.farm.isDemo} farmName={s.farm.name} page="Objetivos" step={2} />
      <main className="center-col">
        <div className="page-title">
          <h1>O que você deseja para o futuro da sua terra?</h1>
          <p>Não existe uma única escolha perfeita. Vamos encontrar as opções que fazem mais sentido para você.</p>
        </div>

        <div className="obj-grid" role="radiogroup" aria-label="Objetivo">
          {OBJECTIVES.map((o) => {
            const on = s.objective === o.id
            return (
              <button key={o.id} role="radio" aria-checked={on} className={`obj-card ${on ? 'on' : ''}`} onClick={() => set({ objective: o.id })}>
                <div className="txt">
                  <span className="icon-wrap" style={{ background: on ? 'var(--forest-900)' : `${o.color}1A`, color: on ? 'var(--lime-400)' : o.color }}>
                    <o.icon size={22} />
                  </span>
                  <span>
                    <strong>{o.title}</strong>
                    <br />
                    <small>{o.desc}</small>
                  </span>
                </div>
                <svg className="art" viewBox="0 0 200 90" aria-hidden style={{ background: `radial-gradient(circle at 70% 30%, ${o.color}${on ? '33' : '1F'}, transparent 70%)` }}>
                  <path d={ART[o.id]} fill="none" stroke={o.color} strokeOpacity={on ? 1 : 0.6} strokeWidth={2.5} strokeLinecap="round" />
                </svg>
                {on && <span className="tick"><Check size={15} /></span>}
              </button>
            )
          })}
        </div>

        <div className="card crop-q">
          <div>
            <strong>O que foi plantado recentemente?</strong>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Ajuda a estimar o efeito da rotação no solo.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="radiogroup" aria-label="Cultura recente">
            {RECENT.map((r) => {
              const on = s.recentCrop === r.id
              return (
                <button key={r.id} role="radio" aria-checked={on} className={`chip ${on ? 'on' : ''}`} onClick={() => set({ recentCrop: r.id })}>
                  {on ? <Check size={14} /> : <r.icon size={14} />} {r.name}
                </button>
              )
            })}
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}
        <div className="row-end">
          <Button variant="ghost" onClick={() => nav('/diagnostico')}>Voltar ao diagnóstico</Button>
          <Button onClick={simulate} disabled={busy} icon={busy ? <Spinner size={16} /> : <Sparkles size={18} color="var(--lime-400)" />} style={{ padding: '16px 24px', fontSize: 16 }}>
            {busy ? 'Simulando…' : 'Simular meus futuros'}
          </Button>
        </div>
      </main>
    </div>
  )
}
