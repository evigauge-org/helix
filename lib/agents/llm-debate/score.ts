// lib/agents/llm-debate/score.ts

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "of", "in", "on", "at", "for", "to", "from", "with", "by", "as", "that",
  "this", "these", "those", "and", "or", "but", "not", "no", "yes",
  "what", "when", "where", "who", "why", "how", "which",
  "do", "does", "did", "can", "could", "should", "would", "will",
  "i", "we", "you", "they", "he", "she", "it",
  "about", "into", "over", "under", "any", "some", "all",
]);

const EVASION_PATTERNS = [
  /\bi cannot determine\b/i,
  /\bi do not have access\b/i,
  /\bi don'?t have access\b/i,
  /\bi'?m unable to\b/i,
  /\bi cannot provide\b/i,
  /\bi am not able to\b/i,
  /\bwithout more context\b/i,
  /\bwithout more information\b/i,
];

// Matches numbers with units/currency: $4.2B, 12%, 2026-03-31, 1.5M, 3.4x
const NUMERIC_PATTERN = /(?:\$|₹|€|£)\s?\d[\d,.]*\s?[kKmMbBtT]?|\d[\d,.]*\s?%|\d{4}-\d{2}-\d{2}|\d[\d.]*[xX]\b|\b\d[\d,.]+\s?(?:M|B|K|T|thousand|million|billion|trillion)\b/g;

const URL_PATTERN = /https?:\/\/[^\s)]+/g;

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);
}

function keywordsFromQuery(query: string): Set<string> {
  const kws = new Set<string>();
  for (const tok of tokenize(query)) {
    if (tok.length < 2) continue;
    if (STOPWORDS.has(tok)) continue;
    kws.add(tok);
  }
  return kws;
}

export interface ScoreAnswerParams {
  query: string;
  answer: string;
}

export function scoreAnswer({ query, answer }: ScoreAnswerParams): number {
  const lowerAnswer = answer.toLowerCase();
  const answerTokens = new Set(tokenize(answer));

  let score = 0;

  // +2 per distinct stopword-filtered keyword present
  for (const kw of keywordsFromQuery(query)) {
    if (answerTokens.has(kw)) score += 2;
  }

  // +1 per number-with-unit
  const numericHits = answer.match(NUMERIC_PATTERN);
  if (numericHits) score += numericHits.length;

  // +1 per URL
  const urlHits = answer.match(URL_PATTERN);
  if (urlHits) score += urlHits.length;

  // -2 per evasion phrase
  for (const pat of EVASION_PATTERNS) {
    if (pat.test(lowerAnswer)) score -= 2;
  }

  return score;
}

export interface RelevanceCandidate {
  model: string;
  content: string;
}

export function pickMostRelevant(query: string, candidates: RelevanceCandidate[]): RelevanceCandidate {
  if (candidates.length === 0) {
    throw new Error("pickMostRelevant: no candidates to score");
  }
  let best = candidates[0];
  let bestScore = scoreAnswer({ query, answer: best.content });
  for (let i = 1; i < candidates.length; i++) {
    const s = scoreAnswer({ query, answer: candidates[i].content });
    if (s > bestScore) {
      best = candidates[i];
      bestScore = s;
    }
  }
  return best;
}
