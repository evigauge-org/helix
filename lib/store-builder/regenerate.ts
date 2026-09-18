// lib/store-builder/regenerate.ts
export interface RegeneratePromptParams {
  sectionId: string;
  briefHeader: string;
  userEdit: string;
  previousContent: unknown;
  approvedContext: string;
}

export function buildRegeneratePrompt(p: RegeneratePromptParams): string {
  const prevStr = typeof p.previousContent === "string" ? p.previousContent : JSON.stringify(p.previousContent, null, 2);
  return `You are regenerating ONE section of a store-builder output. Section id: "${p.sectionId}".

${p.briefHeader}

PREVIOUS CONTENT FOR THIS SECTION:
${prevStr}

USER'S EDIT / GUIDANCE:
${p.userEdit}
${p.approvedContext}

Return ONLY the new content for this section, as JSON matching the same shape as the previous content (for strings: return a JSON-encoded string; for arrays/objects: return the array/object directly). Do not include markdown fences.`;
}
