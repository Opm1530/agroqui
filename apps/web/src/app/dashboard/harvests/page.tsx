'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, formatCurrency } from '@/lib/api'
import { toast } from 'sonner'
import { Plus, Leaf, BarChart2, Pencil, X, Layers } from 'lucide-react'
import { useForm } from 'react-hook-form'
import Link from 'next/link'
import { PlanGuard } from '@/components/PlanGuard'

function NewHarvestModal({ properties, onClose }: { properties: any[]; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm({
    defaultValues: { year: new Date().getFullYear().toString() },
  })

  const create = useMutation({
    mutationFn: (data: any) =>
      api.post('/producer/harvests', { ...data, targetCostPerHa: data.targetCostPerHa ? Number(data.targetCostPerHa) : undefined }),
    onSuccess: () => {
      toast.success('Safra criada!')
      qc.invalidateQueries({ queryKey: ['harvests'] })
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Nova Safra</h2>
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-3">
          <div>
            <label className="label">Propriedade</label>
            <select {...register('propertyId', { required: true })} className="input">
              <option value="">Selecione</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
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

function HarvestPlotsModal({ harvest, onClose }: { harvest: any; onClose: () => void }) {
  const qc = useQueryClient()

  const { data: harvestPlots } = useQuery({
    queryKey: ['harvest-plots', harvest.id],
    queryFn: () => api.get(`/producer/harvests/${harvest.id}/plots`).then((r) => r.data),
  })

  const { data: allPlots } = useQuery({
    queryKey: ['plots', harvest.propertyId],
    queryFn: () => api.get('/producer/plots', { params: { propertyId: harvest.propertyId } }).then((r) => r.data),
  })

  const [plotId, setPlotId] = useState('')
  const [hectares, setHectares] = useState('')

  const linkedIds = new Set((harvestPlots ?? []).map((hp: any) => hp.plotId))
  const availablePlots = (allPlots ?? []).filter((p: any) => !linkedIds.has(p.id))

  const add = useMutation({
    mutationFn: () => api.post(`/producer/harvests/${harvest.id}/plots`, {
      plotId,
      hectares: hectares ? Number(hectares) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['harvest-plots', harvest.id] })
      setPlotId('')
      setHectares('')
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro'),
  })

  const remove = useMutation({
    mutationFn: (pid: string) => api.delete(`/producer/harvests/${harvest.id}/plots/${pid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['harvest-plots', harvest.id] }),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Talhões — {harvest.crop} {harvest.year}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-2 mb-4">
          {(harvestPlots ?? []).length === 0 && (
            <p className="text-sm text-gray-400 py-2">Nenhum talhão vinculado</p>
          )}
          {(harvestPlots ?? []).map((hp: any) => (
            <div key={hp.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <div>
                <span className="font-medium text-sm">{hp.plot.name}</span>
                {hp.hectares && <span className="text-xs text-gray-500 ml-2">{hp.hectares} ha</span>}
                {hp.plot.hectares && !hp.hectares && <span className="text-xs text-gray-400 ml-2">{hp.plot.hectares} ha (total)</span>}
              </div>
              <button onClick={() => remove.mutate(hp.plotId)} className="text-red-400 hover:text-red-600 text-xs">Remover</button>
            </div>
          ))}
        </div>

        {availablePlots.length > 0 && (
          <div className="border-t pt-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">Adicionar talhão</p>
            <select value={plotId} onChange={(e) => setPlotId(e.target.value)} className="input">
              <option value="">Selecione o talhão</option>
              {availablePlots.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}{p.hectares ? ` (${p.hectares} ha)` : ''}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                value={hectares}
                onChange={(e) => setHectares(e.target.value)}
                className="input flex-1"
                placeholder="Hectares usados (opcional)"
              />
              <button
                onClick={() => plotId && add.mutate()}
                disabled={!plotId || add.isPending}
                className="btn-primary px-4"
              >
                Adicionar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const statusLabel = (s: string) => ({
  PLANNING: 'Planejamento', ACTIVE: 'Ativa', HARVESTED: 'Colhida', CLOSED: 'Encerrada'
}[s] ?? s)

const statusBadge = (s: string) => ({
  PLANNING: 'badge-yellow', ACTIVE: 'badge-green', HARVESTED: 'badge-gray', CLOSED: 'badge-gray'
}[s] ?? 'badge-gray')

export default function HarvestsPage() {
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [managingPlots, setManagingPlots] = useState<any>(null)

  const { data: harvests, isLoading } = useQuery({
    queryKey: ['harvests'],
    queryFn: () => api.get('/producer/harvests').then((r) => r.data),
  })

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get('/producer/properties').then((r) => r.data),
  })

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
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card p-6 h-24 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {harvests?.map((harvest: any) => (
            <div key={harvest.id} className="card p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center shrink-0">
                <Leaf className="w-5 h-5 text-primary-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="font-semibold text-gray-900 truncate">{harvest.crop} {harvest.year}</span>
                  <span className={statusBadge(harvest.status)}>{statusLabel(harvest.status)}</span>
                </div>
                <p className="text-sm text-gray-500 truncate">{harvest.property?.name} · {harvest._count?.entries ?? 0} lançamentos</p>
                {harvest.targetCostPerHa && (
                  <p className="text-xs text-gray-400">Meta: {formatCurrency(harvest.targetCostPerHa)}/ha</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setManagingPlots(harvest)}
                  className="btn-secondary flex items-center gap-1.5 text-sm"
                  title="Gerenciar talhões"
                >
                  <Layers className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditing(harvest)}
                  className="btn-secondary flex items-center gap-1.5 text-sm"
                  title="Editar safra"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <Link href={`/dashboard/harvests/${harvest.id}/dre`} className="btn-secondary flex items-center gap-1.5 text-sm">
                  <BarChart2 className="w-4 h-4" /> DRE
                </Link>
              </div>
            </div>
          ))}
          {harvests?.length === 0 && (
            <div className="card p-12 text-center text-gray-400">
              <Leaf className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Nenhuma safra cadastrada</p>
            </div>
          )}
        </div>
      )}

      {modal && properties && (
        <NewHarvestModal properties={properties} onClose={() => setModal(false)} />
      )}
      {editing && (
        <EditHarvestModal harvest={editing} onClose={() => setEditing(null)} />
      )}
      {managingPlots && (
        <HarvestPlotsModal harvest={managingPlots} onClose={() => setManagingPlots(null)} />
      )}
    </div>
    </PlanGuard>
  )
}
