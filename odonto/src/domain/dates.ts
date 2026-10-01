/**
 * Datas civis ("YYYY-MM-DD") são tratadas como texto e aritmética de calendário,
 * nunca como instantes: um vencimento não muda de dia por conversão UTC.
 * Instantes (consultas, auditoria) são convertidos usando o fuso da clínica.
 */

export type CivilDate = string; // YYYY-MM-DD

const CIVIL_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(year: number, month1to12: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month1to12 - 1]!;
}

export function parseCivil(value: string): { y: number; m: number; d: number } {
  const match = CIVIL_RE.exec(value);
  if (!match) throw new RangeError(`data inválida: ${value}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) throw new RangeError(`data inválida: ${value}`);
  return { y, m, d };
}

export function isValidCivil(value: unknown): value is CivilDate {
  if (typeof value !== "string") return false;
  try {
    parseCivil(value);
    return true;
  } catch {
    return false;
  }
}

export function civil(y: number, m: number, d: number): CivilDate {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Dias desde 1970-01-01 (aritmética pura de calendário, sem fuso). */
function toDayNumber(date: CivilDate): number {
  const { y, m, d } = parseCivil(date);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function fromDayNumber(n: number): CivilDate {
  const dt = new Date(n * 86_400_000);
  return civil(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(date: CivilDate, days: number): CivilDate {
  return fromDayNumber(toDayNumber(date) + days);
}

export function diffDays(a: CivilDate, b: CivilDate): number {
  return toDayNumber(a) - toDayNumber(b);
}

export function compareCivil(a: CivilDate, b: CivilDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 0 = domingo … 6 = sábado. */
export function weekdayOf(date: CivilDate): number {
  const { y, m, d } = parseCivil(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Segunda-feira da semana da data. */
export function startOfWeekMonday(date: CivilDate): CivilDate {
  const wd = weekdayOf(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

export function startOfMonth(date: CivilDate): CivilDate {
  const { y, m } = parseCivil(date);
  return civil(y, m, 1);
}

export function endOfMonth(date: CivilDate): CivilDate {
  const { y, m } = parseCivil(date);
  return civil(y, m, daysInMonth(y, m));
}

/**
 * Soma meses preservando o dia original. Dia 30 + 1 mês a partir de janeiro
 * vira o último dia de fevereiro; o cálculo é sempre feito a partir da data-base,
 * então o mês seguinte volta ao dia 30.
 */
export function addMonthsPreservingDay(base: CivilDate, months: number, dayOverride?: number): CivilDate {
  const { y, m, d } = parseCivil(base);
  const index = y * 12 + (m - 1) + months;
  const ty = Math.floor(index / 12);
  const tm = (index % 12) + 1;
  const day = Math.min(dayOverride ?? d, daysInMonth(ty, tm));
  return civil(ty, tm, day);
}

/** Vencimentos mensais: n datas a partir da primeira, sem somar 30 dias. */
export function monthlySchedule(firstDue: CivilDate, count: number): CivilDate[] {
  return Array.from({ length: count }, (_, i) => addMonthsPreservingDay(firstDue, i));
}

export function formatDateBR(date: CivilDate | null | undefined): string {
  if (!date) return "—";
  const { y, m, d } = parseCivil(date);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/** "31/12/2026" → "2026-12-31"; null se inválida. */
export function parseDateBR(value: string): CivilDate | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const candidate = civil(Number(match[3]), Number(match[2]), Number(match[1]));
  return isValidCivil(candidate) ? candidate : null;
}

export function ageOn(birth: CivilDate, today: CivilDate): number {
  const b = parseCivil(birth);
  const t = parseCivil(today);
  let age = t.y - b.y;
  if (t.m < b.m || (t.m === b.m && t.d < b.d)) age--;
  return age;
}

// ---------------------------------------------------------------------------
// Fuso horário (instantes ↔ horário de parede da clínica)
// ---------------------------------------------------------------------------

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(tz, f);
  }
  return f;
}

export function zonedParts(instant: Date, tz: string) {
  const parts = partsFormatter(tz).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    y: get("year"),
    m: get("month"),
    d: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function offsetMs(instant: Date, tz: string): number {
  const p = zonedParts(instant, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Converte data civil + minutos desde 00:00 (horário local da clínica) em instante. */
export function zonedToInstant(date: CivilDate, minutesOfDay: number, tz: string): Date {
  const { y, m, d } = parseCivil(date);
  const guess = Date.UTC(y, m - 1, d, 0, minutesOfDay, 0);
  let result = guess - offsetMs(new Date(guess), tz);
  // Segunda passada corrige transições de horário de verão.
  result = guess - offsetMs(new Date(result), tz);
  return new Date(result);
}

export function instantToZoned(instant: Date, tz: string): { date: CivilDate; minutes: number } {
  const p = zonedParts(instant, tz);
  return { date: civil(p.y, p.m, p.d), minutes: p.hour * 60 + p.minute };
}

export function todayInTz(tz: string, now: Date = new Date()): CivilDate {
  return instantToZoned(now, tz).date;
}

export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "09:15" → 555; null se inválido. */
export function hhmmToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59 || (h === 24 && m !== 0)) return null;
  return h * 60 + m;
}

const WEEKDAYS_PT = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const WEEKDAYS_SHORT_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function weekdayNamePT(date: CivilDate, short = false): string {
  return (short ? WEEKDAYS_SHORT_PT : WEEKDAYS_PT)[weekdayOf(date)]!;
}

export function monthNamePT(month1to12: number): string {
  return MONTHS_PT[month1to12 - 1]!;
}

export function formatLongDatePT(date: CivilDate): string {
  const { y, m, d } = parseCivil(date);
  return `${weekdayNamePT(date)}, ${d} de ${monthNamePT(m)} de ${y}`;
}

export function formatDateTimeBR(instant: Date | string | null | undefined, tz: string): string {
  if (!instant) return "—";
  const dt = typeof instant === "string" ? new Date(instant) : instant;
  const z = instantToZoned(dt, tz);
  return `${formatDateBR(z.date)} ${minutesToHHMM(z.minutes)}`;
}
