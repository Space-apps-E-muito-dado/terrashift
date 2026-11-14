import { useEffect, useRef, type ReactNode } from 'react'
import { Minus, Plus } from 'lucide-react'
import { CircleMarker, MapContainer, Polygon, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { LatLng } from '../lib/api'

export type MapLayer = 'real' | 'agua' | 'vegetacao' | 'relevo' | 'solo'

const S2 = {
  url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg',
  attribution:
    '<a href="https://s2maps.eu" target="_blank" rel="noreferrer">Sentinel-2 cloudless 2024</a> by EOX — contém dados Copernicus Sentinel modificados',
}

const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'
export const OVERLAYS: Record<Exclude<MapLayer, 'real' | 'solo'>, { url: string; maxNative: number; label: string; attribution: string }> = {
  vegetacao: {
    url: `${GIBS}/MODIS_Terra_L3_NDVI_16Day/default/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`,
    maxNative: 9,
    label: 'NDVI · MODIS Terra 16 dias · 250 m',
    attribution: 'NASA GIBS · MODIS Terra NDVI',
  },
  agua: {
    url: `${GIBS}/SMAP_L4_Analyzed_Root_Zone_Soil_Moisture/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
    maxNative: 6,
    label: 'Umidade do solo · SMAP L4 · ~9 km',
    attribution: 'NASA GIBS · SMAP L4',
  },
  relevo: {
    url: `${GIBS}/SRTM_Color_Index/default/default/GoogleMapsCompatible_Level12/{z}/{y}/{x}.png`,
    maxNative: 12,
    label: 'Elevação · SRTM · 30 m',
    attribution: 'NASA GIBS · SRTM',
  },
}

function FitTo({ polygon, focus }: { polygon?: LatLng[]; focus?: { lat: number; lng: number; zoom: number } }) {
  const map = useMap()
  const key = polygon?.map((p) => p.join(',')).join(';')
  useEffect(() => {
    if (polygon && polygon.length >= 3) {
      map.fitBounds(L.latLngBounds(polygon), { padding: [90, 90], maxZoom: 15 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], focus.zoom, { duration: 1.2 })
  }, [focus, map])
  return null
}

function ClickToDraw({ onAdd }: { onAdd: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onAdd([+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)]) })
  return null
}

function InvalidateOnResize() {
  const map = useMap()
  useEffect(() => {
    const obs = new ResizeObserver(() => map.invalidateSize())
    obs.observe(map.getContainer())
    return () => obs.disconnect()
  }, [map])
  return null
}

export function FarmMap({
  polygon,
  draft,
  onAddPoint,
  layer = 'real',
  fill = '#A8D66D',
  fillOpacity = 0.2,
  interactive = true,
  focus,
  className = '',
  children,
}: {
  polygon?: LatLng[]
  draft?: LatLng[]
  onAddPoint?: (p: LatLng) => void
  layer?: MapLayer
  fill?: string
  fillOpacity?: number
  interactive?: boolean
  focus?: { lat: number; lng: number; zoom: number }
  className?: string
  children?: ReactNode
}) {
  const overlay = layer !== 'real' && layer !== 'solo' ? OVERLAYS[layer] : undefined
  const center: LatLng = polygon?.[0] ?? [-12.1, -45.91]
  return (
    <div className={`map-wrap ${className}`}>
      <MapContainer
        center={center}
        zoom={polygon ? 15 : 5}
        zoomControl={false}
        attributionControl
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive && !onAddPoint}
        touchZoom={interactive}
        keyboard={interactive}
        className="leaflet-host"
      >
        <TileLayer url={S2.url} attribution={S2.attribution} maxNativeZoom={17} maxZoom={18} />
        {overlay && (
          <TileLayer
            key={layer}
            url={overlay.url}
            attribution={overlay.attribution}
            maxNativeZoom={overlay.maxNative}
            maxZoom={18}
            opacity={0.72}
          />
        )}
        {polygon && polygon.length >= 3 && (
          <Polygon
            positions={polygon}
            pathOptions={{ color: '#A8D66D', weight: 3, fillColor: fill, fillOpacity, lineJoin: 'round' }}
          />
        )}
        {draft && draft.length > 0 && (
          <>
            <Polyline positions={draft} pathOptions={{ color: '#A8D66D', weight: 3, dashArray: '6 6' }} />
            {draft.map((p, i) => (
              <CircleMarker key={i} center={p} radius={6} pathOptions={{ color: '#A8D66D', weight: 3, fillColor: '#fff', fillOpacity: 1 }} />
            ))}
          </>
        )}
        {onAddPoint && <ClickToDraw onAdd={onAddPoint} />}
        <FitTo polygon={polygon} focus={focus} />
        <InvalidateOnResize />
        {interactive && <ZoomButtons />}
      </MapContainer>
      {children}
    </div>
  )
}

function ZoomButtons() {
  const map = useMap()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) {
      L.DomEvent.disableClickPropagation(ref.current)
      L.DomEvent.disableScrollPropagation(ref.current)
    }
  }, [])
  return (
    <div ref={ref} className="zoom-ctl">
      <button aria-label="Aproximar" onClick={() => map.zoomIn()}>
        <Plus size={18} />
      </button>
      <button aria-label="Afastar" onClick={() => map.zoomOut()}>
        <Minus size={18} />
      </button>
    </div>
  )
}
