'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { api, formatCurrency } from '@/lib/api'
import { setAuth } from '@/lib/auth'
import { toast } from 'sonner'
import { Wheat, Check, ArrowLeft, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { clsx } from 'clsx'

const schema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  passwordConfirm: z.string(),
  whatsapp: z.string().min(10, 'WhatsApp inválido').regex(/^\d+$/, 'Apenas números com DDI (ex: 5511999999999)'),
  cpfCnpj: z.string().optional(),
}).refine((d) => d.password === d.passwordConfirm, {
  message: 'As senhas não conferem',
  path: ['passwordConfirm'],
})

type FormData = z.infer<typeof schema>

const planFeatureLabels: Record<string, string> = {
  hasOcr: 'OCR de notas fiscais',
  hasAiAgent: 'Agente IA no WhatsApp',
  hasAutoDre: 'DRE automático',
  hasAlerts: 'Alertas inteligentes',
  hasPrioritySupport: 'Suporte prioritário',
}

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedPlanId = searchParams.get('planId')

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(preselectedPlanId)
  const [step, setStep] = useState<'plan' | 'form'>(preselectedPlanId ? 'form' : 'plan')
  const [loading, setLoading] = useState(false)

  const { data: plans } = useQuery({
    queryKey: ['public-plans'],
    queryFn: () => api.get('/public/plans').then((r) => r.data),
  })

  const { data: billingMode } = useQuery({
    queryKey: ['billing-mode'],
    queryFn: () => api.get('/public/billing-mode').then((r) => r.data),
  })

  const selectedPlan = plans?.find((p: any) => p.id === selectedPlanId)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    if (!selectedPlanId) return toast.error('Selecione um plano')
    setLoading(true)

    try {
      // If Stripe is configured and plan has a price ID → go to Stripe checkout
      if (billingMode?.stripeEnabled && selectedPlan?.stripePriceId) {
        // Register first, then redirect to checkout
        const regRes = await api.post('/public/register', {
          name: data.name,
          email: data.email,
          password: data.password,
          whatsapp: data.whatsapp,
          cpfCnpj: data.cpfCnpj,
          planId: selectedPlanId,
        })

        // Auto login
        const loginRes = await api.post('/auth/login', { email: data.email, password: data.password })
        setAuth(loginRes.data.token, loginRes.data.user)

        // Redirect to Stripe checkout
        const checkoutRes = await api.post('/stripe/checkout', {
          planId: selectedPlanId,
          successUrl: `${window.location.origin}/dashboard?payment=success`,
          cancelUrl: `${window.location.origin}/register?planId=${selectedPlanId}`,
        })
        window.location.href = checkoutRes.data.url
        return
      }

      // No Stripe → create account directly (trial mode)
      await api.post('/public/register', {
        name: data.name,
        email: data.email,
        password: data.password,
        whatsapp: data.whatsapp,
        cpfCnpj: data.cpfCnpj,
        planId: selectedPlanId,
      })

      const loginRes = await api.post('/auth/login', { email: data.email, password: data.password })
      setAuth(loginRes.data.token, loginRes.data.user)
      toast.success('Conta criada com sucesso! Bem-vindo ao Contador do Campo 🌾')
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  const visiblePlans = (plans ?? []).filter((p: any) => p.type !== 'CUSTOM' && p.type !== 'COOPERATIVE')

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-green-100 flex flex-col">
      {/* Header */}
      <div className="p-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Wheat className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900">Contador do Campo</span>
        </Link>
        <Link href="/login" className="text-sm text-gray-500 hover:text-gray-800">
          Já tenho conta
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        {step === 'plan' ? (
          /* ── Step 1: Plan selection ─────────────────────────────── */
          <div className="w-full max-w-3xl">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Escolha seu plano</h1>
              <p className="text-gray-500 text-sm mt-1">Cancele quando quiser. Sem compromisso.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              {visiblePlans.map((plan: any) => {
                const isPro = plan.type === 'PRO'
                const isSelected = selectedPlanId === plan.id

                return (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={clsx(
                      'relative text-left rounded-2xl border-2 p-6 transition-all',
                      isSelected
                        ? 'border-primary-600 bg-white shadow-lg'
                        : 'border-gray-200 bg-white hover:border-primary-300'
                    )}
                  >
                    {isPro && (
                      <div className="absolute -top-3 left-4">
                        <span className="bg-amber-400 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full">
                          ✨ Recomendado
                        </span>
                      </div>
                    )}

                    {isSelected && (
                      <div className="absolute top-4 right-4 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}

                    <p className="font-semibold text-gray-900 mb-1">{plan.name}</p>
                    <div className="flex items-end gap-1 mb-4">
                      <span className="text-3xl font-bold text-primary-600">
                        {formatCurrency(plan.priceMonthly)}
                      </span>
                      <span className="text-gray-400 text-sm mb-0.5">/mês</span>
                    </div>

                    <ul className="space-y-1.5">
                      {Object.entries(planFeatureLabels).map(([key, label]) => (
                        <li key={key} className={clsx('flex items-center gap-2 text-xs', plan[key] ? 'text-gray-700' : 'text-gray-300 line-through')}>
                          <Check className={clsx('w-3.5 h-3.5 shrink-0', plan[key] ? 'text-primary-500' : 'opacity-20')} />
                          {label}
                        </li>
                      ))}
                    </ul>
                  </button>
                )
              })}
            </div>

            {!billingMode?.stripeEnabled && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 text-center mb-4">
                🎉 Período de teste — acesso liberado sem necessidade de cartão
              </div>
            )}

            <button
              onClick={() => selectedPlanId && setStep('form')}
              disabled={!selectedPlanId}
              className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              Continuar <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* ── Step 2: Registration form ──────────────────────────── */
          <div className="w-full max-w-md">
            <button
              onClick={() => setStep('plan')}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar aos planos
            </button>

            <div className="card p-8">
              {/* Selected plan summary */}
              {selectedPlan && (
                <div className="flex items-center justify-between bg-primary-50 rounded-xl px-4 py-3 mb-6">
                  <div>
                    <p className="text-xs text-primary-600 font-medium">Plano selecionado</p>
                    <p className="font-semibold text-gray-900">{selectedPlan.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary-600">{formatCurrency(selectedPlan.priceMonthly)}/mês</p>
                    {!billingMode?.stripeEnabled && <p className="text-xs text-amber-600">Período de teste</p>}
                  </div>
                </div>
              )}

              <h1 className="text-xl font-bold text-gray-900 mb-6">Criar sua conta</h1>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="label">Nome completo</label>
                  <input {...register('name')} className="input" placeholder="João da Silva" />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="label">E-mail</label>
                  <input {...register('email')} type="email" className="input" placeholder="seu@email.com" />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                </div>

                <div>
                  <label className="label">WhatsApp <span className="text-gray-400 font-normal">(com DDI)</span></label>
                  <input {...register('whatsapp')} className="input" placeholder="5511999999999" />
                  {errors.whatsapp && <p className="text-red-500 text-xs mt-1">{errors.whatsapp.message}</p>}
                  <p className="text-xs text-gray-400 mt-1">Este número será usado para interagir com o agente IA</p>
                </div>

                <div>
                  <label className="label">CPF ou CNPJ <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <input {...register('cpfCnpj')} className="input" placeholder="000.000.000-00" />
                </div>

                <div>
                  <label className="label">Senha</label>
                  <input {...register('password')} type="password" className="input" placeholder="Mínimo 8 caracteres" />
                  {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
                </div>

                <div>
                  <label className="label">Confirmar senha</label>
                  <input {...register('passwordConfirm')} type="password" className="input" placeholder="Repita a senha" />
                  {errors.passwordConfirm && <p className="text-red-500 text-xs mt-1">{errors.passwordConfirm.message}</p>}
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full py-3.5 mt-2 flex items-center justify-center gap-2"
                  disabled={loading}
                >
                  {loading
                    ? 'Criando conta...'
                    : billingMode?.stripeEnabled
                      ? 'Continuar para pagamento'
                      : 'Criar conta grátis'}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>

                <p className="text-xs text-gray-400 text-center">
                  Ao criar uma conta você concorda com nossos{' '}
                  <a href="#" className="text-primary-600 hover:underline">termos de uso</a>.
                </p>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
