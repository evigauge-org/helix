import { describe, it, expect } from "vitest";
import { decideRoute } from "@/lib/chat/router";

describe("decideRoute", () => {
  const base = { message: "hello", hasFiles: false, deepResearch: false };

  it("files attached → backend", () => {
    expect(decideRoute({ ...base, hasFiles: true }).kind).toBe("backend");
  });
  it("deep research on → backend", () => {
    expect(decideRoute({ ...base, deepResearch: true }).kind).toBe("backend");
  });
  it("store builder trigger → store-builder", () => {
    expect(decideRoute({ ...base, message: "open a clothing brand" }).kind).toBe("store-builder");
  });
  it("carousel trigger → carousel", () => {
    expect(decideRoute({ ...base, message: "make an instagram carousel about AI" }).kind).toBe("carousel");
  });
  it("presentation trigger → presentation", () => {
    expect(decideRoute({ ...base, message: "create a presentation on climate" }).kind).toBe("presentation");
  });
  it("plain chat → openrouter", () => {
    expect(decideRoute({ ...base, message: "where are iran-us peace talks happening?" }).kind).toBe("openrouter");
  });
  it("files beat deepResearch flag", () => {
    expect(decideRoute({ ...base, hasFiles: true, deepResearch: true }).kind).toBe("backend");
  });
});
