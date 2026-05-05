'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { api, formatCurrency, formatDate } from '@/lib/api'
import { toast } from 'sonner'
import { CreditCard, Check, ExternalLink, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

const statusLabel: Record<string, string> = {
  ACTIVE: 'Ativa',
  TRIALING: 'Período de teste',
  PAST_DUE: 'Pagamento pendente',
  CANCELED: 'Cancelada',
  INACTIVE: 'Inativa',
}

const statusStyle: Record<string, string> = {
  ACTIVE: 'badge-green',
  TRIALING: 'badge-yellow',
  PAST_DUE: 'badge-red',
  CANCELED: 'badge-gray',
  INACTIVE: 'badge-gray',
}

const planFeatureLabels: Record<string, string> = {
  hasOcr: 'OCR de notas fiscais (foto)',
  hasAiAgent: 'Agente IA no WhatsApp',
  hasAutoDre: 'DRE automático por safra',
  hasAlerts: 'Alertas inteligentes',
  hasPrioritySupport: 'Suporte prioritário',
}

export default function BillingPage() {
  const { data: billingMode } = useQuery({
    queryKey: ['billing-mode'],
    queryFn: () => api.get('/public/billing-mode').then((r) => r.data),
  })

  // Fetch producer's own subscription via DRE (reuse harvests endpoint for plan info)
  // We'll use a dedicated approach: ask the API for the current user's subscription
  const { data: subscription, isLoading } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: () => api.get('/producer/subscription').then((r) => r.data),
  })

  const openPortal = useMutation({
    mutationFn: () => api.post('/stripe/portal').then((r) => r.data),
    onSuccess: (data) => { window.location.href = data.url },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro ao abrir portal'),
  })

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl w-full">
        {[...Array(2)].map((_, i) => <div key={i} className="card h-32 animate-pulse" />)}
      </div>
    )
  }

  const plan = subscription?.plan
  const status = subscription?.status ?? 'INACTIVE'
  const isTrialing = status === 'TRIALING'
  const isPastDue = status === 'PAST_DUE'
  const hasStripe = billingMode?.stripeEnabled && subscription?.stripeSubscriptionId

  return (
    <div className="max-w-2xl w-full">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Assinatura</h1>

      {/* Status banner */}
      {isPastDue && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-700">Pagamento pendente</p>
            <p className="text-sm text-red-600 mt-0.5">
              Atualize seu método de pagamento para continuar usando todos os recursos.
            </p>
          </div>
        </div>
      )}

      {isTrialing && !billingMode?.stripeEnabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 mb-4">
          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-700">Você está no período de teste</p>
            <p className="text-sm text-amber-600 mt-0.5">
              Aproveite todos os recursos do seu plano. Em breve os pagamentos serão habilitados.
            </p>
          </div>
        </div>
      )}

      {/* Plan card */}
      <div className="card p-6 mb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{plan?.name ?? 'Sem plano'}</h2>
              <span className={statusStyle[status]}>{statusLabel[status]}</span>
            </div>
            {plan && (
              <p className="text-2xl font-bold text-primary-600">
                {formatCurrency(plan.priceMonthly)}
                <span className="text-sm text-gray-400 font-normal">/mês</span>
              </p>
            )}
          </div>
          <CreditCard className="w-8 h-8 text-gray-300 shrink-0" />
        </div>

        {subscription?.currentPeriodEnd && (
          <p className="text-sm text-gray-500 mb-4">
            {subscription.cancelAtPeriodEnd
              ? `⚠️ Cancela em ${formatDate(subscription.currentPeriodEnd)}`
              : `Renova em ${formatDate(subscription.currentPeriodEnd)}`}
          </p>
        )}

        {/* Features */}
        {plan && (
          <div className="border-t border-gray-100 pt-4 space-y-2">
            {Object.entries(planFeatureLabels).map(([key, label]) => (
              <div key={key} className={`flex items-center gap-2.5 text-sm ${plan[key] ? 'text-gray-700' : 'text-gray-300'}`}>
                <Check className={`w-4 h-4 shrink-0 ${plan[key] ? 'text-primary-500' : 'opacity-30'}`} />
                <span className={!plan[key] ? 'line-through' : ''}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {hasStripe ? (
          <button
            onClick={() => openPortal.mutate()}
            disabled={openPortal.isPending}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {openPortal.isPending ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Abrindo portal...</>
            ) : (
              <><ExternalLink className="w-4 h-4" /> Gerenciar assinatura (Stripe)</>
            )}
          </button>
        ) : (
          <div className="card p-4 text-center text-sm text-gray-500">
            Quando os pagamentos forem habilitados, você poderá gerenciar sua assinatura aqui.
          </div>
        )}

        {/* Upgrade CTA */}
        {plan?.type === 'BASIC' && (
          <div className="card p-5 border-primary-200 bg-primary-50">
            <p className="font-medium text-primary-800 mb-1">Quer mais recursos?</p>
            <p className="text-sm text-primary-600 mb-3">
              Faça upgrade para o Pro e tenha OCR de notas fiscais, agente IA no WhatsApp e DRE automático.
            </p>
            <Link href="/#planos" className="btn-primary text-sm w-full text-center block">
              Ver plano Pro
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
