import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { runResearch } from "@/lib/store-builder/research";
import { generateCatalog } from "@/lib/store-builder/catalog";
import { runBranding } from "@/lib/store-builder/branding";
import { runSocial } from "@/lib/store-builder/social";
import { runShopifySetup } from "@/lib/store-builder/shopify-setup";
import { renderApprovedContext, type ApprovedContextBag } from "@/lib/store-builder/sections";
import type { StoreBrief, ResearchOutput, CatalogOutput, BrandingOutput, SocialOutput, EditableSection } from "@/lib/store-builder/types";

async function buildApprovedContext(projectId: string, throughStage: number): Promise<ApprovedContextBag> {
  const stages = await prisma.storeStage.findMany({
    where: { projectId, stage: { lt: throughStage } },
    include: { sections: true },
  });
  const bag: ApprovedContextBag = {};
  for (const stage of stages) {
    const stageKey = (["research", "catalog", "branding", "social", "shopify"] as const)[stage.stage - 1];
    const stageBag: Record<string, unknown> = {};
    for (const sec of stage.sections) {
      const versions = sec.versions as unknown as EditableSection<unknown>["versions"];
      const chosenId = sec.approvedVersionId ?? sec.activeVersionId;
      const v = versions.find((x) => x.id === chosenId);
      if (v && sec.approvedVersionId) stageBag[sec.sectionId] = v.content;
    }
    if (Object.keys(stageBag).length > 0) {
      bag[stageKey] = stageBag as never;
    }
  }
  return bag;
}

