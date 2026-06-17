'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Plus, Tractor, X, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { PlanGuard } from '@/components/PlanGuard'

const ACTIVITY_LABELS: Record<string, string> = {
  PLANTING: 'Plantio', APPLICATION: 'Aplicação', FUELING: 'Abastecimento',
  HARVEST_OP: 'Colheita', OTHER: 'Outro',
}

const UNIT_LABELS: Record<string, string> = {
  LITER: 'L', KG: 'kg', SACA_60KG: 'sc 60kg', TONELADA: 't', UNIDADE: 'un',
}

const ACTIVITY_COLORS: Record<string, string> = {
  PLANTING: 'bg-green-100 text-green-700',
  APPLICATION: 'bg-blue-100 text-blue-700',
  FUELING: 'bg-yellow-100 text-yellow-700',
  HARVEST_OP: 'bg-orange-100 text-orange-700',
  OTHER: 'bg-gray-100 text-gray-700',
}

function NewActivityModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [type, setType] = useState('')
  const [harvestId, setHarvestId] = useState('')
  const [plotId, setPlotId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [hectares, setHectares] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<{ productId: string; quantity: string; unit: string }[]>([])

  const { data: harvests } = useQuery({
    queryKey: ['harvests'],
    queryFn: () => api.get('/producer/harvests').then((r) => r.data),
  })

  const selectedHarvest = (harvests ?? []).find((h: any) => h.id === harvestId)

  const { data: harvestPlots } = useQuery({
    queryKey: ['harvest-plots', harvestId],
    queryFn: () => api.get(`/producer/harvests/${harvestId}/plots`).then((r) => r.data),
    enabled: !!harvestId,
  })

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/producer/products').then((r) => r.data),
  })

  const create = useMutation({
    mutationFn: () => api.post('/producer/activities', {
      harvestId,
      plotId: plotId || undefined,
      type,
      date,
      hectares: hectares ? Number(hectares) : undefined,
      notes: notes || undefined,
      items: items
        .filter((i) => i.productId && i.quantity)
        .map((i) => ({ productId: i.productId, quantity: Number(i.quantity), unit: i.unit })),
    }),
    onSuccess: () => {
      toast.success('Atividade registrada!')
      qc.invalidateQueries({ queryKey: ['activities'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro'),
  })

  function addItem() {
    setItems((prev) => [...prev, { productId: '', quantity: '', unit: 'LITER' }])
  }

  function updateItem(idx: number, field: string, value: string) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const canSubmit = type && harvestId && date

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Nova Atividade</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          {/* Tipo */}
          <div>
            <label className="label">Tipo de atividade</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(ACTIVITY_LABELS).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setType(v)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                    type === v
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Safra */}
          <div>
            <label className="label">Safra</label>
            <select value={harvestId} onChange={(e) => { setHarvestId(e.target.value); setPlotId('') }} className="input">
              <option value="">Selecione a safra</option>
              {(harvests ?? []).map((h: any) => (
                <option key={h.id} value={h.id}>{h.crop} {h.year} — {h.property?.name}</option>
              ))}
            </select>
          </div>

          {/* Talhão */}
          {harvestId && (
            <div>
              <label className="label">Talhão <span className="text-gray-400 font-normal">(opcional)</span></label>
              <select value={plotId} onChange={(e) => setPlotId(e.target.value)} className="input">
                <option value="">Toda a safra</option>
                {(harvestPlots ?? []).map((hp: any) => (
                  <option key={hp.plotId} value={hp.plotId}>
                    {hp.plot.name}{hp.hectares ? ` — ${hp.hectares} ha` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Hectares trabalhados</label>
              <input
                type="number" step="0.01" value={hectares}
                onChange={(e) => setHectares(e.target.value)}
                className="input" placeholder="Opcional"
              />
            </div>
          </div>

          {/* Produtos usados */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Produtos utilizados</label>
              <button type="button" onClick={addItem} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                + Adicionar produto
              </button>
            </div>
            {items.length === 0 && (
              <p className="text-sm text-gray-400">Nenhum produto adicionado</p>
            )}
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={item.productId}
                    onChange={(e) => {
                      const prod = (products ?? []).find((p: any) => p.id === e.target.value)
                      setItems((prev) => prev.map((it, i) =>
                        i === idx ? { ...it, productId: e.target.value, unit: prod?.unit ?? it.unit } : it
                      ))
                    }}
                    className="input flex-1"
                  >
                    <option value="">Produto</option>
                    {(products ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input
                    type="number" step="0.001" value={item.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                    className="input w-24" placeholder="Qtd"
                  />
                  <span className="text-sm text-gray-500 w-14 text-center">{UNIT_LABELS[item.unit] ?? item.unit}</span>
                  <button type="button" onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Observações</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="Opcional" />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => canSubmit && create.mutate()}
              disabled={!canSubmit || create.isPending}
              className="btn-primary flex-1"
            >
              {create.isPending ? 'Registrando...' : 'Registrar atividade'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ActivityCard({ activity, onDelete }: { activity: any; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${ACTIVITY_COLORS[activity.type] ?? 'bg-gray-100 text-gray-700'}`}>
          {ACTIVITY_LABELS[activity.type] ?? activity.type}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate">
            {activity.harvest?.crop} {activity.harvest?.year}
            {activity.plot && <span className="text-gray-500"> · {activity.plot.name}</span>}
          </p>
          <p className="text-xs text-gray-400">
            {new Date(activity.date).toLocaleDateString('pt-BR')}
            {activity.hectares && ` · ${activity.hectares} ha`}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {activity.items?.length > 0 && (
            <button onClick={() => setExpanded((v) => !v)} className="text-gray-400 hover:text-gray-600 p-1">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
          <button onClick={onDelete} className="text-gray-300 hover:text-red-400 p-1">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && activity.items?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
          {activity.items.map((item: any) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-gray-700">{item.product?.name}</span>
              <span className="text-gray-500">{item.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {UNIT_LABELS[item.unit] ?? item.unit}</span>
            </div>
          ))}
        </div>
      )}
      {activity.notes && (
        <p className="mt-2 text-xs text-gray-400 italic">{activity.notes}</p>
      )}
    </div>
  )
}

export default function ActivitiesPage() {
  const [modal, setModal] = useState(false)
  const [filterHarvest, setFilterHarvest] = useState('')
  const qc = useQueryClient()

  const { data: activities, isLoading } = useQuery({
    queryKey: ['activities', filterHarvest],
    queryFn: () => api.get('/producer/activities', {
      params: filterHarvest ? { harvestId: filterHarvest } : {},
    }).then((r) => r.data),
  })

  const { data: harvests } = useQuery({
    queryKey: ['harvests'],
    queryFn: () => api.get('/producer/harvests').then((r) => r.data),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/producer/activities/${id}`),
    onSuccess: () => {
      toast.success('Atividade removida')
      qc.invalidateQueries({ queryKey: ['activities'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro'),
  })

  return (
    <PlanGuard>
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 truncate">Atividades</h1>
        <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Nova Atividade
        </button>
      </div>

      <div className="mb-4">
        <select
          value={filterHarvest}
          onChange={(e) => setFilterHarvest(e.target.value)}
          className="input max-w-xs"
        >
          <option value="">Todas as safras</option>
          {(harvests ?? []).map((h: any) => (
            <option key={h.id} value={h.id}>{h.crop} {h.year} — {h.property?.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="card p-4 h-16 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2">
          {(activities ?? []).length === 0 && (
            <div className="card p-12 text-center text-gray-400">
              <Tractor className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Nenhuma atividade registrada</p>
            </div>
          )}
          {(activities ?? []).map((activity: any) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onDelete={() => remove.mutate(activity.id)}
            />
          ))}
        </div>
      )}

      {modal && <NewActivityModal onClose={() => setModal(false)} />}
    </div>
    </PlanGuard>
  )
}
