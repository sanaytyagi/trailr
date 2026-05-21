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
import { followupItemsSchema, type Dossier } from "@/lib/research-brief/schema";
import { buildFollowUpSystemPrompt } from "@/lib/research-brief/prompt";

export const maxDuration = 60;
const ENDPOINT = "research-brief-followup";
const WINDOW = 24 * 60 * 60;
const MAX = 50;

function stripCiteTags(s: string): string {
  return s
    .replace(/<cite[^>]*>(.*?)<\/cite>/gs, "$1")
    .replace(/<cite[^>]*/g, "")
    .trim();
}

function extractJsonArray(s: string): string {
  const trimmed = s.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const cleaned = fenceMatch ? fenceMatch[1].trim() : trimmed;
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    return match ? match[0] : cleaned;
  }
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
      "You've reached the daily limit for follow-up questions. Try again tomorrow."
    );
  }

  const { data: profile } = await db
    .from("profiles")
    .select("id, plan, plan_expires_at")
    .eq("id", user.id)
    .single() as { data: { id: string; plan: Plan; plan_expires_at: string | null } | null };
  const effectivePlan = resolvePlan(profile);
  const quota = await checkAiQuota(
    getRateLimitAdminClient(),
    user.id,
    effectivePlan,
    ENDPOINT
  );
  if (!quota.ok) return quotaExceededResponse(quota);

  const parsed = await parseJsonBody<{ brief_id?: string; prompt?: string }>(req, 8 * 1024);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const { brief_id: briefId, prompt } = body;
  if (!briefId || !prompt?.trim()) {
    return NextResponse.json(
      { error: "Missing brief_id or prompt" },
      { status: 400 }
    );
  }
  if (prompt.length > 1000) {
    return NextResponse.json({ error: "Prompt too long (max 1000 characters)." }, { status: 400 });
  }

  // Load the brief (verify ownership + ready status)
  const { data: brief } = await db
    .from("research_briefs")
    .select("id, user_id, college_id, content, status")
    .eq("id", briefId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!brief) {
    return NextResponse.json({ error: "Brief not found" }, { status: 404 });
  }
  if (brief.status !== "ready") {
    return NextResponse.json(
      { error: "Brief is not ready" },
      { status: 409 }
    );
  }

  // Load college name
  const { data: college } = await db
    .from("colleges")
    .select("name")
    .eq("id", brief.college_id)
    .single();

  // Load student profile for context
  const { data: listRow } = await db
    .from("user_lists")
    .select("colleges")
    .eq("user_id", user.id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listBlob = (listRow?.colleges ?? {}) as any;
  const quiz =
    listBlob && typeof listBlob === "object" && !Array.isArray(listBlob)
      ? ((listBlob.quiz_answers as Record<string, unknown> | undefined) ?? {})
      : {};

  const systemPrompt = buildFollowUpSystemPrompt(
    college?.name ?? "this college",
    JSON.stringify(brief.content as Dossier, null, 2),
    {
      major: typeof quiz.major === "string" ? quiz.major : null,
      interests: Array.isArray(quiz.interests) ? (quiz.interests as string[]) : [],
    }
  );

  try {
    const result = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      system: systemPrompt,
      messages: [{ role: "user", content: prompt.trim() }],
      tools: {
        web_search: anthropic.tools.webSearch_20250305({ maxUses: 2 }),
      },
      stopWhen: stepCountIs(3),
      maxRetries: 0,
    });

    const cleaned = extractJsonArray(result.text);
    console.log("Followup raw output:", JSON.stringify(result.text.slice(0, 800)));
    console.log("Followup cleaned:", JSON.stringify(cleaned.slice(0, 800)));
    let items;
    try {
      const parsed = JSON.parse(cleaned);

      // Guardrail sentinel — model flagged the query as off-topic
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.__error__ === "off_topic") {
        return NextResponse.json(
          { error: parsed.message ?? "That question is outside the scope of college research. Try asking about programs, professors, clubs, or anything specific to this school." },
          { status: 400 }
        );
      }

      // Normalize URLs and strip citation tags from text fields
      const normalized = Array.isArray(parsed)
        ? parsed.map((item: Record<string, unknown>) => ({
            ...item,
            title: typeof item.title === "string" ? stripCiteTags(item.title) : item.title,
            detail: typeof item.detail === "string" ? stripCiteTags(item.detail) : item.detail,
            url: typeof item.url === "string" && !item.url.startsWith("http")
              ? `https://${item.url}`
              : item.url,
          }))
        : parsed;

      const validation = followupItemsSchema.safeParse(normalized);
      if (!validation.success) {
        console.error("Followup schema validation failed:", JSON.stringify(validation.error.issues));
        console.error("Raw model output:", result.text.slice(0, 500));
        throw new Error("Response did not match expected schema");
      }
      items = validation.data;
    } catch {
      // If the model returned prose instead of JSON, surface it directly
      const raw = result.text.trim();
      const looksLikeProse = raw.length > 0 && !raw.startsWith("[") && !raw.startsWith("{");
      const userMessage = looksLikeProse
        ? "The research tool couldn't process that as a search query. Try being more specific — e.g. \"Find me professors doing AI research at BU who mentor undergrads\"."
        : "Model returned an unexpected format. Try rephrasing your request.";
      return NextResponse.json({ error: userMessage }, { status: 422 });
    }

    const { data: saved, error: insertError } = await db
      .from("research_brief_followups")
      .insert({
        brief_id: briefId,
        user_id: user.id,
        prompt: prompt.trim(),
        items,
      })
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const costCents = estimateCostCents(
      "claude-haiku-4-5",
      {
        input_tokens: result.usage?.inputTokens ?? 0,
        output_tokens: result.usage?.outputTokens ?? 0,
        cache_read_input_tokens: result.usage?.cachedInputTokens ?? 0,
      },
      1
    );
    await recordRateLimitHit(supabase, {
      endpoint: ENDPOINT,
      userId: user.id,
      billable: true,
      costCents: costCents ?? undefined,
    });

    return NextResponse.json({ id: saved.id, items, prompt: prompt.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Follow-up research failed: ${message}` },
      { status: 500 }
    );
  }
}
