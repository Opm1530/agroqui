'use client'

import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { api, formatCurrency } from '@/lib/api'
import { useParams } from 'next/navigation'
import {
  TrendingUp, TrendingDown, Target, ArrowLeft, Sprout,
  Droplets, Flame, Wrench, Users, Home, Truck, DollarSign,
  ShoppingCart, BarChart3, CalendarDays, MapPin,
} from 'lucide-react'
import Link from 'next/link'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const LeafletMap = dynamic(() => import('@/components/map/LeafletMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-100 rounded-2xl animate-pulse" />,
})

// ─── Category config ──────────────────────────────────────────────────────────

interface CatConfig { label: string; icon: React.ElementType; color: string; bg: string }

const CAT: Record<string, CatConfig> = {
  DEFENSIVE:             { label: 'Defensivos',      icon: Sprout,        color: '#16a34a', bg: '#dcfce7' },
  FERTILIZER:            { label: 'Fertilizantes',   icon: Droplets,      color: '#d97706', bg: '#fef3c7' },
  SEED:                  { label: 'Sementes',         icon: Sprout,        color: '#0891b2', bg: '#cffafe' },
  FUEL:                  { label: 'Combustível',      icon: Flame,         color: '#ea580c', bg: '#ffedd5' },
  MACHINERY_MAINTENANCE: { label: 'Maquinário',       icon: Wrench,        color: '#7c3aed', bg: '#ede9fe' },
  LABOR:                 { label: 'Mão de Obra',      icon: Users,         color: '#be185d', bg: '#fce7f3' },
  LEASE:                 { label: 'Arrendamento',     icon: Home,          color: '#2563eb', bg: '#dbeafe' },
  FREIGHT_DRYING:        { label: 'Frete/Secagem',    icon: Truck,         color: '#475569', bg: '#f1f5f9' },
  OTHER_EXPENSE:         { label: 'Outras Despesas',  icon: DollarSign,    color: '#64748b', bg: '#f8fafc' },
  PRODUCTION_SALE:       { label: 'Venda de Produção',icon: ShoppingCart,  color: '#16a34a', bg: '#dcfce7' },
  OTHER_INCOME:          { label: 'Outras Receitas',  icon: TrendingUp,    color: '#0891b2', bg: '#cffafe' },
}

