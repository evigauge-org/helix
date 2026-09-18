import { z } from "zod";

export type DocPolicy = "required" | "optional";

export type DocChecklistItem = {
  label: string;
  hint?: string;
  exampleFormats?: string[];
};

export type SelfImprovementPolicy = {
  learningMemory:  { enabled: boolean; scope: "template+user" | "user-global"; piiScanner: boolean };
  modifyOwnPrompt: { enabled: boolean; autoPromote: boolean };
  spawnSubagent:   { enabled: boolean; maxDepth: number };
  replicate:       { enabled: boolean; maxFanout: number };
};

export type AgentTemplateConfig = {
  slug: string;
  name: string;
  category: "compliance" | "finance-ops" | "research";
  goal: string;
  description: string;
  iconName?: string;
  defaultToolSlugs: string[];
  defaultSkillIds?: string[];
  systemPromptBase: string;
  outputSchema: z.ZodTypeAny;
  docPolicy: DocPolicy;
  docChecklist: DocChecklistItem[];
  reviewerRoleHint?: string;
  selfImprovementPolicy: SelfImprovementPolicy;
  version: number;
};
