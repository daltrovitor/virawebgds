// Hello World
"use client"

import type React from "react"
import { useId } from "react"
import { motion, LayoutGroup } from "motion/react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { VwoLogo } from "@/components/brand/vwo-logo"
import { DASHBOARD_NAV, type DashboardTabId } from "./nav-config"

export interface DashboardSidebarProps {
  activeTab: DashboardTabId
  onSelect: (tab: DashboardTabId) => void
  /** Indicadores discretos por aba (ex.: tutorial pendente). */
  markers?: Partial<Record<DashboardTabId, "dot" | string>>
  footer?: React.ReactNode
  /** Desativa a animação de entrada da logo (ex.: demo embutida). */
  staticLogo?: boolean
  className?: string
}

export function DashboardSidebar({ activeTab, onSelect, markers = {}, footer, staticLogo, className }: DashboardSidebarProps) {
  const t = useTranslations("dashboard.sidebar")
  const layoutScope = useId()

  return (
    <div className={cn("flex h-full w-full flex-col bg-sidebar", className)}>
      <div className="flex h-16 shrink-0 items-center px-5">
        <VwoLogo variant="stacked" animate={staticLogo ? "none" : "mount"} markClassName="w-8" />
      </div>

      <LayoutGroup id={layoutScope}>
        <nav aria-label={t("navLabel")} className="scrollbar-visible flex-1 overflow-y-auto px-3 pb-6" data-lenis-prevent>
          {DASHBOARD_NAV.map((group) => (
            <div key={group.groupKey} className="pt-5 first:pt-2">
              <p className="px-3 pb-2 font-display text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t(`groups.${group.groupKey}`)}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.id === activeTab
                  const Icon = item.icon
                  const marker = markers[item.id]
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(item.id)}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "group relative flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-left text-[14px] transition-colors duration-200 lg:min-h-10",
                          isActive ? "text-ink font-semibold" : "text-ink-soft hover:text-ink hover:bg-surface",
                        )}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="vwo-nav-active"
                            className="absolute inset-0 rounded-sm bg-accent"
                            transition={{ type: "spring", stiffness: 420, damping: 36 }}
                            aria-hidden
                          >
                            <span className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-primary" />
                          </motion.span>
                        )}
                        <Icon
                          className={cn(
                            "relative h-[18px] w-[18px] shrink-0 transition-colors",
                            isActive ? "text-primary" : "text-muted-foreground group-hover:text-ink-soft",
                          )}
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        <span className="relative truncate">{t(item.labelKey)}</span>
                        {marker === "dot" && (
                          <span className="relative ml-auto h-1.5 w-1.5 rounded-full bg-primary" aria-label={t("pending")} />
                        )}
                        {marker && marker !== "dot" && (
                          <span className="relative ml-auto rounded-sm border border-border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {marker}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </LayoutGroup>

      {footer && <div className="shrink-0 border-t border-hairline p-3">{footer}</div>}
    </div>
  )
}

export default DashboardSidebar
