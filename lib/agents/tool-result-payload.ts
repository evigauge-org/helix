/**
 * A `tool_result` AgentStep is meant to hold a `ToolResult` flat — `{ ok, data }`
 * or `{ ok, error }` — which is what the runner's own error paths write and what
 * the run timeline reads.
 *
 * The execute path used to wrap it instead: `{ result: <ToolResult> }`. Rows
 * written that way have no top-level `ok`, so the timeline read `ok` as
 * undefined, called it a failure, found no top-level `error`, and rendered
 * "Failed — Unknown error" for every executed tool regardless of what it did.
 *
 * The writer now stores the result flat. This unwraps the older shape so runs
 * recorded before that change still show their real outcome.
 */
export function unwrapToolResult(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  // A top-level `ok` means the payload is already flat — including the case
  // where a tool's own data is called `result`.
  if ("ok" in payload) return payload;

  const inner = payload.result;
  if (inner && typeof inner === "object" && !Array.isArray(inner) && "ok" in inner) {
    return inner as Record<string, unknown>;
  }

  return payload;
}
