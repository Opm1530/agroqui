import { useEffect, useState } from 'react'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getAuth } from '@/lib/auth'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

export default function RootLayout() {
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    getAuth().then((auth) => {
      if (!auth) {
        router.replace('/(auth)/login')
      } else {
        router.replace('/(tabs)')
      }
      setChecked(true)
    })
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" backgroundColor="#16a34a" />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  )
}
