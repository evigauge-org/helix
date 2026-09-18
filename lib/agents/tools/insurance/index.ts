// lib/agents/tools/insurance/index.ts
// Aggregates insurance factsheet tools so tool-registry has a single import.
// Tools are added as they're authored.

import type { ToolDef } from "@/lib/agents/types";
import { indiaInsuranceFactsheetFetchTool } from "./india_insurance_factsheet_fetch";
import { indiaInsuranceFactsheetExtractTool } from "./india_insurance_factsheet_extract";

export const INSURANCE_TOOLS: ToolDef[] = [
  indiaInsuranceFactsheetFetchTool,
  indiaInsuranceFactsheetExtractTool,
];
