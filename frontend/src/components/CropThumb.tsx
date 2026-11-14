import type { CropKey } from '../lib/api'
import { cropMeta } from '../lib/meta'

/** Crop photo, or an icon on the crop's colour when there is no photo (idle field, custom crops). */
export function CropThumb({ crop, className = '', iconSize = 22, alt = '' }: { crop: CropKey; className?: string; iconSize?: number; alt?: string }) {
  const m = cropMeta(crop)
  if (m.photo) return <img className={className} src={m.photo} alt={alt} />
  return (
    <span className={`crop-ph ${className}`} style={{ background: `${m.tint}33`, color: m.tint }} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
      <m.icon size={iconSize} />
    </span>
  )
}
