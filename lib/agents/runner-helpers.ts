// lib/agents/runner-helpers.ts
//
// Helpers shared between runner.ts and the LLM adapters.
// `zodToJsonSchema` was previously a private helper inside `runner.ts` — it is
// promoted here so adapters (lib/agents/llm/*) can build OpenAI-style tool
// `parameters` schemas from the same Zod ToolDef.schema definitions the runner
// uses. The contract: take a Zod schema, return an object suitable for the
// `parameters` field of an OpenAI tool definition.

import type { z } from "zod";

export type JSONSchema = Record<string, unknown>;

export function zodToJsonSchema(schema: z.ZodTypeAny): JSONSchema {
  const def = (schema as unknown as { _def: { typeName?: string } })._def;
  const typeName = def?.typeName;

  if (typeName === "ZodObject") {
    const shape = (schema as unknown as { shape: Record<string, z.ZodTypeAny> }).shape;
    const properties: Record<string, JSONSchema> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      const inner = value as z.ZodTypeAny;
      const innerDef = (inner as unknown as { _def: { typeName?: string; innerType?: z.ZodTypeAny } })._def;
      const isOptional = innerDef.typeName === "ZodOptional" || innerDef.typeName === "ZodDefault";
      const resolved = isOptional && innerDef.innerType ? innerDef.innerType : inner;
      properties[key] = zodToJsonSchema(resolved);
      if (!isOptional) required.push(key);
    }
    const out: JSONSchema = { type: "object", properties };
    if (required.length) out.required = required;
    return out;
  }
  if (typeName === "ZodString") return { type: "string" };
  if (typeName === "ZodNumber") return { type: "number" };
  if (typeName === "ZodBoolean") return { type: "boolean" };
  if (typeName === "ZodArray") {
    const itemType = (def as unknown as { type: z.ZodTypeAny }).type;
    return { type: "array", items: itemType ? zodToJsonSchema(itemType) : {} };
  }
  if (typeName === "ZodEnum") {
    const values = (def as unknown as { values: string[] }).values;
    return { type: "string", enum: values };
  }
  if (typeName === "ZodOptional" || typeName === "ZodDefault" || typeName === "ZodNullable") {
    const inner = (def as unknown as { innerType: z.ZodTypeAny }).innerType;
    return zodToJsonSchema(inner);
  }
  return { type: "object", additionalProperties: true };
}
