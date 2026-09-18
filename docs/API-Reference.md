# Reasonix — API Reference

> Complete reference for all API endpoints with request bodies and response examples.

**Base URL:** `http://localhost:8000`

---

## Health

### `GET /health`

**Response:**
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "components": {
    "redis": "connected",
    "cache_stats": {
      "exact_hits": 12,
      "semantic_hits": 8,
      "misses": 30,
      "total_requests": 50,
      "hit_rate": 0.4
    }
  },
  "classifier_stats": {
    "total_classifications": 50,
    "rule_based_pct": 70.0,
    "llm_based_pct": 30.0
  }
}
```

---

## Query Endpoints

### `POST /api/v2/query/run`

Direct in-process execution. No Celery needed. Runs any tier.

Supports two modes:
- **Sync mode** (default, `stream: false`): Blocks until the full result is ready. Response includes `query_id` and `websocket_url` — the frontend can optionally connect to the WebSocket while the HTTP request is pending to show real-time reasoning/chain-of-thought.
- **Stream mode** (`stream: true`): Returns `query_id` + `websocket_url` immediately. The query processes in the background. Connect to the WebSocket for live progress, or poll `GET /api/v2/query/{query_id}/result` for the final result.

**Request:**
| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `query` | string | yes | — | The question to analyze (3-5000 chars) |
| `session_id` | string | no | `null` | Session ID for conversational follow-ups |
| `force_tier` | int | no | auto | Force a specific tier (1, 2, or 3) |
| `use_exa` | bool | no | `true` | Enable Exa web search enrichment |
| `stream` | bool | no | `false` | Return immediately with `query_id`, process in background |
| `include_decision_trace` | bool \| null | no | `null` | Override tier-aware default. `null` → use default (Tier 1 off; Tier 2/3 on); `true` → force on; `false` → force off. See **Decision Trace** below. |
| `include_counterfactuals` | bool | no | `false` | Tier 3 only: run source ablation to measure each source's causal influence on the answer. Adds 30-60s and ~$0.10-0.30/query. Ignored on Tier 1/2. |

**Request (sync mode):**
```json
{
  "query": "Stock valuation of HCG Healthcare India with DCF analysis",
  "force_tier": 3,
  "use_exa": true,
  "session_id": null
}
```

**Request (stream mode):**
```json
{
  "query": "Deep analysis of Zomato DCF valuation",
  "force_tier": 3,
  "stream": true
}
```

**Response (stream mode — HTTP 200, returned immediately):**
```json
{
  "query_id": "q_a1b2c3d4e5f6",
  "status": "processing",
  "tier": 3,
  "websocket_url": "/ws/query/q_a1b2c3d4e5f6",
  "poll_url": "/api/v2/query/q_a1b2c3d4e5f6/result",
  "message": "Query submitted. Connect to websocket_url for real-time progress."
}
```

**WebSocket progress messages** (`/ws/query/{query_id}`):

The WebSocket delivers real-time updates as the query progresses through each phase:

```json
{"query_id": "q_a1b2c3d4e5f6", "status": "processing", "phase": "exa_search", "progress": 0, "result": {"message": "Gathering research context"}}
{"query_id": "q_a1b2c3d4e5f6", "status": "processing", "phase": "round1", "progress": 50, "result": {"message": "Starting parallel research"}}
{"query_id": "q_a1b2c3d4e5f6", "status": "processing", "phase": "reasoning_guard", "progress": 55, "result": {...}}
{"query_id": "q_a1b2c3d4e5f6", "status": "processing", "phase": "round2", "progress": 70, "result": {"average_agreement": 8.2}}
{"query_id": "q_a1b2c3d4e5f6", "status": "processing", "phase": "round3", "progress": 85, "result": {"message": "Building consensus"}}
{"query_id": "q_a1b2c3d4e5f6", "status": "processing", "phase": "code_execution", "progress": 90, "result": {"message": "Writing and executing code"}}
{"query_id": "q_a1b2c3d4e5f6", "status": "complete", "phase": "done", "progress": 100, "result": {<full result object>}}
```

**Progress phases (Tier 3):**
| Phase | Progress | Description |
|---|---|---|
| `exa_search` | 0-10 | Gathering research context from Exa |
| `fetching_financial_data` | 10-15 | Fetching real-time financial data |
| `round1` | 15-55 | Independent parallel research (4 agents) |
| `reasoning_guard` | 55 | Checking agents for drift |
| `round2` | 55-70 | Agents critiquing each other |
| `grok_second_opinion` | 70-75 | Grok-4 second opinion (if disagreement) |
| `early_exit` / `round3` | 75-85 | Consensus or 3rd round |
| `code_execution` | 85-90 | Writing/executing code for calculations |
| `done` | 100 | Complete |

**Frontend integration example (JavaScript):**
```javascript
// 1. Submit query in stream mode
const res = await fetch('/api/v2/query/run', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({query: 'DCF valuation of ZOMATO', stream: true})
});
const {query_id, websocket_url} = await res.json();

