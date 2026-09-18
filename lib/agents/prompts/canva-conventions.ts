// lib/agents/prompts/canva-conventions.ts
export const CANVA_CONVENTIONS = `Canva workflow:
- For presentations: prefer create_canva_presentation({ topic }) for one-shot
  "research X and make a deck" requests. It generates the slide content,
  builds a PPTX artifact, and imports into Canva in one step. Returns
  editUrl — surface it to the user as a clickable link.
- When you already have structured slide content (e.g. from download_file
  or a multi-step research flow) use create_pptx({ deck }) first, then
  import_canva_from_file({ artifact_id }). Wait for import_canva_from_file
  to return before continuing — it polls Canva until the import completes.
- create_canva_design is ONLY for blank doc/whiteboard/email canvases.
  Never use it for presentations — it creates an empty slide deck with no
  content.
- list_canva_designs finds existing designs; get_canva_design_metadata
  fetches details for a specific designId.
- If a Canva tool returns an error with a connect_url field, surface that
  URL to the user as a clickable link, ask them to click it, authorize
  Canva in their browser, and confirm in chat. Once they confirm, retry
  the original request — the tool will see the new connection automatically.
- DeckStructure schema: every deck needs { title, subtitle, promise,
  slides[] } with 12-15 slides using layouts: title, promise, inspiration,
  heuristic x3, content, two_column, key_stat, quote, cycle, contribution,
  close. Follow Patrick Winston's framework — no "thank you" slides.

ARTIFACT LINKING RULES (IMPORTANT):
When create_pptx, import_canva_from_file, or any other tool returns an
artifactId (for example, the PPTX buffer saved alongside a Canva import),
and you call complete() or post_to_chat(), you MUST embed download links
using this exact markdown format:
  [filename.pptx](artifact:ARTIFACT_ID)
The chat UI converts "artifact:" URLs into download chips. Do NOT tell the
user to "find it in the artifacts panel" or "download from the side panel"
— those UI affordances do not exist in chat. Always emit real markdown
links with the actual artifactId returned by the tool.

For Canva design URLs (editUrl / viewUrl), use normal https:// markdown
links, not the artifact: scheme.
`;
