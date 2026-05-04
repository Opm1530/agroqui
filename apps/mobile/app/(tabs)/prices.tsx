import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, ScrollView
} from 'react-native'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { api } from '@/lib/api'
import { colors } from '@/lib/colors'

const STATES = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

const CATEGORY_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'FUEL', label: '⛽ Combustível' },
  { value: 'FERTILIZER', label: '🪨 Adubo' },
  { value: 'DEFENSIVE', label: '🌿 Defensivo' },
  { value: 'SEED', label: '🌱 Semente' },
  { value: 'MACHINERY_MAINTENANCE', label: '🔧 Manutenção' },
]

function fmtPrice(value: number, unit: string | null) {
  const formatted = value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 4 })
  return unit ? `${formatted}/${unit}` : formatted
}

export default function PricesScreen() {
  const [selectedState, setSelectedState] = useState<string>('MT')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['price-index', selectedState, selectedCategory],
    queryFn: () =>
      api.get('/public/price-index', {
        params: {
          state: selectedState || undefined,
          category: selectedCategory || undefined,
        },
      }).then((r) => r.data),
  })

  const { data: summary } = useQuery({
    queryKey: ['price-summary'],
    queryFn: () => api.get('/public/price-index/summary').then((r) => r.data),
  })

  const items: any[] = (data ?? []).filter((item: any) =>
    !search || item.product.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <View style={styles.container}>
      {/* Filters */}
      <View style={styles.filtersBox}>
        {/* State picker */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stateScroll}>
          {STATES.map((st) => (
            <TouchableOpacity
              key={st}
              style={[styles.stateChip, selectedState === st && styles.stateChipActive]}
              onPress={() => setSelectedState(st)}
            >
              <Text style={[styles.stateChipText, selectedState === st && styles.stateChipTextActive]}>
                {st}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          {CATEGORY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.catChip, selectedCategory === opt.value && styles.catChipActive]}
              onPress={() => setSelectedCategory(opt.value)}
            >
              <Text style={[styles.catChipText, selectedCategory === opt.value && styles.catChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Search */}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={colors.gray[400]} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar produto..."
            placeholderTextColor={colors.gray[400]}
          />
        </View>
      </View>

      {/* Data count */}
      {summary && (
        <View style={styles.summaryBar}>
          <Ionicons name="analytics" size={14} color={colors.primary} />
          <Text style={styles.summaryText}>
            {summary.states?.length ?? 0} estados · {summary.products?.length ?? 0} produtos indexados
          </Text>
        </View>
      )}

      {/* List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Carregando preços regionais...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="trending-up-outline" size={48} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>Sem dados ainda</Text>
          <Text style={styles.emptyText}>
            Conforme os produtores enviam notas fiscais, os preços regionais são indexados automaticamente.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, i) => `${item.product}-${item.city}-${i}`}
          renderItem={({ item }) => <PriceRow item={item} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        />
      )}
    </View>
  )
}

function PriceRow({ item }: { item: any }) {
  const spread = item.maxPrice && item.minPrice ? item.maxPrice - item.minPrice : null

  return (
    <View style={styles.priceCard}>
      <View style={styles.priceHeader}>
        <Text style={styles.productName}>{item.product}</Text>
        <View style={styles.dataPointBadge}>
          <Text style={styles.dataPointText}>{item.dataPoints} NF</Text>
        </View>
      </View>

      <Text style={styles.location}>
        📍 {item.city ? `${item.city}, ` : ''}{item.state}
      </Text>

      <View style={styles.priceRow}>
        <PriceStat label="Média" value={item.avgPrice} unit={item.unit} bold />
        <PriceStat label="Mín" value={item.minPrice} unit={item.unit} />
        <PriceStat label="Máx" value={item.maxPrice} unit={item.unit} />
      </View>

      {spread && spread > 0 && (
        <Text style={styles.spread}>
          Variação: {fmtPrice(spread, item.unit)}
        </Text>
      )}
    </View>
  )
}

function PriceStat({ label, value, unit, bold }: { label: string; value: number | null; unit: string | null; bold?: boolean }) {
  return (
    <View style={styles.priceStat}>
      <Text style={styles.priceStatLabel}>{label}</Text>
      <Text style={[styles.priceStatValue, bold && styles.priceStatBold]}>
        {value != null ? fmtPrice(value, unit) : '—'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  filtersBox: { backgroundColor: colors.white, paddingTop: 12, borderBottomWidth: 1, borderBottomColor: colors.gray[200] },
  stateScroll: { paddingHorizontal: 12, marginBottom: 8 },
  stateChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.gray[100], marginRight: 6 },
  stateChipActive: { backgroundColor: colors.primary },
  stateChipText: { fontSize: 12, fontWeight: '600', color: colors.gray[600] },
  stateChipTextActive: { color: colors.white },
  catScroll: { paddingHorizontal: 12, marginBottom: 10 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.gray[100], marginRight: 6 },
  catChipActive: { backgroundColor: colors.primaryDark },
  catChipText: { fontSize: 12, color: colors.gray[600] },
  catChipTextActive: { color: colors.white, fontWeight: '600' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 12, backgroundColor: colors.gray[50], borderRadius: 10, paddingHorizontal: 12, gap: 8, borderWidth: 1, borderColor: colors.gray[200] },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.gray[800] },
  summaryBar: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, paddingHorizontal: 16 },
  summaryText: { fontSize: 12, color: colors.gray[500] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.gray[500], fontSize: 14 },
  emptyBox: { flex: 1, padding: 48, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.gray[600] },
  emptyText: { fontSize: 13, color: colors.gray[400], textAlign: 'center', lineHeight: 20 },
  priceCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  priceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  productName: { fontSize: 15, fontWeight: '700', color: colors.gray[900], flex: 1 },
  dataPointBadge: { backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  dataPointText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  location: { fontSize: 12, color: colors.gray[500], marginBottom: 10 },
  priceRow: { flexDirection: 'row', gap: 8 },
  priceStat: { flex: 1, backgroundColor: colors.gray[50], borderRadius: 8, padding: 8, alignItems: 'center' },
  priceStatLabel: { fontSize: 11, color: colors.gray[400], marginBottom: 3 },
  priceStatValue: { fontSize: 12, color: colors.gray[700] },
  priceStatBold: { fontWeight: '700', color: colors.primary, fontSize: 13 },
  spread: { fontSize: 11, color: colors.gray[400], marginTop: 6, textAlign: 'center' },
})
