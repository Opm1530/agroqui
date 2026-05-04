import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator
} from 'react-native'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { api } from '@/lib/api'
import { colors } from '@/lib/colors'

const CATEGORY_LABELS: Record<string, string> = {
  DEFENSIVE: '🌿 Defensivo',
  FERTILIZER: '🪨 Adubo',
  SEED: '🌱 Semente',
  FUEL: '⛽ Combustível',
  MACHINERY_MAINTENANCE: '🔧 Manutenção',
  LABOR: '👷 Mão de Obra',
  LEASE: '🏡 Arrendamento',
  FREIGHT_DRYING: '🚛 Frete/Secagem',
  PRODUCTION_SALE: '💰 Venda',
  OTHER_INCOME: '📈 Outra Receita',
  OTHER_EXPENSE: '📋 Outras Despesas',
}

function fmt(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

export default function EntriesScreen() {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['entries', page],
    queryFn: () =>
      api.get('/producer/entries', { params: { page, limit: 30 } }).then((r) => r.data),
  })

  const entries: any[] = data?.entries ?? []
  const hasMore = page < (data?.pages ?? 1)

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <FlatList
      style={styles.container}
      data={entries}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Lançamentos</Text>
          {data && (
            <Text style={styles.sub}>{data.total} registros</Text>
          )}
        </View>
      }
      renderItem={({ item }) => <EntryRow entry={item} />}
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Ionicons name="document-text-outline" size={48} color={colors.gray[300]} />
          <Text style={styles.emptyText}>Nenhum lançamento ainda</Text>
          <Text style={styles.emptySub}>Envie uma nota fiscal pelo WhatsApp ou pela aba Nota Fiscal</Text>
        </View>
      }
      ListFooterComponent={
        hasMore ? (
          <TouchableOpacity style={styles.loadMore} onPress={() => setPage((p) => p + 1)}>
            <Text style={styles.loadMoreText}>Carregar mais</Text>
          </TouchableOpacity>
        ) : null
      }
      contentContainerStyle={{ paddingBottom: 24 }}
    />
  )
}

function EntryRow({ entry }: { entry: any }) {
  const isIncome = entry.type === 'INCOME'
  return (
    <View style={styles.row}>
      <View style={[styles.dot, isIncome ? styles.dotGreen : styles.dotRed]} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowCategory}>{CATEGORY_LABELS[entry.category] ?? entry.category}</Text>
        {entry.supplier && <Text style={styles.rowSupplier}>{entry.supplier}</Text>}
        <Text style={styles.rowDate}>
          {entry.harvest?.crop} {entry.harvest?.year} · {fmtDate(entry.date)}
        </Text>
      </View>
      <Text style={[styles.rowAmount, isIncome ? styles.amountGreen : styles.amountRed]}>
        {isIncome ? '+' : '-'} {fmt(entry.amount)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: colors.gray[900] },
  sub: { fontSize: 13, color: colors.gray[500], marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotGreen: { backgroundColor: colors.primary },
  dotRed: { backgroundColor: colors.red },
  rowInfo: { flex: 1 },
  rowCategory: { fontSize: 14, fontWeight: '600', color: colors.gray[800] },
  rowSupplier: { fontSize: 12, color: colors.gray[500], marginTop: 1 },
  rowDate: { fontSize: 12, color: colors.gray[400], marginTop: 2 },
  rowAmount: { fontSize: 14, fontWeight: '700' },
  amountGreen: { color: colors.primary },
  amountRed: { color: colors.red },
  emptyBox: { padding: 48, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.gray[500] },
  emptySub: { fontSize: 13, color: colors.gray[400], textAlign: 'center', lineHeight: 20 },
  loadMore: { margin: 16, padding: 14, backgroundColor: colors.gray[100], borderRadius: 12, alignItems: 'center' },
  loadMoreText: { color: colors.gray[600], fontWeight: '600' },
})
