export type NseReportName =
  | "participant_wise_oi"
  | "participant_wise_volume"
  | "category_wise_oi"
  | "market_activity_report"
  | "fo_bhavcopy"
  | "cm_bhavcopy"
  | "daily_reports_archive";

export type NseReportResolved = {
  url: string;
  referer: string;
  mime: string;
  filename: string;
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function formatDDMMYYYY(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) throw new Error(`invalid date: ${isoDate}`);
  const yyyy = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const dd = parseInt(m[3], 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) throw new Error(`invalid date: ${isoDate}`);
  const monthName = MONTHS[mm - 1];
  const ddStr = String(dd).padStart(2, "0");
  return `${ddStr}${monthName}${yyyy}`;
}

// TODO(timezone-plan): NSE publishes in IST (UTC+5:30) but this function
// uses UTC. There's a ~5.5h/day window where UTC and IST disagree about the
// weekday. Deferred per user direction to a separate timezone-handling plan
// that will introduce ctx.userTimezone + an IANA-zone helper used here and
// elsewhere. See C:/Users/Lokesh/.claude/projects/F--web-applications-helix-
// helix-ui/memory/feedback_global_timezone.md for context.
export function latestWeekday(now: Date = new Date()): string {
  const d = new Date(now);
  while (true) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) break;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

const NSE_REFERER = "https://www.nseindia.com/all-reports-derivatives";
const ARCHIVES_BASE = "https://nsearchives.nseindia.com";

export const NSE_REPORTS_CATALOG: Record<
  NseReportName,
  (isoDate: string) => NseReportResolved
> = {
  participant_wise_oi: (d) => {
    const ddm = formatDDMMYYYY(d);
    const name = `fao_participant_oi_${ddm}.csv`;
    return { url: `${ARCHIVES_BASE}/content/nsccl/${name}`, referer: NSE_REFERER, mime: "text/csv", filename: name };
  },
  participant_wise_volume: (d) => {
    const ddm = formatDDMMYYYY(d);
    const name = `fao_participant_vol_${ddm}.csv`;
    return { url: `${ARCHIVES_BASE}/content/nsccl/${name}`, referer: NSE_REFERER, mime: "text/csv", filename: name };
  },
  category_wise_oi: (d) => {
    const ddm = formatDDMMYYYY(d);
    const name = `fao_participant_oi_cat_${ddm}.csv`;
    return { url: `${ARCHIVES_BASE}/content/nsccl/${name}`, referer: NSE_REFERER, mime: "text/csv", filename: name };
  },
  market_activity_report: (d) => {
    const dd = d.slice(8, 10);
    const mm = d.slice(5, 7);
    const yyyy = d.slice(0, 4);
    const name = `MA${dd}${mm}${yyyy}.csv`;
    return { url: `${ARCHIVES_BASE}/archives/equities/mkt/${name}`, referer: NSE_REFERER, mime: "text/csv", filename: name };
  },
  fo_bhavcopy: (d) => {
    const yyyy = d.slice(0, 4);
    const mm = d.slice(5, 7);
    const dd = d.slice(8, 10);
    const name = `BhavCopy_NSE_FO_0_0_0_${yyyy}${mm}${dd}_F_0000.csv.zip`;
    return { url: `${ARCHIVES_BASE}/content/fo/${name}`, referer: NSE_REFERER, mime: "application/zip", filename: name };
  },
  cm_bhavcopy: (d) => {
    const yyyy = d.slice(0, 4);
    const mm = d.slice(5, 7);
    const dd = d.slice(8, 10);
    const name = `BhavCopy_NSE_CM_0_0_0_${yyyy}${mm}${dd}_F_0000.csv.zip`;
    return { url: `${ARCHIVES_BASE}/content/cm/${name}`, referer: NSE_REFERER, mime: "application/zip", filename: name };
  },
  daily_reports_archive: (d) => {
    const ddm = formatDDMMYYYY(d);
    const name = `combined_report${ddm}.zip`;
    return { url: `${ARCHIVES_BASE}/content/equities/${name}`, referer: NSE_REFERER, mime: "application/zip", filename: name };
  },
};

export function resolveNseReport(name: NseReportName, isoDate: string): NseReportResolved {
  const fn = NSE_REPORTS_CATALOG[name];
  if (!fn) throw new Error(`unknown report: ${name}`);
  return fn(isoDate);
}
