'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, formatCurrency } from '@/lib/api'
import {
  MessageSquare, Camera, BarChart2, Bell, Check, ArrowRight,
  Wheat, Star, ChevronRight, ChevronLeft, Plus, Minus, ArrowUpRight,
  Instagram, Twitter, Facebook, Mail
} from 'lucide-react'

// ─── Data ────────────────────────────────────────────────────────────────────

const services = [
  {
    tag: 'IA + WhatsApp',
    title: 'Nota Fiscal pelo WhatsApp',
    desc: 'Foto da NF → IA extrai e classifica automaticamente. Sem digitar nada.',
    img: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=600&q=80',
    dark: false,
  },
  {
    tag: 'Relatórios',
    title: 'DRE Automático por Safra',
    desc: 'Demonstrativo completo: receitas, custos por categoria e custo por hectare.',
    img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80',
    dark: true,
  },
  {
    tag: 'Inteligência',
    title: 'Agente IA Conversacional',
    desc: 'Pergunte em português: "Quanto gastei de defensivo no talhão A esse mês?"',
    img: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=600&q=80',
    dark: false,
  },
  {
    tag: 'Controle',
    title: 'Alertas Inteligentes',
    desc: 'Aviso automático quando custo/ha ultrapassa a meta ou saldo fica baixo.',
    img: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=600&q=80',
    dark: true,
  },
]

const testimonials = [
  {
    name: 'João Marcos',
    role: 'Produtor de soja · 320 ha · MT',
    text: '"Antes eu não sabia quanto custava produzir uma saca. Hoje o sistema me manda o número na hora pelo WhatsApp."',
    stars: 5,
  },
  {
    name: 'Ana Paula Ribeiro',
    role: 'Produtora · Milho e algodão · GO',
    text: '"Fotografo a nota fiscal no campo mesmo, direto no WhatsApp. Em 30 segundos o lançamento já está no sistema."',
    stars: 5,
  },
  {
    name: 'Carlos Mendonça',
    role: 'Cooperativa Cerrado · 80 produtores',
    text: '"Implantamos para toda a cooperativa. Os produtores adoraram — não precisam aprender nenhum app novo."',
    stars: 5,
  },
]

const faqs = [
  {
    q: 'Preciso baixar algum aplicativo?',
    a: 'Não. Tudo funciona pelo WhatsApp que você já usa. Para o painel completo, acesse pelo navegador — sem instalação.',
  },
  {
    q: 'Como a IA lê as notas fiscais?',
    a: 'Você fotografa a NF e manda no WhatsApp. O sistema usa visão computacional (GPT-4o) para extrair fornecedor, valor, itens e data automaticamente.',
  },
  {
    q: 'Funciona para qualquer tipo de produto rural?',
    a: 'Sim. Soja, milho, algodão, café, pecuária — qualquer cultura. As categorias se adaptam ao que você produz.',
  },
  {
    q: 'E se eu quiser cancelar?',
    a: 'Cancele quando quiser, sem multa. Seus dados ficam disponíveis para exportação por 90 dias após o cancelamento.',
  },
  {
    q: 'Posso usar pela cooperativa?',
    a: 'Sim. O plano Cooperativa inclui painel white-label com o nome da sua cooperativa, subdomínio próprio e gestão de todos os produtores.',
  },
]

const planFeatureLabels: Record<string, string> = {
  hasOcr: 'OCR de notas fiscais (foto)',
  hasAiAgent: 'Agente IA no WhatsApp',
  hasAutoDre: 'DRE automático por safra',
  hasAlerts: 'Alertas inteligentes',
  hasWhitelabel: 'White-label para cooperativa',
  hasPrioritySupport: 'Suporte prioritário',
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-200 py-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 text-left"
      >
        <span className="font-medium text-gray-900 text-sm">{q}</span>
        <span className="shrink-0 w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center">
          {open ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
        </span>
      </button>
      {open && <p className="mt-3 text-sm text-gray-500 leading-relaxed">{a}</p>}
    </div>
  )
}

