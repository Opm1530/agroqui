'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, formatCurrency } from '@/lib/api'
import { toast } from 'sonner'
import { Plus, Leaf, BarChart2, Pencil, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useForm } from 'react-hook-form'
import Link from 'next/link'
import { PlanGuard } from '@/components/PlanGuard'

// ─── New Harvest Modal ────────────────────────────────────────────────────────

function NewHarvestModal({ properties, onClose }: { properties: any[]; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, watch } = useForm({
    defaultValues: { year: new Date().getFullYear().toString(), propertyId: '', crop: '', targetCostPerHa: '' },
  })
  const [selectedPlots, setSelectedPlots] = useState<string[]>([])

  const propertyId = watch('propertyId')

  const { data: plots } = useQuery({
    queryKey: ['plots', propertyId],
    queryFn: () => api.get(`/producer/plots?propertyId=${propertyId}`).then((r) => r.data),
    enabled: !!propertyId,
  })

  const create = useMutation({
    mutationFn: async (data: any) => {
      const harvest = await api.post('/producer/harvests', {
        ...data,
        targetCostPerHa: data.targetCostPerHa ? Number(data.targetCostPerHa) : undefined,
      })
      // Link selected plots
      for (const plotId of selectedPlots) {
        await api.post(`/producer/harvests/${harvest.data.id}/plots`, { plotId }).catch(() => {})
      }
      return harvest.data
    },
    onSuccess: () => {
      toast.success('Safra criada!')
      qc.invalidateQueries({ queryKey: ['harvests'] })
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro'),
  })

  const togglePlot = (id: string) =>
    setSelectedPlots((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Nova Safra</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-3">
          <div>
            <label className="label">Propriedade</label>
            <select {...register('propertyId', { required: true })} className="input">
              <option value="">Selecione</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {propertyId && plots && (
            <div>
              <label className="label">Talhões desta safra</label>
              {plots.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum talhão cadastrado nesta propriedade.</p>
              ) : (
                <div className="space-y-1.5">
                  {plots.map((plot: any) => (
                    <label key={plot.id} className="flex items-center gap-2 cursor-pointer py-1">
                      <input
                        type="checkbox"
                        checked={selectedPlots.includes(plot.id)}
                        onChange={() => togglePlot(plot.id)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">{plot.name}</span>
                      {plot.hectares && <span className="text-xs text-gray-400">{plot.hectares} ha</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cultura</label>
              <input {...register('crop', { required: true })} className="input" placeholder="Soja, Milho..." />
            </div>
            <div>
              <label className="label">Ano</label>
              <input {...register('year', { required: true })} className="input" placeholder="2025/26" />
            </div>
          </div>
          <div>
            <label className="label">Meta de custo/ha (R$)</label>
            <input {...register('targetCostPerHa')} type="number" step="0.01" className="input" placeholder="Opcional" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-primary flex-1" disabled={create.isPending}>
              {create.isPending ? 'Criando...' : 'Criar'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Edit Harvest Modal ────────────────────────────────────────────────────────

function EditHarvestModal({ harvest, onClose }: { harvest: any; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm({
    defaultValues: {
      crop: harvest.crop,
      year: harvest.year,
      targetCostPerHa: harvest.targetCostPerHa ?? '',
      status: harvest.status,
    },
  })

  // Plots linked to this harvest
  const { data: harvestPlots } = useQuery({
    queryKey: ['harvest-plots', harvest.id],
    queryFn: () => api.get(`/producer/harvests/${harvest.id}/plots`).then((r) => r.data),
  })

  const { data: allPlots } = useQuery({
    queryKey: ['plots', harvest.propertyId],
    queryFn: () => api.get(`/producer/plots?propertyId=${harvest.propertyId}`).then((r) => r.data),
  })

  const linkedIds = new Set((harvestPlots ?? []).map((hp: any) => hp.plotId))

  const addPlot = useMutation({
    mutationFn: (plotId: string) => api.post(`/producer/harvests/${harvest.id}/plots`, { plotId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['harvest-plots', harvest.id] }),
  })

  const removePlot = useMutation({
    mutationFn: (plotId: string) => api.delete(`/producer/harvests/${harvest.id}/plots/${plotId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['harvest-plots', harvest.id] }),
  })

  const togglePlot = (plotId: string) => {
    if (linkedIds.has(plotId)) {
      removePlot.mutate(plotId)
    } else {
      addPlot.mutate(plotId)
    }
  }

  const save = useMutation({
    mutationFn: (data: any) =>
      api.put(`/producer/harvests/${harvest.id}`, {
        ...data,
        targetCostPerHa: data.targetCostPerHa ? Number(data.targetCostPerHa) : undefined,
      }),
    onSuccess: () => {
      toast.success('Safra atualizada!')
      qc.invalidateQueries({ queryKey: ['harvests'] })
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Editar Safra</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cultura</label>
              <input {...register('crop', { required: true })} className="input" placeholder="Soja, Milho..." />
            </div>
            <div>
              <label className="label">Ano/Safra</label>
              <input {...register('year', { required: true })} className="input" placeholder="2025/26" />
            </div>
          </div>
          <div>
            <label className="label">Meta de custo/ha (R$)</label>
            <input {...register('targetCostPerHa')} type="number" step="0.01" className="input" placeholder="Opcional" />
          </div>
          <div>
            <label className="label">Status</label>
            <select {...register('status')} className="input">
              <option value="PLANNING">Planejamento</option>
              <option value="ACTIVE">Ativa</option>
              <option value="HARVESTED">Colhida</option>
              <option value="CLOSED">Encerrada</option>
            </select>
          </div>

          {allPlots && allPlots.length > 0 && (
            <div>
              <label className="label">Talhões vinculados</label>
              <div className="space-y-1.5">
                {allPlots.map((plot: any) => (
                  <label key={plot.id} className="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={linkedIds.has(plot.id)}
                      onChange={() => togglePlot(plot.id)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">{plot.name}</span>
                    {plot.hectares && <span className="text-xs text-gray-400">{plot.hectares} ha</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-primary flex-1" disabled={save.isPending}>
              {save.isPending ? 'Salvando...' : 'Salvar'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete confirmation ───────────────────────────────────────────────────────

function DeleteHarvestDialog({ harvest, onClose }: { harvest: any; onClose: () => void }) {
  const qc = useQueryClient()
  const del = useMutation({
    mutationFn: () => api.delete(`/producer/harvests/${harvest.id}`),
    onSuccess: () => {
      toast.success('Safra removida!')
      qc.invalidateQueries({ queryKey: ['harvests'] })
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro ao remover'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-sm">
        <h2 className="text-lg font-semibold mb-2">Remover safra?</h2>
        <p className="text-sm text-gray-500 mb-5">
          <strong>{harvest.crop} {harvest.year}</strong> e todos os seus lançamentos serão removidos permanentemente.
        </p>
        <div className="flex gap-3">
          <button onClick={() => del.mutate()} disabled={del.isPending} className="btn-danger flex-1">
            {del.isPending ? 'Removendo...' : 'Remover'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Status helpers ────────────────────────────────────────────────────────────

const statusLabel = (s: string) => ({
  PLANNING: 'Planejamento', ACTIVE: 'Ativa', HARVESTED: 'Colhida', CLOSED: 'Encerrada'
}[s] ?? s)

const statusBadge = (s: string) => ({
  PLANNING: 'badge-yellow', ACTIVE: 'badge-green', HARVESTED: 'badge-gray', CLOSED: 'badge-gray'
}[s] ?? 'badge-gray')

// ─── Harvest card ─────────────────────────────────────────────────────────────

function HarvestCard({
  harvest,
  onEdit,
  onDelete,
}: {
  harvest: any
  onEdit: (h: any) => void
  onDelete: (h: any) => void
}) {
  const plots: any[] = harvest.harvestPlots?.map((hp: any) => hp.plot) ?? []

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
      <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
        <Leaf className="w-4 h-4 text-primary-700" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="font-semibold text-gray-900">{harvest.crop} {harvest.year}</span>
          <span className={statusBadge(harvest.status)}>{statusLabel(harvest.status)}</span>
        </div>
        <p className="text-xs text-gray-400">{harvest._count?.entries ?? 0} lançamentos</p>
        {harvest.targetCostPerHa && (
          <p className="text-xs text-gray-400">Meta: {formatCurrency(harvest.targetCostPerHa)}/ha</p>
        )}
        {plots.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {plots.map((plot) => (
              <span key={plot.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {plot.name}{plot.hectares ? ` · ${plot.hectares} ha` : ''}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Link
          href={`/dashboard/harvests/${harvest.id}/dre`}
          className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50"
          title="DRE"
        >
          <BarChart2 className="w-4 h-4" />
        </Link>
        <button
          onClick={() => onEdit(harvest)}
          className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          title="Editar"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(harvest)}
          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
          title="Remover"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Property group ───────────────────────────────────────────────────────────

function PropertyGroup({
  property,
  harvests,
  onEdit,
  onDelete,
}: {
  property: { id: string; name: string }
  harvests: any[]
  onEdit: (h: any) => void
  onDelete: (h: any) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-900">{property.name}</span>
          <span className="badge-gray">{harvests.length} safra{harvests.length !== 1 ? 's' : ''}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-50 pt-3">
          {harvests.map((h) => (
            <HarvestCard key={h.id} harvest={h} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HarvestsPage() {
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deleting, setDeleting] = useState<any>(null)

  const { data: harvests, isLoading } = useQuery({
    queryKey: ['harvests'],
    queryFn: () => api.get('/producer/harvests').then((r) => r.data),
  })

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get('/producer/properties').then((r) => r.data),
  })

  // Group harvests by property
  const byProperty = (harvests ?? []).reduce((acc: Record<string, any[]>, h: any) => {
    const key = h.property.id
    if (!acc[key]) acc[key] = []
    acc[key].push(h)
    return acc
  }, {})

  return (
    <PlanGuard>
      <div>
        <div className="flex items-center justify-between gap-3 mb-6 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">Safras</h1>
          <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Nova Safra
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="card p-6 h-24 animate-pulse" />)}</div>
        ) : harvests?.length === 0 ? (
          <div className="card p-12 text-center text-gray-400">
            <Leaf className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Nenhuma safra cadastrada</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(byProperty).map(([propId, propHarvests]) => (
              <PropertyGroup
                key={propId}
                property={(propHarvests as any[])[0].property}
                harvests={propHarvests as any[]}
                onEdit={setEditing}
                onDelete={setDeleting}
              />
            ))}
          </div>
        )}

        {modal && properties && (
          <NewHarvestModal properties={properties} onClose={() => setModal(false)} />
        )}
        {editing && (
          <EditHarvestModal harvest={editing} onClose={() => setEditing(null)} />
        )}
        {deleting && (
          <DeleteHarvestDialog harvest={deleting} onClose={() => setDeleting(null)} />
        )}
      </div>
    </PlanGuard>
  )
}