// 2. Connect WebSocket for real-time progress
const ws = new WebSocket(`ws://localhost:8000${websocket_url}`);
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log(`Phase: ${msg.phase}, Progress: ${msg.progress}%`);
  updateProgressBar(msg.progress);
  updateChainOfThought(msg.phase, msg.result);

  if (msg.status === 'complete') {
    displayResult(msg.result);
    ws.close();
  }
};
```

**Response (sync mode):** Full result object. Now also includes `query_id` and `websocket_url`.
```json
{
  "query": "Stock valuation of HCG Healthcare India...",
  "query_hash": "a1b2c3d4",
  "tier": 3,
  "success": true,
  "answer": "## 1. Where Agents Agreed [HIGH CONFIDENCE]\n\nAll agents confirmed...",
  "confidence": 0.87,
  "agents_used": [
    "claude-opus-4.6-research",
    "gemini-3-flash-preview-analysis",
    "gpt-4o-reasoning",
    "claude-opus-4.6-synthesis"
  ],
  "tokens": { "input": 24189, "output": 12179, "total": 36368 },
  "duration_ms": 156291,
  "cache": { "hit": false, "type": null },
  "sources": [
    "https://screener.in/company/HCG/consolidated/",
    "https://nseindia.com/get-quotes/equity?symbol=HCG"
  ],
  "agent_outputs": {
    "research": "## Key Data Points Extracted\n\nRevenue (Dec 2025): INR 633 Cr...",
    "analysis": "## Growth Decomposition\n\nOrganic revenue CAGR: 12.4%...",
    "reasoning": "## Quantitative Model\n\nDCF at 11.5% WACC...",
    "synthesis": "## Bull Case (40%)\n\nIf margins expand to 20%..."
  },
  "consensus_data": {
    "rounds_completed": 2,
    "average_agreement": 8.2,
    "early_exit": true,
    "analytical": {
      "confidence_scores": { "research": 0.92, "analysis": 0.88 },
      "shared_claims_count": 5,
      "consensus_strength": 8.2,
      "high_agreement_claims": ["HCG revenue Dec 2025: INR 633 Cr"]
    }
  },
  "reasoning_chain": {
    "initial_understanding": "Stock valuation requires DCF + comparable analysis",
    "key_assumptions": "Growth rate 12-15%, WACC 11.5%",
    "reasoning_steps": ["Extract revenue data", "Compute CAGR", "Build DCF"],
    "conclusion": "Fair value range: INR 480-560"
  },
  "chain_of_thoughts": [
    { "agent": "tier3", "thought": "Processing complex query...", "confidence": 0.8, "timestamp": "2026-03-24T14:52:00" },
    { "agent": "financial_data", "thought": "Fetched real data from: screener.in, nse_india", "confidence": 0.95, "timestamp": "2026-03-24T14:52:05" }
  ],
  "guardrail_result": {
    "status": "pass",
    "is_safe": true,
    "is_report_grade": true,
    "processing_time_ms": 3200,
    "pii": {
      "count": 0,
      "has_critical": false,
      "items": [],
      "redacted_text": null
    },
    "toxicity": {
      "score": 0.01,
      "is_toxic": false,
      "flagged_categories": [],
      "flagged_phrases": []
    },
    "hallucination": {
      "score": 0.05,
      "accuracy_rate": 0.95,
      "threshold": 0.003,
      "flagged_segments": []
    },
    "fact_verification": {
      "score": 0.92,
      "accuracy_threshold": 0.99,
      "grounding_score": 0.88
    },
    "claims": {
      "verified": [
        { "text": "HCG revenue Dec 2025: INR 633 Cr", "confidence": 0.96, "source": "Screener.in", "agent": "research" }
      ],
      "unverified": [
        { "text": "Management expects 15% growth", "confidence": 0.4, "source": "", "agent": "synthesis" }
      ],
      "contradicted": [
        { "text": "Operating margin is 22%", "confidence": 0.3, "source": "Screener.in", "contradiction_detail": "Source shows operating margin of 17.5%", "agent": "analysis" }
      ]
    },
    "citation_audit": {
      "coverage": 0.85,
      "uncited_claims": [
        "The healthcare sector is expected to grow significantly in the next decade."
      ]
    },
    "source_quality": {
      "overall_quality": "high",
      "average_authority": 0.82,
      "high_authority_count": 3,
      "low_authority_count": 0,
      "source_diversity": 0.8,
      "warnings": [],
      "sources": [
        { "url": "https://screener.in/company/HCG/", "domain": "screener.in", "authority_tier": "high", "cited_by_agents": 3, "overall_score": 0.95 },
        { "url": "https://nseindia.com/...", "domain": "nseindia.com", "authority_tier": "high", "cited_by_agents": 2, "overall_score": 0.9 }
      ]
    },
    "errors": []
  },
  "source_provenance": {
    "total_sources_encountered": 10,
    "active_sources": 8,
    "dropped_sources": 1,
    "contested_sources": 1,
    "sources": {
      "active": [{ "source": "Screener.in", "cited_by": ["research", "analysis"], "claims_supported": ["Revenue data"], "confidence": 1.0 }],
      "dropped": [{ "source": "old-blog.com", "drop_reason": "Round 2, analysis: Outdated", "confidence": 0.0 }],
      "contested": [{ "source": "news-article.com", "confidence": 0.7 }]
    },
    "claim_source_index": [
      { "claim": "Revenue Dec 2025: INR 633 Cr", "sources": ["Screener.in"], "source_count": 1 }
    ]
  },
  "reasoning_guard": {
    "total_checks": 8,
    "drift_detections": 0,
    "corrections_issued": 0,
    "corrections_applied": 0,
    "max_drift_score": 0.2,
    "agent_drift_counts": {},
    "all_on_track": true
  },
  "debate_narrative": {
    "total_entries": 8,
    "rounds_captured": 3,
    "round1_independent_research": {
      "research": { "claims": ["Revenue CAGR 12.4%"], "reasoning": "Based on Screener.in quarterly data" }
    },
    "disagreements": [
      { "between": "analysis vs synthesis", "score": 6.5, "about": "Margin expansion sustainability" }
    ],
    "position_changes": [
      { "agent": "synthesis", "before": "Margins will expand 3%", "after": "Margins expand 1-2% conservatively", "reason": "Analysis agent flagged cost pressures" }
    ],
    "insights_from_debate": ["Analysis agent caught margin risk that research agent missed"],
    "why_multi_agent_is_better": ["synthesis changed position after critique — single LLM would keep optimistic view"],
    "what_single_llm_would_miss": ["1 position revised — single LLM keeps potentially wrong position"]
  },
  "epistemic_integrity": {
    "sycophancy_risk": 0.0,
    "position_strength": 0.85,
    "disclosed_limitations": ["Based on 3 assumptions that could be wrong"],
    "potential_flaws": ["If interest rates rise, DCF model compresses"],
    "assumptions_made": ["Assumption: growth continues at 12-15%"],
    "data_gaps": [],
    "user_framing_detected": "",
    "position_held": true
  },
  "decision_trace": {
    "trace_schema_version": 1,
    "query_id": "q_a1b2c3d4e5f6",
    "tier": 2,
    "judge_status": "judged",
    "judge_model": "anthropic/claude-sonnet-4-6",
    "judge_latency_ms": 2840,
    "judge_tokens": { "input": 1180, "output": 420 },
    "counterfactuals_run": false,
    "pii_redacted": true,
    "built_at": "2026-05-08T14:32:11.221Z",
    "build_duration_ms": 3120,
    "narrative": "The answer's claim about Reliance's FY24 revenue derives primarily from the company's annual report (reliance.com, weight 0.85, authority tier high)...",
    "mermaid": "flowchart TD\n    classDef src fill:#cfe7ff,...\n    src_a1b2c3d4[\"reliance.com<br/>tier=high (0.9)\"]:::src\n    ...",
    "nodes": [
      { "id": "src_a1b2c3d4", "type": "Source", "data": { "url": "...", "domain": "reliance.com", "authority_tier": "high", "authority_score": 0.9, "provider": "exa", "snippet": "...", "fetch_status": "ok" }, "verbalization": "Annual report — primary", "confidence": 0.95, "stage": "ingest" },
      { "id": "claim_2", "type": "Claim", "data": { "text": "FY24 revenue ₹9.74 lakh cr", "span_in_answer": [42, 102], "kind": "factual" }, "stage": "synthesize" },
      { "id": "verdict_claim_2", "type": "FactVerdict", "data": { "verdict": "verified", "score": 0.91, "supporting_src_ids": ["src_a1b2c3d4"], "contradicting_src_ids": [] }, "stage": "audit" }
    ],
    "edges": [
      { "id": "e2", "from_id": "src_a1b2c3d4", "to_id": "claim_2", "type": "derived_from", "weight": 0.85, "verbalization": "Annual report directly cites this figure" },
      { "id": "e3", "from_id": "claim_2", "to_id": "verdict_claim_2", "type": "judged_by" }
    ]
  },
  "reliability": {
    "grade": "B",
    "score": 82,
    "citation_coverage": 0.85,
    "fact_verification": 0.92,
    "accuracy_rate": 0.95,
    "hallucination_risk": 0.05,
    "source_quality": "high",
    "contradictions_found": 1,
    "warnings": [
      "1 claim(s) contradicted by sources",
      "Only 85% of factual claims have citations"
    ]
  },
  "code_results": [
    {
      "success": true,
      "reasoning": "Computing revenue CAGR from quarterly data",
      "code": "revenue = [424, 441, 460, ...]\ncagr = (revenue[-1]/revenue[0])**(1/3)-1\nprint(f'CAGR: {cagr:.2%}')",
      "output": "CAGR: 12.4%\nOperating Margin: 17.5%",
      "execution_time_ms": 45,
      "variables": { "cagr": "0.124" },
      "charts_generated": []
    }
  ],
  "autonomous_data": {
    "synthetic_data_generated": true,
    "synthetic_rows": 10000,
    "real_sample_rows_used": 20,
    "real_data_source": "Screener.in quarterly data",
    "benchmark_results": {
      "metrics": { "revenue": { "mean": 45000000, "median": 28000000, "p25": 12000000, "p75": 65000000 } },
      "data_quality_score": 0.98,
      "insights": ["revenue: Target is in top 10% of peers"]
    },
    "valuation_results": {
      "method": "dcf",
      "base_value": 887000000,
      "recommended_range": "$638M - $1274M"
    }
  },
  "report": {
    "report_id": "rpt_17942c41ef5f",
    "status": "completed",
    "is_report_grade": true,
    "quality": {
      "hallucination_score": 0.05,
      "fact_accuracy": 0.92,
      "hallucination_threshold": 0.003,
      "accuracy_threshold": 0.99
    },
    "formats": {
      "pdf": "/api/v2/reports/rpt_17942c41ef5f/download?format=pdf",
      "docx": "/api/v2/reports/rpt_17942c41ef5f/download?format=docx",
      "md": "/api/v2/reports/rpt_17942c41ef5f/download?format=md",
      "xlsx": "/api/v2/reports/rpt_17942c41ef5f/download?format=xlsx"
    },
    "pages": 8
  },
  "slides_data": null,
  "financial_excel": {
    "file_id": "fin_7e3a9c01",
    "download_url": "/api/v2/reports/fin_7e3a9c01/download?format=xlsx",
    "sheets": 5,
    "tables_extracted": 3,
    "metrics_extracted": 12,
    "scenarios_found": 3,
    "code_variables": 8
  },
  "timestamps": {
    "started_at": "2026-03-24T14:52:00.000000",
    "completed_at": "2026-03-24T14:54:36.291000"
  }
}
```

**`financial_excel`** — Auto-generated when the query involves financial modeling (DCF, valuation, revenue breakdown, sensitivity analysis, comparable analysis, etc.). Contains a dedicated Excel workbook with structured sheets extracted from the AI output.

Triggers on queries containing: `dcf`, `valuation`, `revenue breakdown/projection`, `sensitivity analysis`, `bull/bear/base case`, `WACC/IRR/NPV`, `comparable analysis`, `financial model`, `SOTP`, `pro forma`.

| Field | Description |
|---|---|
| `file_id` | Unique file identifier |
| `download_url` | URL to download the `.xlsx` file |
| `sheets` | Number of sheets in the workbook |
| `tables_extracted` | Markdown tables found and converted (revenue projections, margins, etc.) |
| `metrics_extracted` | Key-value financial metrics extracted (e.g. `Revenue: ₹20,243 Cr`) |
| `scenarios_found` | Bull/base/bear scenarios detected |
| `code_variables` | Computed variables from code execution (CAGR, DCF value, WACC, etc.) |

**Excel sheets generated:**
| Sheet | Content |
|---|---|
| Key Metrics | All financial key-value pairs from the answer |
| Data tables (multiple) | Revenue projections, margin trends, peer comparisons — any markdown tables |
| Scenario Analysis | Bull/base/bear cases with probability, target value, assumptions |
| Computed Values | Variables computed by the code agent (CAGR, WACC, DCF, NPV, etc.) |
| Code Outputs | Reasoning + output from each code execution |

This field is `null` / absent for non-financial queries. The general report Excel (`report.formats.xlsx`) is always generated for Tier 2/3 — `financial_excel` is an additional dedicated workbook specifically for the financial model.

---

#### Decision Trace (`decision_trace`)

Unified attribution graph that explains **why each source was kept/dropped, which sources contributed to which claim, and (Tier 3 + opt-in) what would change if individual sources were removed**. Surfaced inline on every Tier 2/3 query (and on Tier 1 when explicitly requested via `include_decision_trace: true`).

**When it's present:**
- Tier 2: present by default
- Tier 3: present by default
- Tier 1: only when `include_decision_trace: true` is in the request
- All tiers: omitted (`decision_trace` key absent OR `null`) when the global kill switch `decision_trace_enabled=False` is set, OR when the build raised an uncaught error. Frontends MUST treat `null` / missing as a valid response.

**Top-level fields on `decision_trace`:**

| Field | Type | Description |
|---|---|---|
| `trace_schema_version` | int | Schema version. `1` today. Frontends should guard on this and show "trace not supported" if a higher version arrives. |
| `query_id` | string | Echo of the parent query's id |
| `tier` | int | The tier this trace was built for |
| `nodes` | array | Pipeline-event nodes — Source, Claim, AgentOutput, FactVerdict, Counterfactual, etc. |
| `edges` | array | Causal relationships — derived_from, dropped_by, judged_by, cited_in, ablated_to, contradicts, revised_to |
| `narrative` | string | 2-3 paragraph plain-English explanation of how the answer was derived |
| `mermaid` | string | Server-rendered `flowchart TD` Mermaid graph; drop into any Mermaid component as-is |
| `judge_status` | string | `"judged"` (LLM attribution succeeded) or `"fallback"` (deterministic-only — cross-judge failed; fewer `derived_from` edges) |
| `judge_model` | string \| null | Which LLM was used for attribution (e.g. `"anthropic/claude-sonnet-4-6"`). `null` on fallback. |
| `judge_latency_ms` | int \| null | Cross-judge wall-clock latency. `null` on hard fallback, `0` on early skip (no claims/sources to judge). |
| `judge_tokens` | object \| null | `{input, output}` token counts from the cross-judge call. `null` on fallback. |
| `counterfactuals_run` | bool | `true` iff at least one counterfactual ablation completed (always `false` unless Tier 3 + `include_counterfactuals=true`) |
| `pii_redacted` | bool | `true` if PII redactor swept the trace successfully. `false` indicates either redactor failure (with `decision_trace_pii_fail_open=true`) — frontend should display a "raw" badge in that case. |
| `built_at` | string | ISO 8601 UTC timestamp with `Z` suffix |
| `build_duration_ms` | int | Total build time across all phases |

**Node types** (12 total) appear in `decision_trace.nodes[].type`:

`Source`, `SourceFilter`, `AgentOutput`, `Critique`, `Revision`, `Claim`, `FactVerdict`, `CitationLink`, `HallucinationSignal`, `Counterfactual`, `FinalAnswer`, `StageMarker`

**Edge types** (7 total) appear in `decision_trace.edges[].type`:

`derived_from` (Claim → Source, weighted), `contradicts`, `dropped_by` (Source → SourceFilter), `revised_to` (AgentOutput → Revision), `judged_by` (Claim → FactVerdict / HallucinationSignal), `cited_in` (Source → Claim), `ablated_to` (Source → Counterfactual)

##### Frontend consumption mapping

| UI surface | Field(s) consumed | Notes |
|---|---|---|
| **"Why this answer" footer** | `decision_trace.narrative` | Plain-English. Render directly under the answer. |
| **"Decision graph" tab / modal** | `decision_trace.mermaid` | String is a valid `flowchart TD ...` — pass straight to any Mermaid library (e.g. `mermaid.render()`). Server already handles the >50-node collapse rules. |
| **Interactive DAG explorer** | `decision_trace.nodes` + `decision_trace.edges` | Wire to react-flow, cytoscape.js, or vis.js. Each node has a stable `id`, a `type` (one of the 12), `data` (type-specific payload), optional `verbalization`, optional `confidence`. Each edge has `from_id`, `to_id`, `type`, optional `weight`, optional `verbalization`. |
| **Source pill kept / dropped indicator** | `nodes[type=='Source']` + `edges[type=='dropped_by']` | A source is dropped iff there's a `dropped_by` edge with `from_id == source.id`. The corresponding `SourceFilter` node carries the `reason` and the `filter_name`. |
| **"Counterfactual evidence" panel** (Tier 3 + flag) | `nodes[type=='Counterfactual']` + matching `edges[type=='ablated_to']` | Each Counterfactual node has `data.ablated_src_id`, `data.drift_score` (0-1), `data.would_change_answer` (bool), `data.delta_summary`. Show only when `decision_trace.counterfactuals_run === true`. |
| **Transparency widget** ("trace cost / latency") | `judge_latency_ms`, `judge_tokens`, `judge_model`, `build_duration_ms` | Compute cost client-side: `judge_tokens.input × $/1M + judge_tokens.output × $/1M` using a model-price lookup. |
| **Fallback indicator** ("attribution unavailable") | `judge_status === "fallback"` | When fallback, `derived_from` edges are absent and the narrative is template-generated. Show a subtle "deterministic" badge — the trace is still valid, just less rich. |
| **Schema upgrade guard** | `trace_schema_version` | If `> 1`, show "Trace requires a newer dashboard version" and do not attempt to parse the graph. |

##### Common consumption patterns

**Get all kept sources (in JS):**
```javascript
const droppedSrcIds = new Set(
  decision_trace.edges
    .filter(e => e.type === "dropped_by")
    .map(e => e.from_id)
);
const keptSources = decision_trace.nodes.filter(
  n => n.type === "Source" && !droppedSrcIds.has(n.id)
);
```

**Get sources backing a specific claim (in JS):**
```javascript
function sourcesForClaim(decision_trace, claimId) {
  // Cross-judge attribution edges
  const judgeAttribs = decision_trace.edges
    .filter(e => e.type === "derived_from" && e.to_id === claimId)
    .map(e => ({ src_id: e.from_id, weight: e.weight, reason: e.verbalization }));

  // Citation-auditor edges (deterministic — always present)
  const citationSrcs = decision_trace.edges
    .filter(e => e.type === "cited_in" && e.to_id === claimId)
    .map(e => e.from_id);

  return { judge: judgeAttribs, cited: citationSrcs };
}
```

**Detect counterfactual-significant sources (Tier 3):**
```javascript
const significantSources = decision_trace.nodes
  .filter(n => n.type === "Counterfactual" && n.data.would_change_answer)
  .map(n => n.data.ablated_src_id);