const ENTRY_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(CAT).map(([k, v]) => [k, v.label])
)

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-3 py-2 text-sm">
      <p className="font-semibold text-gray-800">{d.name}</p>
      <p className="text-gray-500">{formatCurrency(d.value)}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DrePage() {
  const { id } = useParams<{ id: string }>()

  const { data: dre, isLoading } = useQuery({
    queryKey: ['dre', id],
    queryFn: () => api.get(`/producer/dre/${id}`).then((r) => r.data),
  })

  // Fallback: se o DRE não retornar propertyId (servidor antigo), busca via lista de safras
  const { data: harvests = [] } = useQuery({
    queryKey: ['harvests'],
    queryFn: () => api.get('/producer/harvests').then((r) => r.data),
    enabled: !!dre && !dre?.harvest?.propertyId,
  })
  const propertyId: string | undefined =
    dre?.harvest?.propertyId ??
    (harvests as any[]).find((h: any) => h.id === id)?.propertyId

  const { data: plots = [], isLoading: plotsLoading } = useQuery({
    queryKey: ['plots', propertyId],
    queryFn: () =>
      api.get('/producer/plots', { params: { propertyId } }).then((r) => r.data),
    enabled: !!propertyId,
  })

  const { data: entries = [] } = useQuery({
    queryKey: ['entries', id],
    queryFn: () =>
      api.get('/producer/entries', { params: { harvestId: id, limit: 8 } }).then((r) => r.data.entries ?? []),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-gray-200 rounded-xl" />
        <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="card h-28" />)}</div>
        <div className="grid grid-cols-2 gap-4">{[...Array(2)].map((_, i) => <div key={i} className="card h-80" />)}</div>
      </div>
    )
  }
  if (!dre) return <p className="text-gray-500">Safra não encontrada</p>

  const expenseData = Object.entries(dre.expensesByCategory ?? {})
    .map(([cat, val]) => ({ name: CAT[cat]?.label ?? cat, value: val as number, cat, color: CAT[cat]?.color ?? '#94a3b8' }))
    .sort((a, b) => b.value - a.value)

  const totalExpenses = dre.summary.totalExpenses
  const isOverTarget = dre.harvest.targetCostPerHa && dre.summary.costPerHa > dre.harvest.targetCostPerHa
  const margin = Number(dre.summary.margin)
  const isProfit = dre.summary.netProfit >= 0

  // Score financeiro visual (0–100 based on margin, capped)
  const score = Math.min(100, Math.max(0, Math.round(margin)))

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/harvests"
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            DRE — {dre.harvest.crop} {dre.harvest.year}
          </h1>
          <p className="text-sm text-gray-400">{dre.harvest.propertyName} · {dre.harvest.hectares} ha</p>
        </div>
        <div className="ml-auto">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
            isProfit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {isProfit ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {isProfit ? 'Lucrativo' : 'Prejuízo'} · {dre.summary.margin}% de margem
          </span>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Receitas */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Receitas</span>
            <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(dre.summary.totalIncome)}</p>
          <p className="text-xs text-gray-400 mt-1">Total recebido</p>
        </div>

        {/* Despesas */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Despesas</span>
            <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(dre.summary.totalExpenses)}</p>
          <p className="text-xs text-gray-400 mt-1">Total de custos</p>
        </div>

        {/* Lucro */}
        <div className={`card p-5 ${isProfit ? '' : 'border-red-200 bg-red-50/50'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Resultado</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isProfit ? 'bg-primary-100' : 'bg-red-100'}`}>
              <BarChart3 className={`w-4 h-4 ${isProfit ? 'text-primary-600' : 'text-red-500'}`} />
            </div>
          </div>
          <p className={`text-2xl font-bold ${isProfit ? 'text-gray-900' : 'text-red-600'}`}>
            {formatCurrency(dre.summary.netProfit)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Lucro líquido</p>
        </div>

        {/* Custo/ha */}
        <div className={`card p-5 ${isOverTarget ? 'border-amber-200 bg-amber-50/50' : ''}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Custo/ha</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isOverTarget ? 'bg-amber-100' : 'bg-blue-100'}`}>
              <Target className={`w-4 h-4 ${isOverTarget ? 'text-amber-600' : 'text-blue-600'}`} />
            </div>
          </div>
          <p className={`text-2xl font-bold ${isOverTarget ? 'text-amber-600' : 'text-gray-900'}`}>
            {formatCurrency(dre.summary.costPerHa)}
          </p>
          {dre.harvest.targetCostPerHa && (
            <p className={`text-xs mt-1 font-medium ${isOverTarget ? 'text-amber-500' : 'text-gray-400'}`}>
              {isOverTarget ? '⚠️ Acima da' : '✓ Dentro da'} meta · {formatCurrency(dre.harvest.targetCostPerHa)}/ha
            </p>
          )}
        </div>
      </div>

      {/* ── Main Grid ──────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-5">

        {/* Left — Donut + Category list */}
        <div className="card p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Distribuição de Gastos</h2>
            {expenseData.length > 0 && (
              <span className="text-xs text-gray-400">{expenseData.length} categorias</span>
            )}
          </div>

          {expenseData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12 text-gray-300 flex-col gap-2">
              <BarChart3 className="w-10 h-10" />
              <p className="text-sm">Nenhuma despesa registrada</p>
            </div>
          ) : (
            <>
              {/* Donut chart */}
              <div className="relative">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={expenseData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {expenseData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-medium">Total gasto</p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(totalExpenses).replace('R$ ', 'R$ ')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Category breakdown */}
              <div className="space-y-2.5 mt-1">
                {expenseData.map((item) => {
                  const cfg = CAT[item.cat]
                  const Icon = cfg?.icon ?? DollarSign
                  const pct = totalExpenses > 0 ? (item.value / totalExpenses) * 100 : 0
                  return (
                    <div key={item.cat} className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: cfg?.bg ?? '#f1f5f9' }}
                      >
                        <Icon className="w-4 h-4" style={{ color: cfg?.color ?? '#64748b' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-700 truncate">{item.name}</span>
                          <span className="text-xs font-semibold text-gray-900 ml-2 shrink-0">{formatCurrency(item.value)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: cfg?.color ?? '#94a3b8' }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 w-10 text-right shrink-0">{pct.toFixed(1)}%</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Right — Map */}
        <div className="card overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Talhões da Propriedade</h2>
            {(plots as any[]).length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{(plots as any[]).length} talhões</span>
                {propertyId && (
                  <Link
                    href={`/dashboard/properties/${propertyId}/map`}
                    className="text-xs text-primary-600 hover:underline font-medium"
                  >
                    Editar mapa →
                  </Link>
                )}
              </div>
            )}
          </div>
          <div className="flex-1 min-h-[340px] relative">
            {plotsLoading ? (
              <div className="absolute inset-0 bg-gray-100 animate-pulse" />
            ) : (plots as any[]).length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 text-gray-300">
                <Home className="w-10 h-10" />
                <p className="text-sm font-medium">Nenhum talhão cadastrado</p>
                <Link
                  href="/dashboard/properties"
                  className="text-xs text-primary-600 hover:underline mt-0.5"
                >
                  Cadastrar talhões →
                </Link>
              </div>
            ) : (plots as any[]).every((p: any) => !p.boundary?.length) ? (
              /* Talhões existem mas sem polígono desenhado */
              <div className="absolute inset-0 flex items-center justify-center flex-col gap-3 text-gray-300 p-6">
                <MapPin className="w-10 h-10" />
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500">
                    {(plots as any[]).length} talhão{(plots as any[]).length > 1 ? 'ões' : ''} cadastrado{(plots as any[]).length > 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Nenhum polígono desenhado ainda</p>
                </div>
                {/* Lista dos talhões */}
                <div className="w-full max-w-xs space-y-1 mt-1">
                  {(plots as any[]).map((p: any, i: number) => (
                    <div key={p.id} className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5">
                      <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                      <span className="font-medium">{p.name}</span>
                      {p.hectares && <span className="ml-auto text-gray-400">{p.hectares} ha</span>}
                    </div>
                  ))}
                </div>
                {propertyId && (
                  <Link
                    href={`/dashboard/properties/${propertyId}/map`}
                    className="text-xs text-primary-600 hover:underline font-medium"
                  >
                    Desenhar polígonos no mapa →
                  </Link>
                )}
              </div>
            ) : (
              <LeafletMap plots={plots} readonly />
            )}
          </div>
        </div>
      </div>

      {/* ── Score + Recent entries ──────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* Score financeiro */}
        <div className="card p-6">
          <h2 className="font-bold text-gray-900 mb-4">Score Financeiro</h2>

          <div className="flex items-center gap-4 mb-5">
            {/* Ring */}
            <div className="relative w-24 h-24 shrink-0">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="30" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                <circle
                  cx="40" cy="40" r="30" fill="none"
                  stroke={score >= 60 ? '#16a34a' : score >= 30 ? '#d97706' : '#ef4444'}
                  strokeWidth="8"
                  strokeDasharray={`${(score / 100) * 188.4} 188.4`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-black text-gray-900">{score}%</span>
              </div>
            </div>

            <div className="space-y-2 flex-1">
              {[
                { label: 'Receitas', value: dre.summary.totalIncome, color: 'bg-green-500' },
                { label: 'Despesas', value: dre.summary.totalExpenses, color: 'bg-red-400' },
              ].map(({ label, value, color }) => {
                const total = dre.summary.totalIncome + dre.summary.totalExpenses
                const pct = total > 0 ? (value / total) * 100 : 0
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{label}</span>
                      <span className="font-medium text-gray-700">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Receita/ha', value: formatCurrency(dre.summary.totalIncome / (dre.harvest.hectares || 1)) },
              { label: 'Custo/ha',   value: formatCurrency(dre.summary.costPerHa) },
              { label: 'Lucro/ha',   value: formatCurrency(dre.summary.netProfit  / (dre.harvest.hectares || 1)) },
              { label: 'Margem',     value: `${dre.summary.margin}%` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-[11px] text-gray-400 font-medium mb-0.5">{label}</p>
                <p className="text-sm font-bold text-gray-800">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent entries */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Últimos Lançamentos</h2>
            <Link
              href={`/dashboard/entries?harvestId=${id}`}
              className="text-xs text-primary-600 hover:underline font-medium"
            >
              Ver todos →
            </Link>
          </div>

          {(entries as any[]).length === 0 ? (
            <div className="py-8 text-center text-gray-300">
              <CalendarDays className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Nenhum lançamento ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(entries as any[]).map((entry: any) => {
                const cfg = CAT[entry.category]
                const Icon = cfg?.icon ?? DollarSign
                const isIncome = entry.type === 'INCOME'
                return (
                  <div key={entry.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: cfg?.bg ?? '#f1f5f9' }}
                    >
                      <Icon className="w-4 h-4" style={{ color: cfg?.color ?? '#64748b' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {cfg?.label ?? entry.category}
                        {entry.supplier ? <span className="font-normal text-gray-400"> · {entry.supplier}</span> : null}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(entry.date).toLocaleDateString('pt-BR')}
                        {entry.plot?.name ? ` · ${entry.plot.name}` : ''}
                      </p>
                    </div>
                    <p className={`text-sm font-bold shrink-0 ${isIncome ? 'text-green-600' : 'text-gray-800'}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(entry.amount)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
