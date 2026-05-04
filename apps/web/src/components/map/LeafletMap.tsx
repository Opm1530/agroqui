// Client-only — never SSR. CSS imports work here because Next.js dynamic() with ssr:false
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import L from 'leaflet'
import 'leaflet-draw'

import { useEffect, useRef } from 'react'

// Fix Leaflet default icon paths broken by webpack
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export const PLOT_COLORS = [
  '#16a34a', '#2563eb', '#d97706', '#dc2626',
  '#7c3aed', '#0891b2', '#be185d', '#65a30d',
]

export interface Plot {
  id: string
  name: string
  color?: string | null
  hectares?: number | null
  boundary?: [number, number][] | null // [[lng, lat], ...]
}

interface LeafletMapProps {
  plots: Plot[]
  selectedPlotId?: string | null
  onPlotDrawn?: (plotId: string, boundary: [number, number][], hectaresEstimate: number) => void
  readonly?: boolean
}

export default function LeafletMap({ plots, selectedPlotId = null, onPlotDrawn, readonly = false }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  // Separate groups: leaflet-draw only manages polygonGroup; labels are independent
  const polygonGroupRef = useRef<L.FeatureGroup | null>(null)  // managed by leaflet-draw
  const labelsGroupRef = useRef<L.LayerGroup | null>(null)      // NOT managed by leaflet-draw

  const plotPolygonsRef = useRef<Record<string, L.Polygon>>({})
  const selectedRef = useRef<string | null>(null)
  selectedRef.current = selectedPlotId

  // ── Init map once ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, { center: [-15, -50], zoom: 5 })

    // Satellite base layer
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles © Esri', maxZoom: 20 }
    ).addTo(map)

    // Labels overlay
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 20, opacity: 0.8 }
    ).addTo(map)

    // FeatureGroup that leaflet-draw will manage (polygons only)
    const polygonGroup = new L.FeatureGroup()
    map.addLayer(polygonGroup)
    polygonGroupRef.current = polygonGroup

    // Separate LayerGroup for labels — leaflet-draw never touches this
    const labelsGroup = L.layerGroup().addTo(map)
    labelsGroupRef.current = labelsGroup

    // Draw control — only added in edit mode
    if (!readonly) {
      const drawControl = new (L.Control as any).Draw({
        edit: {
          featureGroup: polygonGroup,
          edit: false,   // disable edit mode (we redraw instead)
          remove: false, // disable remove button
        },
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: true,
            metric: true,
            drawError: { color: '#dc2626', message: 'Lados não podem se cruzar!' },
            shapeOptions: { color: '#16a34a', fillOpacity: 0.25, weight: 2 },
          },
          polyline: false, circle: false, rectangle: false,
          marker: false, circlemarker: false,
        },
      })
      map.addControl(drawControl)
    }

    // ── Polygon created ──────────────────────────────────────────────────────
    if (!readonly) {
      map.on((L.Draw as any).Event.CREATED, (e: any) => {
        const plotId = selectedRef.current
        if (!plotId) {
          alert('Selecione um talhão na lista antes de desenhar.')
          return
        }

        // Remove previous polygon for this plot (if redrawing)
        const existing = plotPolygonsRef.current[plotId]
        if (existing) polygonGroup.removeLayer(existing)

        const layer = e.layer as L.Polygon
        polygonGroup.addLayer(layer)
        plotPolygonsRef.current[plotId] = layer

        const latlngs = layer.getLatLngs()[0] as L.LatLng[]
        const boundary: [number, number][] = latlngs.map((ll) => [ll.lng, ll.lat])

        let areaHa = 0
        try {
          const sqm = (L as any).GeometryUtil?.geodesicArea(latlngs) ?? 0
          areaHa = parseFloat((sqm / 10_000).toFixed(2))
        } catch { /* ignore */ }

        onPlotDrawn?.(plotId, boundary, areaHa)
      })
    }

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      polygonGroupRef.current = null
      labelsGroupRef.current = null
      plotPolygonsRef.current = {}
    }
  }, []) // eslint-disable-line

  // ── Re-render all plot polygons + labels when plots data changes ───────────
  useEffect(() => {
    const map = mapRef.current
    const polygonGroup = polygonGroupRef.current
    const labelsGroup = labelsGroupRef.current
    if (!map || !polygonGroup || !labelsGroup) return

    polygonGroup.clearLayers()
    labelsGroup.clearLayers()
    plotPolygonsRef.current = {}

    const allBounds: L.LatLngBounds[] = []

    plots.forEach((plot, idx) => {
      if (!plot.boundary?.length) return
      const color = plot.color ?? PLOT_COLORS[idx % PLOT_COLORS.length]
      const latlngs: L.LatLngExpression[] = plot.boundary.map(([lng, lat]) => [lat, lng])

      const polygon = L.polygon(latlngs, {
        color, fillColor: color, fillOpacity: 0.3, weight: 2,
      })

      // Label goes into labelsGroup — completely separate from polygonGroup
      const center = polygon.getBounds().getCenter()
      const label = L.marker(center, {
        icon: L.divIcon({
          html: `<div style="background:${color};color:#fff;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.35)">${plot.name}${plot.hectares ? ` · ${plot.hectares}ha` : ''}</div>`,
          className: '',
          iconAnchor: [0, 0],
        }),
        interactive: false,
        zIndexOffset: 1000,
      })

      polygonGroup.addLayer(polygon)
      labelsGroup.addLayer(label)
      plotPolygonsRef.current[plot.id] = polygon
      allBounds.push(polygon.getBounds())
    })

    if (allBounds.length > 0) {
      const combined = allBounds.reduce((acc, b) => acc.extend(b))
      map.fitBounds(combined, { padding: [48, 48], maxZoom: 16 })
    }
  }, [plots])

  // ── Fly to selected plot ───────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedPlotId || !mapRef.current) return
    const poly = plotPolygonsRef.current[selectedPlotId]
    if (poly) {
      mapRef.current.fitBounds(poly.getBounds(), { padding: [60, 60], maxZoom: 17 })
    }
  }, [selectedPlotId])

  return <div ref={containerRef} className="w-full h-full" />
}
