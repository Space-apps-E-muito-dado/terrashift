import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronDown, Pencil, Repeat } from 'lucide-react'
import { AppHeader, Button, EstTag } from '../components/ui'
import { CropThumb } from '../components/CropThumb'
import { CropPicker } from '../components/CropPicker'
import { useCropEditor } from '../components/useCropEditor'
import type { CropKey } from '../lib/api'
import { isDiagnosisOnly } from '../lib/api'
import { PAST_YEARS, cropMeta, cropName, farmLabel, safra } from '../lib/meta'
import { useI18n } from '../lib/i18n'
import { useStore } from '../lib/store'

/** "What did you plant in the last 3 years?" — sets the "Current rotation" baseline. */
export default function Rotation() {
  const nav = useNavigate()
  const { s, set } = useStore()
  const { t } = useI18n()
  const [active, setActive] = useState(1)
  const pick = (k: CropKey) => {
    const currentRotation = s.currentRotation.map((x, i) => (i === active ? k : x))
    set({ currentRotation })
  }
  const editor = useCropEditor(pick)
  if (isDiagnosisOnly(s.diagnosis)) return <Navigate to="/diagnostico" replace />
  if (!s.farm) return <Navigate to="/terra" replace />

  const seq = s.currentRotation.map((k) => cropName(t, k)).join(' → ')

  return (
    <div className="screen">
      <AppHeader demo={s.farm.isDemo} farmName={farmLabel(t, s.farm)} page={t('rot.page')} step={2} />
      <main className="center-col">
        <div className="page-title">
          <h1>{t('rot.title')}</h1>
          <p>{t('rot.lead')}</p>
        </div>

        <div className="season-row" role="tablist" aria-label={t('rot.aria')}>
          {s.currentRotation.flatMap((k, i) => {
            const on = i === active
            const card = (
              <button key={i} role="tab" aria-selected={on} className={`season-card ${on ? 'on' : ''}`} onClick={() => setActive(i)}>
                <span className="season-img">
                  <CropThumb crop={k} iconSize={40} />
                  <span className="season-yr">{t('rot.season', { s: safra(PAST_YEARS[i]) })}</span>
                  {cropMeta(k).estimated && <span className="season-est"><EstTag /></span>}
                </span>
                <span className="season-foot">
                  <strong>{cropName(t, k)}</strong>
                  <span className={`season-act ${on ? 'on' : ''}`}>
                    {on ? <ChevronDown size={14} /> : <Pencil size={14} />} {on ? t('rot.choosing') : t('rot.change')}
                  </span>
                </span>
              </button>
            )
            return i < 2 ? [card, <ArrowRight key={`a${i}`} size={20} className="season-arrow" aria-hidden />] : [card]
          })}
        </div>

        <section className="card pick-card">
          <div className="pick-head">
            <strong>{t('rot.pickQ', { s: safra(PAST_YEARS[active]) })}</strong>
            <span className="muted">{t('rot.mainOnly')}</span>
          </div>
          <CropPicker
            value={s.currentRotation[active]}
            customs={s.customCrops}
            onPick={pick}
            onAdd={editor.add}
            onEdit={editor.edit}
            onDelete={editor.remove}
          />
        </section>

        {editor.notice && (
          <div className="notice" role="status">
            {editor.notice}
            <button className="link-btn" onClick={editor.clearNotice}>OK</button>
          </div>
        )}

        <p className="note rot-note">
          <Repeat size={16} />
          <span>{t('rot.note', { seq })}</span>
        </p>

        <div className="row-end">
          <Button variant="ghost" onClick={() => nav('/diagnostico')}>{t('rot.back')}</Button>
          <Button onClick={() => nav('/objetivos')} icon={<ArrowRight size={18} color="var(--lime-400)" />} style={{ padding: '16px 24px', fontSize: 16 }}>
            {t('common.continue')}
          </Button>
        </div>
      </main>
      {editor.panel}
    </div>
  )
}
