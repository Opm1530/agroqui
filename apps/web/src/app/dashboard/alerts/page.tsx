'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, formatDate } from '@/lib/api'
import { toast } from 'sonner'
import { Bell, BellOff, CheckCheck, AlertTriangle, TrendingDown, Clock, Info } from 'lucide-react'
import { clsx } from 'clsx'

const alertIcons: Record<string, any> = {
  COST_ABOVE_TARGET: AlertTriangle,
  LOW_BALANCE: TrendingDown,
  INSTALLMENT_DUE: Clock,
  CUSTOM: Info,
}

const alertColors: Record<string, string> = {
  COST_ABOVE_TARGET: 'bg-red-50 border-red-100 text-red-700',
  LOW_BALANCE: 'bg-orange-50 border-orange-100 text-orange-700',
  INSTALLMENT_DUE: 'bg-yellow-50 border-yellow-100 text-yellow-700',
  CUSTOM: 'bg-blue-50 border-blue-100 text-blue-700',
}

const alertIconColors: Record<string, string> = {
  COST_ABOVE_TARGET: 'text-red-500',
  LOW_BALANCE: 'text-orange-500',
  INSTALLMENT_DUE: 'text-yellow-500',
  CUSTOM: 'text-blue-500',
}

export default function AlertsPage() {
  const qc = useQueryClient()

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.get('/producer/alerts').then((r) => r.data),
  })

  const markRead = useMutation({
    mutationFn: (id: string) => api.put(`/producer/alerts/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      const unread = (alerts ?? []).filter((a: any) => !a.isRead)
      await Promise.all(unread.map((a: any) => api.put(`/producer/alerts/${a.id}/read`)))
    },
    onSuccess: () => {
      toast.success('Todos os alertas marcados como lidos')
      qc.invalidateQueries({ queryKey: ['alerts'] })
    },
  })

  const unreadCount = (alerts ?? []).filter((a: any) => !a.isRead).length

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-6 min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">Alertas</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">{unreadCount} não lido{unreadCount > 1 ? 's' : ''}</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="btn-secondary flex items-center gap-2 text-sm shrink-0"
          >
            <CheckCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Marcar todos como lidos</span>
            <span className="sm:hidden">Marcar lidos</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="card h-16 animate-pulse" />)}
        </div>
      ) : alerts?.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <BellOff className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum alerta</p>
          <p className="text-sm mt-1">Tudo tranquilo por aqui. Os alertas aparecem quando algo precisa da sua atenção.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert: any) => {
            const Icon = alertIcons[alert.type] ?? Bell
            const colorClass = alertColors[alert.type] ?? 'bg-gray-50 border-gray-100 text-gray-700'
            const iconColor = alertIconColors[alert.type] ?? 'text-gray-500'

            return (
              <div
                key={alert.id}
                className={clsx(
                  'flex items-start gap-4 p-4 rounded-xl border transition-opacity',
                  colorClass,
                  alert.isRead && 'opacity-60'
                )}
              >
                <Icon className={clsx('w-5 h-5 mt-0.5 shrink-0', iconColor)} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium break-words">{alert.message}</p>
                  <p className="text-xs opacity-60 mt-1">{formatDate(alert.createdAt)}</p>
                </div>

                {!alert.isRead && (
                  <button
                    onClick={() => markRead.mutate(alert.id)}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-black/5 transition-colors"
                    title="Marcar como lido"
                  >
                    <CheckCheck className="w-4 h-4 opacity-60" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
