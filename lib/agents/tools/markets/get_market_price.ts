import { z } from "zod";
import { registerTool } from "../../tool-registry";
import type { ToolDef } from "../../types";
import { detectExchange } from "./symbol-routing";
import { fetchYahooQuote } from "./yahoo-client";
import { NseIndia } from "stock-nse-india";

const nse = new NseIndia();

const schema = z.object({
  symbol: z.string().min(1).max(40),
  exchange: z.enum(["nse", "yahoo", "auto"]).default("auto"),
});

const tool: ToolDef<typeof schema> = {
  slug: "get_market_price",
  description:
    "Get the latest price for a stock, index, commodity, FX, or crypto symbol. Returns last price, change, % change, volume, and currency. Use exchange='nse' for Indian equities/indices/commodities (RELIANCE, ^NSEI, SILVER), exchange='yahoo' for US tickers (AAPL), crypto (BTC-USD), FX (EURUSD=X), and CME futures (SI=F for silver, GC=F for gold). Default 'auto' picks NSE for bare-uppercase symbols and Yahoo for symbols with -USD/=X/=F/.NS suffixes. Outside market hours data may be stale or zero.",
  schema,
  async execute(_ctx, { symbol, exchange }) {
    const resolved: "nse" | "yahoo" =
      exchange === "auto" ? detectExchange(symbol) : exchange;
    try {
      if (resolved === "nse") {
        if (/^\^NSE/i.test(symbol)) {
          const indexName = symbol.replace(/^\^/, "");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const intraday: any = await nse.getIndexIntradayData(indexName);
          const candles = (intraday?.grapthData ?? intraday?.graphData ?? intraday) as Array<[number, number]>;
          if (!Array.isArray(candles) || candles.length === 0) {
            return { ok: false, error: `NSE returned no data for ${symbol}` };
          }
          const last = candles[candles.length - 1][1];
          const open = candles[0][1];
          const change = last - open;
          const changePct = open !== 0 ? (change / open) * 100 : 0;
          return {
            ok: true,
            data: {
              symbol,
              exchange: "nse",
              last,
              change,
              change_pct: changePct,
              currency: "INR",
              timestamp: new Date().toISOString(),
              source: "nse",
            },
          };
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const details: any = await nse.getEquityDetails(symbol);
        const price = details?.priceInfo?.lastPrice;
        if (typeof price !== "number") {
          return { ok: false, error: `NSE returned no price for ${symbol}` };
        }
        return {
          ok: true,
          data: {
            symbol,
            exchange: "nse",
            last: price,
            change: details?.priceInfo?.change ?? 0,
            change_pct: details?.priceInfo?.pChange ?? 0,
            volume: details?.securityWiseDP?.quantityTraded ?? undefined,
            currency: "INR",
            timestamp: new Date().toISOString(),
            source: "nse",
          },
        };
      }
      const q = await fetchYahooQuote(symbol);
      return {
        ok: true,
        data: {
          symbol: q.symbol,
          exchange: "yahoo",
          last: q.last,
          change: q.change,
          change_pct: q.changePct,
          volume: q.volume,
          currency: q.currency,
          timestamp: q.timestamp,
          source: "yahoo",
        },
      };
    } catch (e) {
      return {
        ok: false,
        error: `get_market_price failed (${resolved}): ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  },
};

registerTool(tool);
export default tool;
