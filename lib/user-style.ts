// lib/user-style.ts
//
// The user's writing preferences from Settings → Account (`UserProfile`), and
// the prompt block that makes them take effect.
//
// These columns existed and were fully migrated long before anything read them.
// The Account page made them editable; this module is what makes them matter.
// Every user-facing answer path composes `buildStylePreamble` into its system
// prompt, so a change on the Account page changes the next answer.
//
// Scope note: this block governs REGISTER and LENGTH only. It is always placed
// after a prompt's structural rules (citations, required sections, honesty
// guardrails) so it can soften how something is said without licensing the
// model to drop what must be said.
import { prisma } from "@/lib/prisma";

export const RESPONSE_LENGTHS = ["concise", "detailed", "exhaustive"] as const;
export const VOCABULARIES = ["plain", "technical", "academic"] as const;
export const TONES = ["casual", "neutral", "formal"] as const;
export const REPORT_FORMATS = ["pdf", "docx", "xlsx", "md"] as const;
export const LANGUAGES = ["en", "hi", "ta", "te", "bn", "mr", "gu", "kn", "ml", "pa"] as const;

export type StyleProfile = {
  preferredLength: string;
  preferredVocabulary: string;
  tone: string;
  primaryLanguage: string;
  codeSwitches: boolean;
};

/**
 * Mirrors the `UserProfile` column defaults in schema.prisma. A user who has
 * never opened the Account page has no row at all, and `findUnique` returns
 * null — without this they would silently get no style block while the Account
 * page shows them "detailed / technical / casual".
 */
export const DEFAULT_STYLE: StyleProfile = {
  preferredLength: "detailed",
  preferredVocabulary: "technical",
  tone: "casual",
  primaryLanguage: "en",
  codeSwitches: false,
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  ta: "Tamil",
  te: "Telugu",
  bn: "Bengali",
  mr: "Marathi",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
};

// Bounds beat adjectives — "be concise" is ignored, "at most 3 paragraphs" is not.
const LENGTH_RULES: Record<string, string> = {
  concise:
    "Keep answers short: at most three short paragraphs, or eight bullets. Lead with the answer itself and cut preamble, restatement of the question, and closing recaps.",
  detailed:
    "Give a complete answer with the supporting detail that actually matters — usually three to six paragraphs. Do not pad, and do not truncate something the user needs.",
  exhaustive:
    "Be thorough. Cover edge cases, alternatives, and caveats, and use headings and sections when the material warrants them. Length is not a constraint; omission is.",
};

const VOCABULARY_RULES: Record<string, string> = {
  plain:
    "Use everyday words. When a technical term is unavoidable, define it the first time it appears.",
  technical:
    "Assume domain fluency. Use precise technical vocabulary without stopping to define standard terms.",
  academic:
    "Use formal, discipline-standard terminology, and name the underlying concepts, methods, or literature where they are relevant.",
};

const TONE_RULES: Record<string, string> = {
  casual:
    "Warm and conversational, like a knowledgeable friend. Contractions are welcome.",
  neutral: "Plain and even — neither chatty nor stiff.",
  formal:
    "Professional and measured. Avoid slang, contractions, and filler openers.",
};

/**
 * Reads the user's style preferences, falling back to the schema defaults when
 * no `UserProfile` row exists yet. Never throws — a preferences lookup must not
 * be able to fail a chat turn.
 */
export async function getStyleProfile(userId: string): Promise<StyleProfile> {
  try {
    const row = await prisma.userProfile.findUnique({
      where: { userId },
      select: {
        preferredLength: true,
        preferredVocabulary: true,
        tone: true,
        primaryLanguage: true,
        codeSwitches: true,
      },
    });
    return row ?? DEFAULT_STYLE;
  } catch {
    return DEFAULT_STYLE;
  }
}

/**
 * Renders the preferences as a system-prompt block. Returns "" when the profile
 * is missing entirely, so callers can `.filter(Boolean)` it away.
 */
export function buildStylePreamble(profile: StyleProfile | null | undefined): string {
  if (!profile) return "";

  const length = LENGTH_RULES[profile.preferredLength] ?? LENGTH_RULES.detailed;
  const vocabulary = VOCABULARY_RULES[profile.preferredVocabulary] ?? VOCABULARY_RULES.technical;
  const tone = TONE_RULES[profile.tone] ?? TONE_RULES.casual;

  const languageName = LANGUAGE_NAMES[profile.primaryLanguage] ?? "English";
  const lines = [
    `- Length: ${length}`,
    `- Vocabulary: ${vocabulary}`,
    `- Tone: ${tone}`,
    `- Language: Write in ${languageName} unless the user asks for another language or writes to you in one.`,
  ];

  // Code-switching only means anything when the primary language isn't English.
  if (profile.primaryLanguage !== "en") {
    lines.push(
      profile.codeSwitches
        ? `- Code-switching: The user mixes English into ${languageName}. Do the same where an English word or phrase reads more naturally than a translation.`
        : `- Code-switching: Stay in ${languageName}. Do not sprinkle in English words where a natural ${languageName} equivalent exists.`,
    );
  }

  return [
    "HOW THIS USER WANTS YOU TO WRITE — from their Account settings. This governs register and length only; it never overrides required structure, citations, factual accuracy, or the honesty guardrails above.",
    ...lines,
  ].join("\n");
}
