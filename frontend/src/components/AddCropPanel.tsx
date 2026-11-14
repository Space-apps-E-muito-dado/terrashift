import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ChevronDown, ChevronUp, Droplets, Info, Layers, Plus, X } from 'lucide-react'
import {
  CROP_TYPES,
  CYCLE_CHOICES,
  TYPE_DEFAULTS,
  newCropId,
  validateCrop,
  type CropType,
  type CustomCrop,
  type Straw,
  type Water,
} from '../lib/crops'
import { useI18n } from '../lib/i18n'
import { Button } from './ui'

type Key = Parameters<ReturnType<typeof useI18n>['t']>[0]

const BUILTIN_NAMES = ['Soja', 'Soybean', 'Milho', 'Maize', 'Cobertura', 'Cobertura vegetal', 'Cover', 'Cover crop', 'Terra parada', 'Idle field', 'Pousio']

/**
 * "Add a crop" side panel. Four required questions in plain words; water and straw start from the
 * type's usual answer and can be changed behind "Change".
 */
export function AddCropPanel({
  initial,
  customs,
  onSave,
  onClose,
}: {
  initial?: CustomCrop
  customs: CustomCrop[]
  onSave: (c: CustomCrop) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<CropType | undefined>(initial?.type)
  const [cycle, setCycle] = useState<number | undefined>(initial?.cycleMonths)
  const [month, setMonth] = useState<number | undefined>(initial?.plantingMonth)
  const [water, setWater] = useState<Water | undefined>(initial?.water)
  const [straw, setStraw] = useState<Straw | undefined>(initial?.straw)
  const [adjust, setAdjust] = useState(false)
  const [tried, setTried] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const draft: Partial<CustomCrop> = { id: initial?.id, name, type, cycleMonths: cycle, plantingMonth: month }
  const errors = validateCrop(draft, customs, BUILTIN_NAMES)
  const err = (f: keyof typeof errors) => (tried && errors[f] ? <p className="field-err" role="alert">{t(`add.err.${errors[f]}` as Key)}</p> : null)
  const usual = type ? TYPE_DEFAULTS[type] : undefined
  const w = water ?? usual?.water
  const s = straw ?? usual?.straw

  function save() {
    setTried(true)
    if (Object.keys(errors).length) return
    onSave({
      id: initial?.id ?? newCropId(customs),
      name: name.trim(),
      type: type!,
      cycleMonths: cycle!,
      plantingMonth: month!,
      // Only store answers that differ from the type's usual ones.
      water: water && water !== usual?.water ? water : undefined,
      straw: straw && straw !== usual?.straw ? straw : undefined,
    })
  }

  const n = (i: number) => <span className="q-num">{i}</span>

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="add-crop-title">
      <div className="sheet-scrim" onClick={onClose} />
      <aside className="sheet">
        <header className="sheet-head">
          <h2 id="add-crop-title">{initial ? t('add.editTitle') : t('add.title')}</h2>
          <button className="icon-btn round" onClick={onClose} aria-label={t('add.close')}>
            <X size={20} />
          </button>
        </header>

        <div className="sheet-body">
          <section className="q">
            <label className="q-label" htmlFor="crop-name">{n(1)} {t('add.q1')}</label>
            <input
              id="crop-name"
              ref={nameRef}
              className={`text-in ${tried && errors.name ? 'bad' : ''}`}
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={tried && !!errors.name}
              autoComplete="off"
            />
            {err('name')}
          </section>

          <section className="q">
            <span className="q-label" id="q-type">{n(2)} {t('add.q2')}</span>
            <div className="type-grid" role="radiogroup" aria-labelledby="q-type">
              {CROP_TYPES.map((ct) => {
                const on = type === ct.id
                return (
                  <button key={ct.id} role="radio" aria-checked={on} className={`type-tile ${on ? 'on' : ''}`} onClick={() => setType(ct.id)}>
                    <span className="ti"><ct.icon size={18} /></span>
                    <span>
                      <strong>{t(`add.type.${ct.id}` as Key)}</strong>
                      <small>{t(`add.ex.${ct.id}` as Key)}</small>
                    </span>
                  </button>
                )
              })}
            </div>
            {err('type')}
          </section>

          <section className="q">
            <span className="q-label" id="q-cycle">{n(3)} {t('add.q3')}</span>
            <div className="chip-row" role="radiogroup" aria-labelledby="q-cycle">
              {CYCLE_CHOICES.map((m) => (
                <button key={m} role="radio" aria-checked={cycle === m} className={`pill ${cycle === m ? 'on' : ''}`} onClick={() => setCycle(m)}>
                  {m === 6 ? t('add.monthsMax') : t('add.months', { n: m })}
                </button>
              ))}
            </div>
            {cycle && <p className="q-help">{t('add.days', { d: cycle * 30 })}{type === 'root' && cycle === 6 ? ` ${t('add.rootLong')}` : ''}</p>}
            {err('cycle')}
          </section>

          <section className="q">
            <span className="q-label" id="q-month">{n(4)} {t('add.q4')}</span>
            <div className="month-grid" role="radiogroup" aria-labelledby="q-month">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <button key={m} role="radio" aria-checked={month === m} className={`pill ${month === m ? 'on' : ''}`} onClick={() => setMonth(m)}>
                  {t(`month.${m}` as Key)}
                </button>
              ))}
            </div>
            {err('month')}
          </section>

          {type && (
            <section className="usual">
              <div className="usual-top">
                <span>{t('add.usual', { type: t(`add.typeOf.${type}` as Key) })}</span>
                <button className="link-btn" onClick={() => setAdjust((v) => !v)} aria-expanded={adjust}>
                  {adjust ? t('add.done') : t('add.change')} {adjust ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
              {!adjust ? (
                <div className="usual-vals">
                  <span><Droplets size={14} color="var(--sky-ink)" /> {t('add.waterLabel')}: {t(`add.water.${w}` as Key)}</span>
                  <span><Layers size={14} color="var(--forest-700)" /> {t('add.strawLabel')}: {t(`add.straw.${s}` as Key)}</span>
                </div>
              ) : (
                <div className="usual-edit">
                  <span className="q-sub"><Droplets size={14} color="var(--sky-ink)" /> {t('add.waterQ')}</span>
                  <div className="chip-row" role="radiogroup" aria-label={t('add.waterQ')}>
                    {(['pouca', 'media', 'muita'] as Water[]).map((v) => (
                      <button key={v} role="radio" aria-checked={w === v} className={`pill ${w === v ? 'on' : ''}`} onClick={() => setWater(v)}>
                        {t(`add.water.${v}` as Key)}
                      </button>
                    ))}
                  </div>
                  <span className="q-sub"><ArrowDownToLine size={14} color="var(--earth-ink)" /> {t('add.strawQ')}</span>
                  <div className="chip-row" role="radiogroup" aria-label={t('add.strawQ')}>
                    {(['pouca', 'muita'] as Straw[]).map((v) => (
                      <button key={v} role="radio" aria-checked={s === v} className={`pill ${s === v ? 'on' : ''}`} onClick={() => setStraw(v)}>
                        {t(`add.straw.${v}` as Key)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <footer className="sheet-foot">
          <p className="est-warning"><Info size={16} /> {t('add.warning')}</p>
          <div className="row-end">
            <Button variant="ghost" onClick={onClose}>{t('add.cancel')}</Button>
            <Button onClick={save} icon={<Plus size={18} color="var(--lime-400)" />}>{initial ? t('add.update') : t('add.save')}</Button>
          </div>
        </footer>
      </aside>
    </div>
  )
}
