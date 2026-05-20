import { NextRequest, NextResponse } from "next/server";
import { generateText, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createClient } from "@/lib/supabase/server";
import { parseJsonBody } from "@/lib/parse-json-body";
import {
  checkRateLimit,
  recordRateLimitHit,
  rateLimitedResponse,
  getRateLimitAdminClient,
} from "@/lib/rate-limit";
import {
  checkAiQuota,
  estimateCostCents,
  quotaExceededResponse,
  resolvePlan,
  type Plan,
} from "@/lib/ai-quota";
import {
  dossierSchema,
  detectGenericPhrases,
  extractSources,
  type Dossier,
} from "@/lib/research-brief/schema";
import {
  buildBriefSystemPrompt,
  buildRetryInstruction,
  type BriefPromptContext,
} from "@/lib/research-brief/prompt";

export const maxDuration = 120;
const MODEL_VERSION = "claude-sonnet-4-6-web-search";
const ENDPOINT = "research-brief";
const WINDOW = 24 * 60 * 60;
const MAX = 25;

function stripCodeFences(s: string): string {
  const trimmed = s.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function extractJsonObject(text: string): string {
  const cleaned = stripCodeFences(text);
  // If it already parses as JSON, return as-is
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // Extract the outermost {...} block in case there's surrounding prose
    const match = cleaned.match(/\{[\s\S]*\}/);
    return match ? match[0] : cleaned;
  }
}

