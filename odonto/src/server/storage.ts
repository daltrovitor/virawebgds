import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

/**
 * Armazenamento privado de arquivos. Nada é público: o download passa sempre
 * pela rota autenticada com link temporário assinado.
 */
export interface StorageAdapter {
  readonly driver: "local" | "supabase";
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}

const KEY_RE = /^[a-z0-9][a-z0-9/_.-]{0,300}$/;

function assertKey(key: string) {
  if (!KEY_RE.test(key) || key.includes("..")) throw new Error("chave de armazenamento inválida");
}

export class LocalStorage implements StorageAdapter {
  readonly driver = "local" as const;
  private readonly root: string;
  constructor(root: string) {
    this.root = resolve(root);
  }
  private path(key: string) {
    assertKey(key);
    const full = resolve(join(this.root, key));
    if (!full.startsWith(this.root + sep)) throw new Error("caminho fora do armazenamento");
    return full;
  }
  async put(key: string, data: Uint8Array) {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data, { flag: "wx" });
  }
  async get(key: string) {
    return new Uint8Array(await readFile(this.path(key)));
  }
  async remove(key: string) {
    await rm(this.path(key), { force: true });
  }
}

/** Supabase Storage (bucket privado) via API REST com a chave de serviço, apenas no servidor. */
export class SupabaseStorage implements StorageAdapter {
  readonly driver = "supabase" as const;
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
    private readonly bucket: string,
  ) {}
  private headers(extra: Record<string, string> = {}) {
    return { Authorization: `Bearer ${this.serviceKey}`, apikey: this.serviceKey, ...extra };
  }
  async put(key: string, data: Uint8Array, contentType: string) {
    assertKey(key);
    const res = await fetch(`${this.url}/storage/v1/object/${this.bucket}/${key}`, {
      method: "POST",
      headers: this.headers({ "Content-Type": contentType, "x-upsert": "false" }),
      body: Buffer.from(data),
    });
    if (!res.ok) throw new Error(`falha ao gravar arquivo (${res.status})`);
  }
  async get(key: string) {
    assertKey(key);
    const res = await fetch(`${this.url}/storage/v1/object/authenticated/${this.bucket}/${key}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`falha ao ler arquivo (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }
  async remove(key: string) {
    assertKey(key);
    await fetch(`${this.url}/storage/v1/object/${this.bucket}/${key}`, { method: "DELETE", headers: this.headers() });
  }
}

let cached: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (cached) return cached;
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "supabase") {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "clinic-files";
    if (!url || !key) throw new Error("STORAGE_DRIVER=supabase exige SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
    cached = new SupabaseStorage(url.replace(/\/$/, ""), key, bucket);
  } else {
    // Em plataformas serverless o disco é efêmero: arquivos de pacientes seriam perdidos.
    if (process.env.NODE_ENV === "production" && process.env.VERCEL) {
      throw new Error("Armazenamento local não é permitido em produção serverless; configure STORAGE_DRIVER=supabase");
    }
    cached = new LocalStorage(process.env.STORAGE_LOCAL_DIR ?? join(process.cwd(), "storage"));
  }
  return cached;
}

/** Permite injetar armazenamento nos testes. */
export function setStorageForTests(adapter: StorageAdapter | null) {
  cached = adapter;
}
