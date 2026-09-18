export type YahooQuote = {
  symbol: string;
  last: number;
  change: number;
  changePct: number;
  volume?: number;
  currency: string;
  timestamp: string;
};

export async function fetchYahooQuote(symbol: string): Promise<YahooQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const data = (await res.json()) as {
    chart?: {
      result?: Array<{
        meta?: {
          regularMarketPrice?: number;
          previousClose?: number;
          chartPreviousClose?: number;
          regularMarketTime?: number;
          currency?: string;
          regularMarketVolume?: number;
        };
      }>;
      error?: { description?: string };
    };
  };
  const meta = data?.chart?.result?.[0]?.meta;
  if (data?.chart?.error?.description) throw new Error(data.chart.error.description);
  if (!meta || typeof meta.regularMarketPrice !== "number") {
    throw new Error("Yahoo returned no price (delisted or symbol invalid?)");
  }
  const last = meta.regularMarketPrice;
  const prev = meta.previousClose ?? meta.chartPreviousClose ?? last;
  const change = last - prev;
  const changePct = prev !== 0 ? (change / prev) * 100 : 0;
  return {
    symbol,
    last,
    change,
    changePct,
    volume: meta.regularMarketVolume,
    currency: meta.currency ?? "USD",
    timestamp: meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : new Date().toISOString(),
  };
}
