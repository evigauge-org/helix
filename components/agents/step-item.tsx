"use client";

import { useState } from "react";
import {
  Brain, Wrench, CheckCircle2, XCircle, Clock, ArrowRight, AlertTriangle,
  ChevronDown, ChevronRight as ChevronRightIcon,
  Mail, FileText, Presentation, Table2, Download, Globe, MessageSquare,
  Search, FileSpreadsheet, Zap, Package, HelpCircle, Image as ImageIcon, Database,
  GitBranch, FileCheck, BookOpen,
} from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown/markdown-renderer";

type StepKind = "think" | "tool_call" | "tool_result" | "cycle_end";

type Step = {
  id: string;
  kind: string;
  toolSlug?: string | null;
  payload: unknown;
  tickNumber: number;
  stepNumber: number;
  createdAt: string;
};

function toRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function s(v: unknown, maxLen = 200): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.length > maxLen ? v.slice(0, maxLen) + "…" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const j = JSON.stringify(v);
  return j.length > maxLen ? j.slice(0, maxLen) + "…" : j;
}

function toolIcon(slug: string | null | undefined) {
  switch (slug) {
    case "send_email": return Mail;
    case "create_docx": return FileText;
    case "create_pptx":
    case "create_canva_presentation":
    case "create_canva_design":
    case "import_canva_from_file":
      return Presentation;
    case "write_rows":
    case "create_enterprise_report":
    case "get_spreadsheet":
    case "find_spreadsheet":
      return FileSpreadsheet;
    case "download_file":
    case "download_nse_report":
      return Download;
    case "web_search":
    case "exa_search":
    case "search_knowledge":
      return Search;
    case "post_to_chat": return MessageSquare;
    case "update_dashboard": return Table2;
    case "get_market_price":
    case "get_option_chain":
    case "screener_company":
      return Database;
    case "llm_debate":
    case "llm_reason":
      return Brain;
    case "get_canva_design_metadata":
    case "list_canva_designs":
      return ImageIcon;
    case "sleep":
    case "complete":
    case "continue_now":
      return Clock;
    default: return Wrench;
  }
}

