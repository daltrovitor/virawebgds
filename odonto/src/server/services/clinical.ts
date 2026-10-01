import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { formatDateBR } from "@/domain/dates";
import { audit } from "../audit";
import { assertCan, can, type Ctx } from "../context";
import {
  anamnesisResponses,
  anamnesisTemplates,
  appointments,
  attachmentLinks,
  attachments,
  clinicalNoteAddenda,
  clinicalNotes,
  clinicalProgressEntries,
  patientAlerts,
  professionals,
  treatmentItems,
  users,
  type AnamnesisQuestion,
} from "../db/schema";
import { BusinessRuleError, NotFoundError, ValidationError } from "../errors";
import { parseInput, zCivilDate, zId, zOptionalText, zRequiredText } from "../validation";
import { assertPatientInOrg } from "./patients";

// ---------------------------------------------------------------------------
// Anotações clínicas: rascunho editável; finalizado só recebe adendos
// ---------------------------------------------------------------------------

const noteSchema = z.object({
  id: zId.nullish(),
  patientId: zId,
  appointmentId: zId.nullish().transform((v) => v ?? null),
  title: zRequiredText("Título", 200),
  body: zRequiredText("Texto", 20000),
  finalize: z.boolean().default(false),
});

async function professionalForUser(ctx: Ctx) {
  const [p] = await ctx.db
    .select({ id: professionals.id })
    .from(professionals)
    .where(and(eq(professionals.organizationId, ctx.orgId), eq(professionals.userId, ctx.userId)));
  return p?.id ?? null;
}

export async function saveClinicalNote(ctx: Ctx, input: z.input<typeof noteSchema>) {
  assertCan(ctx, "clinical.edit");
  const data = parseInput(noteSchema, input);
  await assertPatientInOrg(ctx, data.patientId);
  if (data.appointmentId) {
    const [a] = await ctx.db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.organizationId, ctx.orgId), eq(appointments.id, data.appointmentId), eq(appointments.patientId, data.patientId)));
    if (!a) throw new NotFoundError("Consulta");
  }
  const professionalId = await professionalForUser(ctx);
  return ctx.db.transaction(async (tx) => {
    let id = data.id ?? null;
    if (id) {
      const [existing] = await tx
        .select()
        .from(clinicalNotes)
        .where(and(eq(clinicalNotes.organizationId, ctx.orgId), eq(clinicalNotes.id, id), eq(clinicalNotes.patientId, data.patientId)))
        .for("update");
      if (!existing) throw new NotFoundError("Anotação");
      if (existing.status === "final") throw new BusinessRuleError("Registro finalizado: inclua um adendo ou correção");
      if (existing.createdBy !== ctx.userId) throw new BusinessRuleError("Somente o autor edita o rascunho");
      await tx
        .update(clinicalNotes)
        .set({
          title: data.title,
          body: data.body,
          appointmentId: data.appointmentId,
          updatedAt: new Date(),
          ...(data.finalize ? { status: "final", finalizedAt: new Date(), finalizedBy: ctx.userId } : {}),
        })
        .where(eq(clinicalNotes.id, id));
    } else {
      const [row] = await tx
        .insert(clinicalNotes)
        .values({
          organizationId: ctx.orgId,
          patientId: data.patientId,
          appointmentId: data.appointmentId,
          professionalId,
          title: data.title,
          body: data.body,
          status: data.finalize ? "final" : "draft",
          finalizedAt: data.finalize ? new Date() : null,
          finalizedBy: data.finalize ? ctx.userId : null,
          createdBy: ctx.userId,
        })
        .returning({ id: clinicalNotes.id });
      id = row!.id;
    }
    await audit(tx, ctx, {
      action: data.finalize ? "clinical_note.finalize" : "clinical_note.save_draft",
      entityType: "clinical_note",
      entityId: id,
      summary: data.finalize ? "Registro clínico finalizado" : "Rascunho clínico salvo",
    });
    return { id };
  });
}

const addendumSchema = z.object({ noteId: zId, kind: z.enum(["addendum", "correction"]), body: zRequiredText("Texto", 10000) });

