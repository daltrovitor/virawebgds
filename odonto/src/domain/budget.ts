import { multiplyCents, sumCents, type Cents } from "./money";
import { ARCH_LABEL, HEMIARCH_LABEL, isValidTooth, type Arch, type Hemiarch } from "./teeth";

/**
 * Unidade de cobrança (como o preço multiplica) é separada da região anatômica
 * (onde o procedimento é feito).
 */
export const BILLING_UNITS = ["tooth", "arch", "hemiarch", "session", "global"] as const;
export type BillingUnit = (typeof BILLING_UNITS)[number];

export const BILLING_UNIT_LABEL: Record<BillingUnit, string> = {
  tooth: "Por dente",
  arch: "Por arcada",
  hemiarch: "Por hemiarcada",
  session: "Por sessão",
  global: "Procedimento global",
};

/** Tipos de localização permitidos por procedimento. */
export const LOCATION_KINDS = ["teeth", "arches", "hemiarches", "none"] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

export const LOCATION_KIND_LABEL: Record<LocationKind, string> = {
  teeth: "Dente(s)",
  arches: "Arcada(s)",
  hemiarches: "Hemiarcada(s)",
  none: "Sem região",
};

export type LocationSelection =
  | { kind: "none" }
  | { kind: "teeth"; teeth: number[] }
  | { kind: "arches"; arches: Arch[] }
  | { kind: "hemiarches"; hemiarches: Hemiarch[] };

/** Localização persistida de um item (um item pode ter várias para procedimentos globais). */
export type ItemLocation =
  | { kind: "tooth"; tooth: number }
  | { kind: "arch"; arch: Arch }
  | { kind: "hemiarch"; hemiarch: Hemiarch };

export type ItemScope = "none" | "teeth" | "arches" | "hemiarches";

export interface ItemDraft {
  scope: ItemScope;
  locations: ItemLocation[];
  quantity: number;
  unitPriceCents: Cents;
  subtotalCents: Cents;
}

export class BudgetRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetRuleError";
  }
}

/** Unidades multiplicadas pela localização: cada dente/arcada/hemiarcada vira um item. */
const UNIT_REQUIRES: Partial<Record<BillingUnit, LocationKind>> = {
  tooth: "teeth",
  arch: "arches",
  hemiarch: "hemiarches",
};

export function normalizeSelection(selection: LocationSelection): LocationSelection {
  switch (selection.kind) {
    case "none":
      return selection;
    case "teeth": {
      const teeth = [...new Set(selection.teeth)].sort((a, b) => a - b);
      for (const t of teeth) if (!isValidTooth(t)) throw new BudgetRuleError(`Dente ${t} não existe na numeração FDI`);
      return { kind: "teeth", teeth };
    }
    case "arches": {
      const order: Arch[] = ["upper", "lower"];
      const arches = order.filter((a) => selection.arches.includes(a));
      return { kind: "arches", arches };
    }
    case "hemiarches": {
      const hemiarches = ([1, 2, 3, 4] as Hemiarch[]).filter((h) => selection.hemiarches.includes(h));
      return { kind: "hemiarches", hemiarches };
    }
  }
}

function selectionSize(selection: LocationSelection): number {
  switch (selection.kind) {
    case "none":
      return 0;
    case "teeth":
      return selection.teeth.length;
    case "arches":
      return selection.arches.length;
    case "hemiarches":
      return selection.hemiarches.length;
  }
}

function selectionToLocations(selection: LocationSelection): ItemLocation[] {
  switch (selection.kind) {
    case "none":
      return [];
    case "teeth":
      return selection.teeth.map((tooth) => ({ kind: "tooth", tooth }));
    case "arches":
      return selection.arches.map((arch) => ({ kind: "arch", arch }));
    case "hemiarches":
      return selection.hemiarches.map((hemiarch) => ({ kind: "hemiarch", hemiarch }));
  }
}

export interface ExpandInput {
  billingUnit: BillingUnit;
  allowedLocations: readonly LocationKind[];
  selection: LocationSelection;
  /** Quantidade usada por sessão/global. Para unidades por região é sempre 1 por região. */
  quantity: number;
  unitPriceCents: Cents;
}

/**
 * Converte a seleção do formulário em itens rastreáveis.
 * - Por dente/arcada/hemiarcada: N regiões → N itens de quantidade 1.
 * - Sessão/global: um item com a quantidade informada e todas as regiões.
 */
