import * as SecureStore from 'expo-secure-store'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  producerId?: string
}

export async function saveAuth(token: string, user: AuthUser) {
  await SecureStore.setItemAsync('auth_token', token)
  await SecureStore.setItemAsync('auth_user', JSON.stringify(user))
}

export async function getAuth(): Promise<{ token: string; user: AuthUser } | null> {
  const token = await SecureStore.getItemAsync('auth_token')
  const userJson = await SecureStore.getItemAsync('auth_user')
  if (!token || !userJson) return null
  return { token, user: JSON.parse(userJson) }
}

export async function clearAuth() {
  await SecureStore.deleteItemAsync('auth_token')
  await SecureStore.deleteItemAsync('auth_user')
}
