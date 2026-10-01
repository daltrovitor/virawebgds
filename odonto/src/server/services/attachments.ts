import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import { audit } from "../audit";
import { assertCan, can, type Ctx } from "../context";
import type { Db } from "../db/client";
import {
  appointments,
  attachmentLinks,
  attachments,
  memberships,
  organizationSettings,
  roles,
  treatmentItems,
  users,
} from "../db/schema";
import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { signValue, verifySignature } from "../secrets";
import { getStorage } from "../storage";
import { parseInput, zCivilDate, zId, zOptionalText } from "../validation";
import { assertPatientInOrg } from "./patients";

export const ATTACHMENT_KIND_LABEL = {
  photo: "Foto",
  radiograph: "Radiografia",
  document: "Documento",
  other: "Outro",
} as const;
export type AttachmentKind = keyof typeof ATTACHMENT_KIND_LABEL;

type DetectedType = { mime: "image/jpeg" | "image/png" | "image/webp" | "application/pdf"; ext: string; image: boolean };

/** Tipo pelo conteúdo (assinatura de bytes), nunca pela extensão ou pelo navegador. */
export function detectFileType(bytes: Uint8Array): DetectedType | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg", image: true };
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return { mime: "image/png", ext: "png", image: true };
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") {
    return { mime: "image/webp", ext: "webp", image: true };
  }
  if (b.length >= 5 && String.fromCharCode(...b.slice(0, 5)) === "%PDF-") return { mime: "application/pdf", ext: "pdf", image: false };
  return null;
}

const uploadSchema = z.object({
  patientId: zId,
  kind: z.enum(["photo", "radiograph", "document", "other"]),
  takenOn: zCivilDate.nullish().transform((v) => v ?? null),
  description: zOptionalText(500),
  originalName: z.string().trim().min(1).max(200),
  tooth: z.number().int().min(11).max(85).nullish(),
  treatmentItemId: zId.nullish(),
  appointmentId: zId.nullish(),
  isProfilePhoto: z.boolean().default(false),
});

export async function uploadAttachment(ctx: Ctx, input: z.input<typeof uploadSchema> & { bytes: Uint8Array }) {
  assertCan(ctx, "attachments.upload");
  const data = parseInput(uploadSchema, input);
  await assertPatientInOrg(ctx, data.patientId);
  const [settings] = await ctx.db
    .select({ uploadMaxMb: organizationSettings.uploadMaxMb })
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, ctx.orgId));
  const maxBytes = (settings?.uploadMaxMb ?? 20) * 1024 * 1024;
  if (input.bytes.byteLength === 0) throw new ValidationError("Arquivo vazio");
  if (input.bytes.byteLength > maxBytes) throw new ValidationError(`Arquivo acima do limite de ${settings?.uploadMaxMb ?? 20} MB`);
  const type = detectFileType(input.bytes);
  if (!type) throw new ValidationError("Formato não aceito. Envie JPEG, PNG, WEBP ou PDF.");
  if (data.isProfilePhoto && !type.image) throw new ValidationError("A foto do paciente precisa ser uma imagem");
  if (data.treatmentItemId) {
    const [ti] = await ctx.db
      .select({ id: treatmentItems.id })
      .from(treatmentItems)
      .where(and(eq(treatmentItems.organizationId, ctx.orgId), eq(treatmentItems.id, data.treatmentItemId), eq(treatmentItems.patientId, data.patientId)));
    if (!ti) throw new ValidationError("Procedimento não pertence ao paciente");
  }
  if (data.appointmentId) {
    const [a] = await ctx.db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.organizationId, ctx.orgId), eq(appointments.id, data.appointmentId), eq(appointments.patientId, data.patientId)));
    if (!a) throw new ValidationError("Consulta não pertence ao paciente");
  }
  let thumbnail: Uint8Array | null = null;
  if (type.image) {
    // Decodificar valida a imagem; a miniatura é um derivado (sem metadados), o original é preservado.
    const sharp = (await import("sharp")).default;
    try {
      const img = sharp(input.bytes, { limitInputPixels: 80_000_000, failOn: "error" });
      await img.metadata();
      thumbnail = new Uint8Array(await img.rotate().resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer());
    } catch {
      throw new ValidationError("Imagem corrompida ou inválida");
    }
  }
  const id = randomUUID();
  const base = `org/${ctx.orgId}/patients/${data.patientId}/${id}`;
  const storageKey = `${base}.${type.ext}`;
  const thumbKey = thumbnail ? `${base}-thumb.webp` : null;
  const storage = getStorage();
  await storage.put(storageKey, input.bytes, type.mime);
  if (thumbnail && thumbKey) await storage.put(thumbKey, thumbnail, "image/webp");
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  try {
    await ctx.db.transaction(async (tx) => {
      if (data.isProfilePhoto) {
        await tx
          .update(attachments)
          .set({ isProfilePhoto: false })
          .where(and(eq(attachments.organizationId, ctx.orgId), eq(attachments.patientId, data.patientId), eq(attachments.isProfilePhoto, true)));
      }
      await tx.insert(attachments).values({
        id,
        organizationId: ctx.orgId,
        patientId: data.patientId,
        storageKey,
        thumbnailKey: thumbKey,
        originalName: data.originalName.replace(/[^\p{L}\p{N} ._()-]/gu, "_"),
        mimeType: type.mime,
        sizeBytes: input.bytes.byteLength,
        sha256,
        kind: data.kind,
        takenOn: data.takenOn,
        description: data.description,
        isProfilePhoto: data.isProfilePhoto,
        uploadedBy: ctx.userId,
      });
      if (data.tooth || data.treatmentItemId || data.appointmentId) {
        await tx.insert(attachmentLinks).values({
          organizationId: ctx.orgId,
          attachmentId: id,
          tooth: data.tooth ?? null,
          treatmentItemId: data.treatmentItemId ?? null,
          appointmentId: data.appointmentId ?? null,
        });
      }
      await audit(tx, ctx, { action: "attachment.upload", entityType: "attachment", entityId: id, summary: `Arquivo enviado (${ATTACHMENT_KIND_LABEL[data.kind]})` });
    });
  } catch (err) {
    await storage.remove(storageKey).catch(() => {});
    if (thumbKey) await storage.remove(thumbKey).catch(() => {});
    throw err;
  }
  return { id, mimeType: type.mime };
}

