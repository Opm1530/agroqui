'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { ArrowLeft, Info, MapPin, Palette } from 'lucide-react'
import Link from 'next/link'
import { PLOT_COLORS } from '@/components/map/LeafletMap'

const LeafletMap = dynamic(() => import('@/components/map/LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Carregando mapa...</p>
      </div>
    </div>
  ),
})

export default function PropertyMapPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null)
  const [colorPickerPlotId, setColorPickerPlotId] = useState<string | null>(null)

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get('/producer/properties').then((r) => r.data),
  })
  const property = (properties as any[]).find((p) => p.id === id)

  const { data: plots = [] } = useQuery({
    queryKey: ['plots', id],
    queryFn: () => api.get('/producer/plots', { params: { propertyId: id } }).then((r) => r.data),
  })

  const saveBoundary = useMutation({
    mutationFn: ({ plotId, boundary, color, hectares }: any) =>
      api.put(`/producer/plots/${plotId}/boundary`, { boundary, color, hectares }),
    onSuccess: () => {
      toast.success('Talhão salvo!')
      qc.invalidateQueries({ queryKey: ['plots', id] })
    },
    onError: () => toast.error('Erro ao salvar'),
  })

  // Save only color (keep existing boundary)
  const saveColor = useMutation({
    mutationFn: ({ plotId, color }: { plotId: string; color: string }) => {
      const plot = (plots as any[]).find((p) => p.id === plotId)
      if (!plot?.boundary?.length) {
        // No boundary yet — just update color via boundary endpoint with dummy call
        // We need to handle this: only save color if boundary exists
        return Promise.resolve()
      }
      return api.put(`/producer/plots/${plotId}/boundary`, {
        boundary: plot.boundary,
        color,
        hectares: plot.hectares ?? undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plots', id] })
      setColorPickerPlotId(null)
    },
    onError: () => toast.error('Erro ao salvar cor'),
  })

  function getPlotColor(plot: any, idx: number) {
    return plot.color ?? PLOT_COLORS[idx % PLOT_COLORS.length]
  }

  function handlePlotDrawn(plotId: string, boundary: [number, number][], hectaresEstimate: number) {
    const plot = (plots as any[]).find((p) => p.id === plotId)
    const idx = (plots as any[]).findIndex((p) => p.id === plotId)
    const color = plot?.color ?? PLOT_COLORS[idx % PLOT_COLORS.length]
    saveBoundary.mutate({ plotId, boundary, color, hectares: hectaresEstimate > 0 ? hectaresEstimate : undefined })
  }

  return (
    <div className="h-full flex flex-col -m-8">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-3.5 bg-white border-b border-gray-200 shrink-0">
        <Link href="/dashboard/properties" className="text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <MapPin className="w-4 h-4 text-primary-600" />
        <h1 className="text-base font-bold text-gray-900">
          {property?.name ?? '...'} — Mapa de Talhões
        </h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
              Talhões
            </p>

            {(plots as any[]).length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-400">Sem talhões cadastrados</p>
                <Link href="/dashboard/properties" className="text-xs text-primary-600 hover:underline mt-1 block">
                  Cadastrar talhão →
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {(plots as any[]).map((plot, idx) => {
                  const color = getPlotColor(plot, idx)
                  const isSelected = selectedPlotId === plot.id
                  const hasBoundary = Array.isArray(plot.boundary) && plot.boundary.length > 0
                  const showPicker = colorPickerPlotId === plot.id

                  return (
                    <div key={plot.id}>
                      <button
                        onClick={() => {
                          setSelectedPlotId(isSelected ? null : plot.id)
                          setColorPickerPlotId(null)
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                          isSelected ? 'bg-primary-50 ring-1 ring-primary-300' : 'hover:bg-gray-50'
                        }`}
                      >
                        {/* Color dot — click opens color picker */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setColorPickerPlotId(showPicker ? null : plot.id)
                          }}
                          title="Trocar cor"
                          className="w-4 h-4 rounded-full shrink-0 ring-2 ring-white ring-offset-1 hover:scale-125 transition-transform relative"
                          style={{ backgroundColor: color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{plot.name}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {plot.hectares ? `${plot.hectares} ha · ` : ''}
                            {hasBoundary
                              ? <span className="text-primary-500">✓ marcado</span>
                              : <span className="text-gray-300">sem polígono</span>
                            }
                          </p>
                        </div>
                        <Palette className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      </button>

                      {/* Inline color picker */}
                      {showPicker && (
                        <div className="mx-2 mb-1 p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                          <p className="text-[10px] text-gray-500 font-medium mb-2">Cor do talhão</p>
                          <div className="grid grid-cols-4 gap-1.5">
                            {PLOT_COLORS.map((c) => (
                              <button
                                key={c}
                                onClick={() => saveColor.mutate({ plotId: plot.id, color: c })}
                                className={`w-8 h-8 rounded-lg transition-all hover:scale-110 ${color === c ? 'ring-2 ring-offset-1 ring-gray-600 scale-110' : ''}`}
                                style={{ backgroundColor: c }}
                                title={c}
                              />
                            ))}
                          </div>
                          {/* Custom color input */}
                          <div className="mt-2 flex items-center gap-2">
                            <label className="text-[10px] text-gray-400">Personalizada</label>
                            <input
                              type="color"
                              defaultValue={color}
                              onChange={(e) => {
                                const val = e.target.value
                                // Debounce: only save on blur
                              }}
                              onBlur={(e) => saveColor.mutate({ plotId: plot.id, color: e.target.value })}
                              className="w-8 h-6 rounded cursor-pointer border border-gray-200"
                            />
                          </div>
                          {!hasBoundary && (
                            <p className="text-[10px] text-amber-600 mt-1.5">
                              Desenhe o polígono primeiro para salvar a cor.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="p-3 mt-auto border-t border-gray-100">
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
              <p className="text-[11px] font-semibold text-blue-700 mb-1.5 flex items-center gap-1">
                <Info className="w-3 h-3" /> Como usar
              </p>
              <ol className="text-[11px] text-blue-600 space-y-0.5 list-decimal list-inside leading-relaxed">
                <li>Clique no talhão para selecionar</li>
                <li>Clique no ícone polígono no mapa</li>
                <li>Clique nos vértices da área</li>
                <li>Clique no <strong>1º ponto</strong> para fechar</li>
                <li>Clique na bolinha colorida para trocar a cor</li>
              </ol>
            </div>
          </div>
        </div>

        {/* ── Map ──────────────────────────────────────────────────────── */}
        <div className="flex-1 relative overflow-hidden">
          {/* Status banner */}
          {selectedPlotId ? (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur shadow-md rounded-full px-4 py-1.5 text-sm font-medium text-gray-700 flex items-center gap-2 pointer-events-none border border-gray-200">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: getPlotColor((plots as any[]).find((p) => p.id === selectedPlotId), (plots as any[]).findIndex((p) => p.id === selectedPlotId)) }}
              />
              Desenhando: <strong>{(plots as any[]).find((p) => p.id === selectedPlotId)?.name}</strong>
              <span className="text-xs text-gray-400 ml-1">· duplo-clique ou 1º ponto para fechar</span>
            </div>
          ) : (plots as any[]).length > 0 ? (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-yellow-50/90 backdrop-blur border border-yellow-200 shadow rounded-full px-4 py-1.5 text-xs text-yellow-700 pointer-events-none">
              ← Selecione um talhão para começar a desenhar
            </div>
          ) : null}

          {saveBoundary.isPending && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-white shadow-lg rounded-full px-4 py-2 text-sm text-gray-600 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              Salvando talhão...
            </div>
          )}

          <LeafletMap
            plots={plots}
            selectedPlotId={selectedPlotId}
            onPlotDrawn={handlePlotDrawn}
          />
        </div>
      </div>
    </div>
  )
}
