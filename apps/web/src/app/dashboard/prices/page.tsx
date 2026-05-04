'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  TrendingUp, TrendingDown, Minus, Search, Store, MapPin,
  RefreshCw, BarChart3, Package, ChevronDown, ChevronUp, X,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts'

// ─── Category labels ──────────────────────────────────────────────────────────
const CAT_LABEL: Record<string, string> = {
  FUEL: 'Combustível', FERTILIZER: 'Fertilizante', SEED: 'Semente',
  DEFENSIVE: 'Defensivo', MACHINERY_MAINTENANCE: 'Maquinário',
  LABOR: 'Mão de Obra', LEASE: 'Arrendamento', FREIGHT_DRYING: 'Frete',
  OTHER_EXPENSE: 'Outros',
}
const CAT_COLOR: Record<string, string> = {
  FUEL: '#ea580c', FERTILIZER: '#d97706', SEED: '#0891b2',
  DEFENSIVE: '#16a34a', MACHINERY_MAINTENANCE: '#7c3aed',
  LABOR: '#be185d', FREIGHT_DRYING: '#475569', OTHER_EXPENSE: '#64748b',
}

// ─── Custom chart tooltip ─────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 shadow-xl rounded-xl p-3 text-sm min-w-[140px]">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="font-bold text-gray-900">R$ {Number(payload[0].value).toFixed(2)}/{payload[0]?.payload?.unit ?? ''}</p>
    </div>
  )
}

