'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getUser, isCooperative } from '@/lib/auth'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, LogOut, Wheat } from 'lucide-react'
import { clearAuth } from '@/lib/auth'
import { clsx } from 'clsx'

const nav = [
  { href: '/cooperative', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/cooperative/producers', icon: Users, label: 'Produtores' },
]

function CoopSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <aside className="w-60 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Wheat className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Cooperativa</p>
            <p className="text-xs text-gray-400">Painel</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== '/cooperative' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}
              className={clsx('flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50')}
            >
              <item.icon className="w-4 h-4" />{item.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-3 border-t border-gray-100">
        <button onClick={() => { clearAuth(); router.push('/login') }}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 w-full">
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </div>
    </aside>
  )
}

export default function CooperativeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  useEffect(() => {
    const user = getUser()
    if (!user || !isCooperative(user)) router.replace('/login')
  }, [router])

  return (
    <div className="flex min-h-screen">
      <CoopSidebar />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
