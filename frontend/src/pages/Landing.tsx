import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronsLeftRight, CloudRain, CloudSun, Droplets, Layers, Leaf, Map, Play, Satellite, Wheat } from 'lucide-react'
import { Button, LangSwitch, Logo } from '../components/ui'
import { api } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { useStore } from '../lib/store'

export default function Landing() {
  const nav = useNavigate()
  const { t } = useI18n()
  const { set, reset } = useStore()
  const [split, setSplit] = useState(50)
  const [busy, setBusy] = useState(false)

  async function demo() {
    setBusy(true)
    try {
      const f = await api.demoFarm()
      reset()
      set({ farm: { name: f.name, region: '', polygon: f.polygon, areaHa: f.areaHa, isDemo: true } })
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
          <a href="#como">{t('landing.how')}</a>
          <a href="#tecnologia">{t('landing.tech')}</a>
          <a href="#sobre">{t('landing.about')}</a>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <LangSwitch />
          <Button onClick={() => nav('/terra')} icon={<ArrowRight size={18} />}>
            {t('landing.cta')}
          </Button>
        </div>
      </nav>

      <section className="lp-hero">
        <div className="lp-text">
          <span className="lp-eyebrow eyebrow">
            <Satellite size={14} /> {t('landing.eyebrow')}
          </span>
          <h1 className="lp-h1">{t('landing.title')}</h1>
          <p className="lp-desc">{t('landing.desc')}</p>
          <div className="lp-actions">
            <Button onClick={() => { reset(); nav('/terra') }} icon={<ArrowRight size={18} />}>
              {t('landing.cta')}
            </Button>
            <Button variant="secondary" onClick={demo} disabled={busy} icon={<Play size={18} />}>
              {t('landing.demo')}
            </Button>
          </div>
          <span className="lp-note">
            <Map size={15} /> {t('landing.note')}
          </span>
        </div>

        <div className="lp-visual" aria-label={t('landing.visualAria')}>
          <img src="/img/hero.jpg" alt={t('landing.heroAlt')} />
          <div className="lp-future" style={{ clipPath: `inset(0 0 0 ${split}%)` }} />
          <div className="lp-divider" style={{ left: `${split}%` }} />
          <div className="lp-handle" style={{ left: `${split}%` }}>
            <ChevronsLeftRight size={18} />
          </div>
          <span className="lp-tag" style={{ left: 24 }}>{t('landing.today')}</span>
          <span className="lp-tag" style={{ right: 24 }}>{t('landing.future')}</span>
          <div className="lp-float" style={{ left: 36, top: '24%' }}>
            <span className="icon-wrap" style={{ background: 'rgba(232,176,62,.18)', color: '#b5852a' }}><CloudSun size={17} /></span>
            <div><strong>{t('landing.climate')}</strong><small>{t('landing.typicalYear')}</small></div>
          </div>
          <div className="lp-float" style={{ right: 28, top: '18%', animationDelay: '-2s' }}>
            <span className="icon-wrap" style={{ background: 'rgba(117,185,223,.18)', color: '#2f7fae' }}><Droplets size={17} /></span>
            <div><strong>{t('landing.soilWater')}</strong><small>{t('landing.stableMoisture')}</small></div>
          </div>
          <div className="lp-float" style={{ right: 40, top: '60%', animationDelay: '-4s' }}>
            <span className="icon-wrap" style={{ background: 'rgba(168,214,109,.3)', color: '#245a43' }}><Leaf size={17} /></span>
            <div><strong>{t('landing.cover')}</strong><small>{t('landing.coverNote')}</small></div>
          </div>
          <label className="lp-range">
            {t('landing.rangeToday')}
            <input type="range" min={5} max={95} value={split} onChange={(e) => setSplit(+e.target.value)} aria-label={t('landing.rangeAria')} />
            2029
          </label>
        </div>
      </section>

      <div className="lp-strip" id="tecnologia">
        <span style={{ fontWeight: 600, color: 'var(--muted)' }}>{t('landing.stripLead')}</span>
        <span><Satellite size={16} /> {t('landing.stripSat')}</span>
        <span><CloudRain size={16} /> {t('landing.stripClimate')}</span>
        <span><Layers size={16} /> {t('landing.stripSoil')}</span>
        <span><Wheat size={16} /> {t('landing.stripYield')}</span>
      </div>
    </div>
  )
}
