import { z } from "zod";
import { registerTool } from "../tool-registry";
import type { ToolDef } from "../types";

const schema = z.object({
  prompt: z.string().min(1).max(20000),
  max_tokens: z.number().int().min(128).max(4000).optional(),
});

const tool: ToolDef<typeof schema> = {
  slug: "llm_reason",
  description: "Delegate sub-reasoning (summarize, analyze, draft) to a cheap model. Returns plain text. Cheaper than using your own context for long intermediate thought.",
  schema,
  async execute(_ctx, { prompt, max_tokens }) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return { ok: false, error: "OPENROUTER_API_KEY not configured" };
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemma-4-26b-a4b-it",
          messages: [{ role: "user", content: prompt }],
          max_tokens: max_tokens ?? 2000,
          temperature: 0.3,
        }),
      });
      if (!res.ok) return { ok: false, error: `llm_reason upstream ${res.status}` };
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string") return { ok: false, error: "empty response" };
      return { ok: true, data: { text: content } };
    } catch (e) {
      return { ok: false, error: `llm_reason failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
};

registerTool(tool);
export default tool;
