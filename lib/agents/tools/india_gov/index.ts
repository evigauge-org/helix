import type { ToolDef } from "@/lib/agents/types";
import { dataGovInCatalogSearchTool } from "./catalog_search";
import { dataGovInDatasetFetchTool } from "./dataset_fetch";
import { indiaRbiPolicyRatesTool } from "./curated/rbi_policy_rates";
import { indiaRbiFxReferenceRatesTool } from "./curated/rbi_fx_reference_rates";
import { indiaMospiCpiTool } from "./curated/mospi_cpi";
import { indiaMospiWpiTool } from "./curated/mospi_wpi";
import { indiaSebiMutualFundAumTool } from "./curated/sebi_mutual_fund_aum";
import { indiaGdpSeriesTool } from "./curated/gdp_series";
import { indiaIipIndexTool } from "./curated/iip_index";

export const INDIA_GOV_TOOLS: ToolDef[] = [
  dataGovInCatalogSearchTool,
  dataGovInDatasetFetchTool,
  indiaRbiPolicyRatesTool,
  indiaRbiFxReferenceRatesTool,
  indiaMospiCpiTool,
  indiaMospiWpiTool,
  indiaSebiMutualFundAumTool,
  indiaGdpSeriesTool,
  indiaIipIndexTool,
];