export async function addNoteAddendum(ctx: Ctx, input: z.input<typeof addendumSchema>) {
  assertCan(ctx, "clinical.edit");
  const data = parseInput(addendumSchema, input);
  const [note] = await ctx.db
    .select()
    .from(clinicalNotes)
    .where(and(eq(clinicalNotes.organizationId, ctx.orgId), eq(clinicalNotes.id, data.noteId)));
  if (!note) throw new NotFoundError("Anotação");
  if (note.status !== "final") throw new BusinessRuleError("Rascunhos são editados diretamente");
  const [row] = await ctx.db
    .insert(clinicalNoteAddenda)
    .values({ organizationId: ctx.orgId, noteId: note.id, kind: data.kind, body: data.body, createdBy: ctx.userId })
    .returning({ id: clinicalNoteAddenda.id });
  await audit(ctx.db, ctx, {
    action: `clinical_note.${data.kind}`,
    entityType: "clinical_note",
    entityId: note.id,
    summary: data.kind === "correction" ? "Correção registrada em registro clínico" : "Adendo registrado em registro clínico",
  });
  return { id: row!.id };
}

export async function deleteDraftNote(ctx: Ctx, noteId: string) {
  assertCan(ctx, "clinical.edit");
  const [row] = await ctx.db
    .delete(clinicalNotes)
    .where(and(eq(clinicalNotes.organizationId, ctx.orgId), eq(clinicalNotes.id, noteId), eq(clinicalNotes.status, "draft"), eq(clinicalNotes.createdBy, ctx.userId)))
    .returning({ id: clinicalNotes.id });
  if (!row) throw new BusinessRuleError("Somente rascunhos do próprio autor podem ser descartados");
}

export type TimelineEntry =
  | { kind: "note"; at: Date; id: string; title: string; body: string; status: string; authorName: string | null; professionalName: string | null; addenda: { kind: string; body: string; at: Date; authorName: string | null }[]; appointmentId: string | null }
  | { kind: "progress"; at: Date; id: string; procedureName: string; locationLabel: string; sessionLabel: string | null; description: string; resultingStatus: string; professionalName: string | null; appointmentId: string | null }
  | { kind: "appointment"; at: Date; id: string; status: string; planned: string | null; performed: string | null; professionalName: string | null; attachments: number };

/** Linha do tempo clínica: consultas finalizadas, evoluções e anotações, sem digitação duplicada. */
export async function clinicalTimeline(ctx: Ctx, patientId: string): Promise<TimelineEntry[]> {
  assertCan(ctx, "clinical.view");
  await assertPatientInOrg(ctx, patientId);
  const notes = await ctx.db
    .select({ note: clinicalNotes, authorName: users.name, professionalName: professionals.name })
    .from(clinicalNotes)
    .leftJoin(users, eq(users.id, clinicalNotes.createdBy))
    .leftJoin(professionals, eq(professionals.id, clinicalNotes.professionalId))
    .where(and(eq(clinicalNotes.organizationId, ctx.orgId), eq(clinicalNotes.patientId, patientId)));
  const visibleNotes = notes.filter((n) => n.note.status === "final" || n.note.createdBy === ctx.userId);
  const addenda = visibleNotes.length
    ? await ctx.db
        .select({ addendum: clinicalNoteAddenda, authorName: users.name })
        .from(clinicalNoteAddenda)
        .leftJoin(users, eq(users.id, clinicalNoteAddenda.createdBy))
        .where(and(eq(clinicalNoteAddenda.organizationId, ctx.orgId), inArray(clinicalNoteAddenda.noteId, visibleNotes.map((n) => n.note.id))))
        .orderBy(asc(clinicalNoteAddenda.createdAt))
    : [];
  const progress = await ctx.db
    .select({ entry: clinicalProgressEntries, item: treatmentItems, professionalName: professionals.name })
    .from(clinicalProgressEntries)
    .innerJoin(treatmentItems, eq(treatmentItems.id, clinicalProgressEntries.treatmentItemId))
    .leftJoin(professionals, eq(professionals.id, clinicalProgressEntries.professionalId))
    .where(and(eq(clinicalProgressEntries.organizationId, ctx.orgId), eq(clinicalProgressEntries.patientId, patientId)));
  const appts = await ctx.db
    .select({ appointment: appointments, professionalName: professionals.name })
    .from(appointments)
    .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
    .where(and(eq(appointments.organizationId, ctx.orgId), eq(appointments.patientId, patientId), eq(appointments.status, "finished")));
  const attachCounts = appts.length
    ? await ctx.db
        .select({ appointmentId: attachmentLinks.appointmentId })
        .from(attachmentLinks)
        .innerJoin(attachments, eq(attachments.id, attachmentLinks.attachmentId))
        .where(and(eq(attachmentLinks.organizationId, ctx.orgId), isNull(attachments.archivedAt), inArray(attachmentLinks.appointmentId, appts.map((a) => a.appointment.id))))
    : [];
  const entries: TimelineEntry[] = [
    ...visibleNotes.map((n): TimelineEntry => ({
      kind: "note",
      at: n.note.finalizedAt ?? n.note.createdAt,
      id: n.note.id,
      title: n.note.title,
      body: n.note.body,
      status: n.note.status,
      authorName: n.authorName,
      professionalName: n.professionalName,
      appointmentId: n.note.appointmentId,
      addenda: addenda
        .filter((a) => a.addendum.noteId === n.note.id)
        .map((a) => ({ kind: a.addendum.kind, body: a.addendum.body, at: a.addendum.createdAt, authorName: a.authorName })),
    })),
    ...progress.map((p): TimelineEntry => ({
      kind: "progress",
      at: p.entry.createdAt,
      id: p.entry.id,
      procedureName: p.item.procedureName,
      locationLabel: p.item.locationLabel,
      sessionLabel: p.entry.sessionLabel,
      description: p.entry.description,
      resultingStatus: p.entry.resultingStatus,
      professionalName: p.professionalName,
      appointmentId: p.entry.appointmentId,
    })),
    ...appts.map((a): TimelineEntry => ({
      kind: "appointment",
      at: a.appointment.startsAt,
      id: a.appointment.id,
      status: a.appointment.status,
      planned: a.appointment.planned,
      performed: a.appointment.performed,
      professionalName: a.professionalName,
      attachments: attachCounts.filter((c) => c.appointmentId === a.appointment.id).length,
    })),
  ];
  return entries.sort((x, y) => y.at.getTime() - x.at.getTime());
}