function prettyToolName(slug: string | null | undefined): string {
  if (!slug) return "tool";
  return slug
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Formats tool-call arguments into a single human-readable line per tool. */
function formatToolArgs(slug: string | null | undefined, args: Record<string, unknown>): string[] {
  const lines: string[] = [];
  switch (slug) {
    case "send_email": {
      const to = args.to;
      const toStr = Array.isArray(to) ? to.join(", ") : typeof to === "string" ? to : "";
      if (toStr) lines.push(`To: ${toStr}`);
      if (args.cc) lines.push(`CC: ${Array.isArray(args.cc) ? args.cc.join(", ") : s(args.cc)}`);
      if (args.subject) lines.push(`Subject: ${s(args.subject, 120)}`);
      if (args.body) lines.push(`Body: ${s(args.body, 160)}`);
      return lines;
    }
    case "create_docx": {
      if (args.title) lines.push(`Title: ${s(args.title, 120)}`);
      if (args.subtitle) lines.push(`Subtitle: ${s(args.subtitle, 120)}`);
      if (typeof args.markdown === "string") {
        lines.push(`Content: ${args.markdown.length.toLocaleString()} characters of markdown`);
      }
      return lines;
    }
    case "create_pptx":
    case "create_canva_presentation": {
      if (args.topic) lines.push(`Topic: ${s(args.topic, 160)}`);
      const deck = args.deck as Record<string, unknown> | undefined;
      if (deck?.title) lines.push(`Title: ${s(deck.title)}`);
      const slides = Array.isArray(deck?.slides) ? deck!.slides : undefined;
      if (slides) lines.push(`Slides: ${slides.length}`);
      return lines;
    }
    case "write_rows": {
      if (args.spreadsheetId) lines.push(`Spreadsheet: ${s(args.spreadsheetId)}`);
      if (args.range) lines.push(`Range: ${s(args.range)}`);
      if (Array.isArray(args.rows)) lines.push(`Rows: ${args.rows.length}`);
      return lines;
    }
    case "create_enterprise_report": {
      if (args.title) lines.push(`Title: ${s(args.title, 120)}`);
      const sheets = Array.isArray(args.sheets) ? args.sheets : [];
      lines.push(`Tabs: ${sheets.length}`);
      return lines;
    }
    case "download_file":
    case "download_nse_report": {
      if (args.url) lines.push(`URL: ${s(args.url, 200)}`);
      if (args.report_name) lines.push(`Report: ${s(args.report_name)}`);
      if (args.date) lines.push(`Date: ${s(args.date)}`);
      return lines;
    }
    case "web_search":
    case "exa_search": {
      if (args.query) lines.push(`Query: ${s(args.query, 200)}`);
      if (args.num_results) lines.push(`Results: ${args.num_results}`);
      return lines;
    }
    case "search_knowledge": {
      if (args.query) lines.push(`Query: ${s(args.query, 200)}`);
      if (args.top_k) lines.push(`Top K: ${args.top_k}`);
      if (args.scope && args.scope !== "all") lines.push(`Scope: ${args.scope}`);
      return lines;
    }
    case "screener_company": {
      if (args.ticker) lines.push(`Ticker: ${s(args.ticker)}`);
      if (args.segment) lines.push(`Segment: ${s(args.segment)}`);
      return lines;
    }
    case "post_to_chat": {
      if (args.markdown) lines.push(`Message: ${s(args.markdown, 220)}`);
      return lines;
    }
    case "llm_debate": {
      if (args.question) lines.push(`Question: ${s(args.question, 200)}`);
      if (args.outputType) lines.push(`Output: ${s(args.outputType)}`);
      return lines;
    }
    case "llm_reason": {
      if (args.prompt) lines.push(`Prompt: ${s(args.prompt, 200)}`);
      if (args.model) lines.push(`Model: ${s(args.model)}`);
      return lines;
    }
    case "sleep": {
      if (args.duration_seconds) lines.push(`Duration: ${args.duration_seconds}s`);
      if (args.reason) lines.push(`Reason: ${s(args.reason, 200)}`);
      return lines;
    }
    case "complete": {
      if (args.final_message) lines.push(`Final message: ${s(args.final_message, 220)}`);
      const artifactIds = args.artifact_ids as unknown;
      if (Array.isArray(artifactIds) && artifactIds.length > 0) {
        lines.push(`Artifacts: ${artifactIds.length}`);
      }
      return lines;
    }
    default: {
      // Generic: show 2-3 top-level key/values
      const keys = Object.keys(args).slice(0, 4);
      for (const k of keys) lines.push(`${k}: ${s(args[k], 180)}`);
      return lines;
    }
  }
}

/** Formats a tool_result payload into a short summary line(s). */
function formatToolResult(slug: string | null | undefined, payload: Record<string, unknown>): { ok: boolean; lines: string[] } {
  const ok = payload.ok === true;
  const lines: string[] = [];
  if (!ok) {
    const err = (payload.error as string | undefined) ?? "Unknown error";
    lines.push(`Error: ${s(err, 220)}`);
    return { ok: false, lines };
  }

  const data = toRecord(payload.data);
  switch (slug) {
    case "send_email": {
      const sent = Number(data.sent ?? 0);
      const failed = Number(data.failed ?? 0);
      if (sent || failed) lines.push(`Sent: ${sent}${failed ? ` · Failed: ${failed}` : ""}`);
      if (data.messageId) lines.push(`Message ID: ${s(data.messageId)}`);
      return { ok, lines };
    }
    case "create_docx":
    case "create_pptx": {
      if (data.artifactId) lines.push(`Artifact: ${s(data.artifactId)}`);
      if (data.filename) lines.push(`File: ${s(data.filename)}`);
      if (data.bytes) lines.push(`Size: ${Math.round((data.bytes as number) / 1024)} KB`);
      return { ok, lines };
    }
    case "create_canva_presentation":
    case "import_canva_from_file":
    case "create_canva_design": {
      if (data.editUrl) lines.push(`Canva: ${s(data.editUrl, 200)}`);
      if (data.designId) lines.push(`Design ID: ${s(data.designId)}`);
      return { ok, lines };
    }
    case "create_enterprise_report": {
      if (data.url) lines.push(`Sheet: ${s(data.url, 200)}`);
      return { ok, lines };
    }
    case "write_rows": {
      if (data.updatedCells) lines.push(`Updated cells: ${data.updatedCells}`);
      if (data.updatedRange) lines.push(`Range: ${s(data.updatedRange)}`);
      return { ok, lines };
    }
    case "download_file":
    case "download_nse_report": {
      if (data.artifactId) lines.push(`Artifact: ${s(data.artifactId)}`);
      if (data.filename) lines.push(`File: ${s(data.filename)}`);
      if (data.bytes) lines.push(`Size: ${Math.round((data.bytes as number) / 1024)} KB`);
      return { ok, lines };
    }
    case "web_search":
    case "exa_search": {
      if (Array.isArray(data.results)) lines.push(`Results: ${data.results.length}`);
      return { ok, lines };
    }
    case "search_knowledge": {
      const hits = Array.isArray(data.hits) ? (data.hits as Array<Record<string, unknown>>) : [];
      const hint = typeof data.hint === "string" ? data.hint : null;
      if (hits.length === 0 && hint) {
        lines.push(hint);
        return { ok, lines };
      }
      lines.push(`${hits.length} hit${hits.length === 1 ? "" : "s"}`);
      for (const h of hits.slice(0, 3)) {
        const filename = typeof h.filename === "string" ? h.filename : "?";
        const lane = h.lane === "pageindex" ? "PDF" : `chunk ${h.chunkIndex ?? 0}`;
        const excerpt = typeof h.excerpt === "string" ? s(h.excerpt, 220) : "";
        lines.push(`${filename} (${lane}): ${excerpt}`);
      }
      return { ok, lines };
    }
    case "post_to_chat": {
      if (data.messageId) lines.push(`Posted (message ${s(data.messageId)})`);
      else if (data.skipped) lines.push("Skipped (no origin chat)");
      return { ok, lines };
    }
    case "llm_debate":
    case "llm_reason": {
      if (data.consensus) lines.push(`Consensus: ${s(data.consensus, 220)}`);
      else if (data.answer) lines.push(`Answer: ${s(data.answer, 220)}`);
      return { ok, lines };
    }
    default: {
      const keys = Object.keys(data).slice(0, 3);
      for (const k of keys) lines.push(`${k}: ${s(data[k], 180)}`);
      if (lines.length === 0) lines.push("Completed");
      return { ok, lines };
    }
  }
}

function StepHeader({
  Icon, title, subtitle, toneClass,
}: { Icon: React.ElementType; title: string; subtitle?: string; toneClass: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md ${toneClass}`}>
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-gray-800 leading-tight">{title}</div>
        {subtitle && <div className="text-[11px] text-gray-500 leading-tight mt-0.5 truncate">{subtitle}</div>}
      </div>
    </div>
  );
}

function formatSize(chars: number): string {
  if (chars >= 1024) return `${(chars / 1024).toFixed(1)} KB`;
  return `${chars} chars`;
}

function CollapsibleMarkdown({
  label,
  content,
  tone = "blue",
  defaultOpen = true,
}: {
  label: string;
  content: string;
  tone?: "blue" | "emerald" | "gray";
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const borderClass =
    tone === "emerald" ? "border-emerald-200" :
    tone === "gray" ? "border-gray-200" :
    "border-[#0085CF]/20";
  const bgClass =
    tone === "gray" ? "bg-gray-50" : "bg-white";
  return (
    <div className={`mt-2 overflow-hidden rounded-md border ${borderClass} ${bgClass}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50 cursor-pointer"
      >
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700">
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
          {label}
        </span>
        <span className="text-[10px] text-gray-400">{formatSize(content.length)}</span>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-4 pt-2 pb-3 text-sm text-gray-700 leading-relaxed">
          <MarkdownRenderer content={content} />
        </div>
      )}
    </div>
  );
}

