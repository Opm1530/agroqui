'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getUser, isProducer } from '@/lib/auth'
import { ProducerSidebar } from '@/components/layout/ProducerSidebar'
import { PwaInstallBanner } from '@/components/PwaInstallBanner'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const user = getUser()
    if (!user) router.replace('/login')
    else if (!isProducer(user)) router.replace('/admin')
  }, [router])

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fa]">
      <ProducerSidebar />
      <main className="flex-1 overflow-y-auto p-7">{children}</main>
      <PwaInstallBanner />
    </div>
  )
}
