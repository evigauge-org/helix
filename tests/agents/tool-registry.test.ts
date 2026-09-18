import { describe, it, expect } from "vitest";
import { z } from "zod";
import { toolRegistry, registerTool, getToolsForAgent } from "@/lib/agents/tool-registry";

describe("tool registry foundation", () => {
  it("toolRegistry is a Map", () => {
    expect(toolRegistry).toBeInstanceOf(Map);
  });
  it("registerTool adds a tool and getToolsForAgent returns user-selected + always-present", () => {
    registerTool({
      slug: "__test_user_tool__",
      description: "t",
      schema: z.object({}),
      execute: async () => ({ ok: true }),
    });
    const withSelected = getToolsForAgent(["__test_user_tool__"]);
    expect(withSelected.map((t) => t.slug)).toContain("__test_user_tool__");
    const without = getToolsForAgent([]);
    expect(without.map((t) => t.slug)).not.toContain("__test_user_tool__");
  });
});
