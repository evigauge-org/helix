const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";
const TIMEOUT_MS = 60_000;
const RETRY_DELAYS_MS = [500, 1500, 3500];

async function embedOnce(apiKey: string, text: string): Promise<number[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(OPENAI_EMBED_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI embedding failed (${res.status}): ${body}`);
    }
    const data = await res.json();
    const vector = data?.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length !== 1536) {
      throw new Error("OpenAI embedding returned unexpected shape");
    }
    return vector;
  } finally {
    clearTimeout(timeout);
  }
}

export async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await embedOnce(apiKey, text);
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("OpenAI embedding failed after retries");
}

export function toPgVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
