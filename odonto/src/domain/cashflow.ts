import { addDays, compareCivil, type CivilDate } from "./dates";
import type { Cents } from "./money";

export interface RealizedMovement {
  occurredOn: CivilDate;
  amountCents: Cents;
}

export interface OpenTitle {
  dueDate: CivilDate;
  /** Saldo em aberto com sinal: + a receber, − a pagar. */
  openCents: Cents;
}

export interface CashflowDay {
  date: CivilDate;
  realizedIn: Cents;
  realizedOut: Cents;
  /** null para datas após a data-base (ainda não realizadas). */
  realizedBalance: Cents | null;
  projectedIn: Cents;
  projectedOut: Cents;
  projectedBalance: Cents;
}

/**
 * Realizado: saldo inicial + movimentos efetivos até a data (inclui
 * transferências). Projetado: saldo realizado na data-base + saldo restante
 * dos títulos em aberto (nunca o valor original, para não duplicar o que já foi
 * pago). Títulos vencidos e não pagos entram no dia seguinte à data-base.
 */
export function buildDailyCashflow(params: {
  openingCents: Cents;
  movements: readonly RealizedMovement[];
  openTitles: readonly OpenTitle[];
  from: CivilDate;
  to: CivilDate;
  baseDate: CivilDate;
}): CashflowDay[] {
  const { openingCents, movements, openTitles, from, to, baseDate } = params;
  let balance = openingCents;
  for (const m of movements) {
    if (compareCivil(m.occurredOn, from) < 0) balance += m.amountCents;
  }
  const byDay = new Map<CivilDate, { in: number; out: number }>();
  for (const m of movements) {
    if (compareCivil(m.occurredOn, from) < 0 || compareCivil(m.occurredOn, to) > 0) continue;
    if (compareCivil(m.occurredOn, baseDate) > 0) continue; // movimento futuro não é realizado
    const e = byDay.get(m.occurredOn) ?? { in: 0, out: 0 };
    if (m.amountCents >= 0) e.in += m.amountCents;
    else e.out += m.amountCents;
    byDay.set(m.occurredOn, e);
  }
  const projByDay = new Map<CivilDate, { in: number; out: number }>();
  for (const t of openTitles) {
    if (t.openCents === 0) continue;
    const day = compareCivil(t.dueDate, baseDate) <= 0 ? addDays(baseDate, 1) : t.dueDate;
    const e = projByDay.get(day) ?? { in: 0, out: 0 };
    if (t.openCents > 0) e.in += t.openCents;
    else e.out += t.openCents;
    projByDay.set(day, e);
  }
  // Projeções anteriores ao período entram no saldo projetado inicial.
  let projectedCarry = 0;
  for (const [day, e] of projByDay) {
    if (compareCivil(day, from) < 0) projectedCarry += e.in + e.out;
  }
  const days: CashflowDay[] = [];
  let projected = balance + projectedCarry;
  for (let d = from; compareCivil(d, to) <= 0; d = addDays(d, 1)) {
    const isRealizedDay = compareCivil(d, baseDate) <= 0;
    const r = byDay.get(d) ?? { in: 0, out: 0 };
    const p = projByDay.get(d) ?? { in: 0, out: 0 };
    if (isRealizedDay) {
      balance += r.in + r.out;
      projected = balance + projectedCarry;
    } else {
      projected += p.in + p.out;
    }
    days.push({
      date: d,
      realizedIn: isRealizedDay ? r.in : 0,
      realizedOut: isRealizedDay ? r.out : 0,
      realizedBalance: isRealizedDay ? balance : null,
      projectedIn: isRealizedDay ? 0 : p.in,
      projectedOut: isRealizedDay ? 0 : p.out,
      projectedBalance: projected,
    });
  }
  return days;
}
