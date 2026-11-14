import { useEffect, useState } from 'react'
import { ArrowRight, Sparkles, X } from 'lucide-react'
import type { CropKey } from '../lib/api'
import { api } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { PLAN_YEARS, cropMeta, cropName, simulateRequest } from '../lib/meta'
import { useStore } from '../lib/store'
import { CropPicker } from './CropPicker'
import { CropThumb } from './CropThumb'
import { Button, EstTag, Spinner } from './ui'
import { useCropEditor } from './useCropEditor'

/** "Build your own rotation": one crop per plan year, simulated next to the fixed strategies. */
export function MyRotationDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { s, set } = useStore()
  const { t } = useI18n()
  const [draft, setDraft] = useState<CropKey[]>(s.myRotation ?? [...s.currentRotation])
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const pick = (k: CropKey) => setDraft((d) => d.map((x, i) => (i === active ? k : x)))
  const editor = useCropEditor(pick)

  // Keep the draft valid if a crop is deleted while the dialog is open.
  useEffect(() => {
    setDraft((d) => d.map((k) => (k.startsWith('custom-') && !s.customCrops.some((c) => c.id === k) ? 'soja' : k)))
  }, [s.customCrops])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !editor.panel && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, editor.panel])

  async function run() {
    setBusy(true)
    setError(undefined)
    try {
      const sim = await api.simulate(simulateRequest({ ...s, myRotation: draft }))
      set({ myRotation: draft, simulation: sim, strategyId: 'minha' })
      onDone()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="mine-title">
      <div className="sheet-scrim" onClick={onClose} />
      <div className="modal card">
        <header className="sheet-head">
          <div>
            <h2 id="mine-title">{t('mine.title')}</h2>
            <p className="muted" style={{ marginTop: 4 }}>{t('mine.lead')}</p>
          </div>
          <button className="icon-btn round" onClick={onClose} aria-label={t('add.close')}><X size={20} /></button>
        </header>
        <div className="season-row compact" role="tablist">
          {draft.flatMap((k, i) => {
            const on = i === active
            const el = (
              <button key={i} role="tab" aria-selected={on} className={`season-card ${on ? 'on' : ''}`} onClick={() => setActive(i)}>
                <span className="season-img">
                  <CropThumb crop={k} iconSize={30} />
                  <span className="season-yr">{PLAN_YEARS[i]}</span>
                  {cropMeta(k).estimated && <span className="season-est"><EstTag /></span>}
                </span>
                <span className="season-foot"><strong>{cropName(t, k)}</strong></span>
              </button>
            )
            return i < 2 ? [el, <ArrowRight key={`a${i}`} size={18} className="season-arrow" aria-hidden />] : [el]
          })}
        </div>
        <div className="pick-head" style={{ marginTop: 6 }}>
          <strong>{t('mine.yearQ', { y: PLAN_YEARS[active] })}</strong>
        </div>
        <CropPicker value={draft[active]} customs={s.customCrops} onPick={pick} onAdd={editor.add} onEdit={editor.edit} onDelete={editor.remove} />
        {error && <div className="error-banner">{error}</div>}
        <div className="row-end">
          <Button variant="ghost" onClick={onClose}>{t('add.cancel')}</Button>
          <Button onClick={run} disabled={busy} icon={busy ? <Spinner size={16} /> : <Sparkles size={18} color="var(--lime-400)" />}>
            {busy ? t('mine.running') : t('mine.run')}
          </Button>
        </div>
      </div>
      {editor.panel}
    </div>
  )
}
