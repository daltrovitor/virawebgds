import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Segredo da aplicação (assinatura de links temporários e criptografia de
 * segredos MFA). Em produção é obrigatório; em desenvolvimento/teste usa um
 * valor local fixo, nunca válido fora da máquina.
 */
export function appSecret(): string {
  const value = process.env.APP_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_INSECURE_DEV_SECRET !== "true") {
    throw new Error("APP_SECRET ausente ou curto (mínimo 32 caracteres)");
  }
  return "dev-only-secret-do-not-use-in-production-0123456789";
}

function key(purpose: string): Buffer {
  return createHash("sha256").update(`${purpose}:${appSecret()}`).digest();
}

export function signValue(purpose: string, payload: string): string {
  return createHmac("sha256", key(purpose)).update(payload).digest("base64url");
}

export function verifySignature(purpose: string, payload: string, signature: string): boolean {
  const expected = Buffer.from(signValue(purpose, payload));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("enc"), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptSecret(value: string): string {
  const [v, iv, tag, data] = value.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("segredo em formato inválido");
  const decipher = createDecipheriv("aes-256-gcm", key("enc"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
