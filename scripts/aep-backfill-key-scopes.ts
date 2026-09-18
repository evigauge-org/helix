// scripts/aep-backfill-key-scopes.ts
//
// One-time backfill: grant the legacy `aep:*` wildcard to every existing
// api-key that doesn't already have AEP scopes set. Re-running is safe — keys
// with non-empty `permissions.aep` are skipped.
//
// Run with: bun run scripts/aep-backfill-key-scopes.ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL ?? "") });

async function main() {
  const all = await prisma.apiKey.findMany({ select: { id: true, permissions: true } });
  let touched = 0;
  for (const k of all) {
    let parsed: { aep?: unknown } | null = null;
    if (k.permissions) {
      try {
        parsed = JSON.parse(k.permissions) as { aep?: unknown };
      } catch {
        // Malformed JSON — overwrite with the legacy wildcard.
        parsed = null;
      }
    }
    if (parsed && Array.isArray(parsed.aep) && parsed.aep.length > 0) {
      continue;
    }
    const next = JSON.stringify({ ...(parsed ?? {}), aep: ["aep:*"] });
    await prisma.apiKey.update({ where: { id: k.id }, data: { permissions: next } });
    touched++;
    console.log(`[apikey] backfilled ${k.id}`);
  }
  console.log(`Done. touched=${touched} of ${all.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
