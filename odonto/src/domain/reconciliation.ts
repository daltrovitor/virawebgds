import { diffDays, type CivilDate } from "./dates";
import type { Cents } from "./money";
import { normalizeDescription } from "./text";

export interface BankLineForMatch {
  id: string;
  postedOn: CivilDate;
  /** Valor ainda não alocado, com sinal (+ entrada, − saída). */
  openAmountCents: Cents;
  description: string;
}

export interface MovementCandidate {
  id: string;
  occurredOn: CivilDate;
  /** Valor ainda não conciliado, com sinal. */
  openAmountCents: Cents;
  description: string;
}

export interface MatchSuggestion {
  movementId: string;
  score: number;
  reasons: string[];
}

function tokens(v: string): Set<string> {
  return new Set(
    normalizeDescription(v)
      .split(/[^A-Z0-9]+/)
      .filter((t) => t.length >= 3),
  );
}

/**
 * Sugere correspondências explicando o motivo. Uma sugestão nunca dá baixa
 * sozinha; o usuário confirma cada vínculo.
 */
export function suggestMatches(line: BankLineForMatch, candidates: readonly MovementCandidate[], limit = 5): MatchSuggestion[] {
  const lineTokens = tokens(line.description);
  const out: MatchSuggestion[] = [];
  for (const c of candidates) {
    if (Math.sign(c.openAmountCents) !== Math.sign(line.openAmountCents) || c.openAmountCents === 0) continue;
    const reasons: string[] = [];
    let score = 0;
    if (c.openAmountCents === line.openAmountCents) {
      score += 60;
      reasons.push("Mesmo valor");
    } else if (Math.abs(c.openAmountCents) < Math.abs(line.openAmountCents)) {
      score += 15;
      reasons.push("Valor menor (possível agrupamento)");
    } else {
      continue;
    }
    const days = Math.abs(diffDays(line.postedOn, c.occurredOn));
    if (days === 0) {
      score += 30;
      reasons.push("Mesma data");
    } else if (days <= 3) {
      score += 20;
      reasons.push(`Data com diferença de ${days} dia(s)`);
    } else if (days <= 10) {
      score += 8;
      reasons.push(`Data com diferença de ${days} dias`);
    } else {
      continue;
    }
    const common = [...tokens(c.description)].filter((t) => lineTokens.has(t));
    if (common.length > 0) {
      score += Math.min(20, common.length * 7);
      reasons.push(`Descrição em comum: ${common.slice(0, 3).join(", ")}`);
    }
    out.push({ movementId: c.id, score, reasons });
  }
  return out.sort((a, b) => b.score - a.score || a.movementId.localeCompare(b.movementId)).slice(0, limit);
}

/** Valida que alocações não excedem o saldo em aberto de nenhum dos lados. */
export function validateAllocations(
  bankOpen: Map<string, Cents>,
  movementOpen: Map<string, Cents>,
  allocations: readonly { bankTransactionId: string; movementId: string; amountCents: Cents }[],
): string[] {
  const errors: string[] = [];
  const usedBank = new Map<string, number>();
  const usedMov = new Map<string, number>();
  for (const a of allocations) {
    if (!Number.isSafeInteger(a.amountCents) || a.amountCents === 0) {
      errors.push("Alocação com valor inválido");
      continue;
    }
    const b = bankOpen.get(a.bankTransactionId);
    const m = movementOpen.get(a.movementId);
    if (b === undefined) {
      errors.push("Movimentação bancária indisponível");
      continue;
    }
    if (m === undefined) {
      errors.push("Lançamento interno indisponível");
      continue;
    }
    if (Math.sign(a.amountCents) !== Math.sign(b) || Math.sign(a.amountCents) !== Math.sign(m)) {
      errors.push("Entrada só concilia com entrada e saída com saída");
      continue;
    }
    usedBank.set(a.bankTransactionId, (usedBank.get(a.bankTransactionId) ?? 0) + a.amountCents);
    usedMov.set(a.movementId, (usedMov.get(a.movementId) ?? 0) + a.amountCents);
  }
  for (const [id, used] of usedBank) {
    if (Math.abs(used) > Math.abs(bankOpen.get(id) ?? 0)) errors.push("Alocação excede o valor em aberto da movimentação bancária");
  }
  for (const [id, used] of usedMov) {
    if (Math.abs(used) > Math.abs(movementOpen.get(id) ?? 0)) errors.push("Alocação excede o valor em aberto do lançamento interno");
  }
  return [...new Set(errors)];
}
