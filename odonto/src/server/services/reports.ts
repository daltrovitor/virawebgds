import { and, asc, count, eq, gte, inArray, lt, lte, ne, sql } from "drizzle-orm";
import { APPOINTMENT_STATUSES, OPEN_STATUSES, type AppointmentStatus } from "@/domain/appointments";
import { BUDGET_STATUSES, type BudgetStatus } from "@/domain/budget";
import { buildDailyCashflow, type CashflowDay } from "@/domain/cashflow";
import { addDays, compareCivil, todayInTz, type CivilDate } from "@/domain/dates";
import { prorate } from "@/domain/money";
import { assertCan, assertCanAny, can, type Ctx } from "../context";
import {
  accountMovements,
  appointments,
  bankTransactions,
  budgetItems,
  budgets,
  cardReceivables,
  financialAccounts,
  financialAllocations,
  financialCategories,
  patients,
  payables,
  paymentAgreements,
  professionals,
  receivables,
  schedulingTasks,
  settlementAllocations,
  settlements,
  treatmentItems,
} from "../db/schema";
import { q } from "../db/sql";

const n = (v: unknown) => Number(v ?? 0);

// ---------------------------------------------------------------------------
// Visão geral (pirâmide: indicadores → análise → listas)
// ---------------------------------------------------------------------------

