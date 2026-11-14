import { CircleCheck, Pencil, Plus, Trash2 } from 'lucide-react'
import type { CropKey } from '../lib/api'
import type { CustomCrop } from '../lib/crops'
import { useI18n } from '../lib/i18n'
import { cropName } from '../lib/meta'
import { CropThumb } from './CropThumb'
import { EstTag } from './ui'

/** Large tiles to pick one crop: built-in crops, idle field, the farmer's own crops, and "another crop". */
export function CropPicker({
  value,
  customs,
  onPick,
  onAdd,
  onEdit,
  onDelete,
}: {
  value?: CropKey
  customs: CustomCrop[]
  onPick: (k: CropKey) => void
  onAdd: () => void
  onEdit: (c: CustomCrop) => void
  onDelete: (c: CustomCrop) => void
}) {
  const { t } = useI18n()
  const keys: CropKey[] = ['soja', 'milho', 'cobertura', ...customs.map((c) => c.id), 'pousio']
  return (
    <div className="picker" role="radiogroup" aria-label={t('rot.pickAria')}>
      {keys.map((k) => {
        const on = value === k
        const custom = customs.find((c) => c.id === k)
        return (
          <div key={k} className={`pick-tile ${on ? 'on' : ''}`}>
            <button role="radio" aria-checked={on} className="pick-main" onClick={() => onPick(k)}>
              <span className="pick-img">
                <CropThumb crop={k} iconSize={28} />
                {custom && <EstTag />}
              </span>
              <span className="pick-label">
                <strong>{k === 'pousio' ? t('rot.fallow') : cropName(t, k)}</strong>
                {on && <CircleCheck size={16} />}
              </span>
            </button>
            {custom && (
              <span className="pick-actions">
                <button className="mini" onClick={() => onEdit(custom)} aria-label={`${t('rot.edit')} ${custom.name}`} title={t('rot.edit')}>
                  <Pencil size={13} />
                </button>
                <button className="mini" onClick={() => onDelete(custom)} aria-label={`${t('rot.delete')} ${custom.name}`} title={t('rot.delete')}>
                  <Trash2 size={13} />
                </button>
              </span>
            )}
          </div>
        )
      })}
      <button className="pick-tile pick-add" onClick={onAdd}>
        <Plus size={26} />
        <strong>{t('rot.another')}</strong>
        <small>{t('rot.notListed')}</small>
      </button>
    </div>
  )
}
