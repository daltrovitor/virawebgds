// Hello World
import type { LucideIcon } from "lucide-react"
import {
  BellRing,
  Building2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  HeadphonesIcon,
  LayoutDashboard,
  PlayCircle,
  Receipt,
  Settings,
  ShieldAlert,
  Smile,
  Sparkles,
  Tag,
  Target,
  TrendingUp,
  Upload,
  UserCog,
  Users,
  Wallet,
} from "lucide-react"

/** Identificadores de aba do dashboard (Notas, Checklist e Relatórios foram descontinuados). */
export type DashboardTabId =
  | "overview"
  | "appointments"
  | "patients"
  | "budgets"
  | "odontogram"
  | "treatments"
  | "anamnesis"
  | "dentalDocuments"
  | "financial"
  | "closing"
  | "reconciliation"
  | "price-table"
  | "professionals"
  | "goals"
  | "reminders"
  | "ai"
  | "import"
  | "subscriptions"
  | "support"
  | "tutorial"
  | "settings"

export interface DashboardNavItem {
  id: DashboardTabId
  /** Chave em `dashboard.sidebar`. */
  labelKey: string
  icon: LucideIcon
}

export interface DashboardNavGroup {
  /** Chave em `dashboard.sidebar.groups`. */
  groupKey: "desk" | "clinical" | "finance" | "management" | "account"
  items: DashboardNavItem[]
}

/**
 * Ordem espelha o fluxo da recepção odontológica: Mesa → Agenda → Pacientes → Orçamentos,
 * seguido do prontuário clínico, do financeiro e da gestão.
 */
export const DASHBOARD_NAV: DashboardNavGroup[] = [
  {
    groupKey: "desk",
    items: [
      { id: "overview", labelKey: "overview", icon: LayoutDashboard },
      { id: "appointments", labelKey: "appointments", icon: CalendarDays },
      { id: "patients", labelKey: "patients", icon: Users },
      { id: "budgets", labelKey: "budgets", icon: Receipt },
    ],
  },
  {
    groupKey: "clinical",
    items: [
      { id: "odontogram", labelKey: "odontogram", icon: Smile },
      { id: "treatments", labelKey: "treatments", icon: ClipboardList },
      { id: "anamnesis", labelKey: "anamnesis", icon: ShieldAlert },
      { id: "dentalDocuments", labelKey: "dentalDocuments", icon: FileText },
    ],
  },
  {
    groupKey: "finance",
    items: [
      { id: "financial", labelKey: "financial", icon: Wallet },
      { id: "closing", labelKey: "closing", icon: TrendingUp },
      { id: "reconciliation", labelKey: "bankReconciliation", icon: Building2 },
      { id: "price-table", labelKey: "priceTable", icon: Tag },
    ],
  },
  {
    groupKey: "management",
    items: [
      { id: "professionals", labelKey: "professionals", icon: UserCog },
      { id: "goals", labelKey: "goals", icon: Target },
      { id: "reminders", labelKey: "reminders", icon: BellRing },
      { id: "ai", labelKey: "ai", icon: Sparkles },
      { id: "import", labelKey: "import", icon: Upload },
    ],
  },
  {
    groupKey: "account",
    items: [
      { id: "subscriptions", labelKey: "subscriptions", icon: CreditCard },
      { id: "support", labelKey: "support", icon: HeadphonesIcon },
      { id: "tutorial", labelKey: "tutorial", icon: PlayCircle },
      { id: "settings", labelKey: "settings", icon: Settings },
    ],
  },
]

export const DASHBOARD_TAB_IDS: readonly DashboardTabId[] = DASHBOARD_NAV.flatMap((g) => g.items.map((i) => i.id))

export function isDashboardTab(value: unknown): value is DashboardTabId {
  return typeof value === "string" && (DASHBOARD_TAB_IDS as readonly string[]).includes(value)
}