export async function overview(ctx: Ctx) {
  const today = todayInTz(ctx.timezone);
  const result: {
    today: CivilDate;
    schedule: null | {
      byStatus: Record<AppointmentStatus, number>;
      list: { id: string; startMinute: number; endMinute: number; status: AppointmentStatus; patientId: string; patientName: string; professionalName: string }[];
      pendingClosure: number;
      openTasks: number;
    };
    budgets: null | { negotiatingCount: number; negotiatingValueCents: number; draftCount: number };
    finance: null | {
      receivableDueTodayCents: number;
      receivableOverdueCents: number;
      receivableOverdueCount: number;
      payableDueTodayCents: number;
      payableOverdueCents: number;
      receivedMonthCents: number;
      paidMonthCents: number;
      pendingBankTx: number;
      accounts: { id: string; name: string; kind: string; balanceCents: number }[];
    };
    unscheduledItems: number | null;
  } = { today, schedule: null, budgets: null, finance: null, unscheduledItems: null };

  if (can(ctx, "schedule.view")) {
    const list = await ctx.db
      .select({
        id: appointments.id,
        startMinute: appointments.startMinute,
        endMinute: appointments.endMinute,
        status: appointments.status,
        patientId: patients.id,
        patientName: patients.fullName,
        professionalName: professionals.name,
      })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
      .where(and(eq(appointments.organizationId, ctx.orgId), eq(appointments.localDate, today)))
      .orderBy(asc(appointments.startMinute));
    const byStatus = Object.fromEntries(APPOINTMENT_STATUSES.map((s) => [s, 0])) as Record<AppointmentStatus, number>;
    for (const a of list) byStatus[a.status as AppointmentStatus]++;
    const [pending] = await ctx.db
      .select({ c: count() })
      .from(appointments)
      .where(and(eq(appointments.organizationId, ctx.orgId), lt(appointments.endsAt, new Date()), inArray(appointments.status, [...OPEN_STATUSES])));
    const [tasks] = await ctx.db.select({ c: count() }).from(schedulingTasks).where(and(eq(schedulingTasks.organizationId, ctx.orgId), eq(schedulingTasks.status, "open")));
    result.schedule = {
      byStatus,
      list: list.map((a) => ({ ...a, status: a.status as AppointmentStatus })),
      pendingClosure: pending?.c ?? 0,
      openTasks: tasks?.c ?? 0,
    };
    const [unscheduled] = await ctx.db
      .select({ c: count() })
      .from(treatmentItems)
      .where(
        and(
          eq(treatmentItems.organizationId, ctx.orgId),
          inArray(treatmentItems.clinicalStatus, ["not_started", "in_progress"]),
          sql`not exists (select 1 from appointment_procedures ap join appointments a on a.id = ap.appointment_id
            where ap.treatment_item_id = ${q(treatmentItems.id)} and a.starts_at > now() and a.status in ('scheduled','confirmed','arrived','in_progress'))`,
        ),
      );
    result.unscheduledItems = unscheduled?.c ?? 0;
  }

  if (can(ctx, "budgets.view")) {
    const rows = await ctx.db
      .select({
        status: budgets.status,
        c: count(),
        value: sql<string>`coalesce(sum((select sum(${q(budgetItems.subtotalCents)}) from ${budgetItems} where ${q(budgetItems.revisionId)} = ${q(budgets.currentRevisionId)} and ${q(budgetItems.approvalStatus)} <> 'rejected')), 0)`,
      })
      .from(budgets)
      .where(and(eq(budgets.organizationId, ctx.orgId), inArray(budgets.status, ["draft", "negotiating"])))
      .groupBy(budgets.status);
    result.budgets = {
      negotiatingCount: rows.find((r) => r.status === "negotiating")?.c ?? 0,
      negotiatingValueCents: n(rows.find((r) => r.status === "negotiating")?.value),
      draftCount: rows.find((r) => r.status === "draft")?.c ?? 0,
    };
  }

  if (can(ctx, "finance.view")) {
    const balanceExpr = (t: typeof receivables | typeof payables) =>
      sql<string>`coalesce(sum(${t.originalCents} + ${t.adjustmentCents} - ${t.paidPrincipalCents} - ${t.discountGrantedCents}), 0)`;
    const [recToday] = await ctx.db
      .select({ v: balanceExpr(receivables) })
      .from(receivables)
      .where(and(eq(receivables.organizationId, ctx.orgId), inArray(receivables.status, ["open", "partial"]), eq(receivables.dueDate, today)));
    const [recOver] = await ctx.db
      .select({ v: balanceExpr(receivables), c: count() })
      .from(receivables)
      .where(and(eq(receivables.organizationId, ctx.orgId), inArray(receivables.status, ["open", "partial"]), lt(receivables.dueDate, today)));
    const [payToday] = await ctx.db
      .select({ v: balanceExpr(payables) })
      .from(payables)
      .where(and(eq(payables.organizationId, ctx.orgId), inArray(payables.status, ["open", "partial"]), eq(payables.dueDate, today)));
    const [payOver] = await ctx.db
      .select({ v: balanceExpr(payables) })
      .from(payables)
      .where(and(eq(payables.organizationId, ctx.orgId), inArray(payables.status, ["open", "partial"]), lt(payables.dueDate, today)));
    const monthStart = `${today.slice(0, 7)}-01`;
    const settled = await ctx.db
      .select({ direction: settlements.direction, v: sql<string>`coalesce(sum(${settlements.amountCents}), 0)` })
      .from(settlements)
      .where(and(eq(settlements.organizationId, ctx.orgId), eq(settlements.status, "active"), gte(settlements.settledOn, monthStart), lte(settlements.settledOn, today)))
      .groupBy(settlements.direction);
    const [bankPending] = await ctx.db
      .select({ c: count() })
      .from(bankTransactions)
      .where(and(eq(bankTransactions.organizationId, ctx.orgId), eq(bankTransactions.status, "pending")));
    const accounts = await ctx.db
      .select({
        id: financialAccounts.id,
        name: financialAccounts.name,
        kind: financialAccounts.kind,
        opening: financialAccounts.openingBalanceCents,
        moves: sql<string>`coalesce((select sum(${q(accountMovements.amountCents)}) from ${accountMovements} where ${q(accountMovements.accountId)} = ${q(financialAccounts.id)} and ${q(accountMovements.occurredOn)} <= ${today}), 0)`,
      })
      .from(financialAccounts)
      .where(and(eq(financialAccounts.organizationId, ctx.orgId), eq(financialAccounts.active, true)))
      .orderBy(asc(financialAccounts.name));
    result.finance = {
      receivableDueTodayCents: n(recToday?.v),
      receivableOverdueCents: n(recOver?.v),
      receivableOverdueCount: recOver?.c ?? 0,
      payableDueTodayCents: n(payToday?.v),
      payableOverdueCents: n(payOver?.v),
      receivedMonthCents: n(settled.find((s) => s.direction === "in")?.v),
      paidMonthCents: n(settled.find((s) => s.direction === "out")?.v),
      pendingBankTx: bankPending?.c ?? 0,
      accounts: accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind, balanceCents: a.opening + n(a.moves) })),
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Relatórios do período
// ---------------------------------------------------------------------------

