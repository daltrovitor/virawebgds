import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "../../src/server/db/client";
import { appointments, notifications, receivables, treatmentItems } from "../../src/server/db/schema";
import { ConflictError } from "../../src/server/errors";
import {
  changeAppointmentStatus,
  createAppointment,
  createBlock,
  getAgenda,
  getAppointment,
  listPendingClosure,
  moveAppointment,
  recordAppointmentOutcome,
  rescheduleAppointment,
  ScheduleConflictError,
} from "../../src/server/services/appointments";
import { addItems, approveBudget, createBudget, getBudget } from "../../src/server/services/budgets";
import { saveAccount } from "../../src/server/services/finance-setup";
import { quickCreatePatient } from "../../src/server/services/patients";
import { settleTitles } from "../../src/server/services/titles";
import { listPatientTreatmentItems, patientTreatmentSummary } from "../../src/server/services/treatments";
import { createCatalog, createClinic, createTestDb, key, type CatalogFixture, type Clinic } from "./helpers";

let h: DbHandle;
let clinic: Clinic;
let cat: CatalogFixture;
let patientId: string;
let otherPatientId: string;

beforeAll(async () => {
  h = await createTestDb();
  clinic = await createClinic(h.db);
  cat = await createCatalog(clinic);
  const ctx = await clinic.ctx("reception");
  const a = await quickCreatePatient(ctx, { fullName: "Paciente Agenda", phone: "62988880001" });
  const b = await quickCreatePatient(ctx, { fullName: "Outro Paciente", phone: "62988880002" });
  if (a.status !== "created" || b.status !== "created") throw new Error("pacientes");
  patientId = a.id;
  otherPatientId = b.id;
});

afterAll(async () => {
  await h.sql.end();
});

