// app/api/store-builder/[projectId]/sections/[sectionId]/regenerate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { z } from "zod";
import { buildRegeneratePrompt } from "@/lib/store-builder/regenerate";
import { renderApprovedContext } from "@/lib/store-builder/sections";
import { MARKET_SEGMENT_DESCRIPTIONS, resolveMarket } from "@/lib/store-builder/markets";
import type { SectionVersion, StoreBrief } from "@/lib/store-builder/types";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const body = z.object({
  stageId: z.string(),
  userEdit: z.string().min(1).max(4000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; sectionId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!OPENROUTER_API_KEY) return NextResponse.json({ error: "OpenRouter not configured" }, { status: 500 });
  const { projectId, sectionId } = await params;
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });

  const project = await prisma.storeProject.findUnique({ where: { id: projectId } });
  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const brief = project.brief as unknown as StoreBrief;

  const section = await prisma.storeStageSection.findUnique({
    where: { stageId_sectionId: { stageId: parsed.data.stageId, sectionId } },
  });
  if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });

  const versionsPrev = section.versions as unknown as SectionVersion<unknown>[];
  const activeVersion = versionsPrev.find((v) => v.id === section.activeVersionId);
  if (!activeVersion) return NextResponse.json({ error: "Active version missing" }, { status: 500 });

  const categoryLabel = brief.brandCategory === "other" && brief.brandCategoryCustom
    ? `other (${brief.brandCategoryCustom})` : brief.brandCategory;
  const marketsLine = brief.markets.map((m) => { const c = resolveMarket(m); return `${m} (${c.name}, ${c.code})`; }).join(", ");
  const briefHeader = [
    `Brand brief:`,
    `- Category: ${categoryLabel}`,
    `- Niche: ${brief.niche.join(", ")}`,
    `- Products: ${brief.products.join(", ")}`,
    `- Target audience: ${brief.audience}`,
    `- Target markets: ${marketsLine}`,
    `- Market segment: ${brief.marketSegment} (${MARKET_SEGMENT_DESCRIPTIONS[brief.marketSegment]})`,
    `- Catalog size: ${brief.scale}`,
  ].join("\n");

  const stage = await prisma.storeStage.findUnique({ where: { id: parsed.data.stageId } });
  if (!stage) return NextResponse.json({ error: "Stage not found" }, { status: 404 });
  const priorStages = await prisma.storeStage.findMany({
    where: { projectId, stage: { lt: stage.stage } },
    include: { sections: true },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bag: any = {};
  for (const s of priorStages) {
    const key = (["research","catalog","branding","social","shopify"] as const)[s.stage - 1];
    const stageBag: Record<string, unknown> = {};
    for (const sec of s.sections) {
      const vs = sec.versions as unknown as SectionVersion<unknown>[];
      const chosen = vs.find((v) => v.id === (sec.approvedVersionId ?? sec.activeVersionId));
      if (chosen && sec.approvedVersionId) stageBag[sec.sectionId] = chosen.content;
    }
    if (Object.keys(stageBag).length > 0) bag[key] = stageBag;
  }
  const approvedContext = renderApprovedContext(bag);

  const prompt = buildRegeneratePrompt({
    sectionId,
    briefHeader,
    userEdit: parsed.data.userEdit,
    previousContent: activeVersion.content,
    approvedContext,
  });

  const llm = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemma-3-27b-it",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
      temperature: 0.6,
    }),
  });
  if (!llm.ok) {
    return NextResponse.json({ error: `Regeneration failed: OpenRouter HTTP ${llm.status}` }, { status: 502 });
  }
  const raw = (await llm.json()).choices?.[0]?.message?.content ?? "";
  const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  let newContent: unknown;
  try {
    newContent = JSON.parse(cleaned);
  } catch {
    newContent = cleaned;
  }

  const newVersion: SectionVersion<unknown> = {
    id: randomUUID(),
    content: newContent,
    author: "ai",
    createdAt: new Date().toISOString(),
    regenerationPrompt: parsed.data.userEdit,
  };
  const updated = await prisma.storeStageSection.update({
    where: { stageId_sectionId: { stageId: parsed.data.stageId, sectionId } },
    data: {
      versions: [...versionsPrev, newVersion] as never,
      activeVersionId: newVersion.id,
    },
  });
  return NextResponse.json({ section: updated, newVersion });
}