```

##### Failure modes (graceful degradation)

| Symptom | What happened | Frontend action |
|---|---|---|
| `decision_trace` key absent or `null` | Build threw uncaught error, OR kill switch is on | Hide the trace UI entirely. Answer is still valid. |
| `judge_status === "fallback"` | Cross-judge LLM call failed/timed out — graph is deterministic-only, no `derived_from` edges, narrative is template-generated | Show a subtle badge ("deterministic mode"); don't show "Why this claim" attribution UI for individual claims. |
| `pii_redacted === false` | Redactor failed and the system was in fail-open mode | Show a "raw" warning badge. Avoid copying trace strings to logs/telemetry. |
| `counterfactuals_run === false` AND `tier === 3` AND request set `include_counterfactuals: true` | All ablations failed or timed out within the 60s budget | Hide the Counterfactual panel entirely (don't show empty state). |
| `mermaid === ""` | Render phase raised | Hide the graph tab; the raw `nodes`/`edges` are still available for the interactive DAG explorer. |

##### Cost & latency expectations

| Tier | Default trace? | Added latency | Added cost / query |
|---|---|---|---|
| 1 | Off | ~80ms (skipped) | $0 |
| 2 | On | ~3.2s | ~$0.015 |
| 3 | On | ~4.3s | ~$0.025 |
| 3 + `include_counterfactuals=true` | On + ablations | +30-60s, ~$0.13-0.33 |

The cross-judge runs in series with the answer pipeline (synthesis → guardrails → trace), so its latency adds to the total response time. Counterfactual ablations run in parallel under a 60s total budget — partial results are accepted.

##### Spec reference

The implementation source lives in `decision_trace/` (package: `__init__.py` exposes `build_decision_trace`; `schema.py`, `builder.py`, `judge.py`, `counterfactual.py`, `render.py`, `redact.py`, `config.py`).

---

### `POST /api/v2/query/with-files`

Query with attached documents. Multipart form data.

**Document parsing strategy (PDFs):** files are run through a 4-tier fallback —
1. **PageIndex** — primary parser for PDFs. Hierarchical tree indexing + agentic RAG; preserves balance sheets, income statements, and exact financial figures. Returns a `doc_id` so agents can run targeted follow-up queries during the Tier 3 debate.
2. **Docling** — table-aware structured extraction.
3. **pypdf** — page-by-page text extraction.
4. **Plain text decode** — for `.txt`, `.md`, `.csv`.

Non-PDF formats (xlsx, docx, csv, etc.) skip directly to Docling / plain text. The original user query is preserved as a search override so file content is **not** sent to Exa — only the text query is.

If files are attached and `force_tier` is unset or < 2, the request is auto-upgraded to Tier 2 (files imply serious analysis).

**Async mode:** PageIndex processing can take up to ~1 hour for large financial PDFs. Set `async_mode=true` to return a `job_id` immediately and process in the background. Poll `GET /api/v2/query/with-files/{job_id}` for results. When `async_mode` is omitted or `false`, the endpoint behaves synchronously as before — no frontend changes required.

**Adaptive polling (internal):** When waiting for PageIndex, the server uses adaptive poll intervals to avoid wasted API calls: every 5s for the first 2 min, 15s up to 10 min, 30s up to 30 min, then 60s after that. In async mode, this uses `asyncio.sleep` so the event loop stays free and the server can handle other requests while waiting.

**Request (multipart/form-data):**
| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `query` | string | yes | — | The question to analyze |
| `force_tier` | int | no | auto | Force a specific tier (1, 2, or 3) |
| `use_exa` | bool | no | `true` | Enable Exa web search enrichment |
| `async_mode` | bool | no | `false` | Return job_id immediately, process in background |
| `files` | file(s) | no | — | Up to 10 files, 50MB each |

**curl (sync mode — default):**
```bash
curl -X POST http://localhost:8000/api/v2/query/with-files \
  -F "query=Analyze revenue trends" \
  -F "force_tier=3" \
  -F "files=@report.pdf" \
  -F "files=@data.xlsx"
```

**curl (async mode — for large PDFs):**
```bash
curl -X POST http://localhost:8000/api/v2/query/with-files \
  -F "query=Analyze this 500-page annual report" \
  -F "async_mode=true" \
  -F "force_tier=3" \
  -F "files=@huge_report.pdf"