export function expandItems(input: ExpandInput): ItemDraft[] {
  const selection = normalizeSelection(input.selection);
  if (!input.allowedLocations.includes(selection.kind)) {
    throw new BudgetRuleError("Localização não permitida para este procedimento");
  }
  if (!Number.isInteger(input.unitPriceCents) || input.unitPriceCents < 0) {
    throw new BudgetRuleError("Preço unitário inválido");
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 999) {
    throw new BudgetRuleError("Quantidade deve ser um inteiro positivo");
  }
  const required = UNIT_REQUIRES[input.billingUnit];
  if (required) {
    if (selection.kind !== required) {
      throw new BudgetRuleError(
        `Procedimento cobrado ${BILLING_UNIT_LABEL[input.billingUnit].toLowerCase()} exige seleção de ${LOCATION_KIND_LABEL[required].toLowerCase()}`,
      );
    }
    if (selectionSize(selection) === 0) throw new BudgetRuleError("Selecione ao menos uma região");
    return selectionToLocations(selection).map((loc) => ({
      scope: selection.kind,
      locations: [loc],
      quantity: 1,
      unitPriceCents: input.unitPriceCents,
      subtotalCents: input.unitPriceCents,
    }));
  }
  if (selection.kind !== "none" && selectionSize(selection) === 0) {
    throw new BudgetRuleError("Selecione ao menos uma região ou escolha sem região");
  }
  return [
    {
      scope: selection.kind,
      locations: selectionToLocations(selection),
      quantity: input.quantity,
      unitPriceCents: input.unitPriceCents,
      subtotalCents: multiplyCents(input.unitPriceCents, input.quantity),
    },
  ];
}

export function previewTotal(drafts: readonly ItemDraft[]): Cents {
  return sumCents(drafts.map((d) => d.subtotalCents));
}

export function locationSignature(scope: ItemScope, locations: readonly ItemLocation[]): string {
  if (scope === "none" || locations.length === 0) return "none";
  return locations
    .map((l) => (l.kind === "tooth" ? `t${l.tooth}` : l.kind === "arch" ? `a${l.arch}` : `h${l.hemiarch}`))
    .sort()
    .join("|");
}

export function locationLabel(scope: ItemScope, locations: readonly ItemLocation[]): string {
  if (scope === "none" || locations.length === 0) return "Sem região";
  const teeth = locations.filter((l): l is { kind: "tooth"; tooth: number } => l.kind === "tooth").map((l) => l.tooth);
  const arches = locations.filter((l): l is { kind: "arch"; arch: Arch } => l.kind === "arch").map((l) => l.arch);
  const hemi = locations
    .filter((l): l is { kind: "hemiarch"; hemiarch: Hemiarch } => l.kind === "hemiarch")
    .map((l) => l.hemiarch);
  const parts: string[] = [];
  if (teeth.length === 1) parts.push(`Dente ${teeth[0]}`);
  else if (teeth.length > 1) parts.push(`Dentes ${teeth.join(", ")}`);
  if (arches.length === 2) parts.push("Ambas as arcadas");
  else if (arches.length === 1) parts.push(ARCH_LABEL[arches[0]!]);
  for (const h of hemi) parts.push(`Hemiarcada ${HEMIARCH_LABEL[h]}`);
  return parts.join(" · ");
}

export interface ExistingItemRef {
  procedureId: string;
  signature: string;
  approvalStatus: ApprovalStatus;
}

/** Retorna as assinaturas de localização que já existem para o mesmo procedimento. */
export function findDuplicates(
  procedureId: string,
  drafts: readonly ItemDraft[],
  existing: readonly ExistingItemRef[],
): string[] {
  const taken = new Set(
    existing.filter((e) => e.procedureId === procedureId && e.approvalStatus !== "rejected").map((e) => e.signature),
  );
  return drafts.map((d) => locationSignature(d.scope, d.locations)).filter((sig) => taken.has(sig));
}

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------

export const BUDGET_STATUSES = [
  "draft",
  "negotiating",
  "partially_approved",
  "approved",
  "rejected",
  "cancelled",
] as const;
export type BudgetStatus = (typeof BUDGET_STATUSES)[number];

export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  draft: "Rascunho",
  negotiating: "Em negociação",
  partially_approved: "Parcialmente aprovado",
  approved: "Aprovado",
  rejected: "Recusado",
  cancelled: "Cancelado",
};

export const APPROVAL_STATUSES = ["pending", "approved", "rejected"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Recusado",
};

/** Itens só podem ser editados livremente antes do acordo aprovado. */
export function isBudgetEditable(status: BudgetStatus): boolean {
  return status === "draft" || status === "negotiating";
}

export function statusAfterApproval(approvedCount: number, totalCount: number): BudgetStatus {
  if (approvedCount === 0) return "rejected";
  return approvedCount === totalCount ? "approved" : "partially_approved";
}
