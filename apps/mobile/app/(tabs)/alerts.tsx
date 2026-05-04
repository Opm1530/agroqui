import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { api } from '@/lib/api'
import { colors } from '@/lib/colors'

const ALERT_ICONS: Record<string, { icon: string; color: string }> = {
  COST_ABOVE_TARGET: { icon: 'trending-up', color: colors.red },
  LOW_BALANCE: { icon: 'warning', color: colors.yellow },
  INSTALLMENT_DUE: { icon: 'calendar', color: colors.blue },
  CUSTOM: { icon: 'notifications', color: colors.primary },
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function AlertsScreen() {
  const qc = useQueryClient()

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.get('/producer/alerts').then((r) => r.data),
  })

  const markRead = useMutation({
    mutationFn: (id: string) => api.put(`/producer/alerts/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })

  const unread = (alerts ?? []).filter((a: any) => !a.isRead)
  const read = (alerts ?? []).filter((a: any) => a.isRead)

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
      data={[...(alerts ?? [])]}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Alertas</Text>
          {unread.length > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unread.length} não lidos</Text>
            </View>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <AlertRow
          alert={item}
          onRead={() => markRead.mutate(item.id)}
        />
      )}
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Ionicons name="notifications-off-outline" size={48} color={colors.gray[300]} />
          <Text style={styles.emptyText}>Nenhum alerta</Text>
          <Text style={styles.emptySub}>Os alertas de custo, saldo e vencimentos aparecerão aqui</Text>
        </View>
      }
      contentContainerStyle={{ paddingBottom: 24 }}
    />
  )
}

function AlertRow({ alert, onRead }: { alert: any; onRead: () => void }) {
  const icon = ALERT_ICONS[alert.type] ?? ALERT_ICONS.CUSTOM

  return (
    <TouchableOpacity
      style={[styles.row, !alert.isRead && styles.rowUnread]}
      onPress={onRead}
      activeOpacity={0.7}
    >
      <View style={[styles.iconBox, { backgroundColor: icon.color + '20' }]}>
        <Ionicons name={icon.icon as any} size={20} color={icon.color} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.message}>{alert.message}</Text>
        <Text style={styles.date}>{fmtDate(alert.createdAt)}</Text>
      </View>
      {!alert.isRead && <View style={styles.dot} />}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8, gap: 10 },
  title: { fontSize: 20, fontWeight: '700', color: colors.gray[900] },
  unreadBadge: { backgroundColor: colors.red, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  unreadText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  rowUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1 },
  message: { fontSize: 14, color: colors.gray[800], lineHeight: 20 },
  date: { fontSize: 12, color: colors.gray[400], marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 4 },
  emptyBox: { padding: 48, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.gray[500] },
  emptySub: { fontSize: 13, color: colors.gray[400], textAlign: 'center', lineHeight: 20 },
})