```

**Response (sync mode):** Same as `/api/v2/query/run` plus an `attached_files` array describing how each upload was processed:
```json
{
  "attached_files": [
    {
      "filename": "annual_report.pdf",
      "chunks": 1,
      "size_bytes": 2100000,
      "parse_method": "pageindex",
      "extracted_chars": 48213,
      "pageindex_doc_id": "doc_8c1f4a..."
    },
    {
      "filename": "financials.xlsx",
      "chunks": 15,
      "size_bytes": 450000,
      "parse_method": "docling",
      "extracted_chars": 12480
    }
  ]
}
```

**Response (async mode):**
```json
{
  "job_id": "wf_a1b2c3d4-...",
  "status": "processing",
  "poll_url": "/api/v2/query/with-files/wf_a1b2c3d4-...",
  "files": ["huge_report.pdf"],
  "message": "Processing in background. Poll the poll_url for results."
}
```

`parse_method` is one of `pageindex`, `docling`, `pypdf`, `plain_text`, or `none`. Files that fail every strategy come back as `{ "filename": ..., "error": ..., "size_bytes": ... }` in the same array. When `parse_method == "pageindex"`, the `pageindex_doc_id` is also propagated into `user_context._pageindex_doc_ids`, enabling Tier 3 agents to run autonomous targeted extraction queries against the document during the debate.

### `GET /api/v2/query/with-files/{job_id}`

Poll for the result of an async `/with-files` job. Only available when the original request used `async_mode=true`.

**Response (still processing — HTTP 202):**
```json
{
  "job_id": "wf_a1b2c3d4-...",
  "status": "processing",
  "message": "Still processing. Try again shortly."
}
```
Returns a `Retry-After: 30` header as a hint for polling interval.

**Response (completed — HTTP 200):**
Full result identical to the sync mode response (same as `/api/v2/query/run` + `attached_files`).

**Response (failed — HTTP 500):**
```json
{
  "detail": "Error description..."
}
```

Jobs expire after 2 hours in Redis.

---

### `POST /api/v2/query`

Async query. Requires Celery workers. Returns immediately with query_id.

**Request:**
```json
{
  "query": "Deep analysis of Indian healthcare sector",
  "force_tier": 3,
  "use_exa": true,
  "session_id": "sess_abc123"
}
```

**Response:**
```json
{
  "query_id": "q_abc123def456",
  "status": "queued",
  "tier": 3,
  "estimated_time_seconds": 120,
  "websocket_url": "/ws/query/q_abc123def456",
  "classification": {
    "tier": 3,
    "confidence": 0.94,
    "method": "rule_based",
    "reasoning": "Complex multi-faceted analysis query"
  }
}
```

### `GET /api/v2/query/{query_id}/status`

**Response:**
```json
{
  "query_id": "q_abc123def456",
  "status": "processing",
  "tier": 3,
  "created_at": "2026-03-24T14:52:00",
  "has_result": false
}
```

### `GET /api/v2/query/{query_id}/result`

**Response:** Same full response as `/api/v2/query/run`.

### `POST /api/v2/query/sync`

Synchronous Tier 1 only.

**Request:**
```json
{ "query": "What is EBITDA?", "use_exa": true }
```

**Response:**
```json
{
  "success": true,
  "answer": "EBITDA stands for Earnings Before Interest, Taxes, Depreciation, and Amortization...",
  "confidence": 0.8,
  "duration_ms": 2340,
  "sources": ["https://investopedia.com/terms/e/ebitda.asp"],
  "cached": false
}
```

---

## Classification

### `POST /api/v2/classify`

**Request:**
```json
{ "query": "Stock valuation of HCG with DCF analysis" }
```

**Response:**
```json
{
  "tier": 3,
  "confidence": 0.94,
  "method": "rule_based",
  "reasoning": "Contains valuation, DCF — complex financial analysis"
}
```

### `GET /api/v2/classifier/stats`

**Response:**
```json
{
  "total_classifications": 150,
  "rule_based_pct": 72.0,
  "llm_based_pct": 28.0,
  "context_adjusted_pct": 5.0
}
```

---

## Agent Spawning

### `POST /api/v2/agents/spawn`

**Request:**
```json
{
  "task": "Perform due diligence on a mid-market SaaS company with $50M ARR",
  "agent_type": "due_diligence",
  "rag_session_id": null,
  "force_tier": 3,
  "context_hint": {
    "sector": "saas",
    "revenue": 50000000,
    "ebitda_margin": 0.25
  }
}
```

**Response:**
```json
{
  "agent_id": "agt_a1b2c3d4e5f6",
  "agent_type": "due_diligence",
  "status": "released",
  "domain": "technology",
  "task": "Perform due diligence on a mid-market SaaS...",
  "warm_start": false,
  "findings": [
    "Revenue CAGR is 23.4%...",
    "[SYNTHETIC] Generated 10,000 rows of SaaS benchmark data",
    "[VALUATION] DCF: $638M - $1,274M"
  ],
  "sources": ["10-K FY2022.pdf", "Screener.in"],
  "queries_executed": 3,
  "total_cost_usd": 0.52,
  "total_duration_ms": 145000,
  "synthetic_data": { "generated": true, "rows": 10000 },
  "benchmark": { "metrics": {}, "data_quality_score": 0.98 },
  "valuation": { "method": "dcf", "recommended_range": "$638M - $1274M" },
  "report": { "report_id": "rpt_xxx", "formats": {} },
  "lifecycle": {
    "agent_id": "agt_a1b2c3d4e5f6",
    "warm_start": false,
    "context_cached": true,
    "context_cache_key": "technology/default",
    "total_lifecycle_ms": 145000,
    "status": "released"
  }
}
```

### `GET /api/v2/agents/active`

**Response:**
```json
{
  "agents": [
    { "agent_id": "agt_xxx", "agent_type": "research", "task": "...", "status": "running", "spawned_at": "..." }
  ]
}
```

### `GET /api/v2/agents/{agent_id}/status`

**Response:**
```json
{
  "agent_id": "agt_xxx",
  "agent_type": "due_diligence",
  "task": "...",
  "status": "running",
  "details": "Executing step 3/5: benchmarking"
}
```

### `GET /api/v2/agents/contexts`

**Response:**
```json
{
  "contexts": [
    { "domain": "technology", "subdomain": "default", "agent_type": "due_diligence", "task_summary": "DD on SaaS...", "cached_at": "2026-03-24T..." }
  ]
}
```

---

## Reports

### `GET /api/v2/reports/{report_id}/download`

**Query params:** `format=pdf|docx|md|xlsx`

**Response:** File download with appropriate MIME type.

```bash
curl -o report.pdf "http://localhost:8000/api/v2/reports/rpt_xxx/download?format=pdf"
curl -o report.docx "http://localhost:8000/api/v2/reports/rpt_xxx/download?format=docx"
curl -o report.md "http://localhost:8000/api/v2/reports/rpt_xxx/download?format=md"
curl -o report.xlsx "http://localhost:8000/api/v2/reports/rpt_xxx/download?format=xlsx"
```

---

## Media / Content Creation

### `POST /api/v2/media/structure-slides`

**Request:**
```json
{
  "query_result": { "...full query result dict..." }
}
```

Or:
```json
{
  "text": "Raw research text to structure into slides",
  "query": "Fiscal policy changes presentation"
}
```

**Response:**
```json
{
  "slides_data": {
    "presentation_title": "FY2026 Fiscal Policy Changes",
    "subtitle": "Reasonix Intelligence Report",
    "slides": [
      { "slide_number": 1, "layout": "title", "title": "FY2026 Fiscal Policy Changes", "subtitle": "Management Discussion Summary" },
      { "slide_number": 2, "layout": "content", "title": "Executive Summary", "bullets": ["Tax rate reduced to 22%", "3-5% earnings boost expected"] },
      { "slide_number": 3, "layout": "two_column", "title": "Winners vs Losers", "left_column": { "heading": "Beneficiaries", "bullets": ["IT", "Pharma"] }, "right_column": { "heading": "Affected", "bullets": ["Real estate"] } }
    ],
    "metadata": { "query": "...", "tier": 3, "total_slides": 11 }
  }
}
```

---

## RAG (Document Q&A)

### `POST /api/v2/rag/upload`

**Request (multipart/form-data):**
```
files: @document1.pdf
files: @document2.docx
```

**Response:**
```json
{
  "session_id": "rag_abc123",
  "status": "processing",
  "documents": [
    { "doc_id": "doc_1", "filename": "document1.pdf", "status": "processing" },
    { "doc_id": "doc_2", "filename": "document2.docx", "status": "processing" }
  ],
  "expires_at": "2026-03-25T14:52:00",
  "ws_url": "/ws/rag/rag_abc123"
}
```

### `GET /api/v2/rag/session/{session_id}`

**Response:**
```json
{
  "session_id": "rag_abc123",
  "status": "ready",
  "total_documents": 2,
  "total_chunks": 847,
  "created_at": "2026-03-24T14:52:00",
  "expires_at": "2026-03-25T14:52:00"
}
```

### `DELETE /api/v2/rag/session/{session_id}`

**Response:**
```json
{ "session_id": "rag_abc123", "status": "deleted" }
```

### `POST /api/v2/rag/query`

**Request:**
```json
{
  "session_id": "rag_abc123",
  "query": "What are the termination clauses?",
  "model": "gemini-3-flash",
  "web_search": false,
  "top_k": 10
}
```

**Response:**
```json
{
  "query_id": "rq_xxx",
  "answer": "Based on the uploaded documents, the termination clauses are...",
  "sources": [
    { "document": "contract.pdf", "chunk_text": "Either party may terminate...", "page": 12, "section": "Section 7.2", "score": 0.94 }
  ],
  "web_context": [],
  "model_used": "gemini-3-flash",
  "tokens": { "input": 1200, "output": 450 },
  "cost_usd": 0.001,
  "duration_ms": 2300,
  "guardrail_transparency": {
    "pii": { "count": 0, "items": [] },
    "toxicity": { "score": 0.01, "is_toxic": false }
  }
}
```

---

## Synthetic Data

### `POST /api/v2/synthetic/generate`

**Request:**
```json
{
  "query": "Generate fraud detection dataset with 10000 transactions",
  "rows": 10000,
  "use_template": "auto"
}
```

**Response:**
```json
{
  "job_id": "syn_abc123",
  "status": "processing",
  "estimated_time_seconds": 60,
  "websocket_url": "/ws/synthetic/syn_abc123",
  "schema_detected": { "data_type": "tabular", "domain_hint": "finance" }
}
```

### `GET /api/v2/synthetic/templates`

**Response:**
```json
{
  "templates": {
    "finance": ["fraud_detection", "credit_scoring", "stock_prices", "loan_applications"],
    "healthcare": ["patient_records", "diagnosis_prediction", "readmission_risk", "clinical_notes"],
    "ecommerce": ["customer_churn", "product_recommendations", "review_sentiment", "purchase_history"],
    "hr": ["employee_attrition", "resume_screening", "performance_reviews"],
    "iot": ["sensor_readings", "anomaly_detection", "predictive_maintenance"]
  }
}
```

### `GET /api/v2/synthetic/{job_id}/status`

**Response:**
```json
{
  "job_id": "syn_abc123",
  "status": "processing",
  "progress": 65,
  "stage": "generating",
  "estimated_time_seconds": 20
}
```

### `GET /api/v2/synthetic/{job_id}/preview`

**Response:**
```json
{
  "job_id": "syn_abc123",
  "rows": [
    { "transaction_id": "TX001", "amount": 42.50, "merchant": "Amazon", "is_fraud": 0 },
    { "transaction_id": "TX002", "amount": 1847.00, "merchant": "WireTransfer", "is_fraud": 1 }
  ],
  "total_rows": 10000,
  "columns": ["transaction_id", "amount", "merchant", "is_fraud"]
}
```

### `GET /api/v2/synthetic/{job_id}/download?format=xlsx`

**Response:** File download (xlsx or csv).

### `POST /api/v2/synthetic/augment`

**Request (multipart/form-data):**
```
file: @existing_data.csv
config: {"multiplier": 3, "preserve_correlations": true, "privacy_epsilon": 1.0}
```

**Response:** Same as `/synthetic/generate`.

---

## Reasoning

### `POST /api/v2/reason`

**Request:**
```json
{
  "query": "What are the geopolitical implications of rare earth supply chains?",
  "user_id": "user_123",
  "include_sources": true,
  "max_rounds": 3
}
```

**Response:**
```json
{
  "job_id": "rsn_abc123",
  "status": "queued",
  "estimated_time_seconds": 120,
  "poll_url": "/api/v2/reason/rsn_abc123",
  "websocket_url": "/ws/reason/rsn_abc123"
}
```

### `GET /api/v2/reason/{job_id}`

**Response:**
```json
{
  "job_id": "rsn_abc123",
  "success": true,
  "query": "What are the geopolitical implications...",
  "reasoning_steps": [
    { "step": 1, "content": "China controls 60% of rare earth processing..." },
    { "step": 2, "content": "US Inflation Reduction Act incentivizes domestic mining..." }
  ],
  "conclusion": "The rare earth supply chain presents significant geopolitical risk...",
  "consensus_strength": 8.7,
  "debate_summary": {
    "rounds_completed": 2,
    "average_agreement": 8.7,
    "early_exit": true
  },
  "sources": ["Reuters", "USGS", "IEA"],
  "duration_ms": 87000
}
```

---

## LKB (Linguistic Knowledge Base)

### `POST /api/v2/lkb/analyze`

**Request:**
```json
{ "query": "मुझे बैंक के बारे में बताओ" }
```

**Response:**
```json
{
  "original_text": "मुझे बैंक के बारे में बताओ",
  "canonical_text": "mujhe bank ke baare mein batao",
  "detected_languages": [
    { "lang": "hi", "confidence": 0.96 }
  ],
  "script_type": "DEVANAGARI",
  "resolved_ambiguities": [
    { "word": "बैंक", "meaning": "financial institution", "alternatives": ["river bank"], "confidence": 0.72 }
  ],
  "cultural_context": [],
  "disambiguation_confidence": 0.72,
  "needs_clarification": true,
  "processing_cost_ms": 23
}
```

### `GET /api/v2/lkb/stats`

**Response:**
```json
{
  "total_queries": 1240,
  "cache_hits": 847,
  "cache_hit_rate": 0.73,
  "avg_latency_ms": 18,
  "languages_processed": { "hi": 520, "en": 400, "ta": 120 }
}
```

### `GET /api/v2/lkb/health`

**Response:**
```json
{ "status": "healthy", "detector": "ready", "cache": "connected" }
```

### `GET /api/v2/lkb/languages`

**Response:**
```json
{
  "languages": [
    { "code": "hi", "name": "Hindi", "status": "active", "seed_data": true },
    { "code": "ta", "name": "Tamil", "status": "active", "seed_data": true },
    { "code": "te", "name": "Telugu", "status": "active", "seed_data": true },
    { "code": "bn", "name": "Bengali", "status": "active", "seed_data": true },
    { "code": "mr", "name": "Marathi", "status": "active", "seed_data": true },
    { "code": "en", "name": "English", "status": "active", "seed_data": true }
  ]
}
```

---

## NotebookLM Studio — Autonomous Content Generation

Generate slide decks, podcasts, videos, infographics, quizzes, flashcards, mind maps, and data tables from research output. The engine autonomously creates a NotebookLM notebook, feeds it your research, generates artifacts in parallel, and returns download URLs. Users never touch the NotebookLM CLI.

**Supported Artifact Types:**

| Type | Value | Download Format | Description |
|------|-------|-----------------|-------------|
| Audio Overview | `audio` | MP3 | Podcast-style audio (deep-dive, brief, critique, debate) |
| Video Overview | `video` | MP4 | Video summary (whiteboard, explainer, cinematic) |
| Slide Deck | `slide_deck` | PDF | Presentation deck |
| Infographic | `infographic` | PNG | Visual summary (landscape, portrait, square) |
| Quiz | `quiz` | JSON | Knowledge quiz with configurable difficulty |
| Flashcards | `flashcards` | JSON | Study flashcards |
| Mind Map | `mind_map` | JSON | Hierarchical concept map |
| Data Table | `data_table` | CSV | Structured data table |
| Report | `report` | Markdown | Written report/study guide |

### `POST /api/v2/studio/generate`

Generate content artifacts from research text or a full query result.

**Request:**
```json
{
  "text": "AI coding assistants have transformed software development. GitHub Copilot leads with 40% market share...",
  "query": "Competitive landscape of AI coding assistants",
  "artifacts": ["slide_deck", "audio", "infographic"],
  "source_urls": [
    "https://github.blog/news-insights/research/survey-ai-wave-grows/",
    "https://www.cursor.com"
  ],
  "instructions": "make it engaging and executive-friendly",
  "audio_format": "deep-dive",
  "video_style": "whiteboard",
  "quiz_difficulty": "medium",
  "infographic_orientation": "landscape"
}
```

Or pass a full query result:
```json
{
  "query_result": { "...full /api/v2/query/run response..." },
  "artifacts": ["slide_deck", "audio"]
}
```

**Response:**
```json
{
  "notebook_id": "nb_abc123def456",
  "artifacts": [
    {
      "artifact_type": "slide_deck",
      "status": "completed",
      "download_url": "/api/v2/studio/artifacts/studio_abc123_slide_deck_f1e2d3/download",
      "format": "pdf",
      "duration_ms": 45200,
      "metadata": { "task_id": "task_xyz", "format": "detailed" },
      "error": null
    },
    {
      "artifact_type": "audio",
      "status": "completed",
      "download_url": "/api/v2/studio/artifacts/studio_abc123_audio_a4b5c6/download",
      "format": "mp3",
      "duration_ms": 120500,
      "metadata": { "task_id": "task_abc", "format": "deep-dive", "length": "medium" },
      "error": null
    },
    {
      "artifact_type": "infographic",
      "status": "completed",
      "download_url": "/api/v2/studio/artifacts/studio_abc123_infographic_d7e8f9/download",
      "format": "png",
      "duration_ms": 38000,
      "metadata": {},
      "error": null
    }
  ],
  "status": "completed",
  "total_duration_ms": 125400,
  "error": null
}
```

**Partial failure example** (2/3 artifacts succeed):
```json
{
  "notebook_id": "nb_abc123def456",
  "artifacts": [
    { "artifact_type": "slide_deck", "status": "completed", "download_url": "/api/v2/studio/artifacts/studio_xxx_slide_deck_aaa/download", "format": "pdf", "duration_ms": 42000, "metadata": {}, "error": null },
    { "artifact_type": "audio", "status": "completed", "download_url": "/api/v2/studio/artifacts/studio_xxx_audio_bbb/download", "format": "mp3", "duration_ms": 98000, "metadata": {}, "error": null },
    { "artifact_type": "video", "status": "failed", "download_url": null, "format": "", "duration_ms": 0, "metadata": {}, "error": "Generation timed out after 300s" }
  ],
  "status": "partial",
  "total_duration_ms": 140200,
  "error": null
}
```

### `GET /api/v2/studio/artifacts/{file_id}/download`

Download a generated studio artifact.

**Response:** File download with appropriate MIME type.

```bash
# Download podcast
curl -o podcast.mp3 "http://localhost:8000/api/v2/studio/artifacts/studio_abc123_audio_a4b5c6/download"

