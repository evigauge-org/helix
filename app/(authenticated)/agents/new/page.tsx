"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreateAgentDialog, type DialogTemplate } from "@/components/agents/create-agent-dialog";

function NewAgentInner() {
  const router = useRouter();
  const params = useSearchParams();
  const slug = params.get("templateSlug");
  const [template, setTemplate] = useState<DialogTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!slug) {
      setOpen(true);
      return;
    }
    void (async () => {
      const res = await fetch(`/api/agents/templates/${encodeURIComponent(slug)}`);
      if (!res.ok) {
        setError(`Template "${slug}" not found.`);
        return;
      }
      const { template } = (await res.json()) as { template: DialogTemplate };
      setTemplate(template);
      setOpen(true);
    })();
  }, [slug]);

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/agents/templates")}
          className="mt-3 rounded-full bg-[#0085CF] px-4 py-2 text-sm text-white"
        >
          Back to templates
        </button>
      </div>
    );
  }

  return (
    <CreateAgentDialog
      open={open}
      onClose={() => router.push("/agents")}
      onCreated={(agentId) => router.push(`/agents?selected=${agentId}`)}
      template={template}
    />
  );
}

export default function NewAgentPage() {
  return (
    <Suspense fallback={null}>
      <NewAgentInner />
    </Suspense>
  );
}
