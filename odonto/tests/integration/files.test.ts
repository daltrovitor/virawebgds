import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "../../src/server/db/client";
import { ForbiddenError, ValidationError } from "../../src/server/errors";
import { listGallery, readSignedFile, signedFileUrl, uploadAttachment } from "../../src/server/services/attachments";
import { quickCreatePatient } from "../../src/server/services/patients";
import { LocalStorage, setStorageForTests } from "../../src/server/storage";
import { createClinic, createTestDb, type Clinic } from "./helpers";

let h: DbHandle;
let clinicA: Clinic;
let clinicB: Clinic;
let patientId: string;
let dir: string;
let png: Uint8Array;

function parseUrl(url: string) {
  const u = new URL(url, "http://local");
  return {
    attachmentId: u.pathname.split("/").pop()!,
    orgId: u.searchParams.get("o")!,
    variant: u.searchParams.get("v")!,
    exp: u.searchParams.get("exp")!,
    sig: u.searchParams.get("sig")!,
  };
}

beforeAll(async () => {
  h = await createTestDb();
  dir = mkdtempSync(join(tmpdir(), "odonto-files-"));
  setStorageForTests(new LocalStorage(dir));
  clinicA = await createClinic(h.db, "Clínica Arquivos A");
  clinicB = await createClinic(h.db, "Clínica Arquivos B");
  const p = await quickCreatePatient(await clinicA.ctx("reception"), { fullName: "Paciente Galeria", phone: "62977770001" });
  if (p.status !== "created") throw new Error("paciente");
  patientId = p.id;
  png = new Uint8Array(await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 220, b: 210 } } }).png().toBuffer());
});

afterAll(async () => {
  setStorageForTests(null);
  rmSync(dir, { recursive: true, force: true });
  await h.sql.end();
});

describe("galeria e arquivos privados", () => {
  it("cenário 19: imagem aparece na galeria e só usuários autorizados acessam; link expirado não funciona", async () => {
    const dentist = await clinicA.ctx("dentist");
    const up = await uploadAttachment(dentist, { patientId, kind: "photo", originalName: "sorriso-frontal.png", takenOn: "2026-10-01", description: "Foto inicial", tooth: 11, bytes: png });
    expect(up.mimeType).toBe("image/png");
    const gallery = await listGallery(dentist, { patientId });
    expect(gallery).toHaveLength(1);
    expect(gallery[0]!.thumbUrl).toBeTruthy();
    expect(gallery[0]!.links[0]!.tooth).toBe(11);

    const url = parseUrl(gallery[0]!.url);
    const file = await readSignedFile(h.db, url, clinicA.users.dentist);
    expect(Buffer.from(file.bytes).equals(Buffer.from(png))).toBe(true); // original preservado
    const thumb = await readSignedFile(h.db, parseUrl(gallery[0]!.thumbUrl!), clinicA.users.owner);
    expect(thumb.mimeType).toBe("image/webp");

    // Recepção (sem permissão de imagens), outra clínica e sem sessão: negado.
    await expect(readSignedFile(h.db, url, clinicA.users.reception)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(readSignedFile(h.db, url, clinicB.users.owner)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(readSignedFile(h.db, url, null)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listGallery(await clinicA.ctx("reception"), { patientId })).rejects.toThrow(/permissão/);

    // Link expirado ou adulterado
    const expired = parseUrl(signedFileUrl(clinicA.orgId, up.id, "original", 60, Date.now() - 3600_000));
    await expect(readSignedFile(h.db, expired, clinicA.users.dentist)).rejects.toThrow(/expirado/);
    await expect(readSignedFile(h.db, { ...url, attachmentId: up.id, sig: url.sig.slice(0, -2) + "xx" }, clinicA.users.dentist)).rejects.toThrow(/inválido/);
    await expect(readSignedFile(h.db, { ...url, orgId: clinicB.orgId }, clinicB.users.owner)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("recusa conteúdo não suportado, SVG e executáveis, independente da extensão", async () => {
    const dentist = await clinicA.ctx("dentist");
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await expect(uploadAttachment(dentist, { patientId, kind: "photo", originalName: "foto.png", bytes: svg })).rejects.toBeInstanceOf(ValidationError);
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03]);
    await expect(uploadAttachment(dentist, { patientId, kind: "document", originalName: "laudo.pdf", bytes: exe })).rejects.toBeInstanceOf(ValidationError);
    const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]);
    await expect(uploadAttachment(dentist, { patientId, kind: "photo", originalName: "x.jpg", bytes: fakeJpeg })).rejects.toThrow(/corrompida/);
    const pdf = new TextEncoder().encode("%PDF-1.4\n%sintético\n");
    const doc = await uploadAttachment(dentist, { patientId, kind: "document", originalName: "termo.pdf", bytes: pdf });
    expect(doc.mimeType).toBe("application/pdf");
    // Paciente de outra clínica não recebe upload
    await expect(uploadAttachment(await clinicB.ctx("owner"), { patientId, kind: "photo", originalName: "a.png", bytes: png })).rejects.toThrow(/não encontrado/);
  });
});
