'use client'

import { useQuery } from '@tanstack/react-query'
import { api, formatCurrency } from '@/lib/api'
import { Users, Building2, Tractor, TrendingUp } from 'lucide-react'

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/admin/dashboard').then((r) => r.data),
  })

  const stats = [
    { label: 'Produtores', value: data?.producers ?? 0, icon: Tractor, color: 'bg-green-100 text-green-700' },
    { label: 'Cooperativas', value: data?.cooperatives ?? 0, icon: Building2, color: 'bg-blue-100 text-blue-700' },
    { label: 'Assinaturas Ativas', value: data?.activeSubs ?? 0, icon: TrendingUp, color: 'bg-purple-100 text-purple-700' },
    { label: 'Planos', value: data?.plans?.length ?? 0, icon: Users, color: 'bg-orange-100 text-orange-700' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {isLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-6 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="card p-6">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-sm text-gray-500">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {data?.plans && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Assinaturas por Plano</h2>
          <div className="space-y-3">
            {data.plans.map((plan: any) => (
              <div key={plan.name} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm font-medium text-gray-700">{plan.name}</span>
                <span className="badge-green">{plan._count.subscriptions} assinaturas</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