// ---------------------------------------------------------------------------
// Anamnese: questionário configurável, respostas datadas e versões preservadas
// ---------------------------------------------------------------------------

export async function activeAnamnesisTemplate(ctx: Ctx) {
  const [tpl] = await ctx.db
    .select()
    .from(anamnesisTemplates)
    .where(and(eq(anamnesisTemplates.organizationId, ctx.orgId), eq(anamnesisTemplates.active, true)))
    .orderBy(desc(anamnesisTemplates.version))
    .limit(1);
  return tpl ?? null;
}

const questionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]{2,40}$/, { message: "Identificador da pergunta inválido" }),
  label: zRequiredText("Pergunta", 300),
  type: z.enum(["yes_no", "text", "yes_no_details"]),
  alertOnYes: z.boolean().optional(),
});

const templateSchema = z.object({ questions: z.array(questionSchema).min(1).max(60) });

/** Editar o questionário cria nova versão; respostas antigas continuam ligadas à versão usada. */
export async function saveAnamnesisTemplate(ctx: Ctx, input: z.input<typeof templateSchema>) {
  assertCan(ctx, "settings.manage");
  const data = parseInput(templateSchema, input);
  const ids = data.questions.map((q) => q.id);
  if (new Set(ids).size !== ids.length) throw new ValidationError("Perguntas com identificador repetido");
  return ctx.db.transaction(async (tx) => {
    const current = await activeAnamnesisTemplate({ ...ctx, db: tx as unknown as Ctx["db"] });
    const name = current?.name ?? "Anamnese inicial";
    await tx.update(anamnesisTemplates).set({ active: false }).where(eq(anamnesisTemplates.organizationId, ctx.orgId));
    const [row] = await tx
      .insert(anamnesisTemplates)
      .values({ organizationId: ctx.orgId, name, version: (current?.version ?? 0) + 1, questions: data.questions as AnamnesisQuestion[], createdBy: ctx.userId })
      .returning({ id: anamnesisTemplates.id, version: anamnesisTemplates.version });
    await audit(tx, ctx, { action: "anamnesis_template.version", entityType: "anamnesis_template", entityId: row!.id, summary: `Questionário de anamnese versão ${row!.version}` });
    return row!;
  });
}