const gallerySchema = z.object({
  patientId: zId,
  kind: z.enum(["photo", "radiograph", "document", "other", "all"]).default("all"),
  from: zCivilDate.nullish(),
  to: zCivilDate.nullish(),
  treatmentItemId: zId.nullish(),
});

export async function listGallery(ctx: Ctx, input: z.input<typeof gallerySchema>) {
  assertCan(ctx, "attachments.view");
  const data = parseInput(gallerySchema, input);
  await assertPatientInOrg(ctx, data.patientId);
  const rows = await ctx.db
    .select({ attachment: attachments, uploaderName: users.name })
    .from(attachments)
    .leftJoin(users, eq(users.id, attachments.uploadedBy))
    .where(
      and(
        eq(attachments.organizationId, ctx.orgId),
        eq(attachments.patientId, data.patientId),
        isNull(attachments.archivedAt),
        data.kind === "all" ? undefined : eq(attachments.kind, data.kind),
        data.from ? gte(attachments.takenOn, data.from) : undefined,
        data.to ? lte(attachments.takenOn, data.to) : undefined,
      ),
    )
    .orderBy(desc(attachments.createdAt));
  const ids = rows.map((r) => r.attachment.id);
  const links = ids.length
    ? await ctx.db
        .select({ link: attachmentLinks, procedureName: treatmentItems.procedureName, locationLabel: treatmentItems.locationLabel })
        .from(attachmentLinks)
        .leftJoin(treatmentItems, eq(treatmentItems.id, attachmentLinks.treatmentItemId))
        .where(and(eq(attachmentLinks.organizationId, ctx.orgId), inArray(attachmentLinks.attachmentId, ids)))
    : [];
  const filtered = data.treatmentItemId ? rows.filter((r) => links.some((l) => l.link.attachmentId === r.attachment.id && l.link.treatmentItemId === data.treatmentItemId)) : rows;
  return filtered.map((r) => ({
    ...r.attachment,
    uploaderName: r.uploaderName,
    links: links.filter((l) => l.link.attachmentId === r.attachment.id).map((l) => ({ ...l.link, procedureName: l.procedureName, locationLabel: l.locationLabel })),
    thumbUrl: r.attachment.thumbnailKey ? signedFileUrl(ctx.orgId, r.attachment.id, "thumb") : null,
    url: signedFileUrl(ctx.orgId, r.attachment.id, "original"),
  }));
}

export type FileVariant = "original" | "thumb";
export const FILE_URL_TTL_SECONDS = 10 * 60;

function payload(orgId: string, id: string, variant: FileVariant, exp: number) {
  return `${orgId}.${id}.${variant}.${exp}`;
}

