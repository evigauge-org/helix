import { TemplateGallery } from "@/components/agents/template-gallery";

export default function AgentsTemplatesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-gray-900">Agent Templates</h1>
        <p className="mt-1 text-sm text-gray-600">
          Pre-built agents for financial workflows. Pick one to instantiate; you can edit name, goal, and tools before running.
        </p>
      </header>
      <TemplateGallery />
    </div>
  );
}
