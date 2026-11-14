import { useCallback, useState } from 'react'
import type { CropKey } from '../lib/api'
import type { CustomCrop } from '../lib/crops'
import { useI18n } from '../lib/i18n'
import { DEFAULT_ROTATION, useStore } from '../lib/store'
import { AddCropPanel } from './AddCropPanel'

/**
 * Adding, editing and deleting the farmer's own crops, shared by the rotation screen and the
 * "build your rotation" dialog. `onAdded` receives a newly added crop so the caller can place it.
 */
export function useCropEditor(onAdded?: (k: CropKey) => void) {
  const { s, set } = useStore()
  const { t } = useI18n()
  const [editing, setEditing] = useState<CustomCrop | 'new' | null>(null)
  const [notice, setNotice] = useState<string>()

  const close = useCallback(() => setEditing(null), [])

  function save(c: CustomCrop) {
    const exists = s.customCrops.some((x) => x.id === c.id)
    const customCrops = exists ? s.customCrops.map((x) => (x.id === c.id ? c : x)) : [...s.customCrops, c]
    // An edited crop changes the results: drop a simulation that used it.
    const usedInSim = s.simulation && [s.simulation.baseline, ...s.simulation.strategies].some((st) => st.sequence.includes(c.id))
    set({ customCrops, ...(exists && usedInSim ? { simulation: undefined } : {}) })
    setEditing(null)
    if (!exists) onAdded?.(c.id)
  }

  function remove(c: CustomCrop) {
    const usedInSim = s.simulation && [s.simulation.baseline, ...s.simulation.strategies].some((st) => st.sequence.includes(c.id))
    set({
      customCrops: s.customCrops.filter((x) => x.id !== c.id),
      currentRotation: s.currentRotation.map((k, i) => (k === c.id ? DEFAULT_ROTATION[i] : k)),
      myRotation: s.myRotation?.includes(c.id) ? undefined : s.myRotation,
      ...(usedInSim ? { simulation: undefined, strategyId: undefined } : {}),
    })
    setNotice(t('rot.deleted', { name: c.name }))
  }

  const panel = editing ? (
    <AddCropPanel initial={editing === 'new' ? undefined : editing} customs={s.customCrops} onSave={save} onClose={close} />
  ) : null

  return {
    panel,
    notice,
    clearNotice: () => setNotice(undefined),
    add: () => setEditing('new'),
    edit: (c: CustomCrop) => setEditing(c),
    remove,
  }
}
