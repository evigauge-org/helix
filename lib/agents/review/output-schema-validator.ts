import { z } from "zod";

export type OutputValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: z.ZodIssue[]; raw: unknown };

export function validateOutput<T>(schema: z.ZodSchema<T>, raw: unknown): OutputValidationResult<T> {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, errors: parsed.error.issues, raw };
}

export function buildCorrectivePrompt(errors: z.ZodIssue[]): string {
  const lines = errors.map((e) => {
    const path = e.path.length ? e.path.join(".") : "(root)";
    return `- ${path}: ${e.message}`;
  });
  return `Your previous response did not match the required output schema. Specific issues:

${lines.join("\n")}

Return ONLY a corrected JSON object that conforms to the schema. Do not include any prose, explanation, or markdown fences.`;
}