/** Link temporário (10 min) — ainda exige sessão autorizada no momento do download. */
export function signedFileUrl(orgId: string, attachmentId: string, variant: FileVariant, ttlSeconds = FILE_URL_TTL_SECONDS, nowMs = Date.now()): string {
  const exp = Math.floor(nowMs / 1000) + ttlSeconds;
  const sig = signValue("file", payload(orgId, attachmentId, variant, exp));
  return `/api/arquivos/${attachmentId}?v=${variant}&o=${orgId}&exp=${exp}&sig=${sig}`;
}

export async function profilePhotoUrl(ctx: Ctx, patientId: string): Promise<string | null> {
  const [row] = await ctx.db
    .select({ id: attachments.id })
    .from(attachments)
    .where(and(eq(attachments.organizationId, ctx.orgId), eq(attachments.patientId, patientId), eq(attachments.isProfilePhoto, true), isNull(attachments.archivedAt)));
  return row ? signedFileUrl(ctx.orgId, row.id, "thumb") : null;
}

export interface SignedRequest {
  attachmentId: string;
  orgId: string;
  variant: string;
  exp: string;
  sig: string;
}

/**
 * Leitura para a rota de download: valida assinatura, expiração, sessão,
 * vínculo ativo com a clínica e permissão sobre o objeto.
 */
export async function readSignedFile(db: Db, req: SignedRequest, userId: string | null, nowMs = Date.now()) {
  const variant: FileVariant = req.variant === "thumb" ? "thumb" : "original";
  const exp = Number(req.exp);
  if (!Number.isInteger(exp) || exp * 1000 < nowMs) throw new ForbiddenError("Link expirado");
  if (!verifySignature("file", payload(req.orgId, req.attachmentId, variant, exp), req.sig)) throw new ForbiddenError("Link inválido");
  if (!userId) throw new ForbiddenError("Entre para acessar o arquivo");
  const [att] = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.organizationId, req.orgId), eq(attachments.id, req.attachmentId), isNull(attachments.archivedAt)));
  if (!att) throw new NotFoundError("Arquivo");
  const [m] = await db
    .select({ permissions: roles.permissions })
    .from(memberships)
    .innerJoin(roles, and(eq(roles.id, memberships.roleId), eq(roles.organizationId, memberships.organizationId)))
    .where(and(eq(memberships.organizationId, att.organizationId), eq(memberships.userId, userId), eq(memberships.status, "active")));
  const perms = new Set(m?.permissions ?? []);
  const allowed = perms.has("attachments.view") || (att.isProfilePhoto && variant === "thumb" && perms.has("patients.view"));
  if (!allowed) throw new ForbiddenError();
  const key = variant === "thumb" && att.thumbnailKey ? att.thumbnailKey : att.storageKey;
  const bytes = await getStorage().get(key);
  return {
    bytes,
    mimeType: variant === "thumb" && att.thumbnailKey ? "image/webp" : att.mimeType,
    fileName: att.originalName,
    inline: att.mimeType.startsWith("image/"),
  };
}

export async function archiveAttachment(ctx: Ctx, attachmentId: string, reason: string) {
  assertCan(ctx, "attachments.upload");
  const [row] = await ctx.db
    .update(attachments)
    .set({ archivedAt: new Date(), isProfilePhoto: false })
    .where(and(eq(attachments.organizationId, ctx.orgId), eq(attachments.id, attachmentId), isNull(attachments.archivedAt)))
    .returning({ id: attachments.id, patientId: attachments.patientId });
  if (!row) throw new NotFoundError("Arquivo");
  await audit(ctx.db, ctx, { action: "attachment.archive", entityType: "attachment", entityId: row.id, summary: `Arquivo arquivado: ${reason}` });
}

export async function setProfilePhoto(ctx: Ctx, attachmentId: string) {
  assertCan(ctx, "patients.edit");
  const [att] = await ctx.db.select().from(attachments).where(and(eq(attachments.organizationId, ctx.orgId), eq(attachments.id, attachmentId)));
  if (!att) throw new NotFoundError("Arquivo");
  if (!att.mimeType.startsWith("image/")) throw new BusinessRuleError("Escolha uma imagem");
  if (!can(ctx, "attachments.view")) throw new ForbiddenError();
  await ctx.db.transaction(async (tx) => {
    await tx.update(attachments).set({ isProfilePhoto: false }).where(and(eq(attachments.organizationId, ctx.orgId), eq(attachments.patientId, att.patientId)));
    await tx.update(attachments).set({ isProfilePhoto: true }).where(eq(attachments.id, att.id));
  });
}
