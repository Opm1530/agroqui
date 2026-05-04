'use client'

import { useQuery } from '@tanstack/react-query'
import { api, formatCurrency } from '@/lib/api'
import { Users, Leaf, FileText, TrendingUp, TrendingDown } from 'lucide-react'

export default function CooperativeDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['coop-dashboard'],
    queryFn: () => api.get('/cooperative/dashboard').then((r) => r.data),
  })

  const stats = [
    { label: 'Total de Produtores', value: data?.totalProducers ?? 0, icon: Users, color: 'text-blue-600 bg-blue-100' },
    { label: 'Produtores Ativos', value: data?.activeProducers ?? 0, icon: Users, color: 'text-green-600 bg-green-100' },
    { label: 'Safras Ativas', value: data?.activeHarvests ?? 0, icon: Leaf, color: 'text-primary-700 bg-primary-100' },
    { label: 'Total de Lançamentos', value: data?.totalEntries ?? 0, icon: FileText, color: 'text-gray-600 bg-gray-100' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard da Cooperativa</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color}`}>
                <s.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-gray-700">Total de Receitas</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(data?.totalIncome ?? 0)}</p>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-gray-700">Total de Despesas</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(data?.totalExpenses ?? 0)}</p>
        </div>
      </div>
    </div>
  )
}
