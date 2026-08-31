#!/usr/bin/env node
/**
 * Fetch colleges from the US College Scorecard API and regenerate
 * src/lib/colleges-data.ts
 *
 * Usage:
 *   node scripts/fetch-colleges.mjs <API_KEY>
 *
 * Get a free API key at https://api.data.gov/
 *
 * Filters applied:
 *   - 4-year institutions (level=3)
 *   - Public or private non-profit (ownership 1 or 2)
 *   - At least 500 undergraduate students
 *   - Has a reported acceptance rate
 *
 * NOTE: Re-run this script (then seed-supabase.mjs) to populate the new
 * sat_25, sat_75, act_25, act_75, and test_requirements columns.
 */

import { writeFileSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load .env.local
try {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "../.env.local");
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch { /* .env.local not found, fall through */ }

const __dirname = dirname(fileURLToPath(import.meta.url));

const API_KEY = process.env.COLLEGE_SCORECARD_API_KEY;
if (!API_KEY) {
  console.error("Missing COLLEGE_SCORECARD_API_KEY in .env.local");
  console.error("Add it: COLLEGE_SCORECARD_API_KEY=your_key");
  console.error("Get a free key at https://api.data.gov/");
  process.exit(1);
}

const BASE_URL = "https://api.data.gov/ed/collegescorecard/v1/schools";

const FIELDS = [
  "id",
  "school.name",
  "school.city",
  "school.state",
  "school.school_url",
  "school.ownership",
  "latest.admissions.admission_rate.overall",
  "latest.student.size",
  "latest.admissions.sat_scores.25th_percentile.math",
  "latest.admissions.sat_scores.75th_percentile.math",
  "latest.admissions.sat_scores.25th_percentile.critical_reading",
  "latest.admissions.sat_scores.75th_percentile.critical_reading",
  "latest.admissions.act_scores.25th_percentile.cumulative",
  "latest.admissions.act_scores.75th_percentile.cumulative",
  "latest.admissions.test_requirements",
].join(",");

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function ownershipToType(ownership) {
  if (ownership === 1) return "public";
  if (ownership === 2) return "private";
  return "private";
}

async function fetchPage(page, perPage = 100) {
  const params = new URLSearchParams({
    api_key: API_KEY,
    fields: FIELDS,
    "school.degrees_awarded.predominant": "3", // 4-year
    "school.ownership__range": "1..2",          // public or private non-profit
    "latest.student.size__range": "500..",      // at least 500 students
    "latest.admissions.admission_rate.overall__range": "0.01..", // has acceptance rate
    per_page: String(perPage),
    page: String(page),
  });

  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

const MAX_COLLEGES = 2000;

async function fetchAll() {
  const perPage = 100;
  const maxPages = Math.ceil(MAX_COLLEGES / perPage);

  console.log("Fetching page 0...");
  const first = await fetchPage(0, perPage);
  const pages = Math.min(Math.ceil(first.metadata.total / perPage), maxPages);
  console.log(`Fetching up to ${MAX_COLLEGES} of ${first.metadata.total} institutions (${pages} pages)`);

  let all = [...first.results];

  for (let p = 1; p < pages; p++) {
    console.log(`Fetching page ${p}/${pages - 1}...`);
    const data = await fetchPage(p, perPage);
    all = all.concat(data.results);
    if (all.length >= MAX_COLLEGES) break;
    // Gentle rate limit
    await new Promise((r) => setTimeout(r, 150));
  }

  return all.slice(0, MAX_COLLEGES);
}

// Scorecard occasionally returns a staff contact address in school_url
// instead of a domain. Drop any userinfo prefix so we never publish
// someone's email address as a college website.
function normalizeWebsite(raw) {
  if (!raw) return null;
  const withScheme = raw.startsWith("http") ? raw : `https://${raw}`;
  return withScheme.replace(/^(https?:\/\/)[^/@]*@/, "$1");
}

function transform(raw) {
  const name = raw["school.name"];
  const city = raw["school.city"];
  const state = raw["school.state"];
  const website = raw["school.school_url"];
  const ownership = raw["school.ownership"];
  const admRate = raw["latest.admissions.admission_rate.overall"];

  if (!name || !state) return null;

  const acceptanceRate = admRate != null ? parseFloat((admRate * 100).toFixed(2)) : null;

  const satMath25 = raw["latest.admissions.sat_scores.25th_percentile.math"] ?? null;
  const satMath75 = raw["latest.admissions.sat_scores.75th_percentile.math"] ?? null;
  const satRead25 = raw["latest.admissions.sat_scores.25th_percentile.critical_reading"] ?? null;
  const satRead75 = raw["latest.admissions.sat_scores.75th_percentile.critical_reading"] ?? null;
  const act25 = raw["latest.admissions.act_scores.25th_percentile.cumulative"] ?? null;
  const act75 = raw["latest.admissions.act_scores.75th_percentile.cumulative"] ?? null;
  const testReq = raw["latest.admissions.test_requirements"] ?? null;

  return {
    id: String(raw.id),
    name,
    slug: slugify(name),
    location: city && state ? `${city}, ${state}` : state ?? null,
    state: state ?? null,
    acceptance_rate: acceptanceRate,
    website_url: normalizeWebsite(website),
    logo_url: null,
    college_type: ownershipToType(ownership),
    sat_25: satMath25 != null && satRead25 != null ? satMath25 + satRead25 : null,
    sat_75: satMath75 != null && satRead75 != null ? satMath75 + satRead75 : null,
    act_25: act25,
    act_75: act75,
    test_requirements: testReq,
  };
}

function generateFile(colleges) {
  const lines = colleges.map((c) => {
    return `  { id: ${JSON.stringify(c.id)}, name: ${JSON.stringify(c.name)}, slug: ${JSON.stringify(c.slug)}, location: ${JSON.stringify(c.location)}, state: ${JSON.stringify(c.state)}, acceptance_rate: ${JSON.stringify(c.acceptance_rate)}, website_url: ${JSON.stringify(c.website_url)}, logo_url: null, college_type: ${JSON.stringify(c.college_type)}, sat_25: ${JSON.stringify(c.sat_25)}, sat_75: ${JSON.stringify(c.sat_75)}, act_25: ${JSON.stringify(c.act_25)}, act_75: ${JSON.stringify(c.act_75)}, test_requirements: ${JSON.stringify(c.test_requirements)}, created_at: "", updated_at: "" }`;
  });

  return `import type { College } from "@/types";

// Auto-generated by scripts/fetch-colleges.mjs
// Source: US College Scorecard API (https://collegescorecard.ed.gov/data/documentation/)
// Last updated: ${new Date().toISOString().split("T")[0]}
// Total: ${colleges.length} institutions

const now = new Date().toISOString();

export const COLLEGES: College[] = [
${lines.join(",\n")}
];
`;
}

async function main() {
  try {
    const raw = await fetchAll();
    const colleges = raw
      .map(transform)
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));

    // Deduplicate slugs
    const slugCounts = {};
    for (const c of colleges) {
      slugCounts[c.slug] = (slugCounts[c.slug] ?? 0) + 1;
    }
    const slugIdx = {};
    for (const c of colleges) {
      if (slugCounts[c.slug] > 1) {
        slugIdx[c.slug] = (slugIdx[c.slug] ?? 0) + 1;
        c.slug = `${c.slug}-${slugIdx[c.slug]}`;
      }
    }

    const content = generateFile(colleges);
    const outPath = join(__dirname, "../src/lib/colleges-data.ts");
    writeFileSync(outPath, content, "utf8");
    console.log(`\nWrote ${colleges.length} colleges to src/lib/colleges-data.ts`);
  } catch (err) {
    console.error("Failed:", err.message);
    process.exit(1);
  }
}

main();
