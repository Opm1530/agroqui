'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getUser, isAdmin } from '@/lib/auth'
import { AdminSidebar } from '@/components/layout/AdminSidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const user = getUser()
    if (!user || !isAdmin(user)) router.replace('/login')
  }, [router])

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
