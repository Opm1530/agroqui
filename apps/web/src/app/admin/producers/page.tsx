'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Tractor, Phone, Gift, Trash2 } from 'lucide-react'

export default function ProducersPage() {
  const qc = useQueryClient()
  const { data: producers, isLoading } = useQuery({
    queryKey: ['admin-producers'],
    queryFn: () => api.get('/admin/producers').then((r) => r.data),
  })

  const deleteProducer = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/producers/${id}`),
    onSuccess: () => {
      toast.success('Produtor excluído.')
      qc.invalidateQueries({ queryKey: ['admin-producers'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro ao excluir'),
  })

  function confirmDelete(p: any) {
    if (confirm(`Excluir ${p.user.name} (${p.user.email})?\n\nTodos os dados serão removidos permanentemente.`)) {
      deleteProducer.mutate(p.id)
    }
  }

  const grantComplimentary = useMutation({
    mutationFn: (id: string) => api.post(`/admin/producers/${id}/complimentary`),
    onSuccess: () => {
      toast.success('Acesso cortesia concedido!')
      qc.invalidateQueries({ queryKey: ['admin-producers'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro'),
  })

  const revokeComplimentary = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/producers/${id}/complimentary`),
    onSuccess: () => {
      toast.success('Acesso cortesia revogado.')
      qc.invalidateQueries({ queryKey: ['admin-producers'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro'),
  })

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      ACTIVE: 'badge-green',
      TRIALING: 'badge-yellow',
      PAST_DUE: 'badge-red',
      CANCELED: 'badge-gray',
      INACTIVE: 'badge-gray',
      COMPLIMENTARY: 'badge-green',
    }
    return map[status] ?? 'badge-gray'
  }

  const statusLabel = (status: string, planName?: string) => {
    if (status === 'COMPLIMENTARY') return 'Cortesia'
    return planName ?? status
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Produtores</h1>

      <div className="card divide-y divide-gray-100">
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : producers?.map((p: any) => {
          const sub = p.subscriptions[0]
          const isComplimentary = sub?.status === 'COMPLIMENTARY'
          const isPending = grantComplimentary.isPending || revokeComplimentary.isPending
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                <Tractor className="w-4 h-4 text-green-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">{p.user.name}</p>
                <p className="text-gray-500 text-xs">{p.user.email}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                <Phone className="w-3 h-3" />{p.whatsapp}
              </div>
              <div className="text-xs text-gray-500 shrink-0">{p._count.properties} prop.</div>
              {p.cooperative && (
                <span className="badge-gray text-xs shrink-0">{p.cooperative.name}</span>
              )}
              {sub && (
                <span className={`${statusBadge(sub.status)} shrink-0`}>
                  {statusLabel(sub.status, sub.plan?.name)}
                </span>
              )}
              {!p.user.isActive && <span className="badge-red shrink-0">Inativo</span>}
              <button
                onClick={() => isComplimentary ? revokeComplimentary.mutate(p.id) : grantComplimentary.mutate(p.id)}
                disabled={isPending}
                title={isComplimentary ? 'Revogar cortesia' : 'Conceder cortesia'}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors shrink-0 ${
                  isComplimentary
                    ? 'border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                } disabled:opacity-50`}
              >
                <Gift className="w-3 h-3" />
                {isComplimentary ? 'Revogar' : 'Cortesia'}
              </button>
              <button
                onClick={() => confirmDelete(p)}
                disabled={deleteProducer.isPending}
                title="Excluir produtor"
                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-colors shrink-0 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
        {producers?.length === 0 && (
          <div className="p-12 text-center text-gray-400">
            <Tractor className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Nenhum produtor cadastrado</p>
          </div>
        )}
      </div>
    </div>
  )
}
