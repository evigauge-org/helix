// lib/agents/tools/ib/precedent_txns/search.ts
// Multi-source candidate finder for precedent M&A deals.
// 1. SEC EDGAR S-4 / DEFM14A / 8-K mergers (US only)
// 2. Web search for "[sector] M&A acquisition" press releases via Exa
// 3. Crunchbase acquisitions (when slug supplied)

import { getJson } from "../sec_edgar/client";

export type PrecedentCandidate = {
  acquirer: string;
  target: string;
  announceDate: string;
  enterpriseValue: number | null;
  source: "sec" | "web" | "crunchbase";
  sourceUrl: string;
  filingForm?: string;
};

type FullTextSearchResp = {
  hits: { hits: Array<{ _id: string; _source: { display_names?: string[]; form: string; file_date: string; adsh: string } }> };
};

export async function searchSecMergers(opts: {
  fromDate: string;
  toDate: string;
  forms?: string[];
}): Promise<PrecedentCandidate[]> {
  const forms = (opts.forms ?? ["S-4", "DEFM14A", "8-K"]).join(",");
  const url = `https://efts.sec.gov/LATEST/search-index?q=%22merger+agreement%22&forms=${encodeURIComponent(forms)}&dateRange=custom&startdt=${opts.fromDate}&enddt=${opts.toDate}`;
  const data = await getJson<FullTextSearchResp>(url, `sec:fts:${forms}:${opts.fromDate}:${opts.toDate}`);
  return (data.hits?.hits ?? []).slice(0, 50).map((h) => {
    const acqTarget = (h._source.display_names ?? [""])[0].split(" (")[0];
    return {
      acquirer: acqTarget,
      target: "(parse from filing)",
      announceDate: h._source.file_date,
      enterpriseValue: null,
      source: "sec" as const,
      sourceUrl: `https://www.sec.gov/Archives/edgar/data/${h._id.split(":")[0]}/${h._source.adsh.replace(/-/g, "")}/`,
      filingForm: h._source.form,
    };
  });
}
