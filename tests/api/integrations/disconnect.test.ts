import { describe, it, expect, vi, beforeEach } from "vitest";

const { deleteMock, listMock, getSessionMock } = vi.hoisted(() => ({
  deleteMock: vi.fn().mockResolvedValue(undefined),
  listMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: getSessionMock } },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/composio", () => ({
  composio: {
    connectedAccounts: {
      list: listMock,
      delete: deleteMock,
    },
  },
  TOOLKIT_AUTH_CONFIG_MAP: {
    canva: "ac_canva",
    gmail: "ac_gmail",
    sheets: "ac_sheets",
    shopify: "ac_shopify",
  },
}));

import { POST } from "@/app/api/integrations/[toolkit]/disconnect/route";

function mkReq(toolkit: string) {
  return { params: Promise.resolve({ toolkit }) };
}

describe("POST /api/integrations/[toolkit]/disconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    deleteMock.mockResolvedValue(undefined);
  });

  it("returns 401 when no session", async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await POST(new Request("http://x"), mkReq("sheets"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when toolkit is unknown", async () => {
    const res = await POST(new Request("http://x"), mkReq("unknown"));
    expect(res.status).toBe(400);
  });

  it("deletes the matching connected account and returns 200", async () => {
    listMock.mockResolvedValue({ items: [{ id: "conn_123" }] });
    const res = await POST(new Request("http://x"), mkReq("sheets"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.disconnected).toBe(true);
    expect(deleteMock).toHaveBeenCalledWith("conn_123");
  });

  it("returns 200 idempotently when no connection exists", async () => {
    listMock.mockResolvedValue({ items: [] });
    const res = await POST(new Request("http://x"), mkReq("sheets"));
    expect(res.status).toBe(200);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("returns 200 and swallows Composio delete errors", async () => {
    listMock.mockResolvedValue({ items: [{ id: "conn_x" }] });
    deleteMock.mockRejectedValueOnce(new Error("composio boom"));
    const res = await POST(new Request("http://x"), mkReq("sheets"));
    expect(res.status).toBe(200);
  });
});
