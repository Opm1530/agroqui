'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Plus, Package, X, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { PlanGuard } from '@/components/PlanGuard'

const UNIT_LABELS: Record<string, string> = {
  LITER: 'Litros', KG: 'kg', SACA_60KG: 'sc 60kg', TONELADA: 'Toneladas', UNIDADE: 'Unidades',
}

const CATEGORY_LABELS: Record<string, string> = {
  DEFENSIVE: 'Defensivo', FERTILIZER: 'Adubo', SEED: 'Semente', FUEL: 'Combustível',
  MACHINERY_MAINTENANCE: 'Manutenção', LABOR: 'Mão de Obra', LEASE: 'Arrendamento',
  FREIGHT_DRYING: 'Frete/Secagem', PRODUCTION_SALE: 'Venda', OTHER_INCOME: 'Outra Receita',
  OTHER_EXPENSE: 'Outras Despesas',
}

function NewProductModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm()

  const create = useMutation({
    mutationFn: (data: any) => api.post('/producer/products', data),
    onSuccess: () => {
      toast.success('Produto criado!')
      qc.invalidateQueries({ queryKey: ['products'] })
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Novo Produto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-3">
          <div>
            <label className="label">Nome</label>
            <input {...register('name', { required: true })} className="input" placeholder="Ex: Glifosato 480, Ureia 45%" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Unidade</label>
              <select {...register('unit', { required: true })} className="input">
                <option value="">Selecione</option>
                {Object.entries(UNIT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Categoria</label>
              <select {...register('category', { required: true })} className="input">
                <option value="">Selecione</option>
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
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

function StockEntryModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm({
    defaultValues: { date: new Date().toISOString().slice(0, 10) },
  })

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/producer/products').then((r) => r.data),
  })

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get('/producer/properties').then((r) => r.data),
  })

  const entry = useMutation({
    mutationFn: (data: any) => api.post('/producer/stock/entry', {
      ...data,
      quantity: Number(data.quantity),
      unitCost: data.unitCost ? Number(data.unitCost) : undefined,
    }),
    onSuccess: () => {
      toast.success('Entrada registrada!')
      qc.invalidateQueries({ queryKey: ['stock'] })
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Entrada de Estoque</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit((d) => entry.mutate(d))} className="space-y-3">
          <div>
            <label className="label">Produto</label>
            <select {...register('productId', { required: true })} className="input">
              <option value="">Selecione</option>
              {(products ?? []).map((p: any) => (
                <option key={p.id} value={p.id}>{p.name} ({UNIT_LABELS[p.unit] ?? p.unit})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Propriedade</label>
            <select {...register('propertyId', { required: true })} className="input">
              <option value="">Selecione</option>
              {(properties ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Quantidade</label>
              <input {...register('quantity', { required: true })} type="number" step="0.001" className="input" placeholder="0" />
            </div>
            <div>
              <label className="label">Custo unitário</label>
              <input {...register('unitCost')} type="number" step="0.01" className="input" placeholder="Opcional" />
            </div>
          </div>
          <div>
            <label className="label">Data</label>
            <input {...register('date', { required: true })} type="date" className="input" />
          </div>
          <div>
            <label className="label">Observação</label>
            <input {...register('note')} className="input" placeholder="Opcional" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-primary flex-1" disabled={entry.isPending}>
              {entry.isPending ? 'Registrando...' : 'Registrar'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function StockPage() {
  const [newProduct, setNewProduct] = useState(false)
  const [stockEntry, setStockEntry] = useState(false)
  const [tab, setTab] = useState<'stock' | 'products'>('stock')

  const { data: stockItems, isLoading: loadingStock } = useQuery({
    queryKey: ['stock'],
    queryFn: () => api.get('/producer/stock').then((r) => r.data),
  })

  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/producer/products').then((r) => r.data),
  })

  return (
    <PlanGuard>
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 truncate">Estoque</h1>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setNewProduct(true)} className="btn-secondary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Produto
          </button>
          <button onClick={() => setStockEntry(true)} className="btn-primary flex items-center gap-2 text-sm">
            <ArrowDownCircle className="w-4 h-4" /> Entrada
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('stock')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'stock' ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
        >
          Saldo atual
        </button>
        <button
          onClick={() => setTab('products')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'products' ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
        >
          Catálogo de produtos
        </button>
      </div>

      {tab === 'stock' && (
        <>
          {loadingStock ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="card p-4 h-16 animate-pulse" />)}</div>
          ) : (
            <div className="space-y-2">
              {(stockItems ?? []).length === 0 && (
                <div className="card p-12 text-center text-gray-400">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p>Nenhum produto em estoque</p>
                  <p className="text-sm mt-1">Registre uma entrada para começar</p>
                </div>
              )}
              {(stockItems ?? []).map((item: any) => (
                <div key={item.id} className="card p-4 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${item.quantity > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    {item.quantity > 0
                      ? <ArrowUpCircle className="w-5 h-5 text-green-600" />
                      : <ArrowDownCircle className="w-5 h-5 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{item.product.name}</p>
                    <p className="text-xs text-gray-500">{item.property.name} · {CATEGORY_LABELS[item.product.category] ?? item.product.category}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-semibold ${item.quantity > 0 ? 'text-gray-900' : 'text-red-500'}`}>
                      {item.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                    </p>
                    <p className="text-xs text-gray-400">{UNIT_LABELS[item.product.unit] ?? item.product.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'products' && (
        <>
          {loadingProducts ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="card p-4 h-14 animate-pulse" />)}</div>
          ) : (
            <div className="space-y-2">
              {(products ?? []).length === 0 && (
                <div className="card p-12 text-center text-gray-400">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p>Nenhum produto cadastrado</p>
                </div>
              )}
              {(products ?? []).map((p: any) => (
                <div key={p.id} className="card p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">{CATEGORY_LABELS[p.category] ?? p.category}</p>
                  </div>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{UNIT_LABELS[p.unit] ?? p.unit}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {newProduct && <NewProductModal onClose={() => setNewProduct(false)} />}
      {stockEntry && <StockEntryModal onClose={() => setStockEntry(false)} />}
    </div>
    </PlanGuard>
  )
}
