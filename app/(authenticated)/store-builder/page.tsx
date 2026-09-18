import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Store } from "lucide-react";

export default function StoreBuilderPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Store Builder</h1>
        <p className="text-gray-500 mt-1">Build a complete e-commerce store with AI — from idea to Shopify.</p>
      </div>
      <div className="h-px bg-[#0085CF]/10" />
      <Card className="border-[#0085CF]/10 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-[#0085CF]/10">
            <Store className="size-5 text-[#0085CF]" />
          </div>
          <div>
            <CardTitle className="text-gray-900">How to start</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Open the AI chat and type something like <em>&ldquo;I want to build a clothing brand&rdquo;</em> or <em>&ldquo;help me build a brand&rdquo;</em>. The assistant will walk you through markets, segment, niche, and catalog scale — then research, catalog, branding, social, and Shopify setup.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
