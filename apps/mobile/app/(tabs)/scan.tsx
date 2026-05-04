import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, ScrollView, Alert, ActivityIndicator
} from 'react-native'
import { useState } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { colors } from '@/lib/colors'

export default function ScanScreen() {
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [selectedHarvestId, setSelectedHarvestId] = useState<string | null>(null)

  const { data: harvests } = useQuery({
    queryKey: ['harvests'],
    queryFn: () => api.get('/producer/harvests').then((r) => r.data),
  })

  const activeHarvests = (harvests ?? []).filter(
    (h: any) => h.status === 'ACTIVE' || h.status === 'PLANNING'
  )

  async function pickCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera para fotografar notas fiscais.')
      return
    }
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      base64: false,
      allowsEditing: false,
    })
    if (!res.canceled && res.assets[0]) {
      setImage(res.assets[0])
      setResult(null)
    }
  }

  async function pickGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria.')
      return
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    })
    if (!res.canceled && res.assets[0]) {
      setImage(res.assets[0])
      setResult(null)
    }
  }

  async function processInvoice() {
    if (!image) return
    if (!selectedHarvestId && activeHarvests.length > 0) {
      Alert.alert('Selecione a safra', 'Escolha a safra para vincular este lançamento.')
      return
    }

    setProcessing(true)
    try {
      const formData = new FormData()
      formData.append('invoice', {
        uri: image.uri,
        name: 'invoice.jpg',
        type: 'image/jpeg',
      } as any)
      if (selectedHarvestId) formData.append('harvestId', selectedHarvestId)

      const { data } = await api.post('/producer/invoices/process', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60_000,
      })
      setResult(data)
    } catch (err: any) {
      // Fallback: just show a success message about WhatsApp flow
      Alert.alert(
        '💬 Dica',
        'Para processar notas fiscais, você também pode enviar a foto direto pelo WhatsApp!\n\n' +
        (err.response?.data?.error ?? 'Erro ao processar a nota.')
      )
    } finally {
      setProcessing(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>📄 Nota Fiscal</Text>
      <Text style={styles.subtitle}>
        Fotografe ou selecione uma NF para registrar automaticamente
      </Text>

      {/* Image picker buttons */}
      {!image && (
        <View style={styles.pickRow}>
          <TouchableOpacity style={styles.pickBtn} onPress={pickCamera}>
            <Ionicons name="camera" size={32} color={colors.primary} />
            <Text style={styles.pickLabel}>Câmera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pickBtn} onPress={pickGallery}>
            <Ionicons name="images" size={32} color={colors.primary} />
            <Text style={styles.pickLabel}>Galeria</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Preview */}
      {image && (
        <View>
          <Image source={{ uri: image.uri }} style={styles.preview} />
          <TouchableOpacity style={styles.clearBtn} onPress={() => { setImage(null); setResult(null) }}>
            <Ionicons name="close-circle" size={24} color={colors.gray[400]} />
            <Text style={styles.clearText}>Trocar foto</Text>
          </TouchableOpacity>

          {/* Harvest selector */}
          {activeHarvests.length > 0 && (
            <View style={styles.harvestSelector}>
              <Text style={styles.selectorLabel}>Vincular à safra:</Text>
              {activeHarvests.map((h: any) => (
                <TouchableOpacity
                  key={h.id}
                  style={[styles.harvestOption, selectedHarvestId === h.id && styles.harvestSelected]}
                  onPress={() => setSelectedHarvestId(h.id)}
                >
                  <Text style={[styles.harvestOptionText, selectedHarvestId === h.id && { color: colors.white }]}>
                    {h.crop} {h.year} — {h.property?.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.processBtn, processing && styles.processBtnDisabled]}
            onPress={processInvoice}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Ionicons name="scan" size={20} color={colors.white} />
            )}
            <Text style={styles.processBtnText}>
              {processing ? 'Processando com IA...' : 'Processar com IA'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Result */}
      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>✅ Nota processada!</Text>
          {result.supplier && <InfoRow label="Fornecedor" value={result.supplier} />}
          {result.amount && <InfoRow label="Valor total" value={`R$ ${result.amount.toFixed(2)}`} />}
          {result.date && <InfoRow label="Data" value={result.date} />}
          {result.category && <InfoRow label="Categoria" value={result.category} />}
        </View>
      )}

      {/* WhatsApp tip */}
      <View style={styles.tipCard}>
        <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
        <Text style={styles.tipText}>
          Você também pode enviar a foto da NF direto pelo WhatsApp para registrar automaticamente!
        </Text>
      </View>
    </ScrollView>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '700', color: colors.gray[900], marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.gray[500], marginBottom: 24 },
  pickRow: { flexDirection: 'row', gap: 12 },
  pickBtn: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  pickLabel: { fontSize: 14, fontWeight: '600', color: colors.gray[700] },
  preview: { width: '100%', height: 240, borderRadius: 14, marginBottom: 12 },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  clearText: { color: colors.gray[500], fontSize: 14 },
  harvestSelector: { marginBottom: 16 },
  selectorLabel: { fontSize: 14, fontWeight: '600', color: colors.gray[700], marginBottom: 8 },
  harvestOption: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  harvestSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  harvestOptionText: { fontSize: 14, color: colors.gray[700] },
  processBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  processBtnDisabled: { opacity: 0.6 },
  processBtnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  resultCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    marginBottom: 16,
  },
  resultTitle: { fontSize: 16, fontWeight: '700', color: colors.gray[900], marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  infoLabel: { fontSize: 13, color: colors.gray[500] },
  infoValue: { fontSize: 13, fontWeight: '600', color: colors.gray[800] },
  tipCard: {
    backgroundColor: '#dcfce7',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  tipText: { flex: 1, fontSize: 13, color: colors.gray[700], lineHeight: 20 },
})
