import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { parseJsonBody } from "@/lib/parse-json-body";
import {
  checkRateLimit,
  recordRateLimitHit,
  rateLimitedResponse,
} from "@/lib/rate-limit";
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
const MODEL_VERSION = "gpt-4o-2024-web-search";
const ENDPOINT = "research-brief";
const WINDOW = 24 * 60 * 60;
const MAX = 25;

function stripCodeFences(s: string): string {
  const trimmed = s.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function parseDossier(text: string): Dossier | null {
  const cleaned = stripCodeFences(text);
  try {
    const parsed = JSON.parse(cleaned);
    const result = dossierSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

async function callModel(systemPrompt: string, userMessage: string) {
  const result = await generateText({
    model: openai.responses("gpt-4o"),
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    tools: {
      web_search_preview: openai.tools.webSearchPreview({}),
    },
  });
  return result.text;
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
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
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "student") {
    return NextResponse.json(
      { error: "Research briefs are student-only" },
      { status: 403 }
    );
  }

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
    let rawText = await callModel(
      systemPrompt,
      `Produce the research brief for ${college.name}.`
    );
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
      rawText = await callModel(
        systemPrompt + "\n\n" + buildRetryInstruction(generic),
        `Regenerate the research brief for ${college.name} without any of the banned generic phrases.`
      );
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

    await recordRateLimitHit(supabase, { endpoint: ENDPOINT, userId: user.id });

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
