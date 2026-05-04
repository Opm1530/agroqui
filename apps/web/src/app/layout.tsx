import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: {
    default: 'Contador do Campo',
    template: '%s | Contador do Campo',
  },
  description: 'Gestão financeira com IA para produtores rurais',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Contador do Campo',
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.png',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* iOS PWA meta tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Contador do Campo" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Splash screen color for iOS */}
        <meta name="msapplication-TileColor" content="#16a34a" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body>
        <Providers>
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  )
}
