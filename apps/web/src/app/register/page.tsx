'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api'
import { setAuth } from '@/lib/auth'
import { toast } from 'sonner'
import { Wheat, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const schema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  email: z.string().email('E-mail inválido'),
  whatsapp: z.string().regex(/^55\d{2}9?\d{8}$/, 'Formato: 5511999999999 (DDI 55 + DDD + número)'),
  cpfCnpj: z.string().optional(),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  passwordConfirm: z.string(),
}).refine((d) => d.password === d.passwordConfirm, {
  message: 'As senhas não conferem',
  path: ['passwordConfirm'],
})

type FormData = z.infer<typeof schema>

function RegisterContent() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      await api.post('/public/register', {
        name: data.name,
        email: data.email,
        password: data.password,
        whatsapp: data.whatsapp,
        cpfCnpj: data.cpfCnpj,
      })

      const loginRes = await api.post('/auth/login', { email: data.email, password: data.password })
      setAuth(loginRes.data.token, loginRes.data.user)
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

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
        <div className="w-full max-w-md">
          <div className="card p-8">
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
                <p className="text-xs text-gray-400 mt-1">DDI 55 + DDD + 9 dígitos do celular. Ex: 5511999999999</p>
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
                {loading ? 'Criando conta...' : 'Criar conta'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>

              <p className="text-xs text-gray-400 text-center">
                Ao criar uma conta você concorda com nossos{' '}
                <a href="#" className="text-primary-600 hover:underline">termos de uso</a>.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-primary-50 to-green-100" />}>
      <RegisterContent />
    </Suspense>
  )
}
