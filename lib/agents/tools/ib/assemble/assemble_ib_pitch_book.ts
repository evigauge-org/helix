// lib/agents/tools/ib/assemble/assemble_ib_pitch_book.ts
import { z } from "zod";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ToolDef } from "@/lib/agents/types";
import { buildPitchBookPptx, type IbPitchInputs } from "./pptx_builder";
import { buildPitchBookXlsx } from "./xlsx_builder";
import { buildCitationIndex } from "./citation_index";

const schema = z.object({
  target: z.object({ name: z.string(), ticker: z.string().optional(), sector: z.string().optional() }),
  acquirers: z.array(z.object({
    name: z.string(),
    ticker: z.string().optional(),
    capacityScore: z.number(),
    rationale: z.string(),
    financialSnapshot: z.record(z.string(), z.unknown()),
    sources: z.array(z.string()),
  })).length(8),
  precedentTxns: z.object({
    deals: z.array(z.record(z.string(), z.unknown())),
    summaryStats: z.record(z.string(), z.number()),
  }),
  landscape: z.object({
    competitors: z.array(z.object({ name: z.string(), marketSharePct: z.unknown(), positioning: z.string() })),
    positioningMapData: z.array(z.object({ name: z.string(), xAxis: z.number(), yAxis: z.number(), bubbleSize: z.number() })),
  }),
  valuation: z.object({
    footballField: z.object({
      ranges: z.array(z.object({ method: z.string(), low: z.number(), mid: z.number(), high: z.number() })),
      overallLow: z.number(),
      overallHigh: z.number(),
    }),
  }),
  recommendation: z.object({
    rankedAcquirers: z.array(z.object({ rank: z.number(), acquirer: z.string(), overallScore: z.number(), rationale: z.string() })).length(8),
    recommendedCounterparty: z.string(),
    rationaleText: z.string(),
  }),
  format: z.enum(["pptx_only", "xlsx_only", "both"]).default("both"),
});

export const assembleIbPitchBookTool: ToolDef<typeof schema> = {
  slug: "assemble_ib_pitch_book",
  description:
    "Assemble the final 30-slide PPTX pitch book and 9-sheet XLSX financial model from sub-agent outputs. " +
    "Returns file paths under /tmp that the orchestrator can post to chat as downloadables.",
  schema,
  execute: async (_ctx, args) => {
    try {
      const allSources = [
        ...args.acquirers.flatMap((a) => a.sources),
      ];
      const citationIndex = buildCitationIndex([allSources]);

      const inputs: IbPitchInputs = {
        ...args,
        citationIndex,
      } as IbPitchInputs;

      const stamp = Date.now();
      const out: Record<string, string> = {};
      if (args.format === "both" || args.format === "pptx_only") {
        const pptx = await buildPitchBookPptx(inputs);
        const path = join(tmpdir(), `ib_pitch_${stamp}.pptx`);
        await writeFile(path, pptx);
        out.pptxPath = path;
      }
      if (args.format === "both" || args.format === "xlsx_only") {
        const xlsx = buildPitchBookXlsx(inputs);
        const path = join(tmpdir(), `ib_pitch_${stamp}.xlsx`);
        await writeFile(path, xlsx);
        out.xlsxPath = path;
      }
      out.citationCount = String(citationIndex.length);
      return { ok: true, data: out };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
