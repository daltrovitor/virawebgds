/**
 * Numeração FDI (ISO 3950).
 * Permanentes: quadrantes 1–4, posições 1–8 (11–18, 21–28, 31–38, 41–48).
 * Decíduos:    quadrantes 5–8, posições 1–5 (51–55, 61–65, 71–75, 81–85).
 * A seleção de dentes serve para localizar procedimentos; não é diagnóstico.
 */

export type Dentition = "permanent" | "deciduous";
export type Arch = "upper" | "lower";
/** Hemiarcadas identificadas pelo quadrante permanente equivalente. */
export type Hemiarch = 1 | 2 | 3 | 4;

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

/** Quadrante decíduo 5→1, 6→2, 7→3, 8→4. */
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
const DECIDUOUS_NAMES = ["incisivo central", "incisivo lateral", "canino", "primeiro molar", "segundo molar"];

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

/** Ordem de exibição do odontograma, lado direito do paciente à esquerda do observador. */
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

/** Interpreta "11, 12 21-23" como lista de dentes (intervalos dentro do mesmo quadrante). */
export function parseTeethList(input: string): { teeth: number[]; invalid: string[] } {
  const teeth = new Set<number>();
  const invalid: string[] = [];
  for (const token of input.split(/[\s,;]+/).filter(Boolean)) {
    const range = /^(\d{2})-(\d{2})$/.exec(token);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      if (quadrantOf(a) !== quadrantOf(b) || !isValidTooth(a) || !isValidTooth(b)) {
        invalid.push(token);
        continue;
      }
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      for (let t = lo; t <= hi; t++) teeth.add(t);
      continue;
    }
    const n = Number(token);
    if (/^\d{2}$/.test(token) && isValidTooth(n)) teeth.add(n);
    else invalid.push(token);
  }
  return { teeth: [...teeth].sort((x, y) => x - y), invalid };
}
