import { and, desc, eq, inArray } from "drizzle-orm";
import type { ReminderPreference } from "@/domain/appointments";
import { formatDateBR, instantToZoned, minutesToHHMM } from "@/domain/dates";
import { assertCan, type Ctx } from "../context";
import type { Tx } from "../db/client";
import { integrationSettings, notifications, organizationSettings } from "../db/schema";

/**
 * Lembretes ficam registrados como "pendentes"; o envio só acontece quando a
 * integração de mensagens estiver configurada e ativa. Enviar lembrete não
 * confirma consulta. O texto padrão não inclui procedimentos nem diagnósticos.
 */
export async function scheduleAppointmentReminder(
  tx: Tx,
  ctx: Pick<Ctx, "orgId" | "timezone">,
  appt: { id: string; patientId: string; startsAt: Date; reminderPreference: ReminderPreference },
): Promise<void> {
  if (appt.reminderPreference === "none") return;
  const [settings] = await tx
    .select({ displayName: organizationSettings.displayName })
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, ctx.orgId));
  const local = instantToZoned(appt.startsAt, ctx.timezone);
  const scheduledFor = new Date(appt.startsAt.getTime() - 24 * 3600 * 1000);
  await tx
    .insert(notifications)
    .values({
      organizationId: ctx.orgId,
      patientId: appt.patientId,
      appointmentId: appt.id,
      channel: appt.reminderPreference,
      purpose: "appointment_reminder",
      scheduledFor,
      dedupeKey: `appt:${appt.id}:reminder:${appt.startsAt.toISOString()}`,
      body: `Lembrete: você tem consulta em ${settings?.displayName ?? "nossa clínica"} no dia ${formatDateBR(local.date)} às ${minutesToHHMM(local.minutes)}.`,
    })
    .onConflictDoNothing();
}

/** Cancela lembretes ainda pendentes (desmarcação, remarcação ou mudança de horário). */
export async function cancelPendingReminders(tx: Tx, orgId: string, appointmentId: string, reason: string): Promise<number> {
  const rows = await tx
    .update(notifications)
    .set({ status: "cancelled", cancelledReason: reason, updatedAt: new Date() })
    .where(and(eq(notifications.organizationId, orgId), eq(notifications.appointmentId, appointmentId), eq(notifications.status, "pending")))
    .returning({ id: notifications.id });
  return rows.length;
}

export async function listNotifications(ctx: Ctx, opts: { appointmentId?: string; patientId?: string } = {}) {
  assertCan(ctx, "schedule.view");
  return ctx.db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.organizationId, ctx.orgId),
        opts.appointmentId ? eq(notifications.appointmentId, opts.appointmentId) : undefined,
        opts.patientId ? eq(notifications.patientId, opts.patientId) : undefined,
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(100);
}

export async function messagingStatus(ctx: Pick<Ctx, "db" | "orgId">): Promise<"not_configured" | "active" | "error" | string> {
  const [row] = await ctx.db
    .select({ status: integrationSettings.status })
    .from(integrationSettings)
    .where(and(eq(integrationSettings.organizationId, ctx.orgId), inArray(integrationSettings.kind, ["messaging"])));
  return row?.status ?? "not_configured";
}
