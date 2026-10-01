/**
 * CSV para Excel pt-BR (separador ";", BOM UTF-8) com proteção contra
 * injeção de fórmulas: células iniciadas por = + - @ tab ou CR recebem apóstrofo.
 */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

const DANGEROUS = /^[=+\-@\t\r]/;
/** Números negativos simples ("-12,34") não são fórmulas. */
const NUMERIC = /^-\d+([.,]\d+)?$/;
const BOM = String.fromCharCode(0xfeff);

export function sanitizeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "number" ? String(value) : value;
  if (typeof value === "string" && DANGEROUS.test(s) && !NUMERIC.test(s)) s = `'${s}`;
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map((c) => sanitizeCell(c.header)).join(";")];
  for (const row of rows) lines.push(columns.map((c) => sanitizeCell(c.value(row))).join(";"));
  return BOM + lines.join("\r\n");
}

/** Centavos como texto decimal pt-BR para planilhas ("1234,56"). Números não são texto perigoso. */
export function centsForCsv(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const neg = cents < 0;
  const abs = Math.abs(cents);
  return `${neg ? "-" : ""}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}
