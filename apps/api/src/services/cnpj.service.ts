import { prisma } from '../config/prisma'
import { EntryCategory } from '@prisma/client'

interface BrasilApiCnpj {
  cnpj: string
  razao_social: string
  nome_fantasia?: string
  municipio?: string
  uf?: string
  situacao_cadastral?: string
}

interface SupplierInfo {
  /** Nome fantasia, ou razão social se fantasia estiver vazio */
  displayName: string
  /** Razão social completa */
  legalName: string
  city: string | null
  state: string | null
}

function cleanCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, '')
}

/**
 * Lookup supplier info by CNPJ.
 * Uses SupplierCache (DB) as primary cache to avoid repeat API calls.
 * Falls back to BrasilAPI when not cached.
 * Returns null if CNPJ is invalid or lookup fails.
 */
export async function lookupSupplier(cnpj: string): Promise<SupplierInfo | null> {
  const digits = cleanCnpj(cnpj)
  if (digits.length !== 14) return null

  // ── 1. Check DB cache ─────────────────────────────────────────────────────
  const cached = await prisma.supplierCache.findUnique({ where: { cnpj: digits } })
  if (cached && (cached.tradeName || cached.name)) {
    // Refresh usage count asynchronously
    prisma.supplierCache
      .update({ where: { cnpj: digits }, data: { usageCount: { increment: 1 } } })
      .catch(() => {})

    return {
      displayName: cached.tradeName || cached.name || digits,
      legalName: cached.name || cached.tradeName || digits,
      city: cached.city,
      state: cached.state,
    }
  }

  // ── 2. Call BrasilAPI ─────────────────────────────────────────────────────
  try {
    const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      headers: { 'User-Agent': 'ContadorDoCampo/1.0' },
      signal: AbortSignal.timeout(8000),
    })

    if (!resp.ok) {
      console.warn(`[cnpj] BrasilAPI returned ${resp.status} for ${digits}`)
      return null
    }

    const data = (await resp.json()) as BrasilApiCnpj

    const legalName = data.razao_social?.trim() ?? ''
    const tradeName = data.nome_fantasia?.trim() || ''
    const city = data.municipio?.trim() || null
    const state = data.uf?.trim() || null
    const displayName = tradeName || legalName

    // ── 3. Upsert cache ───────────────────────────────────────────────────
    await prisma.supplierCache.upsert({
      where: { cnpj: digits },
      create: {
        cnpj: digits,
        name: legalName || null,
        tradeName: tradeName || null,
        city,
        state,
        category: EntryCategory.OTHER_EXPENSE, // default; updated by usage context
        usageCount: 1,
      },
      update: {
        name: legalName || undefined,
        tradeName: tradeName || undefined,
        city: city ?? undefined,
        state: state ?? undefined,
        usageCount: { increment: 1 },
      },
    })

    return { displayName, legalName, city, state }
  } catch (err) {
    console.warn(`[cnpj] lookup failed for ${digits}:`, err)
    return null
  }
}

/**
 * Format a CNPJ string to XX.XXX.XXX/XXXX-XX display format.
 */
export function formatCnpj(cnpj: string): string {
  const d = cleanCnpj(cnpj)
  if (d.length !== 14) return cnpj
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}
