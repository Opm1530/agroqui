'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, formatCurrency } from '@/lib/api'
import { toast } from 'sonner'
import { Plus, Leaf, BarChart2 } from 'lucide-react'
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

const statusLabel = (s: string) => ({
  PLANNING: 'Planejamento', ACTIVE: 'Ativa', HARVESTED: 'Colhida', CLOSED: 'Encerrada'
}[s] ?? s)

const statusBadge = (s: string) => ({
  PLANNING: 'badge-yellow', ACTIVE: 'badge-green', HARVESTED: 'badge-gray', CLOSED: 'badge-gray'
}[s] ?? 'badge-gray')

export default function HarvestsPage() {
  const [modal, setModal] = useState(false)

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
              <Link href={`/dashboard/harvests/${harvest.id}/dre`} className="btn-secondary flex items-center gap-1.5 text-sm">
                <BarChart2 className="w-4 h-4" /> DRE
              </Link>
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
    </div>
    </PlanGuard>
  )
}
