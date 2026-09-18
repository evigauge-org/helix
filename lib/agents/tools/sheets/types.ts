import { z } from "zod";

export const columnTypeSchema = z.enum(["currency", "percent", "multiple", "integer", "text", "date"]);
export type ColumnType = z.infer<typeof columnTypeSchema>;

export const cellRoleSchema = z.enum(["input", "formula", "cross_sheet", "external"]);
export type CellRole = z.infer<typeof cellRoleSchema>;

const cellObjectSchema = z.object({
  value: z.union([z.string(), z.number()]),
  role: cellRoleSchema.optional(),
  background: z.literal("assumption").optional(),
  source: z.string().max(500).optional(),
  format_override: z.string().max(100).optional(),
});

// LLM-friendly: accept raw primitive values too ("foo" or 42) and wrap them
// into { value: ... }. Also tolerate null / undefined / boolean because LLMs
// frequently emit those for "empty" or "N/A" cells — coerce them to an empty
// string rather than failing the whole sheet.
export const cellSchema = z.preprocess((v) => {
  if (v === null || v === undefined) return { value: "" };
  if (typeof v === "string" || typeof v === "number") return { value: v };
  if (typeof v === "boolean") return { value: v ? "TRUE" : "FALSE" };
  return v;
}, cellObjectSchema);
export type Cell = z.infer<typeof cellObjectSchema>;

export const columnSchema = z.object({
  header: z.string().min(1).max(100),
  type: columnTypeSchema,
  width: z.number().int().positive().max(2000).optional(),
});
export type Column = z.infer<typeof columnSchema>;

const rowObjectSchema = z.object({
  cells: z.array(cellSchema).max(100),
});

// LLM-friendly: accept rows as an array of cells directly
// (e.g. [{value:"x"}, {value:42}] or ["x", 42]) and coerce to { cells: [...] }.
// Keeps the canonical { cells: [...] } shape valid too.
export const rowSchema = z.preprocess((v) => {
  if (Array.isArray(v)) return { cells: v };
  return v;
}, rowObjectSchema);
export type Row = z.infer<typeof rowObjectSchema>;

export const kpiSchema = z.object({
  label: z.string().min(1).max(100),
  value: z.union([z.string(), z.number()]),
  format: z.enum(["currency", "percent", "multiple", "integer", "text"]),
});
export type Kpi = z.infer<typeof kpiSchema>;

export const chartSchema = z.object({
  type: z.enum(["line", "column", "bar", "pie"]),
  title: z.string().min(1).max(100),
  data_range: z.string().regex(/^[A-Z]+\d+:[A-Z]+\d+$/),
  anchor_cell: z.string().regex(/^[A-Z]+\d+$/),
});
export type Chart = z.infer<typeof chartSchema>;

export const sheetSchema = z.object({
  name: z.string().min(1).max(100),
  frozen_header: z.boolean().optional(),
  columns: z.array(columnSchema).min(1).max(26),
  rows: z.array(rowSchema).max(2000),
  kpi_block: z.array(kpiSchema).max(8).optional(),
  charts: z.array(chartSchema).max(4).optional(),
});
export type Sheet = z.infer<typeof sheetSchema>;

export const enterpriseReportSchema = z.object({
  title: z.string().min(1).max(200),
  sheets: z.array(sheetSchema).min(1).max(10),
});
export type EnterpriseReport = z.infer<typeof enterpriseReportSchema>;

export const ROLE_TEXT_COLORS: Record<CellRole, { red: number; green: number; blue: number }> = {
  input:       { red: 0,    green: 0,    blue: 1    },
  formula:     { red: 0,    green: 0,    blue: 0    },
  cross_sheet: { red: 0,    green: 0.5,  blue: 0    },
  external:    { red: 1,    green: 0,    blue: 0    },
};

export const ASSUMPTION_BG = { red: 1, green: 1, blue: 0 };
export const HEADER_BG = { red: 0.0588, green: 0.1647, blue: 0.2667 };
export const HEADER_FG = { red: 1, green: 1, blue: 1 };
export const BANDED_ROW_BG = { red: 0.9529, green: 0.9569, blue: 0.9647 };
export const BORDER_COLOR = { red: 0.8196, green: 0.8392, blue: 0.8588 };

export const NUMBER_FORMATS: Record<ColumnType, string | null> = {
  currency: '$#,##0;($#,##0);"-"',
  percent: "0.0%",
  multiple: '0.0"x"',
  integer: '#,##0;(#,##0);"-"',
  date: "yyyy-mm-dd",
  text: null,
};
