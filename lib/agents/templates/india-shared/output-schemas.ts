// lib/agents/templates/india-shared/output-schemas.ts
// Shared zod schemas. Both India templates' outputSchema imports from here.

import { z } from "zod";

export const datasetCitationSchema = z.object({
  resourceId: z.string(),
  sourceUrl: z.string().url(),
  visualizeUrl: z.string().url().nullable(),
  accessedAt: z.string(),
  publisherLastUpdate: z.string().nullable(),
});

export const numericClaimSchema = z.object({
  claim: z.string(),
  value: z.union([z.number(), z.literal("Not disclosed")]),
  unit: z.string().optional(),
  citations: z.array(datasetCitationSchema).min(1),
  _confidence: z.enum(["high", "medium", "low"]),
});

export const caAuditOutputSchema = z.object({
  workingPaperRef: z.string(),
  scope: z.string(),
  findings: z.array(z.object({
    label: z.string(),
    summary: z.string(),
    underlyingClaims: z.array(numericClaimSchema),
    derivedValue: z.union([z.number(), z.literal("Not applicable")]).optional(),
    derivationCode: z.string().optional(),
  })),
  csvArtifactPath: z.string().optional(),
  chartArtifactPath: z.string().optional(),
});

export const cfoInsightOutputSchema = z.object({
  topic: z.string(),
  narrative: z.string(),
  trendClaims: z.array(numericClaimSchema),
  chartSpec: z.object({
    chartType: z.enum(["line", "bar", "stacked-bar", "mixed"]),
    xField: z.string(),
    yFields: z.array(z.string()),
    title: z.string(),
  }).optional(),
  recommendations: z.array(z.string()).optional(),
  artifactPaths: z.object({
    csvPath: z.string().optional(),
    chartPath: z.string().optional(),
    docxPath: z.string().optional(),
  }),
});
