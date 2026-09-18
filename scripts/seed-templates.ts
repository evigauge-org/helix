// scripts/seed-templates.ts
// One-off seeder for AgentTemplate rows. Mirrors POST /api/admin/seed-templates
// but bypasses the auth gate so it can be run from a shell. Uses the same
// seedAgentTemplates() helper, so the canonical TEMPLATES array is the source
// of truth either way.
//
// Usage:
//   bun run scripts/seed-templates.ts

import { seedAgentTemplates } from "../lib/agents/templates";

async function main() {
  console.log("Seeding AgentTemplate rows from TEMPLATES array...");
  const result = await seedAgentTemplates();
  console.log(`Done. Upserted ${result.upserted} templates.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
