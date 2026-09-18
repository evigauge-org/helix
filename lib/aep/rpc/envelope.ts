// lib/aep/rpc/envelope.ts
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: string | number | null;
  result: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  error: { code: number; message: string; data?: unknown };
}

export function successEnvelope(id: JsonRpcRequest["id"], result: unknown): JsonRpcSuccess {
  return { jsonrpc: "2.0", id, result };
}

export function errorEnvelope(id: JsonRpcRequest["id"], code: number, message: string, data?: unknown): JsonRpcErrorResponse {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

export function isValidRequest(v: unknown): v is JsonRpcRequest {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return r.jsonrpc === "2.0" && typeof r.method === "string" && ("id" in r);
}