// ─── Price History Modal ──────────────────────────────────────────────────────
function PriceHistoryModal({
  supplier, product, unit, color, onClose,
}: {
  supplier: string; product: string; unit: string | null; color: string; onClose: () => void
}) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['price-history', supplier, product],
    queryFn: () =>
      api.get('/public/price-index/history', { params: { supplier, product } })
        .then((r) => r.data),
  })

  const chartData = (history as any[]).map((h: any) => ({
    date: new Date(h.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    price: h.price,
    unit: h.unit,
  }))

  const prices = chartData.map((d) => d.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0
  const latest = prices[prices.length - 1]
  const previous = prices[prices.length - 2]
  const trend = previous ? ((latest - previous) / previous) * 100 : 0

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <p className="text-xs text-gray-400 font-medium">{supplier}</p>
          </div>
          <h2 className="text-xl font-bold text-gray-900">{product}</h2>
          {unit && <p className="text-sm text-gray-400">por {unit}</p>}
        </div>

        {/* Stats row */}
        {prices.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Último preço', value: `R$ ${latest?.toFixed(2)}`, highlight: true },
              { label: 'Variação', value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`, up: trend > 0 },
              { label: 'Mínimo', value: `R$ ${minPrice.toFixed(2)}` },
              { label: 'Máximo', value: `R$ ${maxPrice.toFixed(2)}` },
            ].map(({ label, value, highlight, up }) => (
              <div key={label} className="bg-gray-50 rounded-2xl p-3">
                <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
                <p className={`text-base font-bold ${highlight ? 'text-gray-900' : up === true ? 'text-red-500' : up === false ? 'text-green-600' : 'text-gray-700'}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Chart */}
        {isLoading ? (
          <div className="h-48 bg-gray-100 animate-pulse rounded-2xl" />
        ) : chartData.length < 2 ? (
          <div className="h-48 flex items-center justify-center text-gray-300 flex-col gap-2">
            <BarChart3 className="w-8 h-8" />
            <p className="text-sm">Dados insuficientes para gráfico</p>
            <p className="text-xs">({chartData.length} registro{chartData.length !== 1 ? 's' : ''})</p>
          </div>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => `R$${v.toFixed(0)}`}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine y={avgPrice} stroke="#94a3b8" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={color}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: color }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="text-[11px] text-gray-400 text-center mt-3">
          Dados anonimizados · {history.length} registro{history.length !== 1 ? 's' : ''} de produtores da região
        </p>
      </div>
    </div>
  )
}

// ─── Supplier card ────────────────────────────────────────────────────────────
function SupplierCard({ supplier: s }: { supplier: any }) {
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState<{ product: string; unit: string | null } | null>(null)

  const daysAgo = Math.floor(
    (Date.now() - new Date(s.lastUpdate).getTime()) / (1000 * 60 * 60 * 24)
  )
  const freshness = daysAgo === 0 ? 'Hoje' : daysAgo === 1 ? 'Ontem' : `${daysAgo} dias atrás`

  const visibleProducts = expanded ? s.products : s.products.slice(0, 3)

  return (
    <>
      <div className="card p-5 hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
            <Store className="w-5 h-5 text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-sm truncate">{s.supplier}</h3>
            {(s.city || s.state) && (
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />
                {[s.city, s.state].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-gray-400 shrink-0">
            <RefreshCw className="w-3 h-3" />
            {freshness}
          </div>
        </div>

        {/* Products */}
        <div className="space-y-2">
          {visibleProducts.map((p: any) => {
            const color = CAT_COLOR[p.category] ?? '#64748b'
            return (
              <button
                key={`${p.product}___${p.unit}`}
                onClick={() => setSelected({ product: p.product, unit: p.unit })}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left group"
              >
                <div
                  className="w-2 h-8 rounded-full shrink-0"
                  style={{ backgroundColor: color + '33' }}
                >
                  <div className="w-full rounded-full" style={{ backgroundColor: color, height: '50%' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.product}</p>
                  <p className="text-[11px] text-gray-400">
                    {CAT_LABEL[p.category] ?? p.category}
                    {p.priceCount > 1 ? ` · ${p.priceCount} registros` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">
                    R$ {Number(p.latestPrice).toFixed(2)}
                  </p>
                  {p.unit && <p className="text-[11px] text-gray-400">/{p.unit}</p>}
                </div>
                <BarChart3 className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors shrink-0" />
              </button>
            )
          })}
        </div>

        {s.products.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 w-full text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {expanded
              ? <><ChevronUp className="w-3 h-3" /> Mostrar menos</>
              : <><ChevronDown className="w-3 h-3" /> +{s.products.length - 3} produto{s.products.length - 3 > 1 ? 's' : ''}</>
            }
          </button>
        )}
      </div>

      {selected && (
        <PriceHistoryModal
          supplier={s.supplier}
          product={selected.product}
          unit={selected.unit}
          color={CAT_COLOR[s.products.find((p: any) => p.product === selected.product)?.category ?? ''] ?? '#16a34a'}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PricesPage() {
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['price-suppliers'],
    queryFn: () => api.get('/public/price-index/suppliers').then((r) => r.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['price-stats'],
    queryFn: () => api.get('/public/price-index/stats').then((r) => r.data),
  })

  const filtered = useMemo(() => {
    let list = suppliers as any[]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((s: any) =>
        s.supplier?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.products?.some((p: any) => p.product?.toLowerCase().includes(q))
      )
    }
    if (filterCategory) {
      list = list.filter((s: any) =>
        s.products?.some((p: any) => p.category === filterCategory)
      )
    }
    return list
  }, [suppliers, search, filterCategory])

  const categories = useMemo(() => {
    const cats = new Set<string>()
    ;(suppliers as any[]).forEach((s: any) =>
      s.products?.forEach((p: any) => cats.add(p.category))
    )
    return Array.from(cats)
  }, [suppliers])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Base de Preços</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Preços reais de insumos coletados automaticamente das notas fiscais
          </p>
        </div>
        {stats && (
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-xl font-bold text-gray-900">{stats.totalSuppliers}</p>
              <p className="text-xs text-gray-400">Estabelecimentos</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-xl font-bold text-gray-900">{stats.totalRecords}</p>
              <p className="text-xs text-gray-400">Registros</p>
            </div>
            {stats.lastUpdate && (
              <>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-900">
                    {new Date(stats.lastUpdate).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-xs text-gray-400">Última atualização</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="bg-primary-50 border border-primary-100 rounded-2xl px-5 py-3.5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
          <Package className="w-4 h-4 text-primary-700" />
        </div>
        <div>
          <p className="text-sm font-semibold text-primary-800">Como funciona</p>
          <p className="text-xs text-primary-600 mt-0.5">
            Quando qualquer produtor envia uma nota fiscal pelo WhatsApp, extraímos automaticamente o preço dos insumos e atualizamos esta base. Os dados são anônimos — nunca mostramos quem comprou.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar fornecedor, produto, cidade..."
            className="input pl-10"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="input sm:w-48"
        >
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c} value={c}>{CAT_LABEL[c] ?? c}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card h-48 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center text-gray-300">
          <Store className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-semibold text-gray-400">
            {(suppliers as any[]).length === 0
              ? 'Nenhum preço registrado ainda'
              : 'Nenhum resultado para esta busca'}
          </p>
          {(suppliers as any[]).length === 0 && (
            <p className="text-sm text-gray-300 mt-1 max-w-xs mx-auto">
              Os preços são preenchidos automaticamente quando produtores enviam notas fiscais pelo WhatsApp.
            </p>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s: any) => (
            <SupplierCard key={s.supplier} supplier={s} />
          ))}
        </div>
      )}
    </div>
  )
}
