'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, CreditCard, Users, Settings, Building2,
  MessageSquare, Tractor, LogOut, ChevronRight, Wheat
} from 'lucide-react'
import { clearAuth } from '@/lib/auth'
import { clsx } from 'clsx'

const nav = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/plans', icon: CreditCard, label: 'Planos' },
  { href: '/admin/cooperatives', icon: Building2, label: 'Cooperativas' },
  { href: '/admin/producers', icon: Tractor, label: 'Produtores' },
  { href: '/admin/users', icon: Users, label: 'Usuários Admin' },
  { href: '/admin/settings', icon: Settings, label: 'Configurações' },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  function logout() {
    clearAuth()
    router.push('/login')
  }

  return (
    <aside className="w-64 bg-gray-900 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
            <Wheat className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Contador do Campo</p>
            <p className="text-gray-400 text-xs">Painel Admin</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  )
}
