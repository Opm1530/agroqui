'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Plus, Tractor, Phone, ToggleLeft, ToggleRight } from 'lucide-react'
import { useForm } from 'react-hook-form'

function NewProducerModal({ plans, onClose }: { plans: any[]; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm()

  const create = useMutation({
    mutationFn: (data: any) => api.post('/cooperative/producers', data),
    onSuccess: () => {
      toast.success('Produtor adicionado!')
      qc.invalidateQueries({ queryKey: ['coop-producers'] })
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Adicionar Produtor</h2>
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-3">
          <div>
            <label className="label">Nome</label>
            <input {...register('name', { required: true })} className="input" />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input {...register('email', { required: true })} type="email" className="input" />
          </div>
          <div>
            <label className="label">Senha inicial</label>
            <input {...register('password', { required: true })} type="password" className="input" placeholder="Mín. 8 caracteres" />
          </div>
          <div>
            <label className="label">WhatsApp (com DDI)</label>
            <input {...register('whatsapp', { required: true })} className="input" placeholder="5511999999999" />
          </div>
          <div>
            <label className="label">CPF/CNPJ</label>
            <input {...register('cpfCnpj')} className="input" />
          </div>
          <div>
            <label className="label">Plano</label>
            <select {...register('planId', { required: true })} className="input">
              <option value="">Selecione</option>
              {plans.filter((p) => p.isActive).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-primary flex-1" disabled={create.isPending}>
              {create.isPending ? 'Adicionando...' : 'Adicionar'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CoopProducersPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)

  const { data: producers, isLoading } = useQuery({
    queryKey: ['coop-producers'],
    queryFn: () => api.get('/cooperative/producers').then((r) => r.data),
  })

  const { data: plans } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => api.get('/admin/plans').then((r) => r.data),
  })

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: any) => api.put(`/cooperative/producers/${id}`, { isActive: !isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coop-producers'] }),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Produtores</h1>
        <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Adicionar Produtor
        </button>
      </div>

      <div className="card divide-y divide-gray-100">
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : producers?.map((p: any) => (
          <div key={p.id} className="flex items-center gap-4 p-4">
            <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center shrink-0">
              <Tractor className="w-4 h-4 text-green-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm">{p.user.name}</p>
              <p className="text-gray-500 text-xs">{p.user.email}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Phone className="w-3 h-3" />{p.whatsapp}
            </div>
            {p.subscriptions[0] && (
              <span className="badge-green">{p.subscriptions[0].plan?.name}</span>
            )}
            <button onClick={() => toggle.mutate({ id: p.id, isActive: p.user.isActive })} className="p-1 text-gray-400 hover:text-gray-600 rounded">
              {p.user.isActive ? <ToggleRight className="w-5 h-5 text-green-600" /> : <ToggleLeft className="w-5 h-5" />}
            </button>
          </div>
        ))}
        {producers?.length === 0 && (
          <div className="p-12 text-center text-gray-400">
            <Tractor className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Nenhum produtor cadastrado</p>
          </div>
        )}
      </div>

      {modal && plans && <NewProducerModal plans={plans} onClose={() => setModal(false)} />}
    </div>
  )
}
