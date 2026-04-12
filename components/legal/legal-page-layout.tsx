"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowLeft,
  ChevronRight,
  Shield,
  FileText,
  Scale,
  Mail,
  MessageSquare,
  Menu,
  X,
  Globe,
  Check,
  ExternalLink,
  Lock,
  CheckCircle2,
} from "lucide-react"
import LanguageToggle from "@/components/language-toggle"
import { useTranslations, useLocale } from 'next-intl'

// ─── Types ──────────────────────────────────────────────────────
export interface LegalSection {
  id: string
  title: string
  icon?: React.ReactNode
  content: React.ReactNode
}

interface LegalPageLayoutProps {
  /** Page title shown in hero */
  title: string
  /** Short description in hero */
  description: string
  /** ISO date string for "last updated" */
  lastUpdated: string
  /** The page type badge label */
  badgeLabel: string
  /** Icon for the badge */
  badgeIcon: React.ReactNode
  /** Array of sections */
  sections: LegalSection[]
  /** Links to other legal pages shown in footer */
  relatedPages: { href: string; label: string; icon: React.ReactNode }[]
}

// ─── Component ──────────────────────────────────────────────────
export default function LegalPageLayout({
  title,
  description,
  lastUpdated,
  badgeLabel,
  badgeIcon,
  sections,
  relatedPages,
}: LegalPageLayoutProps) {
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.id ?? "")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const t = useTranslations('legal.layout')
  const locale = useLocale()

  // Intersection observer highlight
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0.1 }
    )
    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [sections])

  const scrollToSection = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" })
    setMobileMenuOpen(false)
  }

  const formattedDate = new Date(lastUpdated).toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

  return (
    <div className="min-h-screen bg-[#fafbfc] text-slate-900 transition-colors duration-300">
      {/* ─── Top bar ─── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{t('backToHome')}</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <LanguageToggle variant="compact" />
            {/* Mobile TOC toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              aria-label={t('sectionMenu')}
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* ─── Mobile TOC overlay ─── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-0 top-14 z-40 bg-white border-b border-slate-200 shadow-xl lg:hidden max-h-[70vh] overflow-y-auto"
          >
            <nav className="p-4 space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-3 ${
                    activeSection === section.id
                      ? "bg-primary/10 text-primary"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {section.icon && <span className="flex-shrink-0 opacity-70">{section.icon}</span>}
                  {section.title}
                </button>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden border-b border-slate-200/60">
        {/* Background pattern */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm mb-6">
              {badgeIcon}
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                {badgeLabel}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-4 max-w-3xl">
              {title}
            </h1>
            <p className="text-lg sm:text-xl text-slate-500 max-w-2xl leading-relaxed font-light">
              {description}
            </p>

            {/* Last updated */}
            <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {t('lastUpdated')}: {formattedDate}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Content area ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="flex gap-12 lg:gap-16">
          {/* Sticky sidebar – desktop */}
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-20">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 px-4">
                {t('index')}
              </p>
              <nav className="space-y-1">
                {sections.map((section, idx) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`group w-full text-left px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 flex items-center gap-3 ${
                      activeSection === section.id
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    }`}
                  >
                    <span className="flex-shrink-0 text-[11px] font-bold text-slate-300 w-5 text-right">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate">{section.title}</span>
                    <ChevronRight
                      className={`w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity ${
                        activeSection === section.id ? "opacity-100" : ""
                      }`}
                    />
                  </button>
                ))}
              </nav>

              {/* Trust badge */}
              <div className="mt-8 p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="text-sm font-bold text-emerald-700">{t('protectedData')}</span>
                </div>
                <p className="text-xs text-emerald-600/80 leading-relaxed">
                  {t('protectedDataDesc')}
                </p>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            <div className="space-y-10">
              {sections.map((section, idx) => (
                <motion.section
                  key={section.id}
                  id={section.id}
                  ref={(el) => { sectionRefs.current[section.id] = el }}
                  className="scroll-mt-24"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.1 }}
                  transition={{ duration: 0.5, delay: 0.05 }}
                >
                  <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/60 shadow-[0_1px_3px_rgb(0,0,0,0.04)] overflow-hidden hover:shadow-[0_4px_20px_rgb(0,0,0,0.06)] transition-shadow duration-300">
                    {/* Section header */}
                    <div className="flex items-center gap-4 px-6 sm:px-8 pt-6 sm:pt-8 pb-4">
                      <span className="text-xs font-bold text-slate-300">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                        {section.title}
                      </h2>
                    </div>
                    {/* Section body */}
                    <div className="px-6 sm:px-8 pb-6 sm:pb-8">
                      <div className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:leading-relaxed prose-p:text-slate-600 prose-li:text-slate-600 prose-strong:text-slate-800 prose-a:text-primary prose-a:no-underline hover:prose-a:underline text-[15px]">
                        {section.content}
                      </div>
                    </div>
                  </div>
                </motion.section>
              ))}
            </div>
          </main>
        </div>
      </div>

      {/* ─── Contact CTA ─── */}
      <section className="border-t border-slate-200/60 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
              {t('contactTitle')}
            </h3>
            <p className="text-slate-500 mb-8 max-w-lg mx-auto leading-relaxed">
              {t('contactDesc')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="mailto:contato@viraweb.online"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5"
              >
                <Mail className="w-4 h-4" />
                contato@viraweb.online
              </a>
              <a
                href="https://wa.me/5500000000000"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200 transition-all border border-slate-200"
              >
                <MessageSquare className="w-4 h-4" />
                WhatsApp
                <ExternalLink className="w-3 h-3 opacity-50" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-slate-200/60 bg-[#fafbfc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Image src="/viraweb6.png" alt="ViraWeb" width={32} height={20} className="w-8 h-auto" />
              <span className="text-sm font-semibold text-slate-700">ViraWeb</span>
              <span className="text-xs text-slate-400">© {new Date().getFullYear()}</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4">
              {relatedPages.map((page) => (
                <Link
                  key={page.href}
                  href={page.href}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-primary transition-colors px-3 py-2 rounded-lg hover:bg-slate-100"
                >
                  {page.icon}
                  {page.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── Reusable sub-components for content ─────────────────────────

/** Info box (blue/neutral) */
export function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 flex gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
      <div className="flex-shrink-0 mt-0.5">
        <CheckCircle2 className="w-5 h-5 text-blue-500" />
      </div>
      <div className="text-sm text-blue-700 leading-relaxed">{children}</div>
    </div>
  )
}

/** Warning box (amber) */
export function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 flex gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
      <div className="flex-shrink-0 mt-0.5">
        <Shield className="w-5 h-5 text-amber-500" />
      </div>
      <div className="text-sm text-amber-700 leading-relaxed">{children}</div>
    </div>
  )
}

/** Data list */
export function DataList({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="my-4 rounded-xl border border-slate-200 overflow-hidden">
      {items.map((item, idx) => (
        <div
          key={idx}
          className={`flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3 text-sm ${
            idx % 2 === 0 ? "bg-slate-50" : "bg-white"
          }`}
        >
          <span className="font-semibold text-slate-700 sm:w-48 flex-shrink-0">
            {item.label}
          </span>
          <span className="text-slate-500">{item.value}</span>
        </div>
      ))}
    </div>
  )
}