describe("agenda", () => {
  it("cenário 14: 09h15–10h00 = 45 min; persiste; mover/redimensionar atualiza horário e histórico", async () => {
    const reception = await clinic.ctx("reception");
    const created = await createAppointment(reception, {
      patientId,
      professionalId: clinic.professionalId,
      date: "2026-10-05",
      startMinute: 9 * 60 + 15,
      endMinute: 10 * 60,
      isFirstVisit: true,
      reminderPreference: "whatsapp",
    });
    expect(created.durationMinutes).toBe(45);
    const loaded = await getAppointment(reception, created.id);
    expect(loaded).toMatchObject({ localDate: "2026-10-05", startMinute: 555, endMinute: 600, status: "scheduled", isFirstVisit: true });
    expect(loaded.startsAt.toISOString()).toBe("2026-10-05T12:15:00.000Z");
    expect(loaded.createdByName).toBeTruthy();
    // Arrastar para 10h30 e redimensionar para 90 min
    await moveAppointment(reception, { appointmentId: created.id, expectedVersion: loaded.version, professionalId: clinic.professionalId, date: "2026-10-05", startMinute: 630, endMinute: 720 });
    const moved = await getAppointment(reception, created.id);
    expect(moved).toMatchObject({ startMinute: 630, endMinute: 720 });
    expect(moved.history.map((x) => x.kind)).toEqual(["created", "time_change"]);
    // Versão desatualizada é recusada
    await expect(
      moveAppointment(reception, { appointmentId: created.id, expectedVersion: loaded.version, professionalId: clinic.professionalId, date: "2026-10-05", startMinute: 600, endMinute: 660 }),
    ).rejects.toBeInstanceOf(ConflictError);
    const agenda = await getAgenda(reception, { from: "2026-10-05", to: "2026-10-11" });
    expect(agenda.appointments.find((a) => a.id === created.id)?.planned).toBeNull(); // recepção não vê conteúdo clínico
  });

  it("cenário 15: conflito detectado no servidor, inclusive simultâneo; encaixe exige permissão", async () => {
    const reception = await clinic.ctx("reception");
    const owner = await clinic.ctx("owner");
    const slot = { professionalId: clinic.professionalId, date: "2026-10-06", startMinute: 14 * 60, endMinute: 15 * 60 };
    const results = await Promise.allSettled([
      createAppointment(reception, { patientId, ...slot }),
      createAppointment(reception, { patientId: otherPatientId, ...slot }),
      createAppointment(owner, { patientId, ...slot, startMinute: 14 * 60 + 30, endMinute: 15 * 60 + 30 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected.every((r) => r.reason instanceof ConflictError)).toBe(true);
    // Recepção não tem permissão de encaixe
    await expect(createAppointment(reception, { patientId: otherPatientId, ...slot, confirmOverbook: true, overbookReason: "Urgência" })).rejects.toMatchObject({ overbookAllowed: false });
    // Administrador encaixa com confirmação deliberada e motivo
    await expect(createAppointment(owner, { patientId: otherPatientId, ...slot, confirmOverbook: true })).rejects.toThrow(/motivo/);
    const ob = await createAppointment(owner, { patientId: otherPatientId, ...slot, confirmOverbook: true, overbookReason: "Urgência com dor" });
    expect(ob.isOverbook).toBe(true);
    // Bloqueio e expediente
    await createBlock(owner, { professionalId: clinic.professionalId, kind: "weekly", weekday: 3, startDate: "2026-10-01", startMinute: 12 * 60, endMinute: 13 * 60, reason: "Almoço" });
    await expect(createAppointment(reception, { patientId, professionalId: clinic.professionalId, date: "2026-10-07", startMinute: 12 * 60, endMinute: 12 * 60 + 30 })).rejects.toBeInstanceOf(ScheduleConflictError);
    await expect(createAppointment(reception, { patientId, professionalId: clinic.professionalId, date: "2026-10-10", startMinute: 9 * 60, endMinute: 10 * 60 })).rejects.toThrow(/expediente/);
    const sat = await createAppointment(reception, { patientId, professionalId: clinic.professionalId, date: "2026-10-10", startMinute: 9 * 60, endMinute: 10 * 60, confirmOutsideHours: true });
    expect(sat.isOverbook).toBe(false);
  });

  it("a restrição do banco impede sobreposição mesmo fora do serviço", async () => {
    const [existing] = await h.db.select().from(appointments).where(and(eq(appointments.localDate, "2026-10-06"), eq(appointments.isOverbook, false)));
    await expect(
      h.db.insert(appointments).values({
        organizationId: clinic.orgId,
        patientId,
        professionalId: clinic.professionalId,
        startsAt: existing!.startsAt,
        endsAt: existing!.endsAt,
        localDate: existing!.localDate,
        startMinute: existing!.startMinute,
        endMinute: existing!.endMinute,
      }),
    ).rejects.toMatchObject({ cause: expect.objectContaining({ code: "23P01" }) });
  });

  it("cenário 16: consulta finalizada com procedimento em andamento; pagamento integral não conclui o procedimento", async () => {
    const owner = await clinic.ctx("owner");
    const dentist = await clinic.ctx("dentist");
    const b = await createBudget(owner, { patientId, budgetDate: "2026-10-01" });
    const items = await addItems(owner, { budgetId: b.id, procedureId: cat.crown, selection: { kind: "teeth", teeth: [36] } });
    const d = await getBudget(owner, b.id);
    const approval = await approveBudget(owner, {
      budgetId: b.id,
      expectedVersion: d.budget.version,
      idempotencyKey: key(),
      approvedItemIds: items.itemIds,
      discount: { type: "none" },
      plan: { downPayment: null, installments: [{ amountCents: 60_000, dueDate: "2026-10-08", method: "pix" }] },
    });
    const tItem = approval.treatmentItemIds[0]!;
    const pending = await listPatientTreatmentItems(dentist, { patientId });
    expect(pending.map((p) => p.id)).toContain(tItem);
    const appt = await createAppointment(dentist, { patientId, professionalId: clinic.professionalId, date: "2026-10-08", startMinute: 8 * 60, endMinute: 9 * 60, treatmentItemIds: [tItem], planned: "Preparo" });
    await changeAppointmentStatus(dentist, { appointmentId: appt.id, to: "in_progress" });
    await recordAppointmentOutcome(dentist, {
      appointmentId: appt.id,
      performed: "Preparo realizado; moldagem enviada ao laboratório",
      finish: true,
      procedures: [{ treatmentItemId: tItem, outcome: "partial", resultingStatus: "in_progress", sessionLabel: "Preparo" }],
    });
    const finished = await getAppointment(dentist, appt.id);
    expect(finished.status).toBe("finished");
    expect(finished.procedures[0]).toMatchObject({ clinicalStatus: "in_progress", outcome: "partial" });
    const finance = await clinic.ctx("finance");
    const account = await saveAccount(owner, { name: "Banco Agenda", kind: "bank", openingBalanceCents: 0, openingDate: "2026-01-01" });
    const [title] = await h.db.select().from(receivables).where(eq(receivables.budgetId, b.id));
    await settleTitles(finance, { kind: "receivable", accountId: account.id, method: "pix", settledOn: "2026-10-08", allocations: [{ titleId: title!.id, principalCents: 60_000 }] });
    const [item] = await h.db.select().from(treatmentItems).where(eq(treatmentItems.id, tItem));
    expect(item!.clinicalStatus).toBe("in_progress");
    const summary = await patientTreatmentSummary(dentist, patientId);
    expect(summary.overall.label).toMatch(/0 de 1 itens concluídos/);
    // Não é possível programar procedimento de outro paciente (manipulação de ID).
    await expect(createAppointment(dentist, { patientId: otherPatientId, professionalId: clinic.professionalId, date: "2026-10-09", startMinute: 8 * 60, endMinute: 9 * 60, treatmentItemIds: [tItem] })).rejects.toThrow(/não pertence/);
  });

  it("cenário 17: remarcação preserva a antiga, vincula a nova e invalida lembretes pendentes", async () => {
    const reception = await clinic.ctx("reception");
    const appt = await createAppointment(reception, { patientId, professionalId: clinic.professionalId, date: "2026-10-13", startMinute: 16 * 60, endMinute: 16 * 60 + 30, reminderPreference: "sms" });
    const before = await h.db.select().from(notifications).where(eq(notifications.appointmentId, appt.id));
    expect(before.map((n) => n.status)).toEqual(["pending"]);
    const res = await rescheduleAppointment(reception, { appointmentId: appt.id, reason: "Paciente viajou", requestedBy: "patient", professionalId: clinic.professionalId, date: "2026-10-14", startMinute: 16 * 60, endMinute: 16 * 60 + 30 });
    expect(res.cancelledReminders).toBe(1);
    const old = await getAppointment(reception, appt.id);
    expect(old.status).toBe("cancelled_rescheduled");
    expect(old.rescheduledTo?.id).toBe(res.newAppointmentId);
    const next = await getAppointment(reception, res.newAppointmentId);
    expect(next.rescheduledFromId).toBe(appt.id);
    expect(next.status).toBe("scheduled");
    const oldN = await h.db.select().from(notifications).where(eq(notifications.appointmentId, appt.id));
    expect(oldN.every((n) => n.status === "cancelled")).toBe(true);
    const newN = await h.db.select().from(notifications).where(eq(notifications.appointmentId, res.newAppointmentId));
    expect(newN.map((n) => n.status)).toEqual(["pending"]);
    // O horário antigo fica livre
    const reuse = await createAppointment(reception, { patientId: otherPatientId, professionalId: clinic.professionalId, date: "2026-10-13", startMinute: 16 * 60, endMinute: 16 * 60 + 30 });
    expect(reuse.id).toBeTruthy();
    // Desmarcação exige motivo e cancela lembrete
    await expect(changeAppointmentStatus(reception, { appointmentId: res.newAppointmentId, to: "cancelled_by_patient" })).rejects.toThrow(/motivo/i);
    await changeAppointmentStatus(reception, { appointmentId: res.newAppointmentId, to: "cancelled_by_patient", reason: "Desistiu" });
    const after = await h.db.select().from(notifications).where(eq(notifications.appointmentId, res.newAppointmentId));
    expect(after.every((n) => n.status === "cancelled")).toBe(true);
  });

  it("cenário 18: consulta passada sem resultado aparece em pendências, sem falta presumida", async () => {
    const reception = await clinic.ctx("reception");
    const past = await createAppointment(reception, { patientId, professionalId: clinic.professionalId, date: "2026-09-28", startMinute: 10 * 60, endMinute: 10 * 60 + 30 });
    const pendings = await listPendingClosure(reception, { patientId });
    expect(pendings.map((p) => p.appointment.id)).toContain(past.id);
    const [row] = await h.db.select().from(appointments).where(eq(appointments.id, past.id));
    expect(row!.status).toBe("scheduled");
  });
});
