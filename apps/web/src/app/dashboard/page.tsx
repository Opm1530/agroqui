'use client'

import { useQuery } from '@tanstack/react-query'
import { api, formatCurrency } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { TrendingUp, TrendingDown, Leaf, Bell, MessageSquare } from 'lucide-react'

export default function DashboardPage() {
  const user = getUser()

  const { data: harvests } = useQuery({
    queryKey: ['harvests'],
    queryFn: () => api.get('/producer/harvests').then((r) => r.data),
  })

  const { data: alerts } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.get('/producer/alerts').then((r) => r.data),
  })

  const activeHarvest = harvests?.find((h: any) => h.status === 'ACTIVE')

  const { data: dre } = useQuery({
    queryKey: ['dre', activeHarvest?.id],
    queryFn: () => api.get(`/producer/dre/${activeHarvest.id}`).then((r) => r.data),
    enabled: !!activeHarvest?.id,
  })

  const unreadAlerts = alerts?.filter((a: any) => !a.isRead).length ?? 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Olá, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 text-sm">Aqui está um resumo da sua fazenda</p>
      </div>

      {/* WhatsApp tip */}
      <div className="card p-4 mb-6 bg-primary-50 border-primary-200 flex items-center gap-3">
        <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center shrink-0">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-medium text-primary-800">Registre pelo WhatsApp</p>
          <p className="text-xs text-primary-600">Mande uma foto de nota fiscal ou mensagem de texto para registrar lançamentos automaticamente.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-xs font-medium text-gray-500">Receitas</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {formatCurrency(dre?.summary?.totalIncome ?? 0)}
          </p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <span className="text-xs font-medium text-gray-500">Despesas</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {formatCurrency(dre?.summary?.totalExpenses ?? 0)}
          </p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Leaf className="w-4 h-4 text-primary-600" />
            <span className="text-xs font-medium text-gray-500">Custo/ha</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {formatCurrency(dre?.summary?.costPerHa ?? 0)}
          </p>
          {dre?.harvest?.targetCostPerHa && (
            <p className={`text-xs mt-1 ${(dre?.summary?.costPerHa ?? 0) > dre.harvest.targetCostPerHa ? 'text-red-500' : 'text-green-600'}`}>
              Meta: {formatCurrency(dre.harvest.targetCostPerHa)}/ha
            </p>
          )}
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-yellow-500" />
            <span className="text-xs font-medium text-gray-500">Alertas</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{unreadAlerts}</p>
          <p className="text-xs text-gray-400 mt-1">não lidos</p>
        </div>
      </div>

      {/* Active harvest */}
      {activeHarvest && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Safra Ativa</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-800">{activeHarvest.crop} {activeHarvest.year}</p>
              <p className="text-sm text-gray-500">{activeHarvest.property?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">{activeHarvest._count?.entries ?? 0} lançamentos</p>
              {dre?.summary?.margin && (
                <p className="text-sm font-medium text-green-600">Margem: {dre.summary.margin}%</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Alertas Recentes</h2>
          <div className="space-y-2">
            {alerts.slice(0, 5).map((alert: any) => (
              <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-lg ${alert.isRead ? 'bg-gray-50' : 'bg-yellow-50 border border-yellow-100'}`}>
                <Bell className={`w-4 h-4 mt-0.5 shrink-0 ${alert.isRead ? 'text-gray-400' : 'text-yellow-600'}`} />
                <p className="text-sm text-gray-700">{alert.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
