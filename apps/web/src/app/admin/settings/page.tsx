'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import {
  CheckCircle, XCircle, RefreshCw, QrCode, Plus,
  Trash2, Webhook, Wifi, Copy
} from 'lucide-react'

// ─── WhatsApp section ─────────────────────────────────────────────────────────

function WhatsAppSection({
  register,
  savedSettings,
  getValues,
  setValue,
}: {
  register: any
  savedSettings: any
  getValues: (key: string) => string
  setValue: (key: string, value: string) => void
}) {
  const qc = useQueryClient()
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loadingQr, setLoadingQr] = useState(false)
  const [newInstanceName, setNewInstanceName] = useState('')
  const [creatingInstance, setCreatingInstance] = useState(false)
  const [settingWebhook, setSettingWebhook] = useState(false)

  // Suggested webhook URL based on the public API URL env var
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  const suggestedWebhook = `${apiUrl}/api/webhook/whatsapp`

  const { data: waStatus, refetch: refetchWa, isFetching: fetchingStatus } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: () => api.get('/admin/whatsapp/status').then((r) => r.data),
    refetchInterval: 8_000,
    retry: false,
  })

  const { data: instances, refetch: refetchInstances } = useQuery({
    queryKey: ['whatsapp-instances'],
    queryFn: () => api.get('/admin/whatsapp/instances').then((r) => r.data),
    retry: false,
  })

  const deleteInstance = useMutation({
    mutationFn: (name: string) => api.delete(`/admin/whatsapp/instances/${name}`),
    onSuccess: () => {
      toast.success('Instância removida')
      refetchInstances()
      refetchWa()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro ao remover'),
  })

  async function createInstance() {
    if (!newInstanceName.trim()) return toast.error('Digite o nome da instância')
    setCreatingInstance(true)
    try {
      await api.post('/admin/whatsapp/create-instance', { instanceName: newInstanceName.trim() })
      toast.success(`Instância "${newInstanceName}" criada e definida como principal!`)
      setNewInstanceName('')
      refetchInstances()
      refetchWa()
      qc.invalidateQueries({ queryKey: ['admin-settings'] })
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Erro ao criar instância')
    } finally {
      setCreatingInstance(false)
    }
  }

  async function applyWebhook() {
    // Read current value from the form field; fall back to suggested URL
    const url = (getValues('evolution_webhook_url') ?? '').trim() || suggestedWebhook
    setSettingWebhook(true)
    try {
      await api.post('/admin/whatsapp/set-webhook', { webhookUrl: url })
      // Also persist into form so it's included when the main "Salvar" fires
      setValue('evolution_webhook_url', url)
      toast.success('Webhook configurado na Evolution API!')
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Erro ao configurar webhook')
    } finally {
      setSettingWebhook(false)
    }
  }

  async function loadQrCode() {
    setLoadingQr(true)
    setQrCode(null)
    try {
      const res = await api.get('/admin/whatsapp/qrcode')
      const base64 = res.data?.base64 ?? res.data?.qrcode?.base64 ?? res.data?.code
      if (base64) setQrCode(base64)
      else toast.error('QR Code não disponível. A instância pode já estar conectada.')
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Erro ao gerar QR Code')
    } finally {
      setLoadingQr(false)
    }
  }

  const stateColor = (state: string) => {
    if (state === 'open') return 'text-green-600'
    if (state === 'connecting') return 'text-yellow-600'
    return 'text-gray-400'
  }

  return (
    <div className="card p-6">
      <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
        💬 Evolution API — WhatsApp
      </h2>
      <p className="text-sm text-gray-500 mb-4">Instância central para atender os clientes</p>

      {/* Connection status */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200 mb-5">
        {waStatus?.connected ? (
          <>
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-700">WhatsApp conectado ✓</p>
              <p className="text-xs text-gray-500">Instância: <strong>{waStatus.name}</strong></p>
            </div>
          </>
        ) : (
          <>
            <XCircle className="w-5 h-5 text-red-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-600">Não conectado</p>
              <p className="text-xs text-gray-500">{waStatus?.reason ?? waStatus?.state ?? 'Desconectado'}</p>
            </div>
          </>
        )}
        <button
          type="button"
          onClick={() => refetchWa()}
          className={`p-1.5 text-gray-400 hover:text-gray-600 rounded ${fetchingStatus ? 'animate-spin' : ''}`}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Credentials */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="label">URL da Evolution API</label>
          <input
            {...register('evolution_api_url')}
            className="input"
            placeholder="https://evolution.suaurl.com"
          />
          <p className="text-xs text-gray-400 mt-1">Sem barra no final</p>
        </div>
        <div>
          <label className="label">API Key Global</label>
          <input
            {...register('evolution_api_key')}
            className="input"
            placeholder="Deixe vazio para manter a atual"
            type="password"
          />
        </div>
        <div>
          <label className="label">Instância principal</label>
          <input
            {...register('evolution_main_instance')}
            className="input"
            placeholder="contadordocampo"
          />
          <p className="text-xs text-gray-400 mt-1">
            Apenas mensagens de números cadastrados no sistema serão respondidas.
          </p>
        </div>
      </div>

      {/* Existing instances */}
      {instances && instances.length > 0 && (
        <div className="mb-5">
          <p className="text-sm font-medium text-gray-700 mb-2">Instâncias na Evolution</p>
          <div className="space-y-2">
            {instances.map((inst: any) => (
              <div key={inst.name} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <Wifi className={`w-4 h-4 shrink-0 ${stateColor(inst.state)}`} />
                <span className="text-sm font-medium text-gray-800 flex-1">{inst.name}</span>
                <span className={`text-xs font-medium ${stateColor(inst.state)}`}>{inst.state}</span>
                <button
                  type="button"
                  onClick={() => deleteInstance.mutate(inst.name)}
                  className="p-1 text-gray-300 hover:text-red-500 rounded"
                  title="Remover instância"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create new instance */}
      <div className="border border-dashed border-gray-300 rounded-xl p-4 mb-5">
        <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary-600" />
          Criar nova instância
        </p>
        <div className="flex gap-2">
          <input
            value={newInstanceName}
            onChange={(e) => setNewInstanceName(e.target.value)}
            className="input flex-1"
            placeholder="Ex: contadordocampo"
            onKeyDown={(e) => e.key === 'Enter' && createInstance()}
          />
          <button
            type="button"
            onClick={createInstance}
            disabled={creatingInstance || !newInstanceName.trim()}
            className="btn-primary text-sm px-4 whitespace-nowrap"
          >
            {creatingInstance ? 'Criando...' : 'Criar'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Salve a URL e API Key antes de criar. A instância criada será definida como principal automaticamente.
        </p>
      </div>

      {/* Webhook — connected to the main form via register so the value is persisted */}
      <div className="border border-dashed border-gray-300 rounded-xl p-4 mb-5">
        <p className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
          <Webhook className="w-4 h-4 text-primary-600" />
          Configurar Webhook
        </p>
        <p className="text-xs text-gray-400 mb-3">
          Aponta a Evolution para receber mensagens no seu sistema. O valor é salvo automaticamente junto com as demais configurações.
        </p>
        <div className="flex gap-2 mb-2">
          <input
            {...register('evolution_webhook_url')}
            className="input flex-1 font-mono text-xs"
            placeholder={suggestedWebhook}
          />
          <button
            type="button"
            onClick={() => setValue('evolution_webhook_url', suggestedWebhook)}
            className="btn-secondary text-xs px-3"
            title="Usar URL sugerida"
          >
            Auto
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={applyWebhook}
            disabled={settingWebhook}
            className="btn-primary text-sm flex-1"
          >
            {settingWebhook ? 'Configurando...' : '✓ Aplicar webhook na Evolution'}
          </button>
          <button
            type="button"
            onClick={() => {
              const url = (getValues('evolution_webhook_url') ?? '').trim() || suggestedWebhook
              navigator.clipboard.writeText(url)
              toast.success('Copiado!')
            }}
            className="btn-secondary px-3"
            title="Copiar URL"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* QR Code */}
      <div className="border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={loadQrCode}
          disabled={loadingQr}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <QrCode className="w-4 h-4" />
          {loadingQr ? 'Gerando...' : 'Gerar QR Code para conectar'}
        </button>
        {qrCode && (
          <div className="mt-3 p-4 bg-white border border-gray-200 rounded-xl inline-block">
            <img
              src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
              alt="QR Code WhatsApp"
              className="w-52 h-52"
            />
            <p className="text-xs text-gray-400 mt-2 text-center">
              Escaneie com o WhatsApp · atualiza em 40s
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const qc = useQueryClient()

  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api.get('/admin/settings').then((r) => r.data),
  })

  const { register, handleSubmit, reset, getValues, setValue } = useForm()

  useEffect(() => {
    if (!settings) return
    // Clear sensitive fields so the masked value is never re-saved
    const SENSITIVE = ['stripe_secret_key', 'stripe_webhook_secret', 'evolution_api_key', 'ai_api_key']
    const cleaned = { ...settings }
    SENSITIVE.forEach((k) => { cleaned[k] = '' })
    reset(cleaned)
  }, [settings, reset])

  const save = useMutation({
    mutationFn: (data: any) => api.put('/admin/settings', data),
    onSuccess: () => {
      toast.success('Configurações salvas!')
      qc.invalidateQueries({ queryKey: ['admin-settings'] })
      qc.invalidateQueries({ queryKey: ['whatsapp-status'] })
      qc.invalidateQueries({ queryKey: ['whatsapp-instances'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro ao salvar'),
  })

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Configurações</h1>

      <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-6">

        {/* ── Stripe ─────────────────────────────────────────────── */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">💳 Stripe — Pagamentos</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Stripe Secret Key</label>
              <input {...register('stripe_secret_key')} className="input" placeholder="sk_live_... (deixe vazio para manter a atual)" type="password" />
            </div>
            <div>
              <label className="label">Stripe Publishable Key</label>
              <input {...register('stripe_publishable_key')} className="input" placeholder="pk_live_..." />
            </div>
            <div>
              <label className="label">Webhook Secret</label>
              <input {...register('stripe_webhook_secret')} className="input" placeholder="whsec_... (deixe vazio para manter a atual)" type="password" />
              <p className="text-xs text-gray-400 mt-1">
                Configure o webhook no Stripe Dashboard apontando para:{' '}
                <code className="bg-gray-100 px-1 rounded">/api/stripe/webhook</code>
              </p>
            </div>
          </div>
        </div>

        {/* ── Evolution API ────────────────────────────────────────── */}
        <WhatsAppSection
          register={register}
          savedSettings={settings}
          getValues={getValues}
          setValue={setValue}
        />

        {/* ── AI ───────────────────────────────────────────────────── */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">🤖 Inteligência Artificial</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Provider</label>
              <select {...register('ai_provider')} className="input">
                <option value="OPENAI">OpenAI (recomendado)</option>
                <option value="ANTHROPIC">Anthropic (Claude)</option>
              </select>
            </div>
            <div>
              <label className="label">API Key</label>
              <input {...register('ai_api_key')} className="input" placeholder="sk-... (deixe vazio para manter a atual)" type="password" />
            </div>
            <div>
              <label className="label">Modelo</label>
              <input {...register('ai_model')} className="input" placeholder="gpt-4o-mini" />
              <p className="text-xs text-gray-400 mt-1">
                Recomendado:{' '}
                <code className="bg-gray-100 px-1 rounded">gpt-4o-mini</code> — custo baixo, ótimo para classificação e atendimento
              </p>
            </div>
          </div>
        </div>

        {/* ── App ──────────────────────────────────────────────────── */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">⚙️ App</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Nome do Sistema</label>
              <input {...register('app_name')} className="input" placeholder="Contador do Campo" />
            </div>
            <div>
              <label className="label">WhatsApp de Suporte</label>
              <input {...register('support_whatsapp')} className="input" placeholder="5511999999999" />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary w-full py-3"
          disabled={save.isPending}
        >
          {save.isPending ? 'Salvando...' : 'Salvar todas as configurações'}
        </button>
      </form>
    </div>
  )
}
