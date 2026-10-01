// Hello World
/**
 * Numeração FDI (ISO 3950).
 * Permanentes: quadrantes 1–4, posições 1–8 (11–18, 21–28, 31–38, 41–48).
 * Decíduos:    quadrantes 5–8, posições 1–5 (51–55, 61–65, 71–75, 81–85).
 */

export type Dentition = "permanent" | "deciduous";
export type Arch = "upper" | "lower";
export type Hemiarch = 1 | 2 | 3 | 4;

export type ToothCondition =
  | "healthy"
  | "caries"
  | "restored"
  | "endodontic"
  | "implant"
  | "prosthesis"
  | "extraction_indicated"
  | "missing"
  | "orthodontic";

export const TOOTH_CONDITION_LABELS: Record<ToothCondition, string> = {
  healthy: "Sadio",
  caries: "Cárie",
  restored: "Restaurado",
  endodontic: "Tratamento de Canal (Endo)",
  implant: "Implante",
  prosthesis: "Prótese / Coroa",
  extraction_indicated: "Extração Indicada",
  missing: "Ausente / Extraído",
  orthodontic: "Aparelho Ortodôntico",
};

export const TOOTH_CONDITION_COLORS: Record<ToothCondition, { bg: string; text: string; border: string }> = {
  healthy: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300" },
  caries: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-400" },
  restored: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300" },
  endodontic: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-300" },
  implant: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300" },
  prosthesis: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-300" },
  extraction_indicated: { bg: "bg-red-100", text: "text-red-800", border: "border-red-500" },
  missing: { bg: "bg-slate-100", text: "text-slate-400", border: "border-slate-300" },
  orthodontic: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-300" },
};

export const HEMIARCHES: readonly Hemiarch[] = [1, 2, 3, 4];
export const ARCHES: readonly Arch[] = ["upper", "lower"];

export function isValidTooth(fdi: number): boolean {
  if (!Number.isInteger(fdi)) return false;
  const q = Math.floor(fdi / 10);
  const p = fdi % 10;
  if (q >= 1 && q <= 4) return p >= 1 && p <= 8;
  if (q >= 5 && q <= 8) return p >= 1 && p <= 5;
  return false;
}

export function dentitionOf(fdi: number): Dentition {
  return Math.floor(fdi / 10) >= 5 ? "deciduous" : "permanent";
}

export function quadrantOf(fdi: number): number {
  return Math.floor(fdi / 10);
}

export function hemiarchOf(fdi: number): Hemiarch {
  const q = quadrantOf(fdi);
  return (q > 4 ? q - 4 : q) as Hemiarch;
}

export function archOf(fdi: number): Arch {
  const h = hemiarchOf(fdi);
  return h === 1 || h === 2 ? "upper" : "lower";
}

const PERMANENT_NAMES = [
  "incisivo central",
  "incisivo lateral",
  "canino",
  "primeiro pré-molar",
  "segundo pré-molar",
  "primeiro molar",
  "segundo molar",
  "terceiro molar",
];

const DECIDUOUS_NAMES = [
  "incisivo central",
  "incisivo lateral",
  "canino",
  "primeiro molar",
  "segundo molar",
];

export const HEMIARCH_LABEL: Record<Hemiarch, string> = {
  1: "superior direita",
  2: "superior esquerda",
  3: "inferior esquerda",
  4: "inferior direita",
};

export const ARCH_LABEL: Record<Arch, string> = {
  upper: "Arcada superior",
  lower: "Arcada inferior",
};

export function toothName(fdi: number): string {
  if (!isValidTooth(fdi)) return `dente ${fdi}`;
  const pos = fdi % 10;
  const deciduous = dentitionOf(fdi) === "deciduous";
  const name = (deciduous ? DECIDUOUS_NAMES : PERMANENT_NAMES)[pos - 1]!;
  const side = HEMIARCH_LABEL[hemiarchOf(fdi)];
  return `${name} ${side}${deciduous ? " (decíduo)" : ""}`;
}

export function odontogramRows(dentition: Dentition): { upper: number[]; lower: number[] } {
  if (dentition === "permanent") {
    return {
      upper: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
      lower: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
    };
  }
  return {
    upper: [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
    lower: [85, 84, 83, 82, 81, 71, 72, 73, 74, 75],
  };
}

export function allTeeth(dentition: Dentition): number[] {
  const rows = odontogramRows(dentition);
  return [...rows.upper, ...rows.lower];
}

export function parseTeethList(input: string): { teeth: number[]; invalid: string[] } {
  const teeth = new Set<number>();
  const invalid: string[] = [];
  for (const token of input.split(/[\s,;]+/).filter(Boolean)) {
    if (token.includes("-")) {
      const [startStr, endStr] = token.split("-");
      const start = Number(startStr);
      const end = Number(endStr);
      if (isValidTooth(start) && isValidTooth(end) && Math.floor(start / 10) === Math.floor(end / 10)) {
        const [min, max] = start <= end ? [start, end] : [end, start];
        for (let t = min; t <= max; t++) {
          if (isValidTooth(t)) teeth.add(t);
        }
        continue;
      }
      invalid.push(token);
      continue;
    }
    const num = Number(token);
    if (isValidTooth(num)) {
      teeth.add(num);
    } else {
      invalid.push(token);
    }
  }
  return { teeth: [...teeth].sort((a, b) => a - b), invalid };
}
