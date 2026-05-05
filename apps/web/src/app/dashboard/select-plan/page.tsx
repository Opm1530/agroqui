'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api, formatCurrency } from '@/lib/api'
import { toast } from 'sonner'
import { Wheat, Check } from 'lucide-react'
import Link from 'next/link'
import { clsx } from 'clsx'

const planFeatureLabels: Record<string, string> = {
  hasOcr: 'OCR de notas fiscais',
  hasAiAgent: 'Agente IA no WhatsApp',
  hasAutoDre: 'DRE automático',
  hasAlerts: 'Alertas inteligentes',
  hasPrioritySupport: 'Suporte prioritário',
}

export default function SelectPlanPage() {
  const router = useRouter()
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null)

  const { data: plans } = useQuery({
    queryKey: ['public-plans'],
    queryFn: () => api.get('/public/plans').then((r) => r.data),
  })

  const { data: billingMode } = useQuery({
    queryKey: ['billing-mode'],
    queryFn: () => api.get('/public/billing-mode').then((r) => r.data),
  })

  const visiblePlans = (plans ?? []).filter((p: any) => p.type !== 'COOPERATIVE' && p.type !== 'CUSTOM')

  async function handleSelectPlan(plan: any) {
    setLoadingPlanId(plan.id)
    try {
      if (billingMode?.stripeEnabled && plan.stripePriceId) {
        const checkoutRes = await api.post('/stripe/checkout', {
          planId: plan.id,
          successUrl: `${window.location.origin}/dashboard?payment=success`,
          cancelUrl: `${window.location.origin}/dashboard/select-plan`,
        })
        window.location.href = checkoutRes.data.url
        return
      }

      // Trial mode or plan without stripe
      await api.post('/producer/select-plan', { planId: plan.id })
      toast.success('Plano selecionado!')
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Erro ao selecionar plano')
    } finally {
      setLoadingPlanId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-green-100 flex flex-col">
      {/* Header */}
      <div className="p-5 flex items-center">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Wheat className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900">Contador do Campo</span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Escolha seu plano</h1>
            <p className="text-gray-500 text-sm mt-1">Comece agora e cancele quando quiser</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {visiblePlans.map((plan: any) => {
              const isPro = plan.type === 'PRO'
              const isLoading = loadingPlanId === plan.id

              return (
                <div
                  key={plan.id}
                  className="relative text-left rounded-2xl border-2 border-gray-200 bg-white p-6"
                >
                  {isPro && (
                    <div className="absolute -top-3 left-4">
                      <span className="bg-amber-400 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full">
                        Recomendado
                      </span>
                    </div>
                  )}

                  <p className="font-semibold text-gray-900 mb-1">{plan.name}</p>
                  <div className="flex items-end gap-1 mb-4">
                    <span className="text-3xl font-bold text-primary-600">
                      {formatCurrency(plan.priceMonthly)}
                    </span>
                    <span className="text-gray-400 text-sm mb-0.5">/mês</span>
                  </div>

                  <ul className="space-y-1.5 mb-6">
                    {Object.entries(planFeatureLabels).map(([key, label]) => (
                      <li
                        key={key}
                        className={clsx(
                          'flex items-center gap-2 text-xs',
                          plan[key] ? 'text-gray-700' : 'text-gray-300 line-through'
                        )}
                      >
                        <Check
                          className={clsx('w-3.5 h-3.5 shrink-0', plan[key] ? 'text-primary-500' : 'opacity-20')}
                        />
                        {label}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={loadingPlanId !== null}
                    className="btn-primary w-full py-2.5 disabled:opacity-50"
                  >
                    {isLoading ? 'Aguarde...' : 'Selecionar este plano'}
                  </button>
                </div>
              )
            })}
          </div>

          <div className="text-center">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Continuar sem plano &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
