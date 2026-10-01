import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { audit } from "../audit";
import { assertCan, type Ctx } from "../context";
import { memberships, professionalAvailability, professionals, professionalSpecialties, specialties } from "../db/schema";
import { NotFoundError, ValidationError } from "../errors";
import { parseInput, zId, zOptionalText, zRequiredText } from "../validation";

export async function listProfessionals(ctx: Ctx, opts: { includeInactive?: boolean } = {}) {
  const rows = await ctx.db
    .select()
    .from(professionals)
    .where(and(eq(professionals.organizationId, ctx.orgId), opts.includeInactive ? undefined : eq(professionals.active, true)))
    .orderBy(asc(professionals.name));
  if (rows.length === 0) return [];
  const specs = await ctx.db
    .select({ professionalId: professionalSpecialties.professionalId, specialtyId: specialties.id, name: specialties.name })
    .from(professionalSpecialties)
    .innerJoin(specialties, eq(specialties.id, professionalSpecialties.specialtyId))
    .where(
      and(
        eq(professionalSpecialties.organizationId, ctx.orgId),
        inArray(
          professionalSpecialties.professionalId,
          rows.map((r) => r.id),
        ),
      ),
    );
  const avail = await ctx.db
    .select()
    .from(professionalAvailability)
    .where(eq(professionalAvailability.organizationId, ctx.orgId));
  return rows.map((p) => ({
    ...p,
    specialties: specs.filter((s) => s.professionalId === p.id).map((s) => ({ id: s.specialtyId, name: s.name })),
    availability: avail
      .filter((a) => a.professionalId === p.id)
      .map((a) => ({ weekday: a.weekday, startMinute: a.startMinute, endMinute: a.endMinute })),
  }));
}

export async function getProfessional(ctx: Ctx, id: string) {
  const [row] = await ctx.db
    .select()
    .from(professionals)
    .where(and(eq(professionals.organizationId, ctx.orgId), eq(professionals.id, id)));
  if (!row) throw new NotFoundError("Profissional");
  return row;
}

const professionalSchema = z.object({
  id: zId.nullish(),
  name: zRequiredText("Nome", 160),
  council: zOptionalText(20),
  councilNumber: zOptionalText(30),
  councilState: zOptionalText(2),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, { message: "Cor inválida" }).default("#0f766e"),
  active: z.boolean().default(true),
  userId: zId.nullish(),
  specialtyIds: z.array(zId).default([]),
  availability: z
    .array(
      z
        .object({ weekday: z.number().int().min(0).max(6), startMinute: z.number().int().min(0).max(1440), endMinute: z.number().int().min(0).max(1440) })
        .refine((a) => a.endMinute > a.startMinute, { message: "Horário final deve ser posterior ao inicial" }),
    )
    .default([]),
});

/** Usuário (login) e profissional (agenda/clínico) são entidades distintas, opcionalmente vinculadas. */
export async function saveProfessional(ctx: Ctx, input: z.input<typeof professionalSchema>) {
  assertCan(ctx, "settings.manage");
  const data = parseInput(professionalSchema, input);
  if (data.userId) {
    const [m] = await ctx.db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.organizationId, ctx.orgId), eq(memberships.userId, data.userId)));
    if (!m) throw new ValidationError("Usuário não pertence a esta clínica", { userId: "Usuário inválido" });
  }
  if (data.specialtyIds.length > 0) {
    const found = await ctx.db
      .select({ id: specialties.id })
      .from(specialties)
      .where(and(eq(specialties.organizationId, ctx.orgId), inArray(specialties.id, data.specialtyIds)));
    if (found.length !== new Set(data.specialtyIds).size) throw new ValidationError("Especialidade inválida");
  }
  return ctx.db.transaction(async (tx) => {
    const values = {
      name: data.name,
      council: data.council,
      councilNumber: data.councilNumber,
      councilState: data.councilState?.toUpperCase() ?? null,
      color: data.color,
      active: data.active,
      userId: data.userId ?? null,
      updatedAt: new Date(),
    };
    let id = data.id ?? null;
    if (id) {
      const [row] = await tx
        .update(professionals)
        .set(values)
        .where(and(eq(professionals.organizationId, ctx.orgId), eq(professionals.id, id)))
        .returning({ id: professionals.id });
      if (!row) throw new NotFoundError("Profissional");
    } else {
      const [row] = await tx.insert(professionals).values({ organizationId: ctx.orgId, ...values }).returning({ id: professionals.id });
      id = row!.id;
    }
    await tx.delete(professionalSpecialties).where(and(eq(professionalSpecialties.organizationId, ctx.orgId), eq(professionalSpecialties.professionalId, id)));
    if (data.specialtyIds.length > 0) {
      await tx
        .insert(professionalSpecialties)
        .values([...new Set(data.specialtyIds)].map((specialtyId) => ({ organizationId: ctx.orgId, professionalId: id!, specialtyId })));
    }
    await tx.delete(professionalAvailability).where(and(eq(professionalAvailability.organizationId, ctx.orgId), eq(professionalAvailability.professionalId, id)));
    if (data.availability.length > 0) {
      await tx.insert(professionalAvailability).values(data.availability.map((a) => ({ organizationId: ctx.orgId, professionalId: id!, ...a })));
    }
    await audit(tx, ctx, {
      action: data.id ? "professional.update" : "professional.create",
      entityType: "professional",
      entityId: id,
      summary: `Profissional ${data.id ? "atualizado" : "cadastrado"}: ${data.name}`,
      changes: { active: data.active, specialties: data.specialtyIds.length },
    });
    return { id };
  });
}
