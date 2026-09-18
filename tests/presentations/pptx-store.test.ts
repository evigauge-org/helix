// tests/presentations/pptx-store.test.ts
import { describe, it, expect } from "vitest";
import { pptxStore, storePptx } from "@/lib/presentations/pptx-store";

describe("pptxStore", () => {
  it("stores and retrieves a buffer by id (default PPTX mime)", () => {
    const buf = Buffer.from("hello", "utf-8");
    const { id, downloadUrl } = storePptx(buf, "T");
    expect(id).toBeTruthy();
    expect(downloadUrl).toContain(`id=${id}`);
    const entry = pptxStore.get(id);
    expect(entry?.buffer.toString("utf-8")).toBe("hello");
    expect(entry?.title).toBe("T");
    expect(entry?.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    expect(entry?.filenameExt).toBe("pptx");
  });

  it("honors caller-supplied mimeType + filenameExt for non-PPTX artifacts", () => {
    const buf = Buffer.from("%PDF-1.4\n...", "utf-8");
    const { id } = storePptx(buf, "Report", {
      mimeType: "application/pdf",
      filenameExt: "pdf",
    });
    const entry = pptxStore.get(id);
    expect(entry?.mimeType).toBe("application/pdf");
    expect(entry?.filenameExt).toBe("pdf");
  });

  it("expires entries past their TTL (short TTL)", async () => {
    const buf = Buffer.from("short", "utf-8");
    const { id } = storePptx(buf, "T", { ttlMs: 10 });
    await new Promise((r) => setTimeout(r, 30));
    const entry = pptxStore.get(id);
    if (entry) expect(entry.expiresAt).toBeLessThan(Date.now());
  });
});
