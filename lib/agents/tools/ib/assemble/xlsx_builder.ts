// lib/agents/tools/ib/assemble/xlsx_builder.ts
// 9-sheet XLSX assembly via xlsx (SheetJS).

import * as XLSX from "xlsx";
import type { IbPitchInputs } from "./pptx_builder";

export function buildPitchBookXlsx(input: IbPitchInputs): Buffer {
  const wb = XLSX.utils.book_new();

  // Cover sheet
  const cover = XLSX.utils.aoa_to_sheet([
    ["IB Pitch Book — XLSX Model"],
    ["Target", input.target.name],
    ["Date", new Date().toISOString().slice(0, 10)],
    ["Recommended counterparty", input.recommendation.recommendedCounterparty],
  ]);
  XLSX.utils.book_append_sheet(wb, cover, "Cover");

  // Comp transactions
  const compHeader = ["Acquirer", "Target", "Announce date", "EV", "EV/Revenue", "EV/EBITDA", "Premium %", "Structure", "Source"];
  const compRows = input.precedentTxns.deals.map((d) => [
    d.acquirer, d.target, d.announceDate,
    cellValue(d.enterpriseValue), cellValue(d.evRevenueMultiple), cellValue(d.evEbitdaMultiple), cellValue(d.premiumPct),
    d.structure, (d.sources as string[] | undefined)?.[0] ?? "",
  ]);
  const compSheet = XLSX.utils.aoa_to_sheet([compHeader, ...compRows]);
  XLSX.utils.book_append_sheet(wb, compSheet, "Comp Transactions");

  // Football field
  const ffHeader = ["Method", "Low", "Mid", "High"];
  const ffRows = input.valuation.footballField.ranges.map((r) => [r.method, r.low, r.mid, r.high]);
  ffRows.push(["Overall envelope", input.valuation.footballField.overallLow, "", input.valuation.footballField.overallHigh]);
  const ffSheet = XLSX.utils.aoa_to_sheet([ffHeader, ...ffRows]);
  XLSX.utils.book_append_sheet(wb, ffSheet, "Football Field");

  // Acquirer capacity grid
  const capHeader = ["Acquirer", "Capacity score", "Rationale"];
  const capRows = input.acquirers.map((a) => [a.name, a.capacityScore, a.rationale]);
  const capSheet = XLSX.utils.aoa_to_sheet([capHeader, ...capRows]);
  XLSX.utils.book_append_sheet(wb, capSheet, "Acquirer Capacity Grid");

  // Strategic fit matrix
  const fitHeader = ["Rank", "Acquirer", "Overall score", "Rationale"];
  const fitRows = input.recommendation.rankedAcquirers.map((r) => [r.rank, r.acquirer, r.overallScore, r.rationale]);
  const fitSheet = XLSX.utils.aoa_to_sheet([fitHeader, ...fitRows]);
  XLSX.utils.book_append_sheet(wb, fitSheet, "Strategic Fit Matrix");

  // Sources
  const srcHeader = ["Citation ID", "URL", "Quote"];
  const srcRows = input.citationIndex.map((c) => [c.id, c.url, c.quote]);
  const srcSheet = XLSX.utils.aoa_to_sheet([srcHeader, ...srcRows]);
  XLSX.utils.book_append_sheet(wb, srcSheet, "Sources");

  // Empty placeholder sheets to reach 9 (the IB analyst can fill these or extend in v1.1)
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Trading Comparables — populate from Yahoo / Macrotrends"]]), "Trading Comparables");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["DCF Model — extend with FCF projection + WACC sensitivity"]]), "DCF Model");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Synergy Model — extend with cost + revenue assumptions"]]), "Synergy Model");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function cellValue(c: unknown): unknown {
  if (c && typeof c === "object" && "value" in c) return (c as { value: unknown }).value;
  return c;
}
