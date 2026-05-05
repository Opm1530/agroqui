'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, FileText, Leaf, MapPin, Bell,
  LogOut, Wheat, CreditCard, PanelLeftClose, PanelLeftOpen, TrendingUp,
} from 'lucide-react'
import { clearAuth } from '@/lib/auth'
import { clsx } from 'clsx'
import { useState, useEffect } from 'react'

const nav = [
  { href: '/dashboard',            icon: LayoutDashboard, label: 'Início' },
  { href: '/dashboard/harvests',   icon: Leaf,            label: 'Safras' },
  { href: '/dashboard/entries',    icon: FileText,        label: 'Lançamentos' },
  { href: '/dashboard/properties', icon: MapPin,          label: 'Propriedades' },
  { href: '/dashboard/prices',     icon: TrendingUp,      label: 'Base de Preços' },
  { href: '/dashboard/alerts',     icon: Bell,            label: 'Alertas' },
]

export function ProducerSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored !== null) setCollapsed(stored === 'true')
  }, [])

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  function logout() {
    clearAuth()
    router.push('/login')
  }

  return (
    <aside
      className={clsx(
        'hidden md:flex bg-white border-r border-gray-100 h-screen sticky top-0 flex-col shrink-0',
        'transition-[width] duration-300 ease-in-out',
        collapsed ? 'w-[64px]' : 'w-[220px]'
      )}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="h-[60px] flex items-center gap-2 px-3.5 border-b border-gray-100 shrink-0">
        <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
          <Wheat className="w-4 h-4 text-white" />
        </div>

        {!collapsed && (
          <span className="font-bold text-gray-900 text-[13px] tracking-tight flex-1 min-w-0 whitespace-nowrap overflow-hidden">
            Contador do Campo
          </span>
        )}

        {/* Toggle button — always visible inside header */}
        <button
          onClick={toggle}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className={clsx(
            'shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
            'text-gray-300 hover:text-primary-600 hover:bg-primary-50',
            collapsed && 'mx-auto'
          )}
        >
          {collapsed
            ? <PanelLeftOpen className="w-4 h-4" />
            : <PanelLeftClose className="w-4 h-4" />
          }
        </button>
      </div>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-hidden">
        {nav.map((item) => {
          const active = pathname === item.href
            || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={clsx(
                'flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                collapsed ? 'justify-center px-2' : 'px-3',
                active
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-800'
              )}
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && (
                <span className="flex-1 truncate">{item.label}</span>
              )}
              {active && !collapsed && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── Bottom ──────────────────────────────────────────────────────── */}
      <div className="p-2 border-t border-gray-100 space-y-0.5 shrink-0">
        <Link
          href="/dashboard/billing"
          title={collapsed ? 'Assinatura' : undefined}
          className={clsx(
            'flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all',
            collapsed ? 'justify-center px-2' : 'px-3',
            pathname.startsWith('/dashboard/billing')
              ? 'bg-primary-50 text-primary-700'
              : 'text-gray-400 hover:bg-gray-50 hover:text-gray-800'
          )}
        >
          <CreditCard className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && 'Assinatura'}
        </Link>

        <button
          onClick={logout}
          title={collapsed ? 'Sair' : undefined}
          className={clsx(
            'flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all w-full',
            collapsed ? 'justify-center px-2' : 'px-3',
            'text-gray-400 hover:bg-gray-50 hover:text-gray-800'
          )}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && 'Sair'}
        </button>
      </div>
    </aside>
  )
}