export async function scheduleReport(ctx: Ctx, from: CivilDate, to: CivilDate) {
  assertCanAny(ctx, "reports.view", "schedule.view");
  const rows = await ctx.db
    .select({ status: appointments.status, c: count() })
    .from(appointments)
    .where(and(eq(appointments.organizationId, ctx.orgId), gte(appointments.localDate, from), lte(appointments.localDate, to)))
    .groupBy(appointments.status);
  const byStatus = Object.fromEntries(APPOINTMENT_STATUSES.map((s) => [s, 0])) as Record<AppointmentStatus, number>;
  for (const r of rows) byStatus[r.status as AppointmentStatus] = r.c;
  const missed = await ctx.db
    .select({ appointment: appointments, patientName: patients.fullName, professionalName: professionals.name })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
    .where(
      and(
        eq(appointments.organizationId, ctx.orgId),
        gte(appointments.localDate, from),
        lte(appointments.localDate, to),
        inArray(appointments.status, ["no_show", "cancelled_by_patient", "cancelled_by_clinic", "cancelled_rescheduled", "no_show_rescheduled"]),
      ),
    )
    .orderBy(asc(appointments.localDate), asc(appointments.startMinute));
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const noShows = byStatus.no_show + byStatus.no_show_rescheduled;
  return {
    byStatus,
    total,
    noShowRate: total > 0 ? { numerator: noShows, denominator: total, percent: Math.round((noShows * 1000) / total) / 10 } : null,
    missed,
  };
}

export async function budgetReport(ctx: Ctx, from: CivilDate, to: CivilDate) {
  assertCanAny(ctx, "reports.view", "budgets.view");
  const rows = await ctx.db
    .select({
      status: budgets.status,
      c: count(),
      quoted: sql<string>`coalesce(sum((select sum(${q(budgetItems.subtotalCents)}) from ${budgetItems} where ${q(budgetItems.revisionId)} = (select r.id from budget_revisions r where r.budget_id = ${q(budgets.id)} and r.number = 1))), 0)`,
    })
    .from(budgets)
    .where(and(eq(budgets.organizationId, ctx.orgId), gte(budgets.budgetDate, from), lte(budgets.budgetDate, to)))
    .groupBy(budgets.status);
  const byStatus = Object.fromEntries(BUDGET_STATUSES.map((s) => [s, { count: 0, quotedCents: 0 }])) as Record<BudgetStatus, { count: number; quotedCents: number }>;
  for (const r of rows) byStatus[r.status as BudgetStatus] = { count: r.c, quotedCents: n(r.quoted) };
  const cohort = rows.filter((r) => r.status !== "cancelled" && r.status !== "draft").reduce((a, r) => a + r.c, 0);
  const converted = (byStatus.approved?.count ?? 0) + (byStatus.partially_approved?.count ?? 0);
  // Valor aprovado = acordos iniciais criados no período (bases não se misturam com o orçado).
  const [approved] = await ctx.db
    .select({ v: sql<string>`coalesce(sum(${paymentAgreements.totalCents}), 0)`, c: count() })
    .from(paymentAgreements)
    .where(
      and(
        eq(paymentAgreements.organizationId, ctx.orgId),
        sql`${paymentAgreements.previousAgreementId} is null`,
        sql`(${paymentAgreements.createdAt} at time zone ${ctx.timezone})::date between ${from}::date and ${to}::date`,
      ),
    );
  const [revisions] = await ctx.db
    .select({ v: sql<string>`coalesce(sum(${paymentAgreements.adjustmentCents}), 0)`, c: count() })
    .from(paymentAgreements)
    .where(
      and(
        eq(paymentAgreements.organizationId, ctx.orgId),
        sql`${paymentAgreements.previousAgreementId} is not null`,
        sql`(${paymentAgreements.createdAt} at time zone ${ctx.timezone})::date between ${from}::date and ${to}::date`,
      ),
    );
  return {
    byStatus,
    quotedCents: Object.values(byStatus).reduce((a, b) => a + b.quotedCents, 0),
    approvedCents: n(approved?.v),
    approvedCount: approved?.c ?? 0,
    revisionAdjustmentCents: n(revisions?.v),
    conversion:
      cohort > 0
        ? {
            numerator: converted,
            denominator: cohort,
            percent: Math.round((converted * 1000) / cohort) / 10,
            basis: "Orçamentos com data no período que saíram do rascunho (exceto cancelados); aprovados total ou parcialmente até hoje.",
          }
        : null,
  };
}

export async function receivablesPosition(ctx: Ctx, from: CivilDate, to: CivilDate) {
  assertCan(ctx, "finance.view");
  const today = todayInTz(ctx.timezone);
  const bal = sql<string>`coalesce(sum(${receivables.originalCents} + ${receivables.adjustmentCents} - ${receivables.paidPrincipalCents} - ${receivables.discountGrantedCents}), 0)`;
  const [open] = await ctx.db.select({ v: bal }).from(receivables).where(and(eq(receivables.organizationId, ctx.orgId), inArray(receivables.status, ["open", "partial"])));
  const [overdue] = await ctx.db
    .select({ v: bal })
    .from(receivables)
    .where(and(eq(receivables.organizationId, ctx.orgId), inArray(receivables.status, ["open", "partial"]), lt(receivables.dueDate, today)));
  const [received] = await ctx.db
    .select({ v: sql<string>`coalesce(sum(${settlements.amountCents}), 0)` })
    .from(settlements)
    .where(and(eq(settlements.organizationId, ctx.orgId), eq(settlements.direction, "in"), eq(settlements.status, "active"), gte(settlements.settledOn, from), lte(settlements.settledOn, to)));
  return { openCents: n(open?.v), overdueCents: n(overdue?.v), receivedCents: n(received?.v), asOf: today };
}

