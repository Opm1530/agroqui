// Shared types between API and Web

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'COOPERATIVE' | 'PRODUCER'
export type PlanType = 'BASIC' | 'PRO' | 'COOPERATIVE' | 'CUSTOM'
export type SubscriptionStatus = 'ACTIVE' | 'INACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED'
export type EntryType = 'INCOME' | 'EXPENSE'
export type EntryCategory =
  | 'DEFENSIVE' | 'FERTILIZER' | 'SEED' | 'FUEL'
  | 'MACHINERY_MAINTENANCE' | 'LABOR' | 'LEASE' | 'FREIGHT_DRYING'
  | 'PRODUCTION_SALE' | 'OTHER_INCOME' | 'OTHER_EXPENSE'
export type HarvestStatus = 'PLANNING' | 'ACTIVE' | 'HARVESTED' | 'CLOSED'
export type AlertType = 'COST_ABOVE_TARGET' | 'LOW_BALANCE' | 'INSTALLMENT_DUE' | 'CUSTOM'
export type WhatsappProvider = 'EVOLUTION' | 'OFFICIAL'
export type AiProvider = 'OPENAI' | 'ANTHROPIC'

export const ENTRY_CATEGORY_LABELS: Record<EntryCategory, string> = {
  DEFENSIVE: 'Defensivo',
  FERTILIZER: 'Fertilizante/Corretivo',
  SEED: 'Semente',
  FUEL: 'Combustível',
  MACHINERY_MAINTENANCE: 'Manutenção Maquinário',
  LABOR: 'Mão de Obra',
  LEASE: 'Arrendamento',
  FREIGHT_DRYING: 'Frete/Secagem',
  PRODUCTION_SALE: 'Venda de Produção',
  OTHER_INCOME: 'Outras Receitas',
  OTHER_EXPENSE: 'Outras Despesas',
}
