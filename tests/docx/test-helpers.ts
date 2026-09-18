// tests/docx/test-helpers.ts
import JSZip from "jszip";

export async function readZipXml(buf: Buffer, path: string): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const file = zip.file(path);
  if (!file) throw new Error(`missing ${path} in zip`);
  return await file.async("string");
}