/**
 * Receitas e despesas por categoria, regime de caixa (data da liquidação).
 * Transferências entre contas e repasses de cartão não entram. Não é DRE por competência.
 */
export async function cashByCategory(ctx: Ctx, from: CivilDate, to: CivilDate) {
  assertCan(ctx, "finance.view");
  const rows = await ctx.db
    .select({
      allocation: settlementAllocations,
      direction: settlements.direction,
      recCategory: receivables.categoryId,
      payCategory: payables.categoryId,
      payableId: payables.id,
    })
    .from(settlementAllocations)
    .innerJoin(settlements, eq(settlements.id, settlementAllocations.settlementId))
    .leftJoin(receivables, eq(receivables.id, settlementAllocations.receivableId))
    .leftJoin(payables, eq(payables.id, settlementAllocations.payableId))
    .where(and(eq(settlementAllocations.organizationId, ctx.orgId), eq(settlements.status, "active"), gte(settlements.settledOn, from), lte(settlements.settledOn, to)));
  const payableIds = [...new Set(rows.map((r) => r.payableId).filter((v): v is string => Boolean(v)))];
  const allocs = payableIds.length
    ? await ctx.db.select().from(financialAllocations).where(and(eq(financialAllocations.organizationId, ctx.orgId), inArray(financialAllocations.payableId, payableIds)))
    : [];
  const totals = new Map<string, number>();
  const add = (categoryId: string | null, v: number) => totals.set(categoryId ?? "none", (totals.get(categoryId ?? "none") ?? 0) + v);
  for (const r of rows) {
    const cash = r.allocation.principalCents + r.allocation.interestCents + r.allocation.fineCents;
    if (r.direction === "in") add(r.recCategory, cash);
    else {
      const split = allocs.filter((a) => a.payableId === r.payableId);
      if (split.length === 0) add(r.payCategory, -cash);
      else prorate(cash, split.map((s) => s.amountCents)).forEach((v, i) => add(split[i]!.categoryId, -v));
    }
  }
  const fees = await ctx.db
    .select({ categoryId: accountMovements.categoryId, v: sql<string>`sum(${accountMovements.amountCents})` })
    .from(accountMovements)
    .where(
      and(
        eq(accountMovements.organizationId, ctx.orgId),
        inArray(accountMovements.kind, ["card_fee", "card_anticipation_fee", "bank_fee"]),
        gte(accountMovements.occurredOn, from),
        lte(accountMovements.occurredOn, to),
      ),
    )
    .groupBy(accountMovements.categoryId);
  for (const f of fees) add(f.categoryId, n(f.v));
  const cats = await ctx.db.select().from(financialCategories).where(eq(financialCategories.organizationId, ctx.orgId));
  const lines = [...totals.entries()].map(([categoryId, cents]) => {
    const cat = cats.find((c) => c.id === categoryId);
    return { categoryId, name: cat?.name ?? "Sem categoria", type: cat?.type ?? (cents >= 0 ? "income" : "expense"), cents };
  });
  return {
    basis: "Regime de caixa: valores pela data da liquidação. Não é DRE por competência nem demonstração contábil oficial.",
    income: lines.filter((l) => l.cents > 0).sort((a, b) => b.cents - a.cents),
    expense: lines.filter((l) => l.cents < 0).sort((a, b) => a.cents - b.cents),
    totalIncome: lines.filter((l) => l.cents > 0).reduce((a, l) => a + l.cents, 0),
    totalExpense: lines.filter((l) => l.cents < 0).reduce((a, l) => a + l.cents, 0),
  };
}

