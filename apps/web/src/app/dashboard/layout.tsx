'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getUser, isProducer } from '@/lib/auth'
import { ProducerSidebar } from '@/components/layout/ProducerSidebar'
import { MobileTopBar } from '@/components/layout/MobileTopBar'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
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
      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileTopBar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-7 pb-24 md:pb-7">{children}</main>
      </div>
      <MobileBottomNav />
      <PwaInstallBanner />
    </div>
  )
}
