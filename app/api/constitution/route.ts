import { prisma } from "@/lib/prisma";
export async function GET() {
  const c = await prisma.systemConstitution.findUnique({ where: { id: 1 } });
  return Response.json({ text: c?.text ?? "", version: c?.version ?? 0 });
}
