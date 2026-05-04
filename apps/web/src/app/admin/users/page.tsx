'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Plus, Shield } from 'lucide-react'
import { useForm } from 'react-hook-form'

function NewUserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm({ defaultValues: { role: 'ADMIN' } })

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
        <h2 className="text-lg font-semibold mb-4">Novo Usuário Admin</h2>
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

export default function UsersPage() {
  const [modal, setModal] = useState(false)
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then((r) => r.data),
  })

  const roleColor = (role: string) =>
    role === 'SUPER_ADMIN' ? 'badge-red' : 'badge-yellow'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Usuários Admin</h1>
        <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Usuário
        </button>
      </div>

      <div className="card divide-y divide-gray-100">
        {isLoading ? (
          <div className="p-6 animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
          </div>
        ) : users?.map((user: any) => (
          <div key={user.id} className="flex items-center gap-4 p-4">
            <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
              <Shield className="w-4 h-4 text-gray-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900 text-sm">{user.name}</p>
              <p className="text-gray-500 text-xs">{user.email}</p>
            </div>
            <span className={roleColor(user.role)}>
              {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
            </span>
            {!user.isActive && <span className="badge-red">Inativo</span>}
          </div>
        ))}
      </div>

      {modal && <NewUserModal onClose={() => setModal(false)} />}
    </div>
  )
}
