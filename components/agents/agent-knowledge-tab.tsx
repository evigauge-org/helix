"use client";

import { KnowledgeUploader } from "./knowledge-uploader";

export function AgentKnowledgeTab({ agentId }: { agentId: string }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Knowledge sources</h2>
        <p className="mt-1 text-sm text-gray-600">
          Upload PDFs, markdown, txt, docx, or csv files. The agent can search them using the{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">search_knowledge</code> tool.
          Up to 10 files, 25 MB each.
        </p>
      </div>
      <KnowledgeUploader target={{ mode: "agent", agentId }} />
    </div>
  );
}
