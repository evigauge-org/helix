// lib/aep/errors.ts
export type AepErrorSymbol =
  | "authn_failed"
  | "authz_denied"
  | "capability_not_supported"
  | "ceiling_exceeded"
  | "budget_exhausted"
  | "tree_boundary_violation"
  | "subject_not_found"
  | "constitution_policy_violation"
  | "tool_not_found"
  | "version_mismatch"
  | "session_expired"
  | "lifecycle_conflict";

export const SYMBOL_TO_CODE: Record<AepErrorSymbol, number> = {
  authn_failed: -32000,
  authz_denied: -32001,
  capability_not_supported: -32002,
  ceiling_exceeded: -32003,
  budget_exhausted: -32004,
  tree_boundary_violation: -32005,
  subject_not_found: -32006,
  constitution_policy_violation: -32007,
  tool_not_found: -32008,
  version_mismatch: -32009,
  session_expired: -32010,
  lifecycle_conflict: -32011,
};

export class AepError extends Error {
  constructor(
    public readonly symbol: AepErrorSymbol,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "AepError";
  }
  get code(): number { return SYMBOL_TO_CODE[this.symbol]; }
  toJsonRpc() {
    return { code: this.code, message: this.message, data: this.data };
  }
}
