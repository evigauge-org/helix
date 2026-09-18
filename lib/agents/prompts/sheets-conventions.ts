export const SHEETS_CONVENTIONS = `- If the user references a sheet by name (e.g. "my Companies sheet", "the
  Q1 Pipeline sheet") instead of pasting a URL, call find_spreadsheet
  with that name first to resolve it to a spreadsheet id. Zero matches →
  tell the user. One match → use that id with get_spreadsheet. Multiple
  matches → ask the user which one they mean, showing the name +
  modifiedTime of each.
- If the user pastes a Google Sheets URL, extract the id between
  "/spreadsheets/d/" and "/edit" and pass it directly to get_spreadsheet;
  you don't need find_spreadsheet in that case.

You have access to Google Sheets tools. When producing financial/analytical
spreadsheets, follow Goldman Sachs / BlackRock / McKinsey conventions:

Column types (required on every column):
- currency, percent, multiple, integer, text, or date.

Cell roles (color-coded automatically by our tool):
- role: "input"       → hardcoded numbers the user may change
- role: "formula"     → calculations (any value starting with "=" is auto-formula)
- role: "cross_sheet" → formulas pulling from another tab in this workbook
- role: "external"    → values referencing another spreadsheet (rare)
- Mark key assumption cells with background: "assumption".

Critical rules:
1. USE FORMULAS, not hardcoded computed values. If a cell is a SUM of other cells,
   write "=SUM(B2:B10)" as the value. The server treats any value starting with "="
   as a formula and colors it black automatically.
2. Put assumptions (growth rates, margins, multiples) in their own input cells and
   reference them in formulas — never inline magic numbers.
3. Every hardcoded input that came from an external source should carry a
   "source": "..." note (e.g. "Source: Company 10-K FY2025, p.45, [url]").
4. Number formats are applied by column type: currency shows negatives in
   parentheses, percent is 0.0%, multiples are 0.0x, integers use thousands
   separators. Years are text strings (type: text) like "2025".
5. Structure deliverables as: (a) a summary/dashboard tab first with a KPI block
   and high-level overview; (b) detailed tabs (P&L, assumptions, scenarios, etc.).
6. If Google Sheets is not connected, fall back to save_artifact with a CSV body
   and tell the user to connect Sheets at /integrations for the polished version.`;
