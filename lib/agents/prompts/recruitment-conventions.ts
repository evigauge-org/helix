// lib/agents/prompts/recruitment-conventions.ts
export const RECRUITMENT_CONVENTIONS = `Recruitment workflow (strict — follow every step):

STEP 1 — Plan the source pull:
- Read the brief (goal + systemPromptExtra). It contains \`filters\` (Apify input),
  \`validation\` (PQE + domain gates), \`sourceUrls\` (user-added firm/directory URLs),
  and \`maxCandidates\`.
- If \`sourceUrls\` contains any firm-directory pages, call \`scrape_firm_directory\` for
  each URL FIRST to build a cached roster. Extract each person's name and, when present,
  profileUrl + title. Feed those names into the Apify search via \`firstNames\` and
  \`lastNames\` fields (batched; up to 50 names per call). This yields high-precision
  targeted LinkedIn pulls instead of a broad scrape.
- If no firm-directory URLs are provided, call \`source_linkedin_profiles\` once with
  the broad filters from the brief.
- Respect \`maxCandidates\` (it's already clamped server-side but don't ask for more).

STEP 2 — Cross-reference EVERY sourced candidate:
- For EACH candidate returned by Apify, call \`cross_reference_candidate\` with:
  - \`candidate\`: the full normalized profile from source_linkedin_profiles
  - \`validation\`: the validation brief from the agent's goal
  - \`sourceUrls\`: the FULL list of user-provided URLs (not just one)
- Never include a candidate in the final output without running this tool.
- A \`validated: false\` result means → add to the Rejected tab with the failure_reason,
  do not include in the dossier or Candidates tab.
- A \`topTierMatch: true\` on a validated candidate means → mark with ⭐ in the sheet.

STEP 3 — Produce the sheet:
- Call \`create_enterprise_report\` with TWO tabs:
  - Tab "Candidates" (validated only): columns in this exact order:
    "Top Match?" | "Name" | "Current Title" | "Current Company" | "Location" |
    "PQE (yrs)" | "LinkedIn" | "Specialty Profile" | "Email" | "Education (top)" |
    "Past Companies" | "Evidence" | "Reasoning"
    Top Match? = "⭐ Yes" when topTierMatch else blank.
    Specialty Profile = first evidence_url with sourceType="user_provided" else blank.
    Education (top) = latest school + degree.
    Past Companies = top 3 comma-joined.
    Evidence = ALL evidence URLs comma-joined.
  - Tab "Rejected": columns "Name" | "LinkedIn" | "Reason" | "PQE (yrs)" |
    "Current Title" | "Current Company".
- Save the returned url — you'll link it in the email and final message.

STEP 4 — Produce the consolidated DOCX dossier:
- Compose ONE markdown document:
  - # Cover heading with the user's original query + today's date +
    "N validated / M rejected".
  - Short intro paragraph (2-3 sentences) summarizing the result.
  - ## <Candidate name> — for each VALIDATED candidate (in topTierMatch-first order,
    then PQE-desc). Each section:
    - **Current role:** Title @ Company (Location). If no currentPosition say
      "Currently between roles — last at <Company>".
    - **PQE:** X years.
    - **Education:** bullet list.
    - **Work history:** bullet list of the candidate's 5 most-recent positions.
    - **Verified employers:** comma-joined list from cross_reference_candidate.
    - **Evidence URLs:** numbered list with the matchedFields in brackets.
    - **Validation reasoning:** the reasoning string from cross_reference_candidate.
- Call \`create_docx\` with coverPage=true and a sensible title like
  "Candidate Dossier — <query summary>".

STEP 5 — Email delivery:
- Call \`send_email\` to the user:
  - \`to\`: the user's email address from context (present in systemPromptExtra as
    "User email (if known): ..."). If unknown/unavailable skip email and surface the
    links in post_to_chat only.
  - \`subject\`: "Helix sourcing results: <brief query>".
  - \`body\`: short plain-text summary ("X validated, Y rejected. Sheet: <url>.
    DOCX attached.").
  - If the send_email tool build doesn't support attachments, include the dossier
    artifactId in the body as "[dossier](artifact:ID)".

STEP 6 — Close the run:
- Call \`complete\` with a final_message that includes:
  - One-line summary: "Sourced N validated candidates (M rejected). See sheet + dossier below."
  - [Open sheet](<sheetUrl>) link.
  - [Open dossier](artifact:<docxArtifactId>) link — the chat UI converts
    artifact: URLs into download chips automatically.
  - Brief top-3 candidate names as a teaser.

FAILURE-MODE HANDLING:
- Apify returns 0 profiles → post_to_chat("No candidates matched — try relaxing
  location/seniority/YoE in a new query") then complete with that message.
- Apify returns fewer than maxCandidates but > 0 → proceed, note the shortfall
  in the final message.
- Firecrawl-based cross-reference errors for a candidate → treat as
  validated=false with failure_reason="no_evidence" (already handled in the tool).
- ALWAYS call complete at the end — never leave the run hanging on sleep.`;
