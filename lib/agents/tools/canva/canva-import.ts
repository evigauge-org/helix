// lib/agents/tools/canva/canva-import.ts
import { executeCanvaTool } from "@/lib/composio";
import { requireCanvaConnection } from "./canva-connection";

export type ImportResult =
  | { ok: true; designId: string; editUrl: string; viewUrl?: string }
  | { ok: false; error: string; connect_url?: string };

function truncateTitle(title: string): string {
  return title.length > 50 ? title.slice(0, 47) + "..." : title;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pollImportJob(userId: string, jobId: string): Promise<any> {
  const MAX_ITERATIONS = 450;      // 450 × 8s = 3600s (1 hour)
  const DELAY_MS = 8000;
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 8; // ~64s of transient flaking before abort

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    await new Promise((r) => setTimeout(r, DELAY_MS));
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status: any = await executeCanvaTool(
        "CANVA_RETRIEVE_DESIGN_IMPORT_JOB_STATUS",
        userId,
        { jobId },
      );
      const job = status?.data?.job ?? status?.data ?? status?.job;
      const jobStatus = job?.status ?? job?.job?.status;
      if (jobStatus === "success" || jobStatus === "completed") return job;
      if (jobStatus === "failed") throw new Error(job?.error ?? "Import failed");
      consecutiveFailures = 0;
    } catch (err) {
      consecutiveFailures += 1;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        throw err instanceof Error ? err : new Error(String(err));
      }
    }
  }
  throw new Error("Canva import job timed out after 1 hour");
}

export async function importPptxIntoCanva(
  userId: string,
  pptxUrl: string,
  title: string,
): Promise<ImportResult> {
  const conn = await requireCanvaConnection(userId);
  if (!conn.ok) return conn;

  const safeTitle = truncateTitle(title);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const importResult: any = await executeCanvaTool(
    "CANVA_CREATE_DESIGN_IMPORT_JOB",
    userId,
    { file: pptxUrl, title: safeTitle },
  );
  const jobId = importResult?.data?.job?.id ?? importResult?.data?.id;
  if (!jobId) {
    return { ok: false, error: `Canva import kickoff returned no jobId: ${JSON.stringify(importResult?.data ?? {}).slice(0, 300)}` };
  }

  try {
    const completedJob = await pollImportJob(userId, jobId);
    const designId =
      completedJob?.result?.design?.id ??
      completedJob?.design?.id ??
      completedJob?.job?.result?.design?.id ??
      completedJob?.id;
    if (!designId) {
      return { ok: false, error: "Canva import finished but returned no designId" };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta: any = await executeCanvaTool(
      "CANVA_FETCH_DESIGN_METADATA_AND_ACCESS_INFORMATION",
      userId,
      { designId },
    );
    const d = meta?.data?.design ?? meta?.design ?? meta?.data ?? {};
    const editUrl = d?.urls?.edit_url ?? meta?.data?.urls?.edit_url ?? "";
    const viewUrl = d?.urls?.view_url;
    if (!editUrl) {
      return { ok: false, error: "Canva import completed but no editUrl available" };
    }
    return { ok: true, designId, editUrl, viewUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
