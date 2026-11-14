import type { LatLng } from './api'

/** Polygon area in hectares (local equirectangular projection; fine for farm-sized areas). */
export function areaHa(poly: LatLng[]): number {
  if (poly.length < 3) return 0
  const lat0 = poly.reduce((s, p) => s + p[0], 0) / poly.length
  const lng0 = poly.reduce((s, p) => s + p[1], 0) / poly.length
  const R = 6371008.8
  const k = Math.cos((lat0 * Math.PI) / 180)
  const xy = poly.map(([lat, lng]) => [((lng - lng0) * Math.PI) / 180 * R * k, ((lat - lat0) * Math.PI) / 180 * R])
  let s = 0
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i]
    const [x2, y2] = xy[(i + 1) % xy.length]
    s += x1 * y2 - x2 * y1
  }
  return Math.abs(s) / 2 / 10000
}

export interface Place {
  name: string
  lat: number
  lng: number
}

/** Geocode a city or place name (OpenStreetMap Nominatim, Brazil only). */
export async function searchPlace(q: string, lang: 'pt' | 'en' = 'pt'): Promise<Place[]> {
  const al = lang === 'pt' ? 'pt-BR' : 'en'
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=br&accept-language=${al}&q=${encodeURIComponent(q)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('search failed')
  const rows: { display_name: string; lat: string; lon: string }[] = await res.json()
  return rows.map((r) => ({ name: r.display_name, lat: +r.lat, lng: +r.lon }))
}
