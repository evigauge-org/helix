type Leg = { lastPrice?: number; impliedVolatility?: number; openInterest?: number; totalTradedVolume?: number; bidprice?: number; askPrice?: number };

type RawData = {
  records?: {
    underlyingValue?: number;
    expiryDates?: string[];
    data?: Array<{
      strikePrice: number;
      expiryDate?: string;
      CE?: Leg;
      PE?: Leg;
    }>;
  };
};

export type StrikeRow = {
  strike: number;
  call: { ltp?: number; iv?: number; oi?: number; vol?: number; bid?: number; ask?: number };
  put:  { ltp?: number; iv?: number; oi?: number; vol?: number; bid?: number; ask?: number };
};

export type NormalizedChain = {
  underlying: string;
  spot: number;
  current_expiry: string | null;
  expiries: string[];
  strikes: StrikeRow[];
  note?: string;
};

function legToOut(leg: Leg | undefined): StrikeRow["call"] {
  if (!leg) return {};
  return {
    ltp: leg.lastPrice,
    iv: leg.impliedVolatility,
    oi: leg.openInterest,
    vol: leg.totalTradedVolume,
    bid: leg.bidprice,
    ask: leg.askPrice,
  };
}

export function normalizeOptionChain(
  raw: RawData,
  underlying: string,
  strikeWindow?: { center?: number; count?: number },
): NormalizedChain {
  const records = raw.records ?? {};
  const spot = records.underlyingValue ?? 0;
  const expiries = records.expiryDates ?? [];
  const data = records.data ?? [];

  const byStrike = new Map<number, StrikeRow>();
  for (const row of data) {
    if (!byStrike.has(row.strikePrice)) {
      byStrike.set(row.strikePrice, {
        strike: row.strikePrice,
        call: legToOut(row.CE),
        put: legToOut(row.PE),
      });
    }
  }
  let strikes = Array.from(byStrike.values()).sort((a, b) => a.strike - b.strike);

  if (strikes.length > 0) {
    const center = strikeWindow?.center ?? spot;
    const count = strikeWindow?.count ?? 20;
    if (strikes.length > count) {
      let centerIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      strikes.forEach((s, i) => {
        const d = Math.abs(s.strike - center);
        if (d < bestDist) {
          bestDist = d;
          centerIdx = i;
        }
      });
      const half = Math.floor(count / 2);
      const start = Math.max(0, centerIdx - half);
      const end = Math.min(strikes.length, start + count);
      strikes = strikes.slice(start, end);
    }
  }

  return {
    underlying,
    spot,
    current_expiry: expiries[0] ?? null,
    expiries,
    strikes,
  };
}
