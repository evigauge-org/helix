import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_PER_AGENT = 10;

const ALLOWED_EXTS = new Set([".pdf", ".md", ".markdown", ".txt", ".docx", ".csv"]);

function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

function laneFor(ext: string, mime: string): "pageindex" | "pgvector" | null {
  if (ext === ".pdf" || mime === "application/pdf") return "pageindex";
  if ([".md", ".markdown", ".txt", ".docx", ".csv"].includes(ext)) return "pgvector";
  if (
    mime === "text/markdown" ||
    mime === "text/plain" ||
    mime === "text/csv" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "pgvector";
  }
  return null;
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const file = form.get("file");
  const agentId = (form.get("agentId") as string | null) ?? null;
  const draftToken = (form.get("draftToken") as string | null) ?? null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
  }
  if (!agentId && !draftToken) {
    return NextResponse.json({ error: "Provide agentId OR draftToken" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 25 MB limit" }, { status: 400 });
  }
  const ext = fileExt(file.name);
  if (!ALLOWED_EXTS.has(ext)) {
    return NextResponse.json(
      { error: "Unsupported file type — accepted: PDF, MD, TXT, DOCX, CSV" },
      { status: 400 },
    );
  }
  const lane = laneFor(ext, file.type);
  if (!lane) {
    return NextResponse.json({ error: "Could not determine lane for file" }, { status: 400 });
  }

  if (agentId) {
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existingCount = await prisma.agentKnowledgeSource.count({
    where: agentId
      ? { agentId, userId }
      : { draftToken: draftToken!, userId },
  });
  if (existingCount >= MAX_PER_AGENT) {
    return NextResponse.json(
      { error: `Maximum ${MAX_PER_AGENT} knowledge sources reached` },
      { status: 400 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileBase64 = buffer.toString("base64");

  const source = await prisma.agentKnowledgeSource.create({
    data: {
      userId,
      agentId,
      draftToken,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      lane,
      status: "uploading",
    },
  });

  await inngest.send({
    name: "agent-knowledge/process.requested",
    data: {
      sourceId: source.id,
      lane,
      fileBase64,
      filename: file.name,
    },
  });

  return NextResponse.json({ source }, { status: 202 });
}

export const runtime = "nodejs";
export const maxDuration = 60;
