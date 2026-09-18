import { describe, it, expect } from "vitest";
import {
  formatDDMMYYYY,
  NSE_REPORTS_CATALOG,
  resolveNseReport,
  latestWeekday,
} from "@/lib/agents/tools/downloads/nse-reports-catalog";

describe("formatDDMMYYYY", () => {
  it("formats an ISO date to DDMMMYYYY uppercase", () => {
    expect(formatDDMMYYYY("2026-04-15")).toBe("15APR2026");
    expect(formatDDMMYYYY("2026-01-02")).toBe("02JAN2026");
    expect(formatDDMMYYYY("2026-12-31")).toBe("31DEC2026");
  });

  it("rejects invalid dates", () => {
    expect(() => formatDDMMYYYY("not-a-date")).toThrow();
    expect(() => formatDDMMYYYY("2026-13-01")).toThrow();
  });
});

describe("NSE_REPORTS_CATALOG", () => {
  it("has all seven supported reports", () => {
    const keys = Object.keys(NSE_REPORTS_CATALOG).sort();
    expect(keys).toEqual([
      "category_wise_oi",
      "cm_bhavcopy",
      "daily_reports_archive",
      "fo_bhavcopy",
      "market_activity_report",
      "participant_wise_oi",
      "participant_wise_volume",
    ]);
  });
});

describe("resolveNseReport", () => {
  it("resolves participant_wise_oi to the archive URL for a given date", () => {
    const r = resolveNseReport("participant_wise_oi", "2026-04-15");
    expect(r.url).toBe(
      "https://nsearchives.nseindia.com/content/nsccl/fao_participant_oi_15APR2026.csv",
    );
    expect(r.referer).toBe("https://www.nseindia.com/all-reports-derivatives");
    expect(r.mime).toBe("text/csv");
    expect(r.filename).toBe("fao_participant_oi_15APR2026.csv");
  });

  it("resolves fo_bhavcopy for a given date", () => {
    const r = resolveNseReport("fo_bhavcopy", "2026-04-15");
    // NSE's post-2024 bhavcopy scheme uses YYYYMMDD, not DDMMMYYYY.
    expect(r.url).toContain("BhavCopy_NSE_FO");
    expect(r.url).toContain("20260415");
    expect(r.mime).toMatch(/csv|zip/);
  });
});

describe("latestWeekday", () => {
  it("returns the same day if it's a weekday (Mon-Fri)", () => {
    expect(latestWeekday(new Date("2026-04-15T12:00:00Z"))).toBe("2026-04-15");
  });

  it("rolls back to Friday when called on Saturday", () => {
    expect(latestWeekday(new Date("2026-04-18T12:00:00Z"))).toBe("2026-04-17");
  });

  it("rolls back to Friday when called on Sunday", () => {
    expect(latestWeekday(new Date("2026-04-19T12:00:00Z"))).toBe("2026-04-17");
  });
});
