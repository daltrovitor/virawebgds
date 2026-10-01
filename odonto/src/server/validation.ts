import { z } from "zod";
import { isValidCivil } from "@/domain/dates";
import { ValidationError, type FieldErrors } from "./errors";

export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fieldErrors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  const first = Object.values(fieldErrors)[0] ?? "Dados inválidos";
  throw new ValidationError(first, fieldErrors);
}

export const zId = z.uuid({ message: "Identificador inválido" });

export const zCivilDate = z.string().refine(isValidCivil, { message: "Data inválida" });

export const zOptionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max, { message: `Máximo de ${max} caracteres` })
    .transform((v) => (v === "" ? null : v))
    .nullish()
    .transform((v) => v ?? null);

export const zRequiredText = (label: string, max = 300) =>
  z
    .string({ message: `${label} é obrigatório` })
    .trim()
    .min(1, { message: `${label} é obrigatório` })
    .max(max, { message: `${label}: máximo de ${max} caracteres` });

export const zCents = z
  .number({ message: "Valor inválido" })
  .int({ message: "Valor deve estar em centavos" })
  .min(0, { message: "Valor não pode ser negativo" })
  .max(100_000_000_00, { message: "Valor acima do limite" });

export const zPositiveCents = zCents.refine((v) => v > 0, { message: "Valor deve ser maior que zero" });
