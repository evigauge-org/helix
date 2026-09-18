import { z } from "zod";
import { registerTool } from "../../tool-registry";
import type { ToolDef } from "../../types";
import { NseIndia } from "stock-nse-india";
import { normalizeOptionChain } from "./option-chain-normalizer";

const nse = new NseIndia();

const schema = z.object({
  symbol: z.string().min(1).max(40),
  kind: z.enum(["equity", "index", "commodity"]),
  expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  strike_window: z
    .object({
      center: z.number().optional(),
      count: z.number().int().min(1).max(60).default(20),
    })
    .optional(),
});

const tool: ToolDef<typeof schema> = {
  slug: "get_option_chain",
  description:
    "Get the option chain for an NSE-listed equity, index (NIFTY, BANKNIFTY), or commodity (SILVER, GOLD, CRUDEOIL on NSE-CDS — closely tracks MCX, not identical). Returns spot, available expiries, and a window of strikes around ATM with calls/puts including LTP, IV, OI, volume, bid, ask. Default returns 20 strikes around ATM; specify strike_window for more or to center elsewhere.",
  schema,
  async execute(_ctx, { symbol, kind, expiry, strike_window }) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let raw: any;
      if (kind === "equity") {
        raw = await nse.getEquityOptionChain(symbol);
      } else if (kind === "index") {
        raw = await nse.getIndexOptionChain(symbol, expiry);
      } else {
        raw = await nse.getCommodityOptionChain(symbol);
      }
      const chain = normalizeOptionChain(raw, symbol, strike_window);
      if (kind === "commodity") {
        chain.note = "NSE-CDS data; tracks MCX closely but not identical.";
      }
      return { ok: true, data: chain };
    } catch (e) {
      return {
        ok: false,
        error: `get_option_chain failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  },
};

registerTool(tool);
export default tool;