# Download slides
curl -o slides.pdf "http://localhost:8000/api/v2/studio/artifacts/studio_abc123_slide_deck_f1e2d3/download"

# Download infographic
curl -o infographic.png "http://localhost:8000/api/v2/studio/artifacts/studio_abc123_infographic_d7e8f9/download"

# Download quiz as JSON
curl -o quiz.json "http://localhost:8000/api/v2/studio/artifacts/studio_abc123_quiz_g0h1i2/download"
```

### Per-User NotebookLM Authentication

Users can connect their own Google/NotebookLM account so artifacts are created on **their** account (visible at notebooklm.google.com). If not connected, the server's own credentials are used as fallback.

#### `GET /api/v2/studio/auth/status`

Check if the current user has connected their NotebookLM account.

**Headers:** `X-API-Key: dr_xxx`

**Response (not connected):**
```json
{
  "connected": false
}
```

**Response (connected):**
```json
{
  "connected": true,
  "google_email": "user@gmail.com",
  "connected_at": "2026-03-30T10:15:00+00:00",
  "last_used_at": "2026-03-31T08:22:00+00:00",
  "is_valid": true
}
```

#### `POST /api/v2/studio/auth/connect`

Connect a user's own Google/NotebookLM account by providing session cookies.

**Headers:** `X-API-Key: dr_xxx`

**Request:**
```json
{
  "cookies_json": "{\"cookies\": [{\"name\": \"SID\", \"value\": \"...\", \"domain\": \".google.com\"}, ...]}",
  "google_email": "user@gmail.com"
}
```

The `cookies_json` field accepts either:
- **Playwright storage_state format:** `{"cookies": [{"name": "SID", "value": "...", "domain": "..."}, ...]}`
- **Raw cookie dict:** `{"SID": "...", "HSID": "...", ...}`

**Response (success):**
```json
{
  "status": "connected",
  "google_email": "user@gmail.com",
  "message": "NotebookLM account connected. All future Studio artifacts will use your account."
}
```

**Response (invalid cookies):**
```json
{
  "detail": "Cookies are invalid or expired. Please re-authenticate with Google. Error: ..."
}
```

#### `DELETE /api/v2/studio/auth/disconnect`

Remove stored NotebookLM credentials. Future Studio requests will use server credentials.

**Headers:** `X-API-Key: dr_xxx`

**Response:**
```json
{
  "status": "disconnected",
  "message": "NotebookLM account disconnected. Credentials deleted."
}
```

#### Auth Expiry Handling

When a user's stored cookies expire, the Studio generate response includes:
```json
{
  "auth_expired": true,
  "message": "Your NotebookLM session has expired. Please re-connect your account.",
  "artifacts": [...]
}
```

The frontend should detect `auth_expired: true` and prompt the user to re-connect.

---

### Auto-Generation via `/api/v2/query/run`

When a user's query includes content generation intent, Studio artifacts are **automatically generated** alongside the research. No separate API call needed.

**Example query:**
```json
{
  "query": "Research the competitive landscape of AI coding assistants and create a podcast, slide deck, and infographic",
  "force_tier": 3
}
```

**Response** includes the standard query result fields plus:
```json
{
  "answer": "## 1. Where Agents Agreed [HIGH CONFIDENCE]...",
  "confidence": 0.89,
  "report": { "report_id": "rpt_xxx", "formats": { "pdf": "..." } },
  "studio": {
    "notebook_id": "nb_abc123",
    "artifacts": [
      { "artifact_type": "audio", "status": "completed", "download_url": "/api/v2/studio/artifacts/studio_xxx_audio_aaa/download", "format": "mp3", "duration_ms": 115000, "metadata": {}, "error": null },
      { "artifact_type": "slide_deck", "status": "completed", "download_url": "/api/v2/studio/artifacts/studio_xxx_slide_deck_bbb/download", "format": "pdf", "duration_ms": 42000, "metadata": {}, "error": null },
      { "artifact_type": "infographic", "status": "completed", "download_url": "/api/v2/studio/artifacts/studio_xxx_infographic_ccc/download", "format": "png", "duration_ms": 35000, "metadata": {}, "error": null }
    ],
    "status": "completed",
    "total_duration_ms": 118000,
    "error": null
  }
}
```

**Intent detection keywords:**
it should
| Intent | Detected Keywords |
|--------|-------------------|
| Slide deck | `slides`, `slide deck`, `presentation`, `ppt`, `powerpoint`, `deck` |
| Audio | `podcast`, `audio`, `audio overview` |
| Video | `video`, `video overview`, `cinematic`, `explainer video` |
| Infographic | `infographic`, `visual summary` |
| Quiz | `quiz`, `test questions` |
| Flashcards | `flashcards`, `study cards` |
| Mind map | `mind map`, `concept map` |
| Data table | `data table`, `spreadsheet`, `csv` |

Combined with a creation verb: `create`, `make`, `build`, `generate`, `produce`, `give me`, `prepare`.

### Auto-Generation via `/api/v2/agents/spawn`

Spawned agents also auto-detect studio intent. When an agent's task description includes content requests, the `content_generation` step runs after research/benchmarking/valuation.

**Example:**
```json
{
  "task": "Perform due diligence on a mid-market SaaS company and create a slide deck and podcast summarizing findings",
  "agent_type": "due_diligence",
  "context_hint": { "sector": "saas", "revenue": 50000000 }
}
```

**Response** includes the standard agent result plus:
```json
{
  "agent_id": "agt_a1b2c3d4e5f6",
  "findings": [
    "Revenue CAGR is 23.4%...",
    "[STUDIO] Generated 2/2 artifacts: slide_deck, audio"
  ],
  "studio": {
    "notebook_id": "nb_xyz789",
    "artifacts": [
      { "artifact_type": "slide_deck", "status": "completed", "download_url": "/api/v2/studio/artifacts/studio_xyz_slide_deck_aaa/download", "format": "pdf", "duration_ms": 48000, "metadata": {}, "error": null },
      { "artifact_type": "audio", "status": "completed", "download_url": "/api/v2/studio/artifacts/studio_xyz_audio_bbb/download", "format": "mp3", "duration_ms": 105000, "metadata": {}, "error": null }
    ],
    "status": "completed",
    "total_duration_ms": 112000
  }
}
```

---

## Frontend Integration Guide

### What the Frontend Needs

**1. Detect studio results in API response:**
```typescript
if (response.studio && response.studio.artifacts?.length > 0) {
  // Render download buttons
}
```

**2. Render artifact download cards:**
```typescript
// Map artifact types to icons and labels
const ARTIFACT_UI = {
  audio:       { icon: "Headphones",   label: "Podcast",     color: "#8B5CF6" },
  video:       { icon: "Video",        label: "Video",       color: "#EC4899" },
  slide_deck:  { icon: "Presentation", label: "Slide Deck",  color: "#3B82F6" },
  infographic: { icon: "Image",        label: "Infographic", color: "#10B981" },
  quiz:        { icon: "HelpCircle",   label: "Quiz",        color: "#F59E0B" },
  flashcards:  { icon: "Layers",       label: "Flashcards",  color: "#6366F1" },
  mind_map:    { icon: "GitBranch",    label: "Mind Map",    color: "#14B8A6" },
  data_table:  { icon: "Table",        label: "Data Table",  color: "#64748B" },
  report:      { icon: "FileText",     label: "Report",      color: "#D4A843" },
};
```

**3. Download handler:**
```typescript
const downloadArtifact = (downloadUrl: string, filename: string) => {
  window.open(`${BASE_URL}${downloadUrl}`, "_blank");
};
```

**4. Loading state** while studio is generating (1-5 minutes):
- Show spinner per artifact type
- Can poll `/api/v2/studio/artifacts/{file_id}/download` (returns 404 until ready)
- Or use WebSocket for real-time progress

**5. Reliability badge** (new — from `reliability` field):
```typescript
const GRADE_COLORS = {
  A: "#10B981", B: "#3B82F6", C: "#F59E0B", D: "#F97316", F: "#EF4444", "N/A": "#6B7280"
};

