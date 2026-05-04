import axios from 'axios'

// Em produção, o Next.js faz proxy de /api/* → http://api:3001/api/* internamente.
// Em dev, aponta direto para localhost:3001.
const BASE_URL = typeof window === 'undefined'
  ? (process.env.API_URL ?? 'http://localhost:3001') + '/api'  // SSR / build
  : '/api'                                                       // browser → proxy

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('cdc_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('cdc_token')
      localStorage.removeItem('cdc_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('pt-BR')
}
