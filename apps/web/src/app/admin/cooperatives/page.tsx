'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Plus, Building2, Users } from 'lucide-react'
import { useForm } from 'react-hook-form'

function NewCooperativeModal({ plans, onClose }: { plans: any[]; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm()

  const create = useMutation({
    mutationFn: (data: any) => api.post('/admin/cooperatives', data),
    onSuccess: () => {
      toast.success('Cooperativa criada!')
      qc.invalidateQueries({ queryKey: ['admin-cooperatives'] })
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Nova Cooperativa</h2>
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Nome da Cooperativa</label>
              <input {...register('name', { required: true })} className="input" placeholder="Coopagrigo" />
            </div>
            <div>
              <label className="label">CNPJ</label>
              <input {...register('cnpj')} className="input" placeholder="00.000.000/0001-00" />
            </div>
            <div>
              <label className="label">Subdomínio</label>
              <div className="flex items-center">
                <input {...register('subdomain', { required: true })} className="input rounded-r-none" placeholder="coopagrigo" />
                <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-200 rounded-r-lg text-sm text-gray-500">.contadordocampo.com.br</span>
              </div>
            </div>
            <div>
              <label className="label">Plano</label>
              <select {...register('planId', { required: true })} className="input">
                {plans.filter((p) => p.isActive).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — R$ {p.priceMonthly}/mês</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Cor Principal</label>
              <input {...register('primaryColor')} type="color" className="input h-10" defaultValue="#16a34a" />
            </div>
          </div>

          <hr className="my-2" />
          <p className="text-sm font-medium text-gray-700">Usuário Admin da Cooperativa</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Nome</label>
              <input {...register('adminName', { required: true })} className="input" />
            </div>
            <div>
              <label className="label">E-mail</label>
              <input {...register('adminEmail', { required: true })} type="email" className="input" />
            </div>
            <div>
              <label className="label">Senha inicial</label>
              <input {...register('adminPassword', { required: true })} type="password" className="input" placeholder="Mín. 8 caracteres" />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-primary flex-1" disabled={create.isPending}>
              {create.isPending ? 'Criando...' : 'Criar Cooperativa'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CooperativesPage() {
  const [modal, setModal] = useState(false)

  const { data: cooperatives, isLoading } = useQuery({
    queryKey: ['admin-cooperatives'],
    queryFn: () => api.get('/admin/cooperatives').then((r) => r.data),
  })

  const { data: plans } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => api.get('/admin/plans').then((r) => r.data),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cooperativas</h1>
        <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nova Cooperativa
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card p-6 h-24 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {cooperatives?.map((coop: any) => (
            <div key={coop.id} className="card p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary-700" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-gray-900">{coop.name}</span>
                  {!coop.isActive && <span className="badge-red">Inativa</span>}
                </div>
                <p className="text-xs text-gray-500">
                  <span className="font-mono bg-gray-100 px-1 rounded">{coop.subdomain}.contadordocampo.com.br</span>
                  {' · '}{coop.plan?.name}
                </p>
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Users className="w-4 h-4" />
                {coop._count.producers} produtores
              </div>
            </div>
          ))}
          {cooperatives?.length === 0 && (
            <div className="card p-12 text-center text-gray-400">
              <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Nenhuma cooperativa cadastrada</p>
            </div>
          )}
        </div>
      )}

      {modal && plans && <NewCooperativeModal plans={plans} onClose={() => setModal(false)} />}
    </div>
  )
}