if (response.reliability) {
  const { grade, score, warnings } = response.reliability;
  // Render: grade badge (A-F), score bar (0-100), warning tooltips
}
```

**6. Disputed claims warning** (new — from `guardrail_result.claims.contradicted`):
```typescript
const contradicted = response.guardrail_result?.claims?.contradicted || [];
if (contradicted.length > 0) {
  // Render warning banner: "X claims are disputed by sources"
  // Show each contradicted claim with its contradiction_detail
}
```

**7. Citation coverage indicator** (new — from `guardrail_result.citation_audit`):
```typescript
const citationAudit = response.guardrail_result?.citation_audit;
if (citationAudit && citationAudit.coverage < 0.7) {
  // Render: "Only X% of claims have citations" warning
  // Optionally list citationAudit.uncited_claims
}
```

**8. Source quality display** (new — from `guardrail_result.source_quality`):
```typescript
const sourceQuality = response.guardrail_result?.source_quality;
if (sourceQuality) {
  // Render per-source authority tier badges (high/medium/low)
  // Show warnings if any
}
```

**9. Studio auth status** (new — per-user NotebookLM connection):
```typescript
// Check connection status
const authStatus = await fetch(`${BASE_URL}/api/v2/studio/auth/status`, {
  headers: { "X-API-Key": apiKey }
}).then(r => r.json());

if (!authStatus.connected) {
  // Show "Connect NotebookLM" button
} else {
  // Show "Connected as user@gmail.com" with disconnect option
}

