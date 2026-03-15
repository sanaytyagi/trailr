#!/usr/bin/env node
/**
 * Seed colleges into Supabase from colleges-data.ts
 *
 * Usage:
 *   node scripts/seed-supabase.mjs
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing required env vars in .env.local:");
  if (!SUPABASE_URL) console.error("  NEXT_PUBLIC_SUPABASE_URL");
  if (!SERVICE_ROLE_KEY) console.error("  SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Parse colleges-data.ts by extracting the array and evaluating it
function loadColleges() {
  const dataPath = join(__dirname, "../src/lib/colleges-data.ts");
  const content = readFileSync(dataPath, "utf8");

  // Replace the `now` variable with a literal timestamp string
  const now = new Date().toISOString();
  const withNow = content.replace(/\bconst now = new Date\(\)\.toISOString\(\);/, "");
  const withLiteral = withNow.replace(/\bnow\b/g, JSON.stringify(now));

  // Extract the array literal
  const match = withLiteral.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (!match) throw new Error("Could not find COLLEGES array in colleges-data.ts");

  // Use Function() to evaluate in a clean scope (safer than eval)
  return new Function(`return ${match[0]}`)();
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  console.log("Loading colleges from colleges-data.ts...");
  const colleges = loadColleges();
  console.log(`Loaded ${colleges.length} colleges`);

  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < colleges.length; i += BATCH_SIZE) {
    const batch = colleges.slice(i, i + BATCH_SIZE).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      location: c.location,
      state: c.state,
      acceptance_rate: c.acceptance_rate,
      website_url: c.website_url,
      logo_url: c.logo_url,
      college_type: c.college_type,
    }));

    const { error } = await supabase
      .from("colleges")
      .upsert(batch, { onConflict: "id" });

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error.message);
      process.exit(1);
    }

    inserted += batch.length;
    console.log(`Inserted ${inserted}/${colleges.length}...`);
  }

  console.log(`\nDone! ${inserted} colleges seeded into Supabase.`);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
