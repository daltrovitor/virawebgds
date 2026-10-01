/** Normalização para comparação: sem acentos, maiúsculas, espaços simples. */
export function normalizeDescription(v: string | null | undefined): string {
  return (v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Busca sem acento e sem diferenciar maiúsculas. */
export function searchKey(v: string | null | undefined): string {
  return normalizeDescription(v).toLowerCase();
}

export function onlyDigits(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

/** CPF: 11 dígitos com dígitos verificadores válidos. */
export function isValidCpf(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

/** Exibe apenas os 3 últimos dígitos antes do verificador: ***.***.*89-01. */
export function maskCpf(value: string | null | undefined): string {
  const d = onlyDigits(value);
  if (d.length !== 11) return "—";
  return `***.***.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatCpf(value: string | null | undefined): string {
  const d = onlyDigits(value);
  if (d.length !== 11) return value ?? "";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatPhone(value: string | null | undefined): string {
  const d = onlyDigits(value);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value ?? "";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (first + last).toUpperCase();
}