export function StepItem({ step }: { step: Step }) {
  const [showRaw, setShowRaw] = useState(false);
  const kind = step.kind as StepKind | string;
  const payload = toRecord(step.payload);

  // --- Render per kind ---

  if (kind === "think") {
    const content = typeof payload.content === "string" ? payload.content : "";
    const toolCallCount = typeof payload.tool_call_count === "number" ? payload.tool_call_count : 0;
    const err = typeof payload.error === "string" ? payload.error : null;

    const subtitle = err
      ? "Model upstream error"
      : toolCallCount > 0
        ? `Planned ${toolCallCount} tool call${toolCallCount === 1 ? "" : "s"}`
        : content.trim().length > 0
          ? "Drafted reply"
          : "Empty response";

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <StepHeader
          Icon={err ? AlertTriangle : Brain}
          title={err ? "Thinking (upstream error)" : "Thinking"}
          subtitle={subtitle}
          toneClass={err ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}
        />
        {err && (
          <p className="mt-2 text-xs text-amber-700 whitespace-pre-wrap break-words">{err}</p>
        )}
        {content && (
          <div className="mt-2 text-sm text-gray-700 leading-relaxed">
            <MarkdownRenderer
              content={content.length > 600 && !showRaw ? content.slice(0, 600) + "…" : content}
            />
          </div>
        )}
        {content.length > 600 && (
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="mt-1 text-[11px] text-[#0085CF] hover:underline cursor-pointer"
          >
            {showRaw ? "Show less" : "Show full"}
          </button>
        )}
      </div>
    );
  }

  if (kind === "tool_call") {
    const slug = step.toolSlug ?? (payload.name as string | undefined) ?? null;
    const args = toRecord(payload.args);
    const Icon = toolIcon(slug);
    const lines = formatToolArgs(slug, args);

    // Tools whose primary argument is markdown content (worth rendering big).
    const markdownArg =
      slug === "post_to_chat" && typeof args.markdown === "string"
        ? args.markdown
        : slug === "complete" && typeof args.final_message === "string"
          ? args.final_message
          : slug === "create_docx" && typeof args.markdown === "string"
            ? args.markdown
            : null;

    // If we're going to render markdown below, drop the short-form "Body: …"
    // line to avoid duplicating the content.
    const visibleLines = markdownArg
      ? lines.filter((l) => !l.startsWith("Body:") && !l.startsWith("Message:") && !l.startsWith("Final message:") && !l.startsWith("Content:"))
      : lines;

    return (
      <div className="rounded-lg border border-[#0085CF]/20 bg-[#0085CF]/5 p-3">
        <StepHeader
          Icon={Icon}
          title={`Calling ${prettyToolName(slug)}`}
          subtitle={slug ?? undefined}
          toneClass="bg-[#0085CF]/15 text-[#0085CF]"
        />
        {visibleLines.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-gray-700">
            {visibleLines.map((l, i) => (
              <li key={i} className="flex gap-1.5">
                <ArrowRight className="size-3 shrink-0 mt-0.5 text-gray-400" />
                <span className="break-words whitespace-pre-wrap">{l}</span>
              </li>
            ))}
          </ul>
        )}
        {markdownArg && (
          <CollapsibleMarkdown
            label={
              slug === "post_to_chat" ? "Chat message"
              : slug === "complete" ? "Final message"
              : slug === "create_docx" ? "Document content"
              : "Content"
            }
            content={markdownArg}
            tone="blue"
            // DOCX bodies can be huge — default collapsed so the timeline
            // stays scannable. Other short bodies default open.
            defaultOpen={slug !== "create_docx"}
          />
        )}
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 cursor-pointer"
        >
          {showRaw ? <ChevronDown className="size-3" /> : <ChevronRightIcon className="size-3" />}
          {showRaw ? "Hide raw" : "Raw"}
        </button>
        {showRaw && (
          <pre className="mt-1.5 max-h-80 overflow-auto rounded-md bg-gray-900 p-2 text-[11px] text-gray-100 whitespace-pre-wrap break-words">
            {JSON.stringify(payload, null, 2).slice(0, 4000)}
          </pre>
        )}
      </div>
    );
  }

  if (kind === "tool_result") {
    const slug = step.toolSlug ?? null;
    const { ok, lines } = formatToolResult(slug, payload);
    const Icon = ok ? CheckCircle2 : XCircle;
    const data = toRecord(payload.data);

    // llm_debate / llm_reason answers are long markdown — render them properly.
    const markdownResult =
      ok && (slug === "llm_debate" || slug === "llm_reason")
        ? (typeof data.answer === "string" && data.answer.length > 60 ? data.answer
          : typeof data.consensus === "string" && data.consensus.length > 60 ? data.consensus
          : null)
        : null;

    const visibleLines = markdownResult
      ? lines.filter((l) => !l.startsWith("Answer:") && !l.startsWith("Consensus:"))
      : lines;

    return (
      <div className={`rounded-lg border p-3 ${ok ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50"}`}>
        <StepHeader
          Icon={Icon}
          title={ok ? "Succeeded" : "Failed"}
          subtitle={slug ? prettyToolName(slug) : undefined}
          toneClass={ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}
        />
        {visibleLines.length > 0 && (
          <ul className={`mt-2 space-y-1 text-xs ${ok ? "text-gray-700" : "text-red-800"}`}>
            {visibleLines.map((l, i) => (
              <li key={i} className="flex gap-1.5">
                <ArrowRight className={`size-3 shrink-0 mt-0.5 ${ok ? "text-emerald-500" : "text-red-400"}`} />
                <span className="break-words whitespace-pre-wrap">{l}</span>
              </li>
            ))}
          </ul>
        )}
        {markdownResult && (
          <CollapsibleMarkdown
            label={slug === "llm_debate" ? "Debate consensus" : "Model answer"}
            content={markdownResult}
            tone="emerald"
            defaultOpen
          />
        )}
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 cursor-pointer"
        >
          {showRaw ? <ChevronDown className="size-3" /> : <ChevronRightIcon className="size-3" />}
          {showRaw ? "Hide raw" : "Raw"}
        </button>
        {showRaw && (
          <pre className="mt-1.5 max-h-80 overflow-auto rounded-md bg-gray-900 p-2 text-[11px] text-gray-100 whitespace-pre-wrap break-words">
            {JSON.stringify(payload, null, 2).slice(0, 4000)}
          </pre>
        )}
      </div>
    );
  }

  if (kind === "cycle_end") {
    const sub = payload.kind as string | undefined;
    const Icon = sub === "completed" ? CheckCircle2 : sub === "slept" || sub === "forced_sleep" ? Clock : Zap;
    const tone = sub === "completed"
      ? "bg-blue-100 text-blue-700"
      : sub === "slept" || sub === "forced_sleep"
        ? "bg-amber-100 text-amber-700"
        : "bg-purple-100 text-purple-700";
    const title =
      sub === "completed" ? "Run completed"
        : sub === "slept" ? "Sleeping"
          : sub === "forced_sleep" ? "Forced sleep"
            : sub === "continue" ? "Continuing"
              : "Cycle end";
    const lines: string[] = [];
    if (payload.reason) lines.push(`Reason: ${s(payload.reason, 200)}`);
    if (payload.nextWakeAt) lines.push(`Next wake: ${s(payload.nextWakeAt)}`);
    const finalMessage = typeof payload.finalMessage === "string" ? payload.finalMessage : "";

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <StepHeader Icon={Icon} title={title} subtitle={sub ?? undefined} toneClass={tone} />
        {lines.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-gray-700">
            {lines.map((l, i) => (
              <li key={i} className="flex gap-1.5">
                <ArrowRight className="size-3 shrink-0 mt-0.5 text-gray-400" />
                <span className="break-words whitespace-pre-wrap">{l}</span>
              </li>
            ))}
          </ul>
        )}
        {finalMessage && (
          <CollapsibleMarkdown
            label="Final message"
            content={finalMessage}
            tone="gray"
            defaultOpen
          />
        )}
      </div>
    );
  }

  if (kind === "memory_event") {
    const op = typeof payload.op === "string" ? payload.op : "event";
    const key = typeof payload.key === "string" ? payload.key : "";
    const reason = typeof payload.reason === "string" ? payload.reason : null;
    const tone = op === "write_blocked" ? "bg-red-100 text-red-700" : "bg-violet-100 text-violet-700";
    const title = `Memory ${op}`;
    return (
      <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
        <StepHeader Icon={Database} title={title} subtitle={key || undefined} toneClass={tone} />
        {reason ? <p className="mt-2 text-xs text-red-700">Reason: {reason}</p> : null}
      </div>
    );
  }

  if (kind === "prompt_proposal") {
    const draft = typeof payload.draft === "string" ? payload.draft : "";
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
        <StepHeader
          Icon={Zap}
          title="Prompt update proposed"
          subtitle="Staged for explicit promotion — does not affect this run"
          toneClass="bg-amber-100 text-amber-700"
        />
        {draft ? (
          <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-white p-2 text-[11px] text-gray-700 whitespace-pre-wrap break-words">
            {draft.slice(0, 1500)}
            {draft.length > 1500 ? "…" : ""}
          </pre>
        ) : null}
      </div>
    );
  }

  if (kind === "subagent_spawn") {
    const blocked = payload.blocked === true;
    const reason = typeof payload.reason === "string" ? payload.reason : null;
    const role = typeof payload.role === "string" ? payload.role : null;
    return (
      <div className={`rounded-lg border p-3 ${blocked ? "border-red-200 bg-red-50/40" : "border-blue-200 bg-blue-50/40"}`}>
        <StepHeader
          Icon={Package}
          title={blocked ? "Subagent spawn blocked" : "Subagent spawned"}
          subtitle={role ?? (reason ?? undefined)}
          toneClass={blocked ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}
        />
        {blocked && reason ? <p className="mt-2 text-xs text-red-700">{reason}</p> : null}
      </div>
    );
  }

  if (kind === "sub_agent_spawn") {
    const role = typeof payload.role === "string" ? payload.role : null;
    const template = typeof payload.template === "string" ? payload.template : null;
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
        <StepHeader
          Icon={GitBranch}
          title="Spawning sub-agent"
          subtitle={template ?? role ?? undefined}
          toneClass="bg-blue-100 text-blue-700"
        />
      </div>
    );
  }

  if (kind === "sub_agent_review") {
    const template = typeof payload.template === "string" ? payload.template : null;
    const reviewId = typeof payload.reviewId === "string" ? payload.reviewId : null;
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
        <StepHeader
          Icon={FileCheck}
          title="Sub-agent review staged"
          subtitle={template ?? reviewId ?? undefined}
          toneClass="bg-amber-100 text-amber-700"
        />
      </div>
    );
  }

  if (kind === "ib_assembly") {
    const stage = typeof payload.stage === "string" ? payload.stage : null;
    return (
      <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-3">
        <StepHeader
          Icon={BookOpen}
          title="Assembling pitch book"
          subtitle={stage ?? undefined}
          toneClass="bg-purple-100 text-purple-700"
        />
      </div>
    );
  }

  if (kind === "tool_gated") {
    const slug = step.toolSlug ?? (payload.name as string | undefined) ?? null;
    const Icon = toolIcon(slug);
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
        <StepHeader
          Icon={Icon}
          title={`${prettyToolName(slug)} queued`}
          subtitle="Awaiting review approval — call deferred"
          toneClass="bg-amber-100 text-amber-700"
        />
      </div>
    );
  }

  if (kind === "tool_post_approval") {
    const slug = step.toolSlug ?? null;
    const ok = payload.ok !== false;
    const err = typeof payload.error === "string" ? payload.error : null;
    const Icon = toolIcon(slug);
    return (
      <div className={`rounded-lg border p-3 ${ok ? "border-emerald-200 bg-emerald-50/40" : "border-red-200 bg-red-50/40"}`}>
        <StepHeader
          Icon={ok ? CheckCircle2 : XCircle}
          title={`${prettyToolName(slug)} dispatched`}
          subtitle={ok ? "post-approval" : `failed: ${err ?? "unknown"}`}
          toneClass={ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}
        />
        {!ok && err ? <p className="mt-2 text-xs text-red-700">{err}</p> : null}
      </div>
    );
  }

  if (kind === "code_execution") {
    const language = typeof payload.language === "string" ? payload.language : "python";
    const code = typeof payload.code === "string" ? payload.code : "";
    const stdoutPreview = typeof payload.stdout_preview === "string" ? payload.stdout_preview : "";
    const stderrPreview = typeof payload.stderr_preview === "string" ? payload.stderr_preview : "";
    const runtimeMs = typeof payload.runtime_ms === "number" ? payload.runtime_ms : 0;
    const hasError = payload.has_error === true;
    const bootError = typeof payload.boot_error === "string" ? payload.boot_error : null;
    const sandboxError = typeof payload.sandbox_error === "string" ? payload.sandbox_error : null;

    return (
      <div className={`rounded-lg border p-3 ${hasError ? "border-amber-200 bg-amber-50/40" : "border-emerald-200 bg-emerald-50/40"}`}>
        <StepHeader
          Icon={hasError ? AlertTriangle : CheckCircle2}
          title={`run_code (${language})`}
          subtitle={`${runtimeMs} ms${hasError ? " · errored" : ""}`}
          toneClass={hasError ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}
        />
        {bootError ? <p className="mt-2 text-xs text-red-700">Boot error: {bootError}</p> : null}
        {sandboxError ? <p className="mt-2 text-xs text-red-700">Sandbox lost: {sandboxError}</p> : null}
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 cursor-pointer"
        >
          {showRaw ? <ChevronDown className="size-3" /> : <ChevronRightIcon className="size-3" />}
          {showRaw ? "Hide code & output" : "Show code & output"}
        </button>
        {showRaw && (
          <>
            <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-gray-900 p-2 text-[11px] text-gray-100 whitespace-pre-wrap break-words">
{code}
            </pre>
            {stdoutPreview && (
              <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-gray-50 p-2 text-[11px] text-gray-700 whitespace-pre-wrap break-words">
                <span className="font-semibold text-gray-500">stdout:</span>{"\n"}{stdoutPreview}
              </pre>
            )}
            {stderrPreview && (
              <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-red-50 p-2 text-[11px] text-red-800 whitespace-pre-wrap break-words">
                <span className="font-semibold">stderr:</span>{"\n"}{stderrPreview}
              </pre>
            )}
          </>
        )}
      </div>
    );
  }

  if (kind === "code_stdout") {
    const chunk = typeof payload.chunk === "string" ? payload.chunk : "";
    return (
      <div className="rounded-lg border border-emerald-200/60 bg-white p-2">
        <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-700 mb-1">stdout</p>
        <pre className="text-[11px] text-gray-800 whitespace-pre-wrap break-words font-mono">{chunk}</pre>
      </div>
    );
  }

  if (kind === "code_stderr") {
    const chunk = typeof payload.chunk === "string" ? payload.chunk : "";
    return (
      <div className="rounded-lg border border-red-200/60 bg-white p-2">
        <p className="text-[10px] font-mono uppercase tracking-wider text-red-700 mb-1">stderr</p>
        <pre className="text-[11px] text-red-800 whitespace-pre-wrap break-words font-mono">{chunk}</pre>
      </div>
    );
  }

  // Unknown kind — generic fallback
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <StepHeader Icon={HelpCircle} title={kind} toneClass="bg-gray-100 text-gray-600" />
      <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-gray-50 p-2 text-[11px] text-gray-700 whitespace-pre-wrap break-words">
        {JSON.stringify(payload, null, 2).slice(0, 2000)}
      </pre>
    </div>
  );
}

// Keep unused icons referenced so tree-shakers don't complain during dev;
// all are already used above. (no-op)
void Globe;
void Package;
