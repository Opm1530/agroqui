'use client'

import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIos, setShowIos] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Don't show if already dismissed
    if (localStorage.getItem('pwa-banner-dismissed')) return

    // Don't show if already in standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    if (isStandalone) return

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)

    if (isIos) {
      setShowIos(true)
      return
    }

    // Android / Desktop: wait for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    setDismissed(true)
    localStorage.setItem('pwa-banner-dismissed', '1')
  }

  async function install() {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setDismissed(true)
      localStorage.setItem('pwa-banner-dismissed', '1')
    }
  }

  if (dismissed) return null

  // iOS banner
  if (showIos) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-xl">🌾</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Instalar no iPhone</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                Toque em{' '}
                <span className="inline-flex items-center gap-0.5 text-primary-600 font-medium">
                  <Share className="w-3 h-3" /> compartilhar
                </span>{' '}
                e depois{' '}
                <strong className="text-gray-700">"Adicionar à Tela de Início"</strong>
              </p>
            </div>
            <button
              onClick={dismiss}
              className="text-gray-300 hover:text-gray-500 transition-colors shrink-0 mt-0.5"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Android / Desktop banner
  if (!prompt) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shrink-0">
          <span className="text-xl">🌾</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Instalar no celular</p>
          <p className="text-xs text-gray-500 truncate">Acesse rápido pela tela inicial</p>
        </div>
        <button
          onClick={install}
          className="flex items-center gap-1.5 bg-primary-600 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-primary-700 transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Instalar
        </button>
        <button
          onClick={dismiss}
          className="text-gray-300 hover:text-gray-500 transition-colors shrink-0"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
