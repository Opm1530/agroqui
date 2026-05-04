'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, formatCurrency, formatDate } from '@/lib/api'
import { toast } from 'sonner'
import { Plus, Trash2, FileText, TrendingUp, TrendingDown } from 'lucide-react'
import { useForm } from 'react-hook-form'

const CATEGORIES = [
  { value: 'DEFENSIVE', label: 'Defensivo' },
  { value: 'FERTILIZER', label: 'Fertilizante/Corretivo' },
  { value: 'SEED', label: 'Semente' },
  { value: 'FUEL', label: 'Combustível' },
  { value: 'MACHINERY_MAINTENANCE', label: 'Manutenção Maquinário' },
  { value: 'LABOR', label: 'Mão de Obra' },
  { value: 'LEASE', label: 'Arrendamento' },
  { value: 'FREIGHT_DRYING', label: 'Frete/Secagem' },
  { value: 'PRODUCTION_SALE', label: 'Venda de Produção' },
  { value: 'OTHER_INCOME', label: 'Outras Receitas' },
  { value: 'OTHER_EXPENSE', label: 'Outras Despesas' },
]

function categoryLabel(v: string) {
  return CATEGORIES.find((c) => c.value === v)?.label ?? v
}

function NewEntryModal({ harvests, plots, onClose }: { harvests: any[]; plots: any[]; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm({
    defaultValues: { date: new Date().toISOString().split('T')[0] },
  })

  const create = useMutation({
    mutationFn: (data: any) => api.post('/producer/entries', { ...data, amount: Number(data.amount) }),
    onSuccess: () => {
      toast.success('Lançamento registrado!')
      qc.invalidateQueries({ queryKey: ['entries'] })
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Novo Lançamento</h2>
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-3">
          <div>
            <label className="label">Safra</label>
            <select {...register('harvestId', { required: true })} className="input">
              <option value="">Selecione a safra</option>
              {harvests.map((h) => (
                <option key={h.id} value={h.id}>{h.crop} {h.year} — {h.property?.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Talhão (opcional)</label>
            <select {...register('plotId')} className="input">
              <option value="">Sem talhão específico</option>
              {plots.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Categoria</label>
            <select {...register('category', { required: true })} className="input">
              <option value="">Selecione</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor (R$)</label>
              <input {...register('amount', { required: true })} type="number" step="0.01" className="input" placeholder="0,00" />
            </div>
            <div>
              <label className="label">Data</label>
              <input {...register('date', { required: true })} type="date" className="input" />
            </div>
          </div>
          <div>
            <label className="label">Fornecedor</label>
            <input {...register('supplier')} className="input" placeholder="Nome do fornecedor" />
          </div>
          <div>
            <label className="label">Descrição</label>
            <input {...register('description')} className="input" placeholder="Descrição opcional" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-primary flex-1" disabled={create.isPending}>
              {create.isPending ? 'Salvando...' : 'Salvar'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function EntriesPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)

  const { data: entriesData, isLoading } = useQuery({
    queryKey: ['entries'],
    queryFn: () => api.get('/producer/entries').then((r) => r.data),
  })

  const { data: harvests } = useQuery({
    queryKey: ['harvests'],
    queryFn: () => api.get('/producer/harvests').then((r) => r.data),
  })

  const { data: plots } = useQuery({
    queryKey: ['plots'],
    queryFn: () => api.get('/producer/plots').then((r) => r.data),
  })

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/producer/entries/${id}`),
    onSuccess: () => {
      toast.success('Lançamento removido')
      qc.invalidateQueries({ queryKey: ['entries'] })
    },
  })

  const entries = entriesData?.entries ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Lançamentos</h1>
        <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Lançamento
        </button>
      </div>

      <div className="card divide-y divide-gray-100">
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Nenhum lançamento ainda</p>
            <p className="text-sm mt-1">Registre pelo WhatsApp ou pelo botão acima</p>
          </div>
        ) : entries.map((entry: any) => (
          <div key={entry.id} className="flex items-center gap-4 p-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${entry.type === 'INCOME' ? 'bg-green-100' : 'bg-red-100'}`}>
              {entry.type === 'INCOME'
                ? <TrendingUp className="w-4 h-4 text-green-600" />
                : <TrendingDown className="w-4 h-4 text-red-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{categoryLabel(entry.category)}</p>
              <p className="text-xs text-gray-500">
                {entry.supplier && `${entry.supplier} · `}
                {entry.harvest?.crop} {entry.harvest?.year}
                {entry.plot && ` · ${entry.plot.name}`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`font-semibold text-sm ${entry.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                {entry.type === 'INCOME' ? '+' : '-'}{formatCurrency(entry.amount)}
              </p>
              <p className="text-xs text-gray-400">{formatDate(entry.date)}</p>
            </div>
            <button
              onClick={() => del.mutate(entry.id)}
              className="p-1.5 text-gray-300 hover:text-red-500 rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {modal && harvests && plots && (
        <NewEntryModal harvests={harvests} plots={plots} onClose={() => setModal(false)} />
      )}
    </div>
  )
}
