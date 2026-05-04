import axios from 'axios'
import * as SecureStore from 'expo-secure-store'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 30_000,
})

// Attach JWT automatically
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401 → clear token (handled in app navigator)
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync('auth_token')
      await SecureStore.deleteItemAsync('auth_user')
    }
    return Promise.reject(err)
  }
)
