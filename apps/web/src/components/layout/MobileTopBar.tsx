'use client'

import Link from 'next/link'
import { Bell, Wheat, TrendingUp } from 'lucide-react'

export function MobileTopBar() {
  return (
    <div className="flex md:hidden items-center justify-between h-14 bg-white border-b border-gray-100 px-4 shrink-0">
      {/* Left: Alerts */}
      <Link href="/dashboard/alerts" className="flex items-center justify-center w-9 h-9">
        <Bell className="w-6 h-6 text-gray-500" />
      </Link>

      {/* Center: Logo */}
      <div className="flex items-center gap-1.5">
        <Wheat className="w-5 h-5 text-primary-600" />
        <span className="font-bold text-sm text-gray-900">Contador do Campo</span>
      </div>

      {/* Right: Prices */}
      <Link href="/dashboard/prices" className="flex items-center justify-center w-9 h-9">
        <TrendingUp className="w-6 h-6 text-gray-500" />
      </Link>
    </div>
  )
}