function PricingSection() {
  const { data: plans } = useQuery({
    queryKey: ['public-plans'],
    queryFn: () => api.get('/public/plans').then((r) => r.data),
  })

  const visible = (plans ?? []).filter((p: any) => p.type !== 'CUSTOM')

  return (
    <section id="planos" className="py-24 bg-gray-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-14 gap-4">
          <div>
            <span className="inline-block text-xs font-semibold text-primary-700 bg-primary-100 px-3 py-1 rounded-full mb-3 uppercase tracking-wider">
              Investimento
            </span>
            <h2 className="text-4xl font-bold text-gray-900">
              Planos que <em className="not-italic text-primary-600">cabem</em> na fazenda
            </h2>
          </div>
          <p className="text-gray-400 text-sm max-w-xs">
            Sem taxa de setup. Sem fidelidade. Cancele quando quiser.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {visible.map((plan: any) => {
            const highlight = plan.type === 'PRO'
            const featureEntries = Object.entries(planFeatureLabels)
              .filter(([key]) => key !== 'hasWhitelabel' || plan.hasWhitelabel)

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-8 flex flex-col transition-transform ${
                  highlight
                    ? 'bg-primary-700 text-white shadow-2xl shadow-primary-900/30 scale-105'
                    : 'bg-white border border-gray-200 hover:-translate-y-1'
                }`}
              >
                {highlight && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-bold px-4 py-1 rounded-full">
                    ✨ Mais popular
                  </span>
                )}

                <p className={`text-xs font-semibold uppercase tracking-wider mb-4 ${highlight ? 'text-primary-200' : 'text-primary-600'}`}>
                  {plan.name}
                </p>

                <div className="flex items-end gap-1 mb-6">
                  <span className={`text-5xl font-bold tracking-tight ${highlight ? 'text-white' : 'text-gray-900'}`}>
                    {formatCurrency(plan.priceMonthly)}
                  </span>
                  <span className={`mb-1.5 text-sm ${highlight ? 'text-primary-300' : 'text-gray-400'}`}>/mês</span>
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  {featureEntries.map(([key, label]) => {
                    const active = plan[key]
                    return (
                      <li key={key} className={`flex items-center gap-2.5 text-sm ${
                        active
                          ? highlight ? 'text-white' : 'text-gray-700'
                          : 'opacity-30 line-through'
                      }`}>
                        <Check className={`w-4 h-4 shrink-0 ${active ? (highlight ? 'text-primary-300' : 'text-primary-500') : 'opacity-30'}`} />
                        {label}
                      </li>
                    )
                  })}
                </ul>

                <Link
                  href={`/register?planId=${plan.id}`}
                  className={`w-full text-center py-3.5 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    highlight
                      ? 'bg-white text-primary-700 hover:bg-primary-50'
                      : 'bg-primary-700 text-white hover:bg-primary-800'
                  }`}
                >
                  Começar agora <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )
          })}
        </div>

        <p className="text-center text-sm text-gray-400 mt-10">
          Precisa de um plano personalizado para cooperativa?{' '}
          <a href="https://wa.me/5511999999999" className="text-primary-600 hover:underline font-medium">
            Fale com a gente →
          </a>
        </p>
      </div>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [testimonialIdx, setTestimonialIdx] = useState(0)
  const [serviceIdx, setServiceIdx] = useState(0)

  const t = testimonials[testimonialIdx]
  const visibleServices = services.slice(serviceIdx, serviceIdx + 3)

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary-700 rounded-xl flex items-center justify-center">
              <Wheat className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm tracking-tight">Contador do Campo</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {[
              { label: 'Início', href: '#' },
              { label: 'Funcionalidades', href: '#funcionalidades' },
              { label: 'Planos', href: '#planos' },
              { label: 'Depoimentos', href: '#depoimentos' },
              { label: 'FAQ', href: '#faq' },
            ].map((item) => (
              <a key={item.label} href={item.href} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                {item.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 hidden sm:block">
              Entrar
            </Link>
            <Link
              href="/register"
              className="bg-primary-700 text-white text-sm font-semibold px-5 py-2 rounded-full hover:bg-primary-800 transition-colors flex items-center gap-1.5"
            >
              Criar conta <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="pt-28 pb-24 px-6 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-emerald-50 -z-10" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-primary-100 rounded-full blur-3xl opacity-40 -z-10" />
        <div className="absolute bottom-0 left-20 w-64 h-64 bg-emerald-100 rounded-full blur-3xl opacity-30 -z-10" />

        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white border border-primary-200 text-primary-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-8 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
            BPO Financeiro com Inteligência Artificial
          </div>

          <h1 className="text-5xl md:text-[64px] font-bold text-gray-900 leading-[1.1] tracking-tight mb-6">
            Finança Rural<br />
            <em className="not-italic text-primary-600">Simplificada,</em><br />
            Colheitas Excepcionais
          </h1>

          <p className="text-lg text-gray-500 mb-10 max-w-xl mx-auto leading-relaxed">
            Mande a foto da nota fiscal pelo WhatsApp. A IA classifica, registra e
            gera o DRE da safra — sem planilha, sem contador, sem complicação.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="bg-primary-700 text-white font-semibold px-8 py-4 rounded-2xl hover:bg-primary-800 transition-all hover:-translate-y-0.5 shadow-lg shadow-primary-900/20 flex items-center justify-center gap-2"
            >
              Começar gratuitamente <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#planos"
              className="bg-white text-gray-700 font-semibold px-8 py-4 rounded-2xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
            >
              Ver planos
            </a>
          </div>

          <p className="text-xs text-gray-400 mt-5">Sem cartão de crédito · Teste grátis · Cancele quando quiser</p>
        </div>
      </section>

      {/* ── Por que nos escolher ─────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <span className="text-xs font-semibold text-primary-700 bg-primary-50 px-3 py-1 rounded-full uppercase tracking-wider">
              Vantagens
            </span>
            <h2 className="text-4xl font-bold text-gray-900 mt-4">
              Por que escolher o{' '}
              <em className="not-italic text-primary-600">Contador do Campo?</em>
            </h2>
          </div>

          {/* Mosaic grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 grid-rows-2 gap-4 h-auto md:h-[480px]">
            {/* Card 1 — grande */}
            <div className="col-span-2 row-span-2 relative rounded-3xl overflow-hidden bg-primary-700">
              <img
                src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&q=80"
                alt="Campo"
                className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-luminosity"
              />
              <div className="relative z-10 p-8 h-full flex flex-col justify-between">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">OCR de Notas Fiscais</h3>
                  <p className="text-primary-200 text-sm leading-relaxed">
                    Fotografe a NF no campo e a IA extrai todos os dados em segundos. Funciona mesmo com foto torta ou iluminação ruim.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="col-span-1 rounded-3xl bg-emerald-50 border border-emerald-100 p-6 flex flex-col justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1 text-sm">Agente IA 24h</h3>
                <p className="text-xs text-gray-500">Pergunte sobre seus custos em linguagem natural pelo WhatsApp.</p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="col-span-1 rounded-3xl overflow-hidden relative bg-gray-900">
              <img
                src="https://images.unsplash.com/photo-1543286386-713bdd548da4?w=400&q=80"
                alt="Análise"
                className="absolute inset-0 w-full h-full object-cover opacity-40"
              />
              <div className="relative z-10 p-6 h-full flex flex-col justify-end">
                <BarChart2 className="w-5 h-5 text-white mb-2" />
                <h3 className="font-bold text-white text-sm">DRE Automático</h3>
                <p className="text-xs text-gray-400 mt-1">Relatório completo por safra em 1 clique.</p>
              </div>
            </div>

            {/* Card 4 */}
            <div className="col-span-1 rounded-3xl bg-amber-50 border border-amber-100 p-6 flex flex-col justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Bell className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1 text-sm">Alertas Inteligentes</h3>
                <p className="text-xs text-gray-500">Receba aviso quando custo/ha ultrapassar a meta.</p>
              </div>
            </div>

            {/* Card 5 */}
            <div className="col-span-1 rounded-3xl bg-primary-900 p-6 flex flex-col justify-between">
              <div className="text-4xl font-black text-primary-400">+2.400</div>
              <div>
                <h3 className="font-bold text-white text-sm">Produtores ativos</h3>
                <p className="text-xs text-primary-300 mt-1">Confiando no sistema todo mês</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Texto sobre o produto ─────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-2xl md:text-3xl text-gray-700 font-medium leading-relaxed">
            Com mais de{' '}
            <span className="text-primary-700 font-bold">anos de experiência</span>{' '}
            no agro, desenvolvemos um sistema que{' '}
            <em>fala a língua do produtor</em>. Nossa missão é trazer
            controle financeiro de verdade para quem produz o alimento do Brasil —
            sem burocracia, sem planilha, sem contador.
          </p>
        </div>
      </section>

      {/* ── Serviços / Como funciona ─────────────────────────────────────── */}
      <section id="funcionalidades" className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <span className="text-xs font-semibold text-primary-700 bg-primary-50 px-3 py-1 rounded-full uppercase tracking-wider">
                Funcionalidades
              </span>
              <h2 className="text-4xl font-bold text-gray-900 mt-4">
                O que o sistema{' '}
                <em className="not-italic text-primary-600">faz por você</em>
              </h2>
            </div>
            <div className="hidden md:flex gap-2">
              <button
                onClick={() => setServiceIdx(Math.max(0, serviceIdx - 1))}
                disabled={serviceIdx === 0}
                className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setServiceIdx(Math.min(services.length - 3, serviceIdx + 1))}
                disabled={serviceIdx >= services.length - 3}
                className="w-10 h-10 rounded-full bg-primary-700 text-white flex items-center justify-center hover:bg-primary-800 disabled:opacity-30 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {visibleServices.map((s, i) => (
              <div key={s.title} className={`rounded-3xl overflow-hidden relative group ${s.dark ? 'bg-gray-900' : 'bg-gray-50 border border-gray-200'}`}>
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={s.img}
                    alt={s.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {s.dark && <div className="absolute inset-0 bg-gray-900/40" />}
                  <span className="absolute top-4 left-4 bg-white/90 text-gray-700 text-xs font-semibold px-3 py-1 rounded-full">
                    {s.tag}
                  </span>
                </div>
                <div className="p-6 flex items-end justify-between">
                  <div>
                    <h3 className={`font-bold mb-1 ${s.dark ? 'text-white' : 'text-gray-900'}`}>{s.title}</h3>
                    <p className={`text-sm leading-relaxed ${s.dark ? 'text-gray-400' : 'text-gray-500'}`}>{s.desc}</p>
                  </div>
                  <Link
                    href="/register"
                    className={`shrink-0 ml-4 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${s.dark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-primary-700 text-white hover:bg-primary-800'}`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center mt-8">
            <Link href="/register" className="text-primary-700 text-sm font-semibold hover:underline flex items-center gap-1">
              Ver todas as funcionalidades <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Depoimentos ─────────────────────────────────────────────────── */}
      <section id="depoimentos" className="py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <span className="text-xs font-semibold text-primary-700 bg-primary-100 px-3 py-1 rounded-full uppercase tracking-wider">
                Depoimentos
              </span>
              <h2 className="text-4xl font-bold text-gray-900 mt-4">
                O que os{' '}
                <em className="not-italic text-primary-600">Produtores</em> dizem
              </h2>
            </div>
            <div className="hidden md:flex gap-2">
              <button
                onClick={() => setTestimonialIdx(Math.max(0, testimonialIdx - 1))}
                disabled={testimonialIdx === 0}
                className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-white disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTestimonialIdx(Math.min(testimonials.length - 1, testimonialIdx + 1))}
                disabled={testimonialIdx === testimonials.length - 1}
                className="w-10 h-10 rounded-full bg-primary-700 text-white flex items-center justify-center hover:bg-primary-800 disabled:opacity-30 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((item, idx) => (
              <div
                key={item.name}
                onClick={() => setTestimonialIdx(idx)}
                className={`rounded-3xl p-7 cursor-pointer transition-all ${
                  idx === testimonialIdx
                    ? 'bg-primary-700 text-white shadow-xl shadow-primary-900/20 scale-[1.02]'
                    : 'bg-white border border-gray-200 hover:-translate-y-1'
                }`}
              >
                <div className="flex gap-0.5 mb-4">
                  {[...Array(item.stars)].map((_, i) => (
                    <Star key={i} className={`w-4 h-4 fill-current ${idx === testimonialIdx ? 'text-amber-300' : 'text-amber-400'}`} />
                  ))}
                  <span className={`ml-1 text-xs font-bold ${idx === testimonialIdx ? 'text-primary-200' : 'text-gray-400'}`}>
                    {item.stars}.0
                  </span>
                </div>

                <p className={`text-sm leading-relaxed mb-6 ${idx === testimonialIdx ? 'text-primary-100' : 'text-gray-600'}`}>
                  {item.text}
                </p>

                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${idx === testimonialIdx ? 'bg-white/20 text-white' : 'bg-primary-100 text-primary-700'}`}>
                    {item.name.charAt(0)}
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${idx === testimonialIdx ? 'text-white' : 'text-gray-900'}`}>{item.name}</p>
                    <p className={`text-xs ${idx === testimonialIdx ? 'text-primary-300' : 'text-gray-400'}`}>{item.role}</p>
                  </div>
                </div>

                {/* Quote mark */}
                <div className={`text-6xl font-serif leading-none absolute opacity-10 bottom-4 right-6 ${idx === testimonialIdx ? 'text-white' : 'text-primary-700'}`} aria-hidden>
                  "
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────── */}
      <PricingSection />

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-start">
          <div>
            <span className="text-xs font-semibold text-primary-700 bg-primary-50 px-3 py-1 rounded-full uppercase tracking-wider">
              Dúvidas
            </span>
            <h2 className="text-4xl font-bold text-gray-900 mt-4 mb-4">
              Perguntas<br />
              <em className="not-italic text-primary-600">Frequentes</em>
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Não encontrou sua dúvida? Fale com a gente pelo WhatsApp — respondemos em minutos.
            </p>
            <a
              href="https://wa.me/5511999999999"
              className="inline-flex items-center gap-2 bg-primary-700 text-white text-sm font-semibold px-5 py-3 rounded-2xl hover:bg-primary-800 transition-colors"
            >
              Falar no WhatsApp <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <div>
            {faqs.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Final ─────────────────────────────────────────────────────── */}
      <section className="mx-6 mb-6 rounded-3xl overflow-hidden relative min-h-[340px] flex items-center">
        <img
          src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1400&q=80"
          alt="Campo verde"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-primary-900/75" />

        <div className="relative z-10 max-w-2xl mx-auto text-center px-6 py-20">
          <h2 className="text-4xl font-bold text-white mb-4">
            Pronto para transformar o controle da sua fazenda?
          </h2>
          <p className="text-primary-200 mb-8">
            Cadastro em menos de 2 minutos. Sem cartão de crédito.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="bg-white text-primary-800 font-semibold px-8 py-4 rounded-2xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
              Começar gratuitamente <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="https://wa.me/5511999999999"
              className="bg-transparent text-white font-semibold px-8 py-4 rounded-2xl border border-white/40 hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              Falar com especialista
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="bg-gray-950 pt-16 pb-0 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 pb-12 border-b border-gray-800">
            {/* Newsletter */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
                  <Wheat className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-bold text-sm">Contador do Campo</span>
              </div>
              <p className="text-gray-500 text-xs leading-relaxed mb-4">
                BPO Financeiro com IA para produtores rurais brasileiros.
              </p>
              <div className="flex gap-3">
                {[Instagram, Twitter, Facebook, Mail].map((Icon, i) => (
                  <a key={i} href="#" className="w-8 h-8 rounded-full bg-gray-800 hover:bg-primary-700 flex items-center justify-center transition-colors">
                    <Icon className="w-3.5 h-3.5 text-gray-400 hover:text-white" />
                  </a>
                ))}
              </div>
            </div>

            {/* Quick links */}
            <div>
              <p className="text-white font-semibold text-xs uppercase tracking-wider mb-4">Links</p>
              <ul className="space-y-2.5">
                {['Início', 'Funcionalidades', 'Planos', 'Depoimentos', 'FAQ'].map((l) => (
                  <li key={l}>
                    <a href="#" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Solutions */}
            <div>
              <p className="text-white font-semibold text-xs uppercase tracking-wider mb-4">Soluções</p>
              <ul className="space-y-2.5">
                {['Produtor Individual', 'Cooperativa', 'Agente IA WhatsApp', 'OCR de NF', 'DRE Automático', 'Base de Preços'].map((l) => (
                  <li key={l}>
                    <a href="#" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Newsletter */}
            <div>
              <p className="text-white font-semibold text-xs uppercase tracking-wider mb-4">Newsletter</p>
              <p className="text-gray-500 text-xs mb-3 leading-relaxed">Receba dicas de gestão financeira rural toda semana.</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="seu@email.com"
                  className="flex-1 bg-gray-800 border border-gray-700 text-white text-xs px-3 py-2.5 rounded-xl placeholder-gray-600 focus:outline-none focus:border-primary-500"
                />
                <button className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors">
                  OK
                </button>
              </div>
            </div>
          </div>

          {/* Big brand wordmark */}
          <div className="py-6 flex items-center justify-between">
            <p className="text-gray-700 text-xs">© {new Date().getFullYear()} Contador do Campo. Todos os direitos reservados.</p>
            <div className="flex gap-4">
              <a href="#" className="text-gray-700 hover:text-gray-500 text-xs">Privacidade</a>
              <a href="#" className="text-gray-700 hover:text-gray-500 text-xs">Termos</a>
            </div>
          </div>
        </div>

        {/* Giant wordmark */}
        <div className="overflow-hidden">
          <p className="text-[clamp(48px,10vw,120px)] font-black text-gray-900 leading-none tracking-tighter text-center pb-0 select-none">
            Contador do Campo
          </p>
        </div>
      </footer>
    </div>
  )
}
