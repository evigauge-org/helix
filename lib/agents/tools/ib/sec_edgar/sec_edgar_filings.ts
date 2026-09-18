// lib/agents/tools/ib/sec_edgar/sec_edgar_filings.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { getJson, padCik } from "./client";

const schema = z.object({
  cik: z.string().min(1),
  formTypes: z.array(z.string()).default(["10-K", "10-Q", "8-K", "S-4", "DEFM14A", "S-1"]),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  top: z.number().int().min(1).max(100).default(50),
});

type SubmissionsResp = {
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      form: string[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
  };
};

export const secEdgarFilingsTool: ToolDef<typeof schema> = {
  slug: "sec_edgar_filings",
  description:
    "List SEC filings for a CIK, optionally filtered by form type and date range. " +
    "Returns accession numbers + URLs for retrieving the filing text.",
  schema,
  execute: async (_ctx, args) => {
    try {
      const cik = padCik(args.cik);
      const data = await getJson<SubmissionsResp>(
        `/submissions/CIK${cik}.json`,
        `sec:submissions:${cik}`,
      );
      const { accessionNumber, filingDate, reportDate, form, primaryDocument, primaryDocDescription } =
        data.filings.recent;

      const filings: Array<{
        accessionNumber: string;
        filingDate: string;
        reportDate: string;
        form: string;
        url: string;
        description: string;
      }> = [];

      for (let i = 0; i < accessionNumber.length; i++) {
        if (!args.formTypes.includes(form[i])) continue;
        if (args.fromDate && filingDate[i] < args.fromDate) continue;
        if (args.toDate && filingDate[i] > args.toDate) continue;
        const accNoDash = accessionNumber[i].replace(/-/g, "");
        const url = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accNoDash}/${primaryDocument[i]}`;
        filings.push({
          accessionNumber: accessionNumber[i],
          filingDate: filingDate[i],
          reportDate: reportDate[i],
          form: form[i],
          url,
          description: primaryDocDescription[i],
        });
        if (filings.length >= args.top) break;
      }
      return { ok: true, data: { cik, filings } };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
