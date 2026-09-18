import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { executeCanvaTool } from "@/lib/composio";
import { importPptxIntoCanva } from "@/lib/agents/tools/canva/canva-import";

function truncateTitle(title: string): string {
  return title.length > 50 ? title.slice(0, 47) + "..." : title;
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pptxUrl, title, mode } = await req.json();
  const safeTitle = truncateTitle(title ?? "Helix Presentation");

  try {
    if (mode === "import" && pptxUrl) {
      const result = await importPptxIntoCanva(session.user.id, pptxUrl, safeTitle);
      if (!result.ok) {
        return NextResponse.json(
          { mode: "import", error: result.error, connect_url: result.connect_url },
          { status: 500 },
        );
      }
      return NextResponse.json({
        mode: "import",
        designId: result.designId,
        result: {
          data: { design: { id: result.designId, urls: { edit_url: result.editUrl, view_url: result.viewUrl } } },
        },
      });
    }

    // Blank-design branch — unchanged
    const designResult = await executeCanvaTool("CANVA_POST_DESIGNS", session.user.id, {
      design_type: { type: "preset", name: "presentation" },
      title: safeTitle,
    });
    return NextResponse.json({ mode: "create", result: designResult });
  } catch (error) {
    console.error("Canva design error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create design" },
      { status: 500 },
    );
  }
}
