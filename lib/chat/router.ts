export type RouteKind =
  | "backend"
  | "openrouter"
  | "store-builder"
  | "carousel"
  | "presentation"
  | "gamma";

export type Route = { kind: RouteKind; reason: string };

export type RouteInput = {
  message: string;
  hasFiles: boolean;
  deepResearch: boolean;
};

const STORE_BUILDER_PATTERNS = [
  /\bopen (?:a|an) .*brand\b/i,
  /\bbuild (?:a|an) .*store\b/i,
  /\bclothing brand\b/i,
  /\bshopify store\b/i,
  /\blaunch (?:a|an) .*brand\b/i,
];
const CAROUSEL_PATTERNS = [
  /\binstagram carousel\b/i,
  /\bcarousel (?:post|about|on)\b/i,
  /\bmake .*carousel\b/i,
];
const PRESENTATION_PATTERNS = [
  /\b(?:create|make|generate|build) (?:a |an )?(?:slide(?:s|show)?|presentation|deck|pitch)\b/i,
  /\bslide deck\b/i,
];
const GAMMA_PATTERNS = [
  /\bgamma\b.*\b(?:deck|presentation|site)\b/i,
  /\bgenerate .*with gamma\b/i,
];

function matches(msg: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(msg));
}

export function decideRoute(input: RouteInput): Route {
  if (input.hasFiles) return { kind: "backend", reason: "files attached" };
  if (input.deepResearch) return { kind: "backend", reason: "deep research toggle on" };
  if (matches(input.message, STORE_BUILDER_PATTERNS))
    return { kind: "store-builder", reason: "store-builder trigger matched" };
  if (matches(input.message, CAROUSEL_PATTERNS))
    return { kind: "carousel", reason: "carousel trigger matched" };
  if (matches(input.message, GAMMA_PATTERNS))
    return { kind: "gamma", reason: "gamma trigger matched" };
  if (matches(input.message, PRESENTATION_PATTERNS))
    return { kind: "presentation", reason: "presentation trigger matched" };
  return { kind: "openrouter", reason: "default casual chat" };
}