// Handle auth expiry in Studio responses
if (response.studio?.auth_expired) {
  // Show "Session expired — reconnect your NotebookLM account" prompt
}
```

### What the Frontend Does NOT Need

- No NotebookLM SDK or client library
- No artifact generation logic
- No intent parsing (backend handles natural language)

---

## Models & Cache

### `GET /api/v2/models/catalog`

**Response:**
```json
{
  "models": [
    { "id": "openai/gpt-4o", "tier": "complex", "cost_per_1k_input": 2.5, "cost_per_1k_output": 10.0 },
    { "id": "gemini/gemini-3-flash", "tier": "easy", "cost_per_1k_input": 0.15, "cost_per_1k_output": 0.6 },
    { "id": "anthropic/claude-opus-4.6", "tier": "complex", "cost_per_1k_input": 15.0, "cost_per_1k_output": 75.0 }
  ]
}
```

### `POST /api/v2/models/select`

**Request:**
```json
{ "query": "Stock valuation of HCG", "tier": 3 }
```

**Response:**
```json
{
  "complexity": "complex",
  "cluster_model_ids": ["openai/gpt-4o", "gemini/gemini-3-flash", "anthropic/claude-opus-4.6"],
  "consensus_model_id": "anthropic/claude-opus-4.6",
  "estimated_cost": 0.18,
  "frontier_needed": true
}
```

### `GET /api/v2/cache/stats`

**Response:**
```json
{
  "exact_hits": 524,
  "semantic_hits": 387,
  "misses": 336,
  "total_requests": 1247,
  "hit_rate": 0.73,
  "semantic_available": true
}
```

### `DELETE /api/v2/cache/clear`

**Query params:** `pattern=tier3*` (optional)

**Response:**
```json
{ "cleared": true, "pattern": "tier3*" }
```

---

## Reproducibility Engine

### `POST /api/v2/reproducibility/run`

Run reproducibility capabilities on research output. Auto-detects which capabilities are needed, or force specific ones.

**Request:**
```json
{
  "text": "Research findings text...",
  "query": "Compare LoRA vs QLoRA fine-tuning methods",
  "capabilities": ["source_matrix", "paper_draft", "peer_review"],
  "tier": 3
}
```

Or with a full query result:
```json
{
  "query_result": { "...full /api/v2/query/run response..." },
  "capabilities": []
}
```

**Available capabilities:** `source_matrix`, `code_audit`, `experiment_replication`, `paper_draft`, `peer_review`

**Response:**
```json
{
  "capabilities_detected": ["source_matrix", "paper_draft", "peer_review"],
  "capabilities_executed": ["source_matrix", "paper_draft", "peer_review"],
  "total_duration_ms": 45000,
  "source_matrix": {
    "mode": "claim_level",
    "total_claims": 15,
    "supported": 11,
    "contradicted": 2,
    "contested": 2,
    "unsupported": 0,
    "download_url": "/api/v2/reproducibility/artifacts/matrix_abc123/download"
  },
  "code_audit": null,
  "replication": null,
  "paper_draft": {
    "format": "academic",
    "title": "Comparative Analysis of Parameter-Efficient Fine-Tuning Methods",
    "sections": 8,
    "word_count": 4500,
    "citations": [
      {"ref_id": "hu2021lora", "title": "LoRA: Low-Rank Adaptation...", "authors": ["Edward Hu"], "year": 2021, "url": "https://arxiv.org/abs/2106.09685", "citation_count": 8500}
    ],
    "quality_gate_passed": true,
    "download_urls": {
      "md": "/api/v2/reproducibility/artifacts/draft_def456/download",
      "latex": "/api/v2/reproducibility/artifacts/draft_def456_latex/download"
    }
  },
  "peer_review": {
    "decision": "weak_accept",
    "aggregate_score": 6.8,
    "consensus": "Two reviewers positive, one borderline",
    "reviewers": [
      {"persona": "methodologist", "initial_review": {"overall": 7, "recommendation": "weak_accept"}, "score_changed": false},
      {"persona": "domain_expert", "initial_review": {"overall": 8, "recommendation": "accept"}, "score_changed": false},
      {"persona": "skeptic", "initial_review": {"overall": 5, "recommendation": "borderline"}, "score_changed": true, "final_recommendation": "weak_accept"}
    ],
    "key_strengths": ["Comprehensive comparison", "Strong empirical evidence"],
    "key_weaknesses": ["Limited ablation study", "Missing compute cost analysis"],
    "revision_suggestions": ["Add comparison on different model sizes", "Include training time metrics"],
    "disclaimer": "AI-simulated peer review — not a substitute for actual human peer review",
    "download_url": "/api/v2/reproducibility/artifacts/review_ghi789/download"
  },
  "error": null
}
```

### `GET /api/v2/reproducibility/artifacts/{file_id}/download`

Download a reproducibility artifact (source matrix xlsx, paper draft md/latex, peer review md, replication logs).

```bash
curl -o matrix.xlsx "http://localhost:8000/api/v2/reproducibility/artifacts/matrix_abc123/download"
curl -o paper.md "http://localhost:8000/api/v2/reproducibility/artifacts/draft_def456/download"
curl -o paper.tex "http://localhost:8000/api/v2/reproducibility/artifacts/draft_def456_latex/download"
curl -o review.md "http://localhost:8000/api/v2/reproducibility/artifacts/review_ghi789/download"
```

### Auto-Trigger in `/api/v2/query/run`

Reproducibility capabilities auto-trigger based on query content:

| Trigger | Capability |
|---|---|
| 3+ sources in result, comparison language | `source_matrix` |
| `code_results` present, GitHub URL in query | `code_audit` |
| "replicate", "reproduce", "re-run" keywords | `experiment_replication` |
| "paper", "draft", "writeup", arXiv sources + Tier 3 | `paper_draft` |
| Paper draft generated, "review", "critique" keywords | `peer_review` |

Response includes `"reproducibility": { ... }` alongside the normal query result.

---

## Business Optimization

### `POST /api/v2/optimization/analyze`

Analyze business documents for cost reduction and revenue growth opportunities. Extracts business context, benchmarks against industry (from 27 verified data sources), identifies specific AI/ML process opportunities.

**Request:**
```json
{
  "text": "Company financial data, operations description, annual report content...",
  "query": "How can we reduce costs and increase revenue?",
  "goal": "both"
}
```

**Goal options:** `cost_reduction`, `revenue_growth`, `both`

**Response:**
```json
{
  "goal": "both",
  "business_context": {
    "industry": "automotive",
    "sub_sector": "EV manufacturing",
    "company_name": "TargetCo",
    "revenue": 5000000000,
    "cost_structure": {"manufacturing": "60%", "SGA": "20%", "R&D": "12%"},
    "margins": {"gross": 0.28, "operating": 0.08}
  },
  "cost_opportunities": [
    {
      "area": "Supply Chain",
      "title": "Consolidate Tier 2 suppliers from 45 to 20",
      "estimated_savings": "$15-25M/year",
      "priority": "critical",
      "timeline": "6-12 months",
      "evidence": "Documents show 45 suppliers vs industry avg 18-22",
      "data_source": "[DOC] procurement report; [BENCH] McKinsey 2025",
      "risks": ["Supplier concentration risk"]
    }
  ],
  "revenue_opportunities": [
    {
      "area": "New Markets",
      "title": "Launch subscription services (OTA updates)",
      "estimated_upside": "$50-80M/year",
      "priority": "critical",
      "timeline": "3-6 months",
      "evidence": "Competitor analysis shows 15% adoption rate",
      "data_source": "[BENCH] Statista 2025 connected car report"
    }
  ],
  "ai_opportunities": [
    {
      "process_area": "Quality Inspection",
      "title": "Computer Vision Defect Detection on Assembly Line",
      "ai_technique": "CNN (YOLOv8) on edge GPU",
      "current_process": "Manual visual inspection by 12 QC staff, 92% detection rate",
      "proposed_ai_process": "4K cameras + edge inference, 200ms/unit, 99.2% detection",
      "estimated_impact": "$1.2-1.8M/year savings",
      "implementation_cost": "$150-250K setup + $30K/year",
      "roi_timeline": "6-9 months",
      "maturity": "proven",
      "case_studies": "BMW uses similar across 12 plants",
      "tech_stack_suggestion": "YOLOv8, NVIDIA Jetson, MLflow"
    }
  ],
  "total_cost_savings_estimate": "$40-60M/year",
  "total_revenue_upside_estimate": "$100-150M/year",
  "total_ai_impact_estimate": "$5-10M/year",
  "executive_summary": "The company has $40-60M in identifiable cost savings...",
  "download_url": "/api/v2/optimization/artifacts/optimization_abc123/download"
}
```

### `GET /api/v2/optimization/artifacts/{file_id}/download`

Download the full optimization report (Markdown).

```bash
curl -o report.md "http://localhost:8000/api/v2/optimization/artifacts/optimization_abc123/download"
```

### Auto-Trigger in `/api/v2/query/run`

Triggers when query contains cost/revenue optimization language:
- "reduce costs", "cut spending", "cost optimization"
- "increase revenue", "grow sales", "revenue growth"
- "improve profitability", "business optimization"

Response includes `"optimization": { ... }` alongside the normal query result.

---

## Voice AI

### `WebSocket /ws/voice/{session_id}`

Full-duplex multilingual voice AI. Client sends audio chunks, server sends back transcripts + TTS audio. Always-listening VAD, barge-in with resume, tone-matching.

**Connection:** `ws://localhost:8000/ws/voice/{session_id}`

**Client → Server messages:**