export const storePipeline = inngest.createFunction(
  {
    id: "store-builder-pipeline",
    retries: 2,
    triggers: [{ event: "store/build.started" }],
  },
  async ({ event, step }) => {
    const projectId = event.data.projectId as string;
    const brief = event.data.brief as StoreBrief;

    // ── Stage 1: Research ──────────────────────────────────────────────────────
    await step.run("research-start", async () => {
      await prisma.storeStage.updateMany({
        where: { projectId, stage: 1 },
        data: { status: "running", startedAt: new Date() },
      });
      await prisma.storeProject.update({
        where: { id: projectId },
        data: { status: "researching", currentStage: 1 },
      });
    });

    const researchContext = await step.run("research-context", async () => {
      return renderApprovedContext(await buildApprovedContext(projectId, 1));
    });

    const researchOutput = await step.run("research-run", async () => {
      return await runResearch(brief, researchContext);
    });

    await step.run("research-save", async () => {
      await prisma.storeStage.updateMany({
        where: { projectId, stage: 1 },
        data: {
          status: "awaiting_approval",
          output: researchOutput as object,
          completedAt: new Date(),
        },
      });
    });

    await step.waitForEvent("research-approved", {
      event: "store/stage.approved",
      match: "data.projectId",
      timeout: "7d",
    });

    await step.run("research-approved-mark", async () => {
      await prisma.storeStage.updateMany({
        where: { projectId, stage: 1 },
        data: { status: "approved" },
      });
    });

    // ── Stage 2: Catalog ───────────────────────────────────────────────────────
    await step.run("catalog-start", async () => {
      await prisma.storeStage.updateMany({
        where: { projectId, stage: 2 },
        data: { status: "running", startedAt: new Date() },
      });
      await prisma.storeProject.update({
        where: { id: projectId },
        data: { status: "catalog", currentStage: 2 },
      });
    });

    const catalogContext = await step.run("catalog-context", async () => {
      return renderApprovedContext(await buildApprovedContext(projectId, 2));
    });

    const catalogOutput = await step.run("catalog-run", async () => {
      return await generateCatalog(brief, researchOutput as ResearchOutput, catalogContext);
    });

    await step.run("catalog-save", async () => {
      await prisma.storeStage.updateMany({
        where: { projectId, stage: 2 },
        data: {
          status: "awaiting_approval",
          output: catalogOutput as object,
          completedAt: new Date(),
        },
      });
    });

    await step.waitForEvent("catalog-approved", {
      event: "store/stage.approved",
      match: "data.projectId",
      timeout: "7d",
    });

    await step.run("catalog-approved-mark", async () => {
      await prisma.storeStage.updateMany({
        where: { projectId, stage: 2 },
        data: { status: "approved" },
      });
    });

    // ── Stage 3: Branding ──────────────────────────────────────────────────────
    await step.run("branding-start", async () => {
      await prisma.storeStage.updateMany({
        where: { projectId, stage: 3 },
        data: { status: "running", startedAt: new Date() },
      });
      await prisma.storeProject.update({
        where: { id: projectId },
        data: { status: "branding", currentStage: 3 },
      });
    });

    const brandingContext = await step.run("branding-context", async () => {
      return renderApprovedContext(await buildApprovedContext(projectId, 3));
    });

    const brandingOutput = await step.run("branding-run", async () => {
      return await runBranding(brief, researchOutput as ResearchOutput, brandingContext);
    });

    await step.run("branding-save", async () => {
      await prisma.storeStage.updateMany({
        where: { projectId, stage: 3 },
        data: {
          status: "awaiting_approval",
          output: brandingOutput as object,
          completedAt: new Date(),
        },
      });
    });

    await step.waitForEvent("brand-approved", {
      event: "store/stage.approved",
      match: "data.projectId",
      timeout: "7d",
    });

    await step.run("branding-approved-mark", async () => {
      await prisma.storeStage.updateMany({
        where: { projectId, stage: 3 },
        data: { status: "approved" },
      });
    });

    // ── Stage 4: Social ────────────────────────────────────────────────────────
    await step.run("social-start", async () => {
      await prisma.storeStage.updateMany({
        where: { projectId, stage: 4 },
        data: { status: "running", startedAt: new Date() },
      });
      await prisma.storeProject.update({
        where: { id: projectId },
        data: { status: "social", currentStage: 4 },
      });
    });

    const socialContext = await step.run("social-context", async () => {
      return renderApprovedContext(await buildApprovedContext(projectId, 4));
    });

    const socialOutput = await step.run("social-run", async () => {
      return await runSocial(brief, brandingOutput as BrandingOutput, researchOutput as ResearchOutput, socialContext);
    });

    await step.run("social-save", async () => {
      await prisma.storeStage.updateMany({
        where: { projectId, stage: 4 },
        data: {
          status: "awaiting_approval",
          output: socialOutput as object,
          completedAt: new Date(),
        },
      });
    });

    await step.waitForEvent("social-approved", {
      event: "store/stage.approved",
      match: "data.projectId",
      timeout: "7d",
    });

    await step.run("social-approved-mark", async () => {
      await prisma.storeStage.updateMany({
        where: { projectId, stage: 4 },
        data: { status: "approved" },
      });
    });

    // ── Stage 5: Shopify ───────────────────────────────────────────────────────
    await step.run("shopify-start", async () => {
      await prisma.storeStage.updateMany({
        where: { projectId, stage: 5 },
        data: { status: "running", startedAt: new Date() },
      });
      await prisma.storeProject.update({
        where: { id: projectId },
        data: { status: "shopify", currentStage: 5 },
      });
    });

    const shopifyContext = await step.run("shopify-context", async () => {
      return renderApprovedContext(await buildApprovedContext(projectId, 5));
    });

    const shopifyOutput = await step.run("shopify-run", async () => {
      return await runShopifySetup(
        brief,
        catalogOutput as CatalogOutput,
        brandingOutput as BrandingOutput,
        socialOutput as SocialOutput,
        shopifyContext,
      );
    });

    await step.run("shopify-save", async () => {
      await prisma.storeStage.updateMany({
        where: { projectId, stage: 5 },
        data: {
          status: "awaiting_approval",
          output: shopifyOutput as object,
          completedAt: new Date(),
        },
      });
    });

    await step.waitForEvent("shopify-approved", {
      event: "store/stage.approved",
      match: "data.projectId",
      timeout: "7d",
    });

    await step.run("shopify-approved-mark", async () => {
      await prisma.storeStage.updateMany({
        where: { projectId, stage: 5 },
        data: { status: "approved" },
      });
    });

    await step.run("complete", async () => {
      await prisma.storeProject.update({
        where: { id: projectId },
        data: { status: "completed" },
      });
    });

    return { projectId, completed: true };
  }
);
