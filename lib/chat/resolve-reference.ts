import type { ChatMessage } from "@/lib/types";

/**
 * Heuristic: does this user query reference prior conversation content
 * ("it", "this", "those results", "the above", "from the earlier list",
 *  numeric picks like "do 1 and 2", etc.) rather than introduce new content?
 */
export function isReferentialQuery(userQuery: string): boolean {
  const q = userQuery.trim().toLowerCase();
  if (!q) return true;
  if (q.length < 40) {
    // Very short queries almost always refer to earlier context.
    return true;
  }
  const patterns: RegExp[] = [
    /\b(it|this|that|them|those|these|the above|the previous|the earlier)\b/,
    /\bfrom (this|that|the above|the previous|the earlier|it)\b/,
    /\bon (it|this|that|the above|the previous)\b/,
    /\bbased on (this|that|the above|the earlier|the previous|it)\b/,
    /\btake (this|that|the above|it)\b/,
    /\b(do|pick|use|take) (\d+|one|two|three|four|five|first|second|third)\b/,
    /\b(make|generate|create|build) (a |the )?(presentation|deck|slides|carousel|sheet|spreadsheet|doc|report) (on|about|from) (it|this|that|the above)\b/,
    /\bturn (this|that|it) into\b/,
    /\bput (it|this|that|these|those) (in|into) (a |the )?(sheet|spreadsheet|doc|table)\b/,
    /\bsummarize (it|this|that|the above)\b/,
  ];
  return patterns.some((re) => re.test(q));
}

/**
 * Walks messages newest-to-oldest and returns the most recent substantive
 * assistant message content (> 80 chars). Returns undefined if nothing useful.
 */
export function findLastSubstantiveAssistant(
  messages: Pick<ChatMessage, "role" | "content">[],
  opts?: { skipId?: string; minChars?: number },
): string | undefined {
  const minChars = opts?.minChars ?? 80;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    const content = (m.content ?? "").trim();
    if (content.length < minChars) continue;
    return content;
  }
  return undefined;
}

/**
 * Decides what "source text" the next intent-triggered card should be seeded
 * with. If the user's query is referential, we look backward for the most
 * recent substantive assistant message and return it. Otherwise returns
 * undefined — the card should fall back to its normal topic-driven behavior.
 */
export function resolveSourceFromHistory(
  messages: Pick<ChatMessage, "role" | "content">[],
  userQuery: string,
): string | undefined {
  if (!isReferentialQuery(userQuery)) return undefined;
  return findLastSubstantiveAssistant(messages);
}

const MAX_SOURCE_CHARS = 12_000;

export function clampSourceText(text: string | undefined, maxChars = MAX_SOURCE_CHARS): string | undefined {
  if (!text) return undefined;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n[...truncated]";
}
