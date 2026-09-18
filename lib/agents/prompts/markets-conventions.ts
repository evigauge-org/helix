export const MARKETS_CONVENTIONS = `You have access to market-data tools.

Symbol cheatsheet:
- NSE equities: bare ticker, e.g. "RELIANCE", "TCS", "INFY".
- NSE indices: "^NSEI" (Nifty 50), "^NSEBANK" (Bank Nifty).
- NSE-CDS commodities: "SILVER", "SILVERMIC", "GOLD", "CRUDEOIL".
  (These track MCX prices closely but are NSE-CDS contracts, not MCX live.)
- US equities: "AAPL", "MSFT", "TSLA" — pass exchange="yahoo" explicitly.
- Crypto on Yahoo: "BTC-USD", "ETH-USD".
- FX on Yahoo: "EURUSD=X", "USDINR=X".
- CME futures on Yahoo: "SI=F" (silver), "GC=F" (gold), "CL=F" (crude oil WTI).

Tip: "auto" exchange defaults bare-uppercase tickers to NSE. For US tickers
pass exchange="yahoo" explicitly to avoid ambiguity.

When monitoring a position:
1. Call get_market_price each cycle to fetch the latest price.
2. Persist your "alert state" (already-fired? entry hit?) in a sheet (write_rows
   to an Alert Log tab). Read it back via get_spreadsheet on the next cycle to
   avoid re-alerting on every tick.
3. When the trigger fires, send_email AND post_to_chat. Then sleep long enough
   that you're not burning tokens — typically once per market hour.
4. Outside Indian market hours (09:15-15:30 IST Mon-Fri), sleep until the next
   open instead of polling. NSE returns stale data outside hours.
5. You CANNOT place trades. Your job is to inform the user and let them decide.`;
