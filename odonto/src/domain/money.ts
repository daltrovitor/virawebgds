/**
 * Dinheiro sempre em centavos inteiros (number seguro até 2^53).
 * Nenhum cálculo monetário usa ponto flutuante binário: multiplicações e
 * rateios passam por BigInt.
 */

export type Cents = number;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

export function assertCents(value: number, label = "valor"): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} deve ser um número inteiro de centavos`);
  }
  return value;
}

export function sumCents(values: readonly number[]): Cents {
  let total = 0n;
  for (const v of values) total += BigInt(assertCents(v));
  return toSafe(total);
}

function toSafe(v: bigint): Cents {
  if (v > BigInt(Number.MAX_SAFE_INTEGER) || v < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new MoneyError("valor fora do intervalo suportado");
  }
  return Number(v);
}

/** Multiplica centavos por uma quantidade inteira. */
export function multiplyCents(unit: Cents, quantity: number): Cents {
  assertCents(unit);
  if (!Number.isSafeInteger(quantity)) throw new MoneyError("quantidade deve ser inteira");
  return toSafe(BigInt(unit) * BigInt(quantity));
}

/**
 * Divide um total em `parts` parcelas inteiras cuja soma é exatamente o total.
 * Regra documentada: os centavos restantes vão para as primeiras parcelas.
 * Ex.: 10000 em 3 → [3334, 3333, 3333].
 */
export function splitEvenly(total: Cents, parts: number): Cents[] {
  assertCents(total, "total");
  if (!Number.isInteger(parts) || parts <= 0) throw new MoneyError("quantidade de parcelas inválida");
  if (total < 0) throw new MoneyError("total não pode ser negativo");
  const base = Math.floor(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Rateio proporcional determinístico (maiores restos). A soma do resultado é
 * exatamente `total`. Empates de resto favorecem o menor índice.
 */
export function prorate(total: Cents, weights: readonly number[]): Cents[] {
  assertCents(total, "total");
  if (weights.length === 0) {
    if (total !== 0) throw new MoneyError("não há itens para ratear");
    return [];
  }
  const w = weights.map((x) => BigInt(assertCents(x, "peso")));
  if (w.some((x) => x < 0n)) throw new MoneyError("pesos não podem ser negativos");
  const sumW = w.reduce((a, b) => a + b, 0n);
  if (sumW === 0n) {
    // Sem base proporcional: distribui igualmente.
    return splitEvenly(total, weights.length);
  }
  const T = BigInt(total);
  const floors = w.map((x) => (T * x) / sumW);
  const remainders = w.map((x, i) => ({ i, r: (T * x) % sumW }));
  let distributed = floors.reduce((a, b) => a + b, 0n);
  remainders.sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  const result = floors.slice();
  let k = 0;
  while (distributed < T) {
    const target = remainders[k % remainders.length]!;
    result[target.i] = result[target.i]! + 1n;
    distributed += 1n;
    k++;
  }
  return result.map(toSafe);
}

export type DiscountInput =
  | { type: "none" }
  | { type: "amount"; cents: Cents }
  /** Percentual em pontos-base: 10% = 1000; 7,5% = 750. */
  | { type: "percent"; basisPoints: number };

/**
 * Desconto global: em reais OU percentual sobre o subtotal, nunca ambos.
 * Percentual arredonda meio centavo para cima (half-up) de forma determinística.
 */
export function computeDiscount(subtotal: Cents, discount: DiscountInput): Cents {
  assertCents(subtotal, "subtotal");
  if (subtotal < 0) throw new MoneyError("subtotal não pode ser negativo");
  let value: Cents;
  switch (discount.type) {
    case "none":
      value = 0;
      break;
    case "amount":
      value = assertCents(discount.cents, "desconto");
      break;
    case "percent": {
      const bp = discount.basisPoints;
      if (!Number.isInteger(bp) || bp < 0 || bp > 10000) {
        throw new MoneyError("percentual de desconto deve estar entre 0% e 100%");
      }
      value = toSafe((BigInt(subtotal) * BigInt(bp) + 5000n) / 10000n);
      break;
    }
  }
  if (value < 0) throw new MoneyError("desconto não pode ser negativo");
  if (value > subtotal) throw new MoneyError("desconto não pode exceder o subtotal");
  return value;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const WORD_JOINER = String.fromCharCode(0x2060);

/** Apresentação apenas; não usar o resultado em cálculos. */
export function formatBRL(cents: Cents | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100);
  const cent = abs % 100;
  const formatted = brl.format(Number(`${reais}.${String(cent).padStart(2, "0")}`));
  // U+2060 (word joiner) impede quebra de linha entre o sinal e o valor.
  return negative ? `-${WORD_JOINER}${formatted}` : formatted;
}

/**
 * Converte texto digitado em pt-BR para centavos.
 * Aceita "1.234,56", "1234,56", "1234", "R$ 10,5" e "1234.56" (ponto decimal
 * apenas quando não há vírgula e há 1–2 casas após o ponto).
 */
export function parseBRL(input: string): Cents | null {
  let s = input.replace(/R\$|\s| /g, "").trim();
  if (s === "") return null;
  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  let intPart: string;
  let decPart = "";
  if (s.includes(",")) {
    const [i, d, ...rest] = s.split(",");
    if (rest.length > 0) return null;
    intPart = (i ?? "").replace(/\./g, "");
    decPart = d ?? "";
  } else if (/^\d+\.\d{1,2}$/.test(s)) {
    const [i, d] = s.split(".");
    intPart = i ?? "";
    decPart = d ?? "";
  } else {
    intPart = s.replace(/\./g, "");
  }
  if (intPart === "") intPart = "0";
  if (!/^\d+$/.test(intPart) || !/^\d{0,2}$/.test(decPart)) return null;
  const cents = BigInt(intPart) * 100n + BigInt((decPart + "00").slice(0, 2));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return negative ? -Number(cents) : Number(cents);
}

/** Valor para inputs editáveis: 123456 → "1.234,56". */
export function centsToInput(cents: Cents | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${reais},${String(abs % 100).padStart(2, "0")}`;
}

/** Percentual em pontos-base a partir de texto "10", "7,5", "7.5". */
export function parsePercentToBasisPoints(input: string): number | null {
  const s = input.replace("%", "").replace(",", ".").trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const [i, d = ""] = s.split(".");
  const bp = Number(i) * 100 + Number((d + "00").slice(0, 2));
  return bp <= 10000 ? bp : null;
}

export function formatBasisPoints(bp: number): string {
  const i = Math.floor(bp / 100);
  const d = bp % 100;
  return d === 0 ? `${i}%` : `${i},${String(d).padStart(2, "0").replace(/0$/, "")}%`;
}
