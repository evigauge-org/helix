import type { ColumnType } from "./types";

export function inferColumnType(header: string): ColumnType {
  const h = header.toLowerCase();
  if (/%|percent|margin|growth|rate|yield|roi|roe|roa/.test(h)) return "percent";
  if (/multiple|\bx\b|ev\/|p\/e|pe\s|ratio/.test(h)) return "multiple";
  if (/[$€£]|usd|\$mm|\$m\b|\(mm\)|\(m\)|revenue|sales|cost|expense|ebitda|profit|income|cash|price/.test(h)) return "currency";
  if (/date|month|quarter|period/.test(h)) return "date";
  if (/count|volume|units|headcount|employees|#/.test(h)) return "integer";
  return "text";
}