function parseDossier(text: string): Dossier | null {
  const extracted = extractJsonObject(text);
  try {
    const parsed = JSON.parse(extracted);
    const result = dossierSchema.safeParse(parsed);
    if (!result.success) {
      console.error("Dossier schema validation failed:", JSON.stringify(result.error.issues));
    }
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

async function callModel(systemPrompt: string, userMessage: string) {
  const result = await generateText({
    model: anthropic("claude-sonnet-4-6"),
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    tools: {
      web_search: anthropic.tools.webSearch_20250305({ maxUses: 3 }),
    },
    stopWhen: stepCountIs(4),
    maxRetries: 0,
  });
  return { text: result.text, usage: result.usage };
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Anthropic API key not configured" },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const limit = await checkRateLimit(supabase, {
    endpoint: ENDPOINT,
    userId: user.id,
    windowSeconds: WINDOW,
    max: MAX,
  });
  if (!limit.ok) {
    return rateLimitedResponse(
      limit,
      "You've reached the daily limit for research briefs. Try again tomorrow."
    );
  }

  const parsed = await parseJsonBody<{
    college_id?: string;
    interview_answers?: Record<string, string>;
  }>(req, 100 * 1024);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const collegeId = body.college_id;
  const interviewAnswers = body.interview_answers ?? {};
  if (!collegeId) {
    return NextResponse.json({ error: "Missing college_id" }, { status: 400 });
  }

  // Verify the user tracks this college and fetch data
  const { data: userCollegeRow } = await db
    .from("user_colleges")
    .select("colleges(id, name, location, website_url, slug)")
    .eq("user_id", user.id)
    .eq("college_id", collegeId)
    .maybeSingle();

  if (!userCollegeRow?.colleges) {
    return NextResponse.json(
      { error: "College not tracked by this user" },
      { status: 404 }
    );
  }
  const college = userCollegeRow.colleges as {
    id: string;
    name: string;
    location: string | null;
    website_url: string | null;
    slug: string;
  };

  // Load profile context
  const { data: profile } = await db
    .from("profiles")
    .select("id, full_name, role, plan, plan_expires_at")
    .eq("id", user.id)
    .single() as { data: { id: string; full_name: string | null; role: "student" | "counselor"; plan: Plan; plan_expires_at: string | null } | null };
  if (!profile || profile.role !== "student") {
    return NextResponse.json(
      { error: "Research briefs are student-only" },
      { status: 403 }
    );
  }

  const effectivePlan = resolvePlan(profile);
  const quota = await checkAiQuota(
    getRateLimitAdminClient(),
    user.id,
    effectivePlan,
    ENDPOINT
  );
  if (!quota.ok) return quotaExceededResponse(quota);

  const { data: listRow } = await db
    .from("user_lists")
    .select("colleges")
    .eq("user_id", user.id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listBlob = (listRow?.colleges ?? {}) as any;
  const quiz = (listBlob && typeof listBlob === "object" && !Array.isArray(listBlob)
    ? (listBlob.quiz_answers as Record<string, unknown> | undefined)
    : undefined) ?? {};

  const promptContext: BriefPromptContext = {
    studentName: profile.full_name ?? null,
    college: {
      name: college.name,
      location: college.location,
      website_url: college.website_url,
    },
    major: typeof quiz.major === "string" ? quiz.major : null,
    interests: Array.isArray(quiz.interests)
      ? (quiz.interests as string[])
      : [],
    extracurriculars: Array.isArray(quiz.extracurriculars)
      ? (quiz.extracurriculars as string[])
      : [],
    careerGoals: typeof quiz.careers === "string" ? quiz.careers : null,
    otherPriorities:
      typeof quiz.otherPriorities === "string" ? quiz.otherPriorities : null,
    interviewAnswers,
  };

  // Claim the slot — unique index prevents double-submit
  const { data: claimed, error: claimError } = await db
    .from("research_briefs")
    .insert({
      user_id: user.id,
      college_id: collegeId,
      status: "generating",
      model_version: MODEL_VERSION,
      interview_answers: interviewAnswers,
    })
    .select("id")
    .single();

  if (claimError) {
    const code = claimError.code;
    if (code === "23505") {
      return NextResponse.json(
        {
          error:
            "A brief for this college is already generating or exists. Delete it first to regenerate.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: `Failed to claim brief slot: ${claimError.message}` },
      { status: 500 }
    );
  }

  const briefId = claimed.id;
  const systemPrompt = buildBriefSystemPrompt(promptContext);

  try {
    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheRead = 0;
    let webSearchUses = 0;
    const accumulate = (u: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number; reasoningTokens?: number } | undefined) => {
      if (!u) return;
      totalInput += u.inputTokens ?? 0;
      totalOutput += u.outputTokens ?? 0;
      totalCacheRead += u.cachedInputTokens ?? 0;
    };

    let first = await callModel(
      systemPrompt,
      `Produce the research brief for ${college.name}.`
    );
    accumulate(first.usage);
    webSearchUses += 1; // best-effort: at least one search per call
    let rawText = first.text;
    let dossier = parseDossier(rawText);

    if (!dossier) {
      throw new Error(
        "Model returned output that did not match the dossier schema"
      );
    }

    // Anti-slop: one retry if generic phrases detected
    let qualityFlag: string | null = null;
    const generic = detectGenericPhrases(dossier);
    if (generic.length > 0) {
      const retry = await callModel(
        systemPrompt + "\n\n" + buildRetryInstruction(generic),
        `Regenerate the research brief for ${college.name} without any of the banned generic phrases.`
      );
      accumulate(retry.usage);
      webSearchUses += 1;
      rawText = retry.text;
      const retried = parseDossier(rawText);
      if (retried) {
        dossier = retried;
        const stillGeneric = detectGenericPhrases(dossier);
        if (stillGeneric.length > 0) {
          qualityFlag = "generic_phrases_detected";
        }
      } else {
        qualityFlag = "retry_parse_failed";
      }
    }

    const sources = extractSources(dossier);

    const { error: updateError } = await db
      .from("research_briefs")
      .update({
        status: "ready",
        content: dossier,
        sources,
        quality_flag: qualityFlag,
        generated_at: new Date().toISOString(),
      })
      .eq("id", briefId);

    if (updateError) throw new Error(updateError.message);

    const costCents = estimateCostCents(
      "claude-sonnet-4-6",
      {
        input_tokens: totalInput,
        output_tokens: totalOutput,
        cache_read_input_tokens: totalCacheRead,
      },
      webSearchUses
    );
    await recordRateLimitHit(supabase, {
      endpoint: ENDPOINT,
      userId: user.id,
      billable: true,
      costCents: costCents ?? undefined,
    });

    return NextResponse.json({
      id: briefId,
      status: "ready",
      content: dossier,
      sources,
      quality_flag: qualityFlag,
      college_slug: college.slug,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db
      .from("research_briefs")
      .update({ status: "failed", error_message: message })
      .eq("id", briefId);
    return NextResponse.json(
      { error: `Brief generation failed: ${message}`, brief_id: briefId },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const collegeId = searchParams.get("college_id");
  if (!collegeId) {
    return NextResponse.json({ error: "Missing college_id" }, { status: 400 });
  }

  const { error } = await db
    .from("research_briefs")
    .delete()
    .eq("user_id", user.id)
    .eq("college_id", collegeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