export async function listAnamnesis(ctx: Ctx, patientId: string) {
  assertCan(ctx, "clinical.view");
  await assertPatientInOrg(ctx, patientId);
  return ctx.db
    .select({ response: anamnesisResponses, template: anamnesisTemplates, recordedByName: users.name, reviewerName: professionals.name })
    .from(anamnesisResponses)
    .innerJoin(anamnesisTemplates, eq(anamnesisTemplates.id, anamnesisResponses.templateId))
    .leftJoin(users, eq(users.id, anamnesisResponses.recordedBy))
    .leftJoin(professionals, eq(professionals.id, anamnesisResponses.reviewedByProfessionalId))
    .where(and(eq(anamnesisResponses.organizationId, ctx.orgId), eq(anamnesisResponses.patientId, patientId)))
    .orderBy(desc(anamnesisResponses.answeredOn), desc(anamnesisResponses.createdAt));
}

const responseSchema = z.object({
  patientId: zId,
  templateId: zId,
  answeredOn: zCivilDate,
  respondentName: zRequiredText("Quem respondeu", 200),
  respondentRelation: zOptionalText(80),
  answers: z.record(z.string(), z.object({ answer: z.string().max(4000), details: z.string().max(4000).optional() })),
});

/**
 * Cada preenchimento é uma nova versão. Respostas "sim" em perguntas marcadas
 * geram alerta clínico para revisão do profissional — sem conclusão automática.
 */
export async function recordAnamnesis(ctx: Ctx, input: z.input<typeof responseSchema>) {
  assertCan(ctx, "clinical.edit");
  const data = parseInput(responseSchema, input);
  await assertPatientInOrg(ctx, data.patientId);
  const [tpl] = await ctx.db
    .select()
    .from(anamnesisTemplates)
    .where(and(eq(anamnesisTemplates.organizationId, ctx.orgId), eq(anamnesisTemplates.id, data.templateId)));
  if (!tpl) throw new NotFoundError("Questionário");
  const known = new Set(tpl.questions.map((q) => q.id));
  const answers = Object.fromEntries(Object.entries(data.answers).filter(([k]) => known.has(k)));
  return ctx.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(anamnesisResponses)
      .values({
        organizationId: ctx.orgId,
        patientId: data.patientId,
        templateId: tpl.id,
        answers,
        respondentName: data.respondentName,
        respondentRelation: data.respondentRelation,
        answeredOn: data.answeredOn,
        recordedBy: ctx.userId,
      })
      .returning({ id: anamnesisResponses.id });
    const flagged = tpl.questions.filter((q) => q.alertOnYes && answers[q.id]?.answer === "sim");
    for (const q of flagged) {
      await tx.insert(patientAlerts).values({
        organizationId: ctx.orgId,
        patientId: data.patientId,
        kind: "clinical",
        priority: "high",
        text: `Anamnese (${formatDateBR(data.answeredOn)}): "${q.label}" respondido como sim${answers[q.id]?.details ? ` — ${answers[q.id]!.details}` : ""}. Revisar.`,
        createdBy: ctx.userId,
      });
    }
    await audit(tx, ctx, { action: "anamnesis.record", entityType: "patient", entityId: data.patientId, summary: `Anamnese registrada (versão ${tpl.version}); ${flagged.length} alerta(s) para revisão` });
    return { id: row!.id, alerts: flagged.length };
  });
}

export async function reviewAnamnesis(ctx: Ctx, responseId: string, note: string | null) {
  assertCan(ctx, "clinical.edit");
  const professionalId = await professionalForUser(ctx);
  if (!professionalId) throw new BusinessRuleError("A revisão é feita por um profissional cadastrado");
  const [row] = await ctx.db
    .update(anamnesisResponses)
    .set({ reviewedByProfessionalId: professionalId, reviewedAt: new Date(), reviewNote: note?.trim() || null })
    .where(and(eq(anamnesisResponses.organizationId, ctx.orgId), eq(anamnesisResponses.id, responseId), isNull(anamnesisResponses.reviewedAt)))
    .returning({ id: anamnesisResponses.id, patientId: anamnesisResponses.patientId });
  if (!row) throw new BusinessRuleError("Anamnese já revisada ou inexistente");
  await audit(ctx.db, ctx, { action: "anamnesis.review", entityType: "patient", entityId: row.patientId, summary: "Anamnese revisada pelo profissional" });
}

export function canSeeClinical(ctx: Ctx) {
  return can(ctx, "clinical.view");
}
