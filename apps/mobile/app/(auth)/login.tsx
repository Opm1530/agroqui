import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert
} from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import { api } from '@/lib/api'
import { saveAuth } from '@/lib/auth'
import { colors } from '@/lib/colors'
import { Ionicons } from '@expo/vector-icons'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email.trim() || !password) return
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email: email.trim().toLowerCase(), password })
      await saveAuth(data.token, data.user)
      router.replace('/(tabs)')
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error ?? 'Email ou senha incorretos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoBox}>
          <Ionicons name="leaf" size={36} color={colors.white} />
        </View>
        <Text style={styles.title}>Contador do Campo</Text>
        <Text style={styles.subtitle}>Controle financeiro para produtores rurais</Text>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            placeholderTextColor={colors.gray[400]}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Senha</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.gray[400]}
              secureTextEntry={!showPassword}
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color={colors.gray[400]}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? 'Entrando...' : 'Entrar'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 40,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray[700],
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.gray[900],
    backgroundColor: colors.gray[50],
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyeBtn: {
    padding: 12,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
})
