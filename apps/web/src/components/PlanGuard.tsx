'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'

export function PlanGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { data: subscription, isLoading } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: () => api.get('/producer/subscription').then(r => r.data).catch(() => null),
  })
  const { data: billingMode } = useQuery({
    queryKey: ['billing-mode'],
    queryFn: () => api.get('/public/billing-mode').then(r => r.data),
  })

  if (isLoading) return null

  // Only show lock when billing is active AND no subscription
  if (billingMode?.stripeEnabled && !subscription) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Selecione um plano para utilizar</h2>
        <p className="text-gray-500 text-sm mb-6 max-w-xs">
          Escolha um plano para ter acesso completo a este recurso.
        </p>
        <button
          onClick={() => router.push('/dashboard/select-plan')}
          className="btn-primary px-6 py-2.5"
        >
          Ver planos
        </button>
      </div>
    )
  }

  return <>{children}</>
}
