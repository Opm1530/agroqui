import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, ActivityIndicator
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { api } from '@/lib/api'
import { clearAuth, getAuth } from '@/lib/auth'
import { colors } from '@/lib/colors'
import { useEffect, useState } from 'react'

function fmt(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function DashboardScreen() {
  const [userName, setUserName] = useState('')

  useEffect(() => {
    getAuth().then((a) => { if (a) setUserName(a.user.name.split(' ')[0]) })
  }, [])

  const { data: harvests, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['harvests'],
    queryFn: () => api.get('/producer/harvests').then((r) => r.data),
  })

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get('/producer/subscription').then((r) => r.data),
  })

  const activeHarvests = (harvests ?? []).filter(
    (h: any) => h.status === 'ACTIVE' || h.status === 'PLANNING'
  )

  async function logout() {
    await clearAuth()
    router.replace('/(auth)/login')
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, {userName} 👋</Text>
          <Text style={styles.headerSub}>
            {subscription?.plan?.name ?? 'Plano Trial'} •{' '}
            {subscription?.status === 'ACTIVE' ? 'Ativo' : subscription?.status ?? 'Trial'}
          </Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Quick actions */}
      <View style={styles.quickRow}>
        <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/(tabs)/scan')}>
          <Ionicons name="camera" size={28} color={colors.primary} />
          <Text style={styles.quickLabel}>Enviar NF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/(tabs)/entries')}>
          <Ionicons name="document-text" size={28} color={colors.primary} />
          <Text style={styles.quickLabel}>Lançamentos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/(tabs)/prices')}>
          <Ionicons name="trending-up" size={28} color={colors.primary} />
          <Text style={styles.quickLabel}>Preços</Text>
        </TouchableOpacity>
      </View>

      {/* Harvest cards */}
      <Text style={styles.sectionTitle}>Safras Ativas</Text>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : activeHarvests.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="leaf-outline" size={40} color={colors.gray[300]} />
          <Text style={styles.emptyText}>Nenhuma safra ativa</Text>
          <Text style={styles.emptySubtext}>Cadastre no painel web</Text>
        </View>
      ) : (
        activeHarvests.map((h: any) => (
          <HarvestCard key={h.id} harvest={h} />
        ))
      )}
    </ScrollView>
  )
}

function HarvestCard({ harvest }: { harvest: any }) {
  const { data: dre } = useQuery({
    queryKey: ['dre', harvest.id],
    queryFn: () => api.get(`/producer/dre/${harvest.id}`).then((r) => r.data),
  })

  const profit = dre?.summary?.netProfit ?? 0
  const income = dre?.summary?.totalIncome ?? 0
  const expenses = dre?.summary?.totalExpenses ?? 0

  return (
    <View style={styles.harvestCard}>
      <View style={styles.harvestHeader}>
        <Text style={styles.harvestTitle}>{harvest.crop} {harvest.year}</Text>
        <View style={[styles.badge, harvest.status === 'ACTIVE' ? styles.badgeGreen : styles.badgeYellow]}>
          <Text style={styles.badgeText}>{harvest.status}</Text>
        </View>
      </View>
      <Text style={styles.harvestProp}>{harvest.property?.name}</Text>

      <View style={styles.dreRow}>
        <DreItem label="Receitas" value={income} positive />
        <DreItem label="Despesas" value={expenses} />
        <DreItem label="Resultado" value={profit} positive={profit >= 0} />
      </View>
    </View>
  )
}

function DreItem({ label, value, positive }: { label: string; value: number; positive?: boolean }) {
  return (
    <View style={styles.dreItem}>
      <Text style={styles.dreLabel}>{label}</Text>
      <Text style={[styles.dreValue, positive === false && styles.dreNeg]}>
        {fmt(value)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  header: {
    backgroundColor: colors.primary,
    padding: 24,
    paddingTop: 56,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  greeting: { fontSize: 22, fontWeight: '700', color: colors.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  logoutBtn: { padding: 4 },
  quickRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    marginTop: -12,
  },
  quickCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  quickLabel: { fontSize: 12, fontWeight: '600', color: colors.gray[700] },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray[800],
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  emptyCard: {
    margin: 16,
    padding: 40,
    backgroundColor: colors.white,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.gray[500] },
  emptySubtext: { fontSize: 13, color: colors.gray[400] },
  harvestCard: {
    margin: 16,
    marginTop: 0,
    marginBottom: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  harvestHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  harvestTitle: { fontSize: 17, fontWeight: '700', color: colors.gray[900] },
  harvestProp: { fontSize: 13, color: colors.gray[500], marginTop: 2, marginBottom: 12 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeGreen: { backgroundColor: colors.primaryLight },
  badgeYellow: { backgroundColor: '#fef9c3' },
  badgeText: { fontSize: 11, fontWeight: '600', color: colors.gray[700] },
  dreRow: { flexDirection: 'row', gap: 8 },
  dreItem: { flex: 1, backgroundColor: colors.gray[50], borderRadius: 10, padding: 10 },
  dreLabel: { fontSize: 11, color: colors.gray[500], marginBottom: 4 },
  dreValue: { fontSize: 13, fontWeight: '700', color: colors.gray[800] },
  dreNeg: { color: colors.red },
})
