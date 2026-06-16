'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Plus, Shield, User, Trash2, X, RotateCcw, Search } from 'lucide-react'
import { useForm } from 'react-hook-form'

// ─── New admin user modal ─────────────────────────────────────────────────────

function NewUserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm({ defaultValues: { role: 'ADMIN', name: '', email: '', password: '' } })

  const create = useMutation({
    mutationFn: (data: any) => api.post('/admin/users', data),
    onSuccess: () => {
      toast.success('Usuário criado!')
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Novo Usuário Admin</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
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
            <label className="label">Senha</label>
            <input {...register('password', { required: true })} type="password" className="input" placeholder="Mínimo 8 caracteres" />
          </div>
          <div>
            <label className="label">Nível</label>
            <select {...register('role')} className="input">
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
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

// ─── Reset confirmation dialog ────────────────────────────────────────────────

function ResetDialog({ user, onClose }: { user: any; onClose: () => void }) {
  const qc = useQueryClient()
  const reset = useMutation({
    mutationFn: () => api.post(`/admin/producers/${user.producer.id}/reset`),
    onSuccess: () => {
      toast.success(`Dados de ${user.name} zerados!`)
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro ao zerar'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
            <RotateCcw className="w-5 h-5 text-orange-600" />
          </div>
          <h2 className="text-lg font-semibold">Zerar usuário?</h2>
        </div>
        <p className="text-sm text-gray-600 mb-2">
          Todos os dados de <strong>{user.name}</strong> serão removidos permanentemente:
        </p>
        <ul className="text-sm text-gray-500 mb-5 space-y-1 list-disc list-inside">
          <li>Propriedades, talhões e safras</li>
          <li>Lançamentos e atividades</li>
          <li>Estoque e movimentações</li>
          <li>Documentos e notas fiscais</li>
          <li>Sessões e histórico do agente</li>
        </ul>
        <p className="text-xs text-gray-400 mb-5">
          Login, WhatsApp e assinatura são mantidos.
        </p>
        <div className="flex gap-3">
          <button onClick={() => reset.mutate()} disabled={reset.isPending} className="btn-danger flex-1">
            {reset.isPending ? 'Zerando...' : 'Zerar dados'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  PRODUCER: 'Produtor',
  COOPERATIVE: 'Cooperativa',
}

const roleBadge: Record<string, string> = {
  SUPER_ADMIN: 'badge-red',
  ADMIN: 'badge-yellow',
  PRODUCER: 'badge-green',
  COOPERATIVE: 'badge-gray',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [modal, setModal] = useState(false)
  const [resetting, setResetting] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then((r) => r.data),
  })

  const filtered = (users ?? []).filter((u: any) => {
    const matchSearch =
      !search ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.producer?.whatsapp?.includes(search)
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter
    return matchSearch && matchRole
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Todos os Usuários</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users?.length ?? '—'} usuários cadastrados</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Admin
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
            placeholder="Buscar por nome, e-mail ou WhatsApp..."
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="input w-44"
        >
          <option value="ALL">Todos os perfis</option>
          <option value="PRODUCER">Produtor</option>
          <option value="COOPERATIVE">Cooperativa</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
      </div>

      <div className="card divide-y divide-gray-100">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <User className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>Nenhum usuário encontrado</p>
          </div>
        ) : filtered.map((user: any) => (
          <div key={user.id} className="flex items-center gap-4 px-4 py-3">
            <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
              {user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
                ? <Shield className="w-4 h-4 text-gray-600" />
                : <User className="w-4 h-4 text-gray-600" />
              }
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-gray-900 text-sm truncate">{user.name}</p>
                <span className={roleBadge[user.role] ?? 'badge-gray'}>{roleLabel[user.role] ?? user.role}</span>
                {!user.isActive && <span className="badge-red">Inativo</span>}
              </div>
              <p className="text-gray-500 text-xs truncate">{user.email}</p>
              {user.producer && (
                <p className="text-gray-400 text-xs">
                  WhatsApp: {user.producer.whatsapp}
                  {' · '}{user.producer._count?.properties ?? 0} propriedade(s)
                  {user.producer.subscriptions?.[0] && (
                    <> · {user.producer.subscriptions[0].plan?.name} ({user.producer.subscriptions[0].status})</>
                  )}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {user.producer && (
                <button
                  onClick={() => setResetting(user)}
                  className="p-1.5 text-gray-400 hover:text-orange-600 rounded-lg hover:bg-orange-50"
                  title="Zerar dados do produtor"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {modal && <NewUserModal onClose={() => setModal(false)} />}
      {resetting && <ResetDialog user={resetting} onClose={() => setResetting(null)} />}
    </div>
  )
}
