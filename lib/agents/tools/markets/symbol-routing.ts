export type Exchange = "nse" | "yahoo";

// "auto" cannot perfectly distinguish bare uppercase tickers like AAPL (US)
// from RELIANCE (India). Agents should pass `exchange` explicitly when needed.
// This heuristic only catches symbols with clear lexical signals; everything
// else defaults to NSE (Helix's primary user base).
export function detectExchange(symbol: string): Exchange {
  // Yahoo conventions: -USD/-EUR (crypto), =X (FX), =F (futures), .NS / .BO (Yahoo's Indian ticker syntax)
  if (/-USD$|-EUR$|-GBP$|-INR$|=X$|=F$|\.[A-Z]{2,3}$/i.test(symbol)) return "yahoo";
  // NSE indices have ^NSE prefix
  if (/^\^NSE/i.test(symbol)) return "nse";
  // Bare uppercase or NSE-style → default to NSE
  if (/^[A-Z][A-Z0-9]{0,15}$/.test(symbol)) return "nse";
  return "yahoo";
}
