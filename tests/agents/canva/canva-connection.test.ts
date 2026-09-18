import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/composio", () => ({
  composio: {
    connectedAccounts: {
      list: vi.fn(),
      initiate: vi.fn(),
    },
  },
  CANVA_AUTH_CONFIG_ID: "ac_test",
}));

import { composio } from "@/lib/composio";
import { requireCanvaConnection } from "@/lib/agents/tools/canva/canva-connection";

 
const listMock = composio.connectedAccounts.list as unknown as ReturnType<typeof vi.fn>;
 
const initiateMock = composio.connectedAccounts.initiate as unknown as ReturnType<typeof vi.fn>;

describe("requireCanvaConnection", () => {
  beforeEach(() => {
    listMock.mockReset();
    initiateMock.mockReset();
  });

  it("returns ok with connectedAccountId when an ACTIVE connection exists", async () => {
    listMock.mockResolvedValueOnce({ items: [{ id: "ca_1" }] });
    const res = await requireCanvaConnection("user_1");
    expect(res).toEqual({ ok: true, connectedAccountId: "ca_1" });
    expect(initiateMock).not.toHaveBeenCalled();
  });

  it("returns connect_url when not connected", async () => {
    listMock.mockResolvedValueOnce({ items: [] });
    initiateMock.mockResolvedValueOnce({ redirectUrl: "https://connect.composio.dev/link/abc" });
    const res = await requireCanvaConnection("user_1");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.connect_url).toBe("https://connect.composio.dev/link/abc");
      expect(res.error).toMatch(/connect_url/);
    }
  });

  it("returns plain error when initiate fails", async () => {
    listMock.mockResolvedValueOnce({ items: [] });
    initiateMock.mockRejectedValueOnce(new Error("boom"));
    const res = await requireCanvaConnection("user_1");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.connect_url).toBeUndefined();
      expect(res.error).toMatch(/could not initiate OAuth/);
    }
  });
});