/** Fluxo de caixa diário: contas de caixa/banco (recebíveis de cartão entram quando liquidados). */
export async function cashflow(ctx: Ctx, params: { from: CivilDate; to: CivilDate; accountId?: string | null }): Promise<{ days: CashflowDay[]; baseDate: CivilDate; pendingCardNetCents: number }> {
  assertCan(ctx, "finance.view");
  const baseDate = todayInTz(ctx.timezone);
  const accounts = await ctx.db
    .select()
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.organizationId, ctx.orgId),
        ne(financialAccounts.kind, "card_clearing"),
        params.accountId ? eq(financialAccounts.id, params.accountId) : undefined,
      ),
    );
  const ids = accounts.map((a) => a.id);
  const movements = ids.length
    ? await ctx.db
        .select({ occurredOn: accountMovements.occurredOn, amountCents: accountMovements.amountCents })
        .from(accountMovements)
        .where(and(eq(accountMovements.organizationId, ctx.orgId), inArray(accountMovements.accountId, ids), lte(accountMovements.occurredOn, params.to)))
    : [];
  const openings = accounts.map((a) => ({ occurredOn: a.openingDate, amountCents: a.openingBalanceCents })).filter((m) => m.amountCents !== 0);
  const openTitles: { dueDate: CivilDate; openCents: number }[] = [];
  if (!params.accountId) {
    const rec = await ctx.db
      .select({ dueDate: receivables.dueDate, v: sql<string>`${receivables.originalCents} + ${receivables.adjustmentCents} - ${receivables.paidPrincipalCents} - ${receivables.discountGrantedCents}` })
      .from(receivables)
      .where(and(eq(receivables.organizationId, ctx.orgId), inArray(receivables.status, ["open", "partial"]), lte(receivables.dueDate, params.to)));
    const pay = await ctx.db
      .select({ dueDate: payables.dueDate, v: sql<string>`${payables.originalCents} + ${payables.adjustmentCents} - ${payables.paidPrincipalCents} - ${payables.discountGrantedCents}` })
      .from(payables)
      .where(and(eq(payables.organizationId, ctx.orgId), inArray(payables.status, ["open", "partial"]), lte(payables.dueDate, params.to)));
    const card = await ctx.db
      .select({ dueDate: cardReceivables.expectedDate, v: cardReceivables.netCents })
      .from(cardReceivables)
      .where(and(eq(cardReceivables.organizationId, ctx.orgId), eq(cardReceivables.status, "pending"), lte(cardReceivables.expectedDate, params.to)));
    openTitles.push(...rec.map((r) => ({ dueDate: r.dueDate, openCents: n(r.v) })));
    openTitles.push(...pay.map((p) => ({ dueDate: p.dueDate, openCents: -n(p.v) })));
    openTitles.push(...card.map((c) => ({ dueDate: c.dueDate, openCents: c.v })));
  }
  const [pendingCard] = await ctx.db
    .select({ v: sql<string>`coalesce(sum(${cardReceivables.netCents}), 0)` })
    .from(cardReceivables)
    .where(and(eq(cardReceivables.organizationId, ctx.orgId), eq(cardReceivables.status, "pending")));
  const days = buildDailyCashflow({
    openingCents: 0,
    movements: [...openings, ...movements],
    openTitles,
    from: params.from,
    to: compareCivil(params.to, addDays(params.from, 366)) > 0 ? addDays(params.from, 366) : params.to,
    baseDate,
  });
  return { days, baseDate, pendingCardNetCents: n(pendingCard?.v) };
}

export async function reconciliationReport(ctx: Ctx) {
  assertCanAny(ctx, "finance.reconcile", "reports.view");
  assertCan(ctx, "finance.view");
  return ctx.db
    .select({
      accountId: financialAccounts.id,
      name: financialAccounts.name,
      pendingCount: sql<number>`(select count(*)::int from ${bankTransactions} where ${q(bankTransactions.accountId)} = ${q(financialAccounts.id)} and ${q(bankTransactions.status)} = 'pending')`,
      pendingCents: sql<string>`(select coalesce(sum(${q(bankTransactions.amountCents)} - ${q(bankTransactions.reconciledCents)}), 0) from ${bankTransactions} where ${q(bankTransactions.accountId)} = ${q(financialAccounts.id)} and ${q(bankTransactions.status)} = 'pending')`,
      ignoredCount: sql<number>`(select count(*)::int from ${bankTransactions} where ${q(bankTransactions.accountId)} = ${q(financialAccounts.id)} and ${q(bankTransactions.status)} = 'ignored')`,
      unreconciledMovements: sql<number>`(select count(*)::int from ${accountMovements} where ${q(accountMovements.accountId)} = ${q(financialAccounts.id)} and ${q(accountMovements.reconciledCents)} <> ${q(accountMovements.amountCents)})`,
    })
    .from(financialAccounts)
    .where(and(eq(financialAccounts.organizationId, ctx.orgId), inArray(financialAccounts.kind, ["bank", "cash", "other"])))
    .orderBy(asc(financialAccounts.name));
}
