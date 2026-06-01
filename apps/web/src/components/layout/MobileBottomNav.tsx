'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Leaf, FileText, Package, Tractor, Settings, CreditCard, LogOut } from 'lucide-react'
import { clearAuth } from '@/lib/auth'

const tabs = [
  { href: '/dashboard',              icon: LayoutDashboard, label: 'Início',      exact: true },
  { href: '/dashboard/harvests',     icon: Leaf,            label: 'Safras',      exact: false },
  { href: '/dashboard/activities',   icon: Tractor,         label: 'Atividades',  exact: false },
  { href: '/dashboard/stock',        icon: Package,         label: 'Estoque',     exact: false },
  { href: '/dashboard/entries',      icon: FileText,        label: 'Lançamentos', exact: false },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [showConfigMenu, setShowConfigMenu] = useState(false)

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  function handleLogout() {
    clearAuth()
    router.push('/login')
  }

  return (
    <>
      {/* Config popup backdrop */}
      {showConfigMenu && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setShowConfigMenu(false)}
        />
      )}

      {/* Config popup */}
      {showConfigMenu && (
        <div className="fixed bottom-16 left-4 right-4 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-2">
          <Link
            href="/dashboard/billing"
            onClick={() => setShowConfigMenu(false)}
            className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <CreditCard className="w-5 h-5 text-gray-500" />
            Assinatura
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 w-full"
          >
            <LogOut className="w-5 h-5 text-gray-500" />
            Sair
          </button>
        </div>
      )}

      {/* Bottom nav bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden bg-white border-t border-gray-100 pb-4">
        {tabs.map(({ href, icon: Icon, label, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium flex-1 ${
                active ? 'text-primary-600' : 'text-gray-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          )
        })}

        {/* Config tab */}
        <button
          onClick={() => setShowConfigMenu((prev) => !prev)}
          className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium flex-1 ${
            showConfigMenu ? 'text-primary-600' : 'text-gray-400'
          }`}
        >
          <Settings className="w-5 h-5" />
          Config
        </button>
      </div>
    </>
  )
}
