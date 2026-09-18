// ── Chat / Messages ──

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  files?: AttachedFile[];
  response?: QueryResponse;
  isStreaming?: boolean;
  mode?: "casual" | "research";
  createdAt: string;
}

export interface AttachedFile {
  file: File;
  name: string;
  size: number;
  type: string;
}

// ── Query API ──

export interface QueryRequest {
  query: string;
  force_tier?: number | null;
  use_exa?: boolean;
  session_id?: string | null;
}

export interface QueryResponse {
  query: string;
  query_hash?: string;
  tier: number;
  success: boolean;
  answer: string;
  confidence: number;
  conversation_mode?: boolean;
  agents_used?: string[];
  tokens?: { input: number; output: number; total: number };
  duration_ms: number;
  cache?: { hit: boolean; type: string | null };
  sources?: unknown[];
  follow_ups?: string[];
  research_steps?: ResearchProgress[];
  agent_outputs?: Record<string, string>;
  optimization?: OptimizationData;
  canonical_query?: string;
  slides_data?: SlidesData | null;
  financial_excel?: FinancialExcel | null;
  parsed_files?: ParsedFile[];
  attached_files?: ParsedFile[];
  agent_spec_card?: {
    spec: { name: string; goal: string; suggestedTools: string[]; rationale: string; systemPromptExtra?: string; templateSlug?: string };
    chatSessionId: string | null;
    draftToken?: string;
  };
  review_card?: {
    reviewId: string;
    runId: string;
    templateSlug: string;
    templateName: string;
    title: string;
    status: "pending" | "approved" | "changes_requested" | "rejected";
    summary: string;
    queuedActionCount: number;
    reviewerRoleHint?: string;
  };
  agent_post?: {
    agentId: string;
    runId: string;
  };
}

export interface FinancialExcel {
  file_id: string;
  download_url: string;
  sheets: number;
  tables_extracted: number;
  metrics_extracted: number;
  scenarios_found: number;
  code_variables: number;
}

export type ParseMethod = "pageindex" | "docling" | "pypdf" | "plain_text" | "none";

export type ParsedFile =
  | {
      filename: string;
      chunks: number;
      size_bytes: number;
      parse_method: ParseMethod;
      extracted_chars: number;
      pageindex_doc_id?: string;
      error?: undefined;
    }
  | {
      filename: string;
      size_bytes: number;
      error: string;
      chunks?: number;
      parse_method?: ParseMethod;
      extracted_chars?: number;
      pageindex_doc_id?: string;
    };

export interface OptimizationData {
  goal: string;
  business_context: Record<string, unknown>;
  cost_opportunities: { area: string; title: string; estimated_savings: string; priority: string; timeline: string; evidence: string; data_source: string; risks: string[] }[];
  revenue_opportunities: { area: string; title: string; estimated_upside: string; priority: string; timeline: string; evidence: string; data_source: string }[];
  ai_opportunities: { process_area: string; title: string; ai_technique: string; estimated_impact: string; maturity: string }[];
  total_cost_savings_estimate: string;
  total_revenue_upside_estimate: string;
  total_ai_impact_estimate: string;
  executive_summary: string;
  download_url?: string;
}

export interface SlidesData {
  presentation_title: string;
  subtitle: string;
  slides: { slide_number: number; layout: string; title: string; bullets?: string[] }[];
  metadata: { query: string; tier: number; total_slides: number };
}

// Per-step expandable detail carrying the REAL tool result content, so the
// chain-of-thought rows can expand to show what each tool actually returned.
export type ResearchStepDetail =
  | { kind: "search"; results: { title: string; url: string }[] }
  | { kind: "fetch"; title: string; excerpt: string }
  | { kind: "todo"; tasks: { task: string; done: boolean }[] }
  | { kind: "error"; message: string };

// Local progress hint for the adaptive research agent's tool activity.
// Surfaced in LiveCOT (components/chat/inline/live-cot.tsx) from the SSE
// `tool` event handled in hooks/use-chat.ts.
export interface ResearchProgress {
  phase: "searching" | "fetching" | "planning";
  label: string;
  detail?: ResearchStepDetail;
  done?: boolean;
}
