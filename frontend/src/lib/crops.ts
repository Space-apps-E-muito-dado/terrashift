import { Bean, Carrot, CircleOff, Droplet, Leaf, Shrub, Sprout, Wheat, type LucideIcon } from 'lucide-react'

/** Built-in crops the farmer can pick. "pousio" = field left idle. */
export type BuiltinCrop = 'soja' | 'milho' | 'cobertura' | 'pousio'
export type CropType = 'cereal' | 'legume' | 'oilseed' | 'root' | 'forage' | 'cover'
export type Water = 'pouca' | 'media' | 'muita'
export type Straw = 'pouca' | 'muita'

export interface CustomCrop {
  id: string
  name: string
  type: CropType
  cycleMonths: number
  plantingMonth: number
  /** Omitted → the type's usual answer (decided by the backend). */
  water?: Water
  straw?: Straw
}

export const BUILTIN: BuiltinCrop[] = ['soja', 'milho', 'cobertura', 'pousio']
export const isBuiltin = (k: string): k is BuiltinCrop => (BUILTIN as string[]).includes(k)

export const CROP_TYPES: { id: CropType; icon: LucideIcon; tint: string }[] = [
  { id: 'cereal', icon: Wheat, tint: '#E8C35A' },
  { id: 'legume', icon: Bean, tint: '#8CC63F' },
  { id: 'oilseed', icon: Droplet, tint: '#D9A65E' },
  { id: 'root', icon: Carrot, tint: '#C98F45' },
  { id: 'forage', icon: Shrub, tint: '#6FA35A' },
  { id: 'cover', icon: Sprout, tint: '#2E8B57' },
]
export const typeMeta = (t: CropType) => CROP_TYPES.find((x) => x.id === t)!

/** The usual answers per type. Must match `type_row` in backend/src/crops.rs. */
export const TYPE_DEFAULTS: Record<CropType, { water: Water; straw: Straw }> = {
  cereal: { water: 'media', straw: 'muita' },
  legume: { water: 'media', straw: 'pouca' },
  oilseed: { water: 'media', straw: 'pouca' },
  root: { water: 'media', straw: 'pouca' },
  forage: { water: 'media', straw: 'muita' },
  cover: { water: 'media', straw: 'muita' },
}

export const CYCLE_CHOICES = [2, 3, 4, 5, 6]
export const MAX_NAME = 40

export const FALLOW_ICON = CircleOff
export const COVER_ICON = Leaf

// ------------------------------------------------------------------ storage (this browser only)

const KEY = 'terrashift-crops-v1'

export function loadCustomCrops(): CustomCrop[] {
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v.filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string') : []
  } catch {
    return []
  }
}

export function saveCustomCrops(list: CustomCrop[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* storage unavailable: crops live for this session only */
  }
}

export function newCropId(list: CustomCrop[]): string {
  let n = list.length + 1
  while (list.some((c) => c.id === `custom-${n}`)) n++
  return `custom-${n}`
}

/** Case- and accent-insensitive name used for duplicate checks. */
export const foldName = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

export type FieldError = 'nameEmpty' | 'nameLong' | 'nameDup' | 'type' | 'cycle' | 'month'

export function validateCrop(
  draft: Partial<CustomCrop>,
  others: CustomCrop[],
  builtinNames: string[],
): Partial<Record<'name' | 'type' | 'cycle' | 'month', FieldError>> {
  const e: Partial<Record<'name' | 'type' | 'cycle' | 'month', FieldError>> = {}
  const name = (draft.name ?? '').trim()
  if (!name) e.name = 'nameEmpty'
  else if (name.length > MAX_NAME) e.name = 'nameLong'
  else {
    const f = foldName(name)
    const taken = [...builtinNames, ...others.filter((o) => o.id !== draft.id).map((o) => o.name)].map(foldName)
    if (taken.includes(f)) e.name = 'nameDup'
  }
  if (!draft.type) e.type = 'type'
  if (!draft.cycleMonths || !CYCLE_CHOICES.includes(draft.cycleMonths)) e.cycle = 'cycle'
  if (!draft.plantingMonth || draft.plantingMonth < 1 || draft.plantingMonth > 12) e.month = 'month'
  return e
}
