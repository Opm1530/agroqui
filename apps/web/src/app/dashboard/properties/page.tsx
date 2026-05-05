'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Plus, MapPin, Leaf, Rows3, Pencil, X, Map } from 'lucide-react'
import Link from 'next/link'
import { PlanGuard } from '@/components/PlanGuard'

// ─── Modals ───────────────────────────────────────────────────────────────────

function PropertyModal({ property, onClose }: { property?: any; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm({
    defaultValues: property ?? {},
  })

  const save = useMutation({
    mutationFn: (data: any) =>
      property
        ? api.put(`/producer/properties/${property.id}`, data)
        : api.post('/producer/properties', { ...data, hectares: data.hectares ? Number(data.hectares) : undefined }),
    onSuccess: () => {
      toast.success(property ? 'Propriedade atualizada!' : 'Propriedade criada!')
      qc.invalidateQueries({ queryKey: ['properties'] })
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro ao salvar'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{property ? 'Editar Propriedade' : 'Nova Propriedade'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-3">
          <div>
            <label className="label">Nome da propriedade</label>
            <input {...register('name', { required: true })} className="input" placeholder="Fazenda Santa Fé" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Área (hectares)</label>
              <input {...register('hectares')} type="number" step="0.1" className="input" placeholder="320" />
            </div>
            <div>
              <label className="label">Estado</label>
              <input {...register('state')} className="input" placeholder="MT" maxLength={2} />
            </div>
          </div>
          <div>
            <label className="label">Município</label>
            <input {...register('city')} className="input" placeholder="Sorriso" />
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

function PlotModal({ propertyId, plot, onClose }: { propertyId: string; plot?: any; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm({ defaultValues: plot ?? { propertyId } })

  const save = useMutation({
    mutationFn: (data: any) =>
      api.post('/producer/plots', { ...data, propertyId, hectares: data.hectares ? Number(data.hectares) : undefined }),
    onSuccess: () => {
      toast.success('Talhão criado!')
      qc.invalidateQueries({ queryKey: ['plots', propertyId] })
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Novo Talhão</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-3">
          <div>
            <label className="label">Nome do talhão</label>
            <input {...register('name', { required: true })} className="input" placeholder="Cerradão, Baixada..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Área (ha)</label>
              <input {...register('hectares')} type="number" step="0.1" className="input" placeholder="80" />
            </div>
            <div>
              <label className="label">Cultura atual</label>
              <input {...register('currentCrop')} className="input" placeholder="Soja" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-primary flex-1" disabled={save.isPending}>
              {save.isPending ? 'Criando...' : 'Criar'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Property card ─────────────────────────────────────────────────────────────

function PropertyCard({ property }: { property: any }) {
  const [editModal, setEditModal] = useState(false)
  const [plotModal, setPlotModal] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const { data: plots } = useQuery({
    queryKey: ['plots', property.id],
    queryFn: () => api.get(`/producer/plots?propertyId=${property.id}`).then((r) => r.data),
    enabled: expanded,
  })

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-start gap-4">
        <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center shrink-0">
          <MapPin className="w-5 h-5 text-primary-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{property.name}</h3>
            {property.state && (
              <span className="badge-gray">{property.state}{property.city ? ` · ${property.city}` : ''}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
            {property.hectares && <span className="shrink-0">{property.hectares} ha</span>}
            <span className="shrink-0">{property._count?.harvests ?? 0} safras</span>
            <span className="shrink-0">{property._count?.plots ?? 0} talhões</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/dashboard/properties/${property.id}/map`}
            className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50"
            title="Ver mapa de talhões"
          >
            <Map className="w-4 h-4" />
          </Link>
          <button
            onClick={() => setEditModal(true)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <Rows3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Plots section */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">Talhões</p>
            <button
              onClick={() => setPlotModal(true)}
              className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar talhão
            </button>
          </div>

          {plots?.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">Nenhum talhão cadastrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {plots?.map((plot: any) => (
                <div key={plot.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <Leaf className="w-4 h-4 text-primary-400 shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-800">{plot.name}</span>
                    {plot.currentCrop && (
                      <span className="text-xs text-gray-400 ml-2">• {plot.currentCrop}</span>
                    )}
                  </div>
                  {plot.hectares && (
                    <span className="text-xs text-gray-400">{plot.hectares} ha</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editModal && <PropertyModal property={property} onClose={() => setEditModal(false)} />}
      {plotModal && <PlotModal propertyId={property.id} onClose={() => setPlotModal(false)} />}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PropertiesPage() {
  const [newModal, setNewModal] = useState(false)

  const { data: properties, isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get('/producer/properties').then((r) => r.data),
  })

  return (
    <PlanGuard>
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">Propriedades</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gerencie suas fazendas e talhões</p>
        </div>
        <button onClick={() => setNewModal(true)} className="btn-primary flex items-center gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Nova Propriedade
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}
        </div>
      ) : properties?.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <MapPin className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhuma propriedade cadastrada</p>
          <p className="text-sm mt-1">Cadastre sua fazenda para começar a registrar safras e lançamentos.</p>
          <button onClick={() => setNewModal(true)} className="btn-primary mt-4 text-sm">
            Cadastrar propriedade
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {properties.map((p: any) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      )}

      {newModal && <PropertyModal onClose={() => setNewModal(false)} />}
    </div>
    </PlanGuard>
  )
}
