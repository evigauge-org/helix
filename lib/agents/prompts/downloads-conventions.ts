// lib/agents/prompts/downloads-conventions.ts
export const DOWNLOADS_CONVENTIONS = `Downloading files:
- Use download_nse_report for NSE daily reports — it knows the URL patterns.
  Supported report_name values: participant_wise_oi, participant_wise_volume,
  category_wise_oi, market_activity_report, fo_bhavcopy, cm_bhavcopy,
  daily_reports_archive. Date format: YYYY-MM-DD (defaults to latest weekday).
- Use download_file for any other public URL. For NSE/BSE and similar sites
  with anti-bot protection, pass referer="https://www.nseindia.com/..." so
  the server warms session cookies before the download.
- Downloads become AgentArtifacts with a returned artifactId. Include the
  artifactId if the user may want to pipe the file into another tool (like
  import_canva_from_file).
- Max file size: 20MB. For larger files, tell the user you can't.

ARTIFACT LINKING RULES (IMPORTANT):
download_file and download_nse_report both return an artifactId when they
save a file as an AgentArtifact. When you call complete() or post_to_chat(),
embed the downloaded file as a markdown link using this exact format:
  [filename.csv](artifact:ARTIFACT_ID)
The chat UI renders "artifact:" URLs as one-click download chips. Never
refer users to a "panel" or "sidebar" — those don't exist in chat. Always
emit real markdown links with the real artifactId.
`;
