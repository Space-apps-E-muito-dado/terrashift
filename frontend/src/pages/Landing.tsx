import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronsLeftRight, CloudRain, CloudSun, Droplets, Layers, Leaf, Map, Play, Satellite, Wheat } from 'lucide-react'
import { Button, Logo } from '../components/ui'
import { api } from '../lib/api'
import { useStore } from '../lib/store'

export default function Landing() {
  const nav = useNavigate()
  const { set, reset } = useStore()
  const [split, setSplit] = useState(50)
  const [busy, setBusy] = useState(false)

  async function demo() {
    setBusy(true)
    try {
      const f = await api.demoFarm()
      reset()
      set({ farm: { name: f.name, region: f.region, polygon: f.polygon, areaHa: f.areaHa, isDemo: true } })
      nav('/terra')
    } catch {
      nav('/terra')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="landing">
      <nav className="lp-nav">
        <Logo />
        <div className="lp-links">
          <a href="#como">Como funciona</a>
          <a href="#tecnologia">Tecnologia</a>
          <a href="#sobre">Sobre</a>
        </div>
        <Button onClick={() => nav('/terra')} icon={<ArrowRight size={18} />}>
          Explorar minha terra
        </Button>
      </nav>

      <section className="lp-hero">
        <div className="lp-text">
          <span className="lp-eyebrow eyebrow">
            <Satellite size={14} /> Inteligência agrícola com dados espaciais
          </span>
          <h1 className="lp-h1">E se você pudesse ver o futuro da sua terra?</h1>
          <p className="lp-desc">
            Explore diferentes estratégias de cultivo, antecipe riscos climáticos e descubra novas possibilidades para sua
            propriedade.
          </p>
          <div className="lp-actions">
            <Button onClick={() => { reset(); nav('/terra') }} icon={<ArrowRight size={18} />}>
              Explorar minha terra
            </Button>
            <Button variant="secondary" onClick={demo} disabled={busy} icon={<Play size={18} />}>
              Experimentar demonstração
            </Button>
          </div>
          <span className="lp-note">
            <Map size={15} /> Sem cadastro. Comece pelo mapa.
          </span>
        </div>

        <div className="lp-visual" aria-label="Comparação ilustrativa entre hoje e um cenário futuro">
          <img src="/img/hero.jpg" alt="Vista aérea de lavouras no Cerrado" />
          <div className="lp-future" style={{ clipPath: `inset(0 0 0 ${split}%)` }} />
          <div className="lp-divider" style={{ left: `${split}%` }} />
          <div className="lp-handle" style={{ left: `${split}%` }}>
            <ChevronsLeftRight size={18} />
          </div>
          <span className="lp-tag" style={{ left: 24 }}>HOJE</span>
          <span className="lp-tag" style={{ right: 24 }}>2029 · CENÁRIO</span>
          <div className="lp-float" style={{ left: 36, top: '24%' }}>
            <span className="icon-wrap" style={{ background: 'rgba(232,176,62,.18)', color: '#b5852a' }}><CloudSun size={17} /></span>
            <div><strong>Clima</strong><small>Ano típico</small></div>
          </div>
          <div className="lp-float" style={{ right: 28, top: '18%', animationDelay: '-2s' }}>
            <span className="icon-wrap" style={{ background: 'rgba(117,185,223,.18)', color: '#2f7fae' }}><Droplets size={17} /></span>
            <div><strong>Água no solo</strong><small>Umidade estável</small></div>
          </div>
          <div className="lp-float" style={{ right: 40, top: '60%', animationDelay: '-4s' }}>
            <span className="icon-wrap" style={{ background: 'rgba(168,214,109,.3)', color: '#245a43' }}><Leaf size={17} /></span>
            <div><strong>Cobertura vegetal</strong><small>Solo protegido em 2029</small></div>
          </div>
          <label className="lp-range">
            Hoje
            <input type="range" min={5} max={95} value={split} onChange={(e) => setSplit(+e.target.value)} aria-label="Comparar hoje e 2029" />
            2029
          </label>
        </div>
      </section>

      <div className="lp-strip" id="tecnologia">
        <span className="muted" style={{ fontWeight: 600, color: 'var(--muted)' }}>Dados abertos de observação da Terra</span>
        <span><Satellite size={16} /> Satélites: Sentinel-2 · MODIS</span>
        <span><CloudRain size={16} /> Clima: NASA POWER</span>
        <span><Layers size={16} /> Solo e água: SMAP · SRTM · SoilGrids</span>
        <span><Wheat size={16} /> Produção: IBGE PAM</span>
      </div>
    </div>
  )
}
