// lib/agents/tools/ib/index.ts
// Aggregates all IB tools so tool-registry.ts has a single import.
// Tools are added to IB_TOOLS as they're authored in Phase 1+.

import type { ToolDef } from "@/lib/agents/types";
import { secEdgarCompanySearchTool } from "./sec_edgar/sec_edgar_company_search";
import { secEdgarFilingsTool } from "./sec_edgar/sec_edgar_filings";
import { secEdgarXbrlFactsTool } from "./sec_edgar/sec_edgar_xbrl_facts";
import { yahooFinanceQuoteTool } from "./yahoo/yahoo_finance_quote";
import { yahooFinanceFinancialsTool } from "./yahoo/yahoo_finance_financials";
import { macrotrendsHistoryTool } from "./macrotrends/macrotrends_history";
import { crunchbaseCompanyTool } from "./crunchbase/crunchbase_company";
import { precedentTransactionsSearchTool } from "./precedent_txns/precedent_transactions_search";
import { precedentTransactionExtractTool } from "./precedent_txns/precedent_transaction_extract";
import { valuationFootballFieldTool } from "./valuation/valuation_football_field";
import { acquirerCapacityScoreTool } from "./valuation/acquirer_capacity_score";
import { assembleIbPitchBookTool } from "./assemble/assemble_ib_pitch_book";

export const IB_TOOLS: ToolDef[] = [
  secEdgarCompanySearchTool,
  secEdgarFilingsTool,
  secEdgarXbrlFactsTool,
  yahooFinanceQuoteTool,
  yahooFinanceFinancialsTool,
  macrotrendsHistoryTool,
  crunchbaseCompanyTool,
  precedentTransactionsSearchTool,
  precedentTransactionExtractTool,
  valuationFootballFieldTool,
  acquirerCapacityScoreTool,
  assembleIbPitchBookTool,
];
