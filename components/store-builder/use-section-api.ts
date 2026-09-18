"use client";

export interface SectionApi<TStageOutput> {
  regenerate: (sectionId: string, userEdit: string) => Promise<void>;
  saveAsIs:   (sectionId: string, content: unknown) => Promise<void>;
  approve:    (sectionId: string, versionId: string) => Promise<void>;
}

export function useSectionApi<TStageOutput>(
  projectId: string,
  stageId: string,
  stageNumber: 1 | 2 | 3 | 4 | 5,
  onUpdated: (output: TStageOutput) => void,
): SectionApi<TStageOutput> {
  async function call(sectionId: string, verb: "edit" | "regenerate" | "approve", body: Record<string, unknown>) {
    const res = await fetch(`/api/store-builder/${projectId}/sections/${sectionId}/${verb}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "request failed");
    const status = await fetch(`/api/store-builder/${projectId}`);
    if (status.ok) {
      const s = await status.json();
      const stg = s.stages?.find((st: { stage: number; output: unknown }) => st.stage === stageNumber);
      if (stg?.output) onUpdated(stg.output as TStageOutput);
    }
    return data;
  }
  return {
    regenerate: (sectionId, userEdit) => call(sectionId, "regenerate", { userEdit }),
    saveAsIs:   (sectionId, content)  => call(sectionId, "edit",       { content }),
    approve:    (sectionId, versionId) => call(sectionId, "approve",    { versionId }),
  };
}
