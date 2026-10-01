import { createHash } from "node:crypto";
import { isValidCivil, type CivilDate } from "./dates";
import type { Cents } from "./money";
import { normalizeDescription } from "./text";

/**
 * Leitor de extratos OFX 1.x (SGML) e 2.x (XML). Extrai apenas o necessário
 * para conciliação; não interpreta o arquivo como lançamentos financeiros.
 */

export interface OfxTransaction {
  externalId: string | null;
  trnType: string | null;
  postedOn: CivilDate;
  amountCents: Cents;
  name: string | null;
  memo: string | null;
  checkNumber: string | null;
}

export interface OfxStatement {
  bankId: string | null;
  branchId: string | null;
  accountId: string | null;
  currency: string | null;
  periodStart: CivilDate | null;
  periodEnd: CivilDate | null;
  ledgerBalanceCents: Cents | null;
  ledgerBalanceDate: CivilDate | null;
  transactions: OfxTransaction[];
}

export class OfxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfxParseError";
  }
}

/** Decodifica respeitando CHARSET:1252 / ENCODING do cabeçalho OFX 1.x. */
export function decodeOfx(buffer: Uint8Array): string {
  const head = new TextDecoder("latin1").decode(buffer.slice(0, 600));
  const xmlEnc = /encoding="([^"]+)"/i.exec(head)?.[1]?.toLowerCase();
  const charset = /CHARSET:\s*([\w-]+)/i.exec(head)?.[1]?.toLowerCase();
  const encoding = /ENCODING:\s*([\w-]+)/i.exec(head)?.[1]?.toLowerCase();
  let label = "utf-8";
  if (xmlEnc) label = xmlEnc;
  else if (encoding === "utf-8" || charset === "utf-8") label = "utf-8";
  else if (charset === "1252" || charset === "windows-1252") label = "windows-1252";
  else if (charset === "iso-8859-1" || charset === "8859-1" || encoding === "usascii") label = "windows-1252";
  try {
    return new TextDecoder(label, { fatal: label === "utf-8" }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

function tagValue(block: string, tag: string): string | null {
  // Funciona para <TAG>valor</TAG> e para SGML sem fechamento (<TAG>valor\n).
  const re = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i");
  const m = re.exec(block);
  if (!m) return null;
  const v = decodeEntities(m[1]!.trim());
  return v === "" ? null : v;
}

function decodeEntities(v: string): string {
  return v
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function parseOfxDate(value: string | null): CivilDate | null {
  if (!value) return null;
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(value);
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  return isValidCivil(date) ? date : null;
}

/** Valores podem vir como "-123.45", "123,45" ou "+1.234,56" conforme o banco. */
export function parseOfxAmount(value: string | null): Cents | null {
  if (!value) return null;
  let s = value.trim().replace(/\s/g, "");
  let sign = 1;
  if (s.startsWith("-")) {
    sign = -1;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  let intPart: string;
  let dec = "";
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    intPart = s.slice(0, lastComma).replace(/\./g, "");
    dec = s.slice(lastComma + 1);
  } else if (lastDot > -1) {
    intPart = s.slice(0, lastDot).replace(/,/g, "");
    dec = s.slice(lastDot + 1);
  } else {
    intPart = s;
  }
  if (intPart === "") intPart = "0";
  if (!/^\d+$/.test(intPart) || !/^\d*$/.test(dec)) return null;
  // Arredonda frações além de 2 casas (alguns bancos usam 3+) com meia-unidade para cima.
  const decPadded = (dec + "000").slice(0, 3);
  let cents = BigInt(intPart) * 100n + BigInt(decPadded.slice(0, 2));
  if (Number(decPadded[2]) >= 5) cents += 1n;
  return sign * Number(cents);
}

export function parseOfx(text: string): OfxStatement {
  const body = text.replace(/\r\n?/g, "\n");
  if (!/<OFX>/i.test(body)) throw new OfxParseError("Arquivo não parece ser um extrato OFX");
  const stmt = /<STMTRS>([\s\S]*?)(<\/STMTRS>|$)/i.exec(body)?.[1] ?? /<CCSTMTRS>([\s\S]*?)(<\/CCSTMTRS>|$)/i.exec(body)?.[1];
  if (!stmt) throw new OfxParseError("Extrato bancário (STMTRS) não encontrado no arquivo");
  const acct = /<BANKACCTFROM>([\s\S]*?)(<\/BANKACCTFROM>|<BANKTRANLIST>)/i.exec(stmt)?.[1] ?? /<CCACCTFROM>([\s\S]*?)(<\/CCACCTFROM>|<BANKTRANLIST>)/i.exec(stmt)?.[1] ?? "";
  const tranList = /<BANKTRANLIST>([\s\S]*?)(<\/BANKTRANLIST>|<LEDGERBAL>|$)/i.exec(stmt)?.[1] ?? "";
  const ledger = /<LEDGERBAL>([\s\S]*?)(<\/LEDGERBAL>|<AVAILBAL>|$)/i.exec(stmt)?.[1] ?? "";

  const chunks = tranList.split(/<STMTTRN>/i).slice(1);
  const transactions: OfxTransaction[] = [];
  chunks.forEach((chunk, index) => {
    const block = chunk.split(/<\/STMTTRN>/i)[0] ?? chunk;
    const postedOn = parseOfxDate(tagValue(block, "DTPOSTED"));
    const amount = parseOfxAmount(tagValue(block, "TRNAMT"));
    if (!postedOn) throw new OfxParseError(`Transação ${index + 1}: data inválida`);
    if (amount === null) throw new OfxParseError(`Transação ${index + 1}: valor inválido`);
    transactions.push({
      externalId: tagValue(block, "FITID"),
      trnType: tagValue(block, "TRNTYPE"),
      postedOn,
      amountCents: amount,
      name: tagValue(block, "NAME") ?? tagValue(block, "PAYEE"),
      memo: tagValue(block, "MEMO"),
      checkNumber: tagValue(block, "CHECKNUM"),
    });
  });

  return {
    bankId: tagValue(acct, "BANKID"),
    branchId: tagValue(acct, "BRANCHID"),
    accountId: tagValue(acct, "ACCTID"),
    currency: tagValue(stmt, "CURDEF"),
    periodStart: parseOfxDate(tagValue(tranList, "DTSTART")),
    periodEnd: parseOfxDate(tagValue(tranList, "DTEND")),
    ledgerBalanceCents: parseOfxAmount(tagValue(ledger, "BALAMT")),
    ledgerBalanceDate: parseOfxDate(tagValue(ledger, "DTASOF")),
    transactions,
  };
}

/** Impressão digital usada quando não há FITID confiável. */
export function transactionFingerprint(accountKey: string, tx: Pick<OfxTransaction, "postedOn" | "amountCents" | "name" | "memo">): string {
  return createHash("sha256")
    .update([accountKey, tx.postedOn, String(tx.amountCents), normalizeDescription(tx.name), normalizeDescription(tx.memo)].join("|"))
    .digest("hex");
}

export function maskAccount(accountId: string | null): string | null {
  if (!accountId) return null;
  const clean = accountId.replace(/\s/g, "");
  return clean.length <= 4 ? clean : `•••${clean.slice(-4)}`;
}
