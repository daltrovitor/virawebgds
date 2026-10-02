// Hello World
/**
 * Região odontológica de um procedimento de orçamento:
 * dente (FDI), hemiarco (quadrante), arcada inteira ou "sem região" (ex.: profilaxia, radiografia).
 */

import { isValidTooth, type Arch, type Hemiarch } from "./teeth"

export type DentalRegion =
  | { kind: "tooth"; tooth: number }
  | { kind: "hemiarch"; hemiarch: Hemiarch }
  | { kind: "arch"; arch: Arch }
  | { kind: "none" }

/** Rótulos no padrão usado pelas recepções (Hemi Arco Sup Dir, etc.). */
export const HEMIARCH_SHORT: Record<Hemiarch, string> = {
  1: "Hemiarco sup. direito",
  2: "Hemiarco sup. esquerdo",
  3: "Hemiarco inf. esquerdo",
  4: "Hemiarco inf. direito",
}

export function regionLabel(region: DentalRegion): string {
  switch (region.kind) {
    case "tooth": return `Dente ${region.tooth}`
    case "hemiarch": return HEMIARCH_SHORT[region.hemiarch]
    case "arch": return region.arch === "upper" ? "Arcada superior" : "Arcada inferior"
    default: return "Sem região"
  }
}

/** Rótulo curto para colunas estreitas ("31", "Q1", "Sup.", "—"). */
export function regionShort(region: DentalRegion): string {
  switch (region.kind) {
    case "tooth": return String(region.tooth)
    case "hemiarch": return `Q${region.hemiarch}`
    case "arch": return region.arch === "upper" ? "Sup." : "Inf."
    default: return "Sem região"
  }
}

/** Serialização estável para a coluna `budget_items.region` (migração 071). */
export function encodeRegion(region: DentalRegion): string {
  switch (region.kind) {
    case "tooth": return `tooth:${region.tooth}`
    case "hemiarch": return `hemiarch:${region.hemiarch}`
    case "arch": return `arch:${region.arch}`
    default: return "none"
  }
}

export function decodeRegion(value: string | null | undefined, tooth?: number | null): DentalRegion {
  if (typeof tooth === "number" && isValidTooth(tooth)) return { kind: "tooth", tooth }
  if (!value) return { kind: "none" }
  const [kind, raw] = value.split(":")
  if (kind === "tooth") {
    const n = Number(raw)
    return isValidTooth(n) ? { kind: "tooth", tooth: n } : { kind: "none" }
  }
  if (kind === "hemiarch") {
    const n = Number(raw)
    return n >= 1 && n <= 4 ? { kind: "hemiarch", hemiarch: n as Hemiarch } : { kind: "none" }
  }
  if (kind === "arch" && (raw === "upper" || raw === "lower")) return { kind: "arch", arch: raw }
  return { kind: "none" }
}

const SUFFIX_SEPARATOR = " · "

/**
 * Sem a migração 071 a região vai como sufixo no nome do item ("Faceta · Dente 31"),
 * garantindo que a informação apareça em qualquer tela ou impressão.
 */
export function withRegionSuffix(name: string, region: DentalRegion): string {
  return region.kind === "none" ? name : `${name}${SUFFIX_SEPARATOR}${regionLabel(region)}`
}

/** Recupera nome e região de itens gravados com sufixo. */
export function splitRegionSuffix(name: string): { name: string; region: DentalRegion } {
  const idx = name.lastIndexOf(SUFFIX_SEPARATOR)
  if (idx === -1) return { name, region: { kind: "none" } }
  const base = name.slice(0, idx)
  const label = name.slice(idx + SUFFIX_SEPARATOR.length)
  const tooth = /^Dente (\d{2})$/.exec(label)
  if (tooth) return { name: base, region: { kind: "tooth", tooth: Number(tooth[1]) } }
  const hemi = (Object.entries(HEMIARCH_SHORT) as [string, string][]).find(([, l]) => l === label)
  if (hemi) return { name: base, region: { kind: "hemiarch", hemiarch: Number(hemi[0]) as Hemiarch } }
  if (label === "Arcada superior") return { name: base, region: { kind: "arch", arch: "upper" } }
  if (label === "Arcada inferior") return { name: base, region: { kind: "arch", arch: "lower" } }
  return { name, region: { kind: "none" } }
}

/** Resolve nome + região de um item de orçamento, venha ele das colunas novas ou do sufixo legado. */
export function resolveItemRegion(item: { product_name: string; tooth?: number | null; region?: string | null }): {
  name: string
  region: DentalRegion
} {
  if (item.region || typeof item.tooth === "number") {
    return { name: item.product_name, region: decodeRegion(item.region ?? null, item.tooth ?? null) }
  }
  return splitRegionSuffix(item.product_name)
}

export function regionSortKey(region: DentalRegion): number {
  switch (region.kind) {
    case "tooth": return region.tooth
    case "hemiarch": return 100 + region.hemiarch
    case "arch": return region.arch === "upper" ? 110 : 111
    default: return 200
  }
}
