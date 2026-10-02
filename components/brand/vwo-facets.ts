// Hello World
/**
 * Facetas vetoriais da marca Vira Web Odonto.
 * Geradas a partir da logo original (viraweb3.png) por segmentação de cor + soldagem de vértices;
 * cada faceta é um polígono independente para permitir animações de entrada sem alterar a imagem.
 */

export type VwoFacetGroup = "descent" | "core" | "ascent"

export interface VwoFacet {
  id: string
  group: VwoFacetGroup
  fill: string
  points: string
  /** Centroide da faceta, usado como origem das transformações. */
  cx: number
  cy: number
}

export const VWO_MARK_VIEWBOX = "0 0 766 621"
export const VWO_MARK_WIDTH = 766
export const VWO_MARK_HEIGHT = 621

export const VWO_FACETS: readonly VwoFacet[] = [
  { id: "descent-cap", group: "descent", fill: "#132a46", points: "2,93.5 84.7,239.5 223.5,92.5", cx: 103.4, cy: 141.8 },
  { id: "descent-upper", group: "descent", fill: "#113f73", points: "307,243.5 223.5,92.5 84.7,239.5", cx: 205.1, cy: 191.8 },
  { id: "descent-lower", group: "descent", fill: "#2965ae", points: "84.7,239.5 200.5,446 307,243.5", cx: 197.4, cy: 309.7 },
  { id: "descent-arrow", group: "descent", fill: "#132a46", points: "307,243.5 200.5,446 245,527.5 184,527.5 299,616.5 415,525.5 352,524 386.7,465.5 409,421.5", cx: 310.9, cy: 477.5 },
  { id: "core-apex", group: "core", fill: "#f2bf12", points: "489,286.5 409,421.5 386.7,465.5 474,465 529,377", cx: 457.5, cy: 403.1 },
  { id: "core-notch", group: "core", fill: "#e4a009", points: "386.7,465.5 430.5,534 474,465", cx: 430.4, cy: 488.2 },
  { id: "core-crest", group: "core", fill: "#edb00e", points: "529,377 474,465 568.3,465.2", cx: 523.8, cy: 435.7 },
  { id: "core-base", group: "core", fill: "#edb00e", points: "386.7,465.5 352,524 415,525.5 299,616.5 480.5,619 430.5,534", cx: 393.9, cy: 547.4 },
  { id: "core-ember", group: "core", fill: "#e39907", points: "568.3,465.2 474,465 430.5,534 480.5,619", cx: 488.3, cy: 520.8 },
  { id: "ascent-glint", group: "ascent", fill: "#3aa7d4", points: "585.5,286.2 489,286.5 529,377", cx: 534.5, cy: 316.6 },
  { id: "ascent-shaft", group: "ascent", fill: "#246ba6", points: "585.5,286.2 529,377 568.3,465.2 637,344", cx: 580.0, cy: 368.1 },
  { id: "ascent-head", group: "ascent", fill: "#266ca6", points: "763,2 493,99.5 567,151.5 489,286.5 585.5,286.2", cx: 579.5, cy: 165.1 },
  { id: "ascent-edge", group: "ascent", fill: "#1958a5", points: "763,2 585.5,286.2 637,344 696,242.5 764,291.5", cx: 689.1, cy: 233.2 },
]
