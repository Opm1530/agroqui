'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Tractor, Phone } from 'lucide-react'

export default function ProducersPage() {
  const { data: producers, isLoading } = useQuery({
    queryKey: ['admin-producers'],
    queryFn: () => api.get('/admin/producers').then((r) => r.data),
  })

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      ACTIVE: 'badge-green', TRIALING: 'badge-yellow',
      PAST_DUE: 'badge-red', CANCELED: 'badge-gray', INACTIVE: 'badge-gray',
    }
    return map[status] ?? 'badge-gray'
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Produtores</h1>

      <div className="card divide-y divide-gray-100">
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : producers?.map((p: any) => (
          <div key={p.id} className="flex items-center gap-4 p-4">
            <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center shrink-0">
              <Tractor className="w-4 h-4 text-green-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm truncate">{p.user.name}</p>
              <p className="text-gray-500 text-xs">{p.user.email}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Phone className="w-3 h-3" />{p.whatsapp}
            </div>
            <div className="text-xs text-gray-500">{p._count.properties} prop.</div>
            {p.cooperative && (
              <span className="badge-gray text-xs">{p.cooperative.name}</span>
            )}
            {p.subscriptions[0] && (
              <span className={statusBadge(p.subscriptions[0].status)}>
                {p.subscriptions[0].plan?.name}
              </span>
            )}
            {!p.user.isActive && <span className="badge-red">Inativo</span>}
          </div>
        ))}
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
