// lib/agents/tools/insurance/shared/catalog.ts
// 8 curated insurers; populated by Tasks 11-18.

import type { InsurerCatalogEntry } from "./types";
import { bajajAllianzLifeEntry } from "../insurers/bajaj-allianz-life";
import { tataAiaLifeEntry } from "../insurers/tata-aia-life";
import { pnbMetlifeEntry } from "../insurers/pnb-metlife";
import { hdfcLifeEntry } from "../insurers/hdfc-life";
import { iciciPrudentialLifeEntry } from "../insurers/icici-prudential-life";
import { sbiLifeEntry } from "../insurers/sbi-life";
import { licEntry } from "../insurers/lic";
import { maxLifeEntry } from "../insurers/max-life";

export const CATALOG: InsurerCatalogEntry[] = [
  bajajAllianzLifeEntry,
  tataAiaLifeEntry,
  pnbMetlifeEntry,
  hdfcLifeEntry,
  iciciPrudentialLifeEntry,
  sbiLifeEntry,
  licEntry,
  maxLifeEntry,
];
