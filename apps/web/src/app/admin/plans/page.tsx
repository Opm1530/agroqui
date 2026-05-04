'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, formatCurrency } from '@/lib/api'
import { toast } from 'sonner'
import { Plus, Edit2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useForm } from 'react-hook-form'

const PLAN_TYPES = ['BASIC', 'PRO', 'COOPERATIVE', 'CUSTOM']

function PlanModal({ plan, onClose }: { plan?: any; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm({
    defaultValues: plan ?? {
      type: 'PRO', priceMonthly: 197, maxProperties: 3, maxUsers: 1,
      hasOcr: true, hasAiAgent: true, hasAutoDre: true, hasAlerts: true,
    },
  })

  const save = useMutation({
    mutationFn: (data: any) =>
      plan ? api.put(`/admin/plans/${plan.id}`, data) : api.post('/admin/plans', data),
    onSuccess: () => {
      toast.success(plan ? 'Plano atualizado!' : 'Plano criado!')
      qc.invalidateQueries({ queryKey: ['admin-plans'] })
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">{plan ? 'Editar Plano' : 'Novo Plano'}</h2>
        <form onSubmit={handleSubmit((d) => save.mutate({ ...d, priceMonthly: Number(d.priceMonthly), maxProperties: Number(d.maxProperties), maxUsers: Number(d.maxUsers) }))} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nome</label>
              <input {...register('name', { required: true })} className="input" placeholder="Pro" />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select {...register('type')} className="input">
                {PLAN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Preço Mensal (R$)</label>
              <input {...register('priceMonthly')} type="number" step="0.01" className="input" />
            </div>
            <div>
              <label className="label">Máx. Propriedades</label>
              <input {...register('maxProperties')} type="number" className="input" />
            </div>
            <div>
              <label className="label">Máx. Usuários/Produtores</label>
              <input {...register('maxUsers')} type="number" className="input" />
            </div>
            <div>
              <label className="label">Stripe Price ID</label>
              <input {...register('stripePriceId')} className="input" placeholder="price_..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            {[
              { key: 'hasOcr', label: 'OCR de Notas' },
              { key: 'hasAiAgent', label: 'Agente IA (WhatsApp)' },
              { key: 'hasAutoDre', label: 'DRE Automático' },
              { key: 'hasAlerts', label: 'Alertas Inteligentes' },
              { key: 'hasWhitelabel', label: 'White-label' },
              { key: 'hasPrioritySupport', label: 'Suporte Prioritário' },
              { key: 'isActive', label: 'Ativo' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input {...register(key as any)} type="checkbox" className="rounded border-gray-300 text-primary-600" />
                {label}
              </label>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
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

export default function PlansPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<'new' | any | null>(null)

  const { data: plans, isLoading } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => api.get('/admin/plans').then((r) => r.data),
  })

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: any) => api.put(`/admin/plans/${id}`, { isActive: !isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-plans'] }),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Planos</h1>
        <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Plano
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card p-6 h-24 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {plans?.map((plan: any) => (
            <div key={plan.id} className="card p-5 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900">{plan.name}</span>
                  <span className="badge-gray text-xs">{plan.type}</span>
                  {!plan.isActive && <span className="badge-red text-xs">Inativo</span>}
                </div>
                <p className="text-2xl font-bold text-primary-600">
                  {formatCurrency(plan.priceMonthly)}<span className="text-sm text-gray-500 font-normal">/mês</span>
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {plan.hasOcr && <span className="badge-green">OCR</span>}
                  {plan.hasAiAgent && <span className="badge-green">IA WhatsApp</span>}
                  {plan.hasAutoDre && <span className="badge-green">DRE Auto</span>}
                  {plan.hasAlerts && <span className="badge-green">Alertas</span>}
                  {plan.hasWhitelabel && <span className="badge-green">White-label</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Até {plan.maxProperties} propriedade(s) · {plan.maxUsers} usuário(s)
                  {plan.stripePriceId && ` · Stripe: ${plan.stripePriceId}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setModal(plan)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => toggle.mutate(plan)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                  {plan.isActive ? <ToggleRight className="w-5 h-5 text-green-600" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <PlanModal
          plan={modal === 'new' ? undefined : modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