| Type | Payload | When |
|---|---|---|
| `audio_chunk` | `{ "type": "audio_chunk", "data": "<base64 opus>" }` | Every 100ms while mic active |
| `mute_toggle` | `{ "type": "mute_toggle", "muted": true }` | User clicks mute |
| `tts_playback_offset` | `{ "type": "tts_playback_offset", "offset_chars": 342 }` | During AI speech |
| `voice_control` | `{ "type": "voice_control", "action": "stop" }` | Manual stop |

**Server → Client messages:**

| Type | Payload | When |
|---|---|---|
| `vad_status` | `{ "type": "vad_status", "speaking": true }` | User speech detected |
| `transcript_partial` | `{ "type": "transcript_partial", "text": "yaar Natco ka..." }` | Live transcription |
| `transcript_final` | `{ "type": "transcript_final", "text": "...", "language": "hi-en" }` | Utterance complete |
| `intent_detected` | `{ "type": "intent_detected", "intent": "research_query", "clean_query": "Natco stock analysis", "tone": "casual" }` | After classification |
| `voice_ack` | `{ "type": "voice_ack", "text": "Chal kar raha hoon..." }` | Immediate acknowledgement |
| `tts_audio` | `{ "type": "tts_audio", "data": "<base64 mp3>", "offset_chars": 0 }` | AI speaking |
| `tts_interrupted` | `{ "type": "tts_interrupted", "offset_chars": 342, "can_resume": true }` | Barge-in detected |
| `tts_resumed` | `{ "type": "tts_resumed", "from_offset": 342 }` | User said "continue" |
| `tts_done` | `{ "type": "tts_done" }` | AI finished speaking |
| `progress` | `{ "type": "progress", "phase": "debate_round_2", "pct": 60 }` | Research in progress |
| `query_complete` | `{ "type": "query_complete", "result": {...} }` | Research done |
| `error` | `{ "type": "error", "message": "..." }` | Any error |

**Voice control commands (instant, no LLM):**

| Say | Action |
|---|---|
| "continue" / "haan bolo" / "aage bolo" | Resume interrupted speech from cutoff |
| "ruk" / "stop" / "bas" / "chup" | Stop speaking |
| "mute" / "mic off" | Disable microphone |
| "pehle ye kar" / "do this first" | Queue interrupted speech, process new input first |

### `GET /api/v2/voice/status`

Check if Voice AI is configured and ready.

**Response:**
```json
{
  "voice_enabled": true,
  "deepgram_configured": true,
  "elevenlabs_configured": true,
  "elevenlabs_voice_id": true
}
```

---

## User Intelligence — Behavioral Profile

### `GET /api/v2/profile/me`

Get the system's learned behavioral profile for the current user. Shows what the system has learned about your preferences, expertise, communication style — all from observing your usage, not from settings you configured.

**Response:**
```json
{
  "user_id": "uuid",
  "preferred_length": "detailed",
  "length_confidence": 0.75,
  "preferred_vocabulary": "technical",
  "tone": "casual",
  "code_switches": true,
  "primary_language": "en",
  "domains": {
    "finance": {
      "domain": "finance",
      "query_count": 45,
      "expertise_level": "expert",
      "jargon_used": ["wacc", "dcf", "irr", "lbo", "comps"],
      "topics": {"dcf": 12, "valuation": 8, "due diligence": 6}
    },
    "technology": {
      "domain": "technology",
      "query_count": 15,
      "expertise_level": "intermediate",
      "jargon_used": ["kubernetes", "microservice"]
    }
  },
  "preferred_report_format": "pdf",
  "format_counts": {"pdf": 28, "docx": 3, "md": 5},
  "uses_voice": true,
  "total_voice_minutes": 45.5,
  "follow_up_rate": 0.35,
  "asks_about_sources": 0.22,
  "satisfaction_score": 0.87,
  "total_queries": 120,
  "avg_queries_per_day": 8.5,
  "active_hours": {"9": 15, "10": 22, "11": 18, "14": 20, "15": 25},
  "recurring_patterns": [
    {"domain": "finance", "day_of_week": 1, "time_bucket": "8:00-12:00", "count": 8}
  ]
}
```

### `GET /api/v2/profile/memory`

Get what the system remembers about your past interactions (90-day cross-session memory).

**Response:**
```json
{
  "summary": {
    "total_memories": 42,
    "domains": {"finance": 25, "technology": 10, "business": 7},
    "top_entities": ["Natco Pharma", "Tesla", "LoRA", "DCF", "SaaS"],
    "oldest_memory": "2026-01-15T10:30:00",
    "newest_memory": "2026-03-28T16:45:00"
  },
  "recent_memories": [
    {
      "query": "Stock valuation of Natco Pharma using DCF",
      "answer_summary": "Natco fair value range is INR 480-560...",
      "domain": "finance",
      "key_entities": ["Natco Pharma", "NSE", "DCF"],
      "tier": 3,
      "confidence": 0.87,
      "timestamp": "2026-03-28T16:45:00"
    }
  ]
}
```

### `POST /api/v2/profile/feedback`

Submit thumbs up/down feedback on a query result. Helps the system learn your preferences.

**Request:**
```json
{
  "rating": "positive",
  "query_id": "q_abc123"
}
```

**Response:**
```json
{
  "status": "recorded",
  "satisfaction_score": 0.87,
  "total_ratings": 45
}
```

---

## Complete Endpoint Index

### Query Processing
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v2/query` | Async query (returns query_id) |
| POST | `/api/v2/query/run` | In-process query (any tier), supports `stream` mode for real-time WebSocket progress |
| POST | `/api/v2/query/sync` | Sync Tier 1 only |
| POST | `/api/v2/query/with-files` | Query + document attachments (supports `async_mode`) |
| GET | `/api/v2/query/with-files/{job_id}` | Poll async with-files job result |
| GET | `/api/v2/query/{id}/status` | Poll query status |
| GET | `/api/v2/query/{id}/result` | Get completed result |

### Classification & Cache
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v2/classify` | Classify query tier |
| GET | `/api/v2/cache/stats` | Cache statistics |
| DELETE | `/api/v2/cache/clear` | Clear cache |
| GET | `/api/v2/classifier/stats` | Classifier stats |

### Agents
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v2/agents/spawn` | Spawn autonomous agent |
| GET | `/api/v2/agents/active` | List running agents |
| GET | `/api/v2/agents/{id}/status` | Agent status |
| GET | `/api/v2/agents/contexts` | Cached agent knowledge |

### Reports & Media
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v2/reports/{id}/download` | Download report (PDF/DOCX/MD/XLSX) |
| POST | `/api/v2/media/structure-slides` | Structure research into slides |
| POST | `/api/v2/media/generate-pptx` | Generate PowerPoint |
| GET | `/api/v2/media/{id}/download` | Download PPTX |

### Content Studio (NotebookLM)
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v2/studio/generate` | Generate artifacts (podcast, video, slides, etc.) |
| GET | `/api/v2/studio/artifacts/{id}/download` | Download artifact |
| GET | `/api/v2/studio/auth/status` | Check user's NotebookLM connection status |
| POST | `/api/v2/studio/auth/connect` | Connect user's own NotebookLM account |
| DELETE | `/api/v2/studio/auth/disconnect` | Disconnect stored NotebookLM credentials |

### Reproducibility
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v2/reproducibility/run` | Run reproducibility capabilities |
| GET | `/api/v2/reproducibility/artifacts/{id}/download` | Download artifacts |

### Business Optimization
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v2/optimization/analyze` | Analyze for cost/revenue opportunities |
| GET | `/api/v2/optimization/artifacts/{id}/download` | Download optimization report |

### RAG (Documents)
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v2/rag/upload` | Upload documents |
| GET | `/api/v2/rag/session/{id}` | Session status |
| DELETE | `/api/v2/rag/session/{id}` | Delete session |
| POST | `/api/v2/rag/query` | Query documents |

### Synthetic Data
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v2/synthetic/generate` | Generate synthetic data |
| POST | `/api/v2/synthetic/augment` | Augment existing dataset |
| GET | `/api/v2/synthetic/templates` | List domain templates |
| GET | `/api/v2/synthetic/{id}/status` | Job status |
| GET | `/api/v2/synthetic/{id}/download` | Download data |
| GET | `/api/v2/synthetic/{id}/preview` | Preview rows |

### Reasoning-as-a-Service
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v2/reason` | Submit reasoning job (API key required) |
| GET | `/api/v2/reason/{id}` | Poll reasoning result |

### LKB (Language)
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v2/lkb/analyze` | Analyze text for language/culture |
| GET | `/api/v2/lkb/stats` | LKB cache stats |
| GET | `/api/v2/lkb/health` | LKB health check |
| GET | `/api/v2/lkb/languages` | Supported languages |

### Models & Routing
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v2/models/catalog` | Available models + pricing |
| POST | `/api/v2/models/select` | Auto-select model for query |

### Voice AI
| Method | Endpoint | Purpose |
|---|---|---|
| WS | `/ws/voice/{session_id}` | Full-duplex voice connection |
| GET | `/api/v2/voice/status` | Voice service health |

### User Intelligence
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v2/profile/me` | View learned behavioral profile |
| GET | `/api/v2/profile/memory` | View cross-session memory |
| POST | `/api/v2/profile/feedback` | Submit thumbs up/down rating |

### WebSocket Endpoints
| Endpoint | Purpose |
|---|---|
| `/ws/query/{query_id}` | Real-time query progress |
| `/ws/voice/{session_id}` | Full-duplex voice AI |
| `/ws/rag/{session_id}` | RAG upload progress |
| `/ws/synthetic/{job_id}` | Synthetic data progress |
| `/ws/reason/{job_id}` | Reasoning job progress |

### Utility
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Root with feature list |
| GET | `/health` | Health check |
| GET | `/docs` | Swagger UI |
| GET | `/redoc` | ReDoc |
