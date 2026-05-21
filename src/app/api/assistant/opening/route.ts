import { NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createClient } from "@/lib/supabase/server";
import {
  checkAiQuota,
  estimateCostCents,
  quotaExceededResponse,
  resolvePlan,
  type Plan,
} from "@/lib/ai-quota";
import { getRateLimitAdminClient, recordRateLimitHit } from "@/lib/rate-limit";

type ListBuilderEntry = { name?: string; tier?: string; reason?: string };

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });
  }

  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await db
      .from("profiles")
      .select("id, role, counselor_id, plan, plan_expires_at")
      .eq("id", user.id)
      .single() as { data: { id: string; role: "student" | "counselor"; counselor_id: string | null; plan: Plan; plan_expires_at: string | null } | null };

    if (!profile || profile.role !== "student") {
      return NextResponse.json({ error: "Student-only" }, { status: 403 });
    }

    const effectivePlan = resolvePlan(profile);
    const quota = await checkAiQuota(getRateLimitAdminClient(), user.id, effectivePlan, "assistant");
    if (!quota.ok) return quotaExceededResponse(quota);

    // Guard: return the first assistant message if one already exists.
    const { data: existing } = await db
      .from("assistant_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1) as { data: Array<{ role: "user" | "assistant"; content: string }> | null };

    if (existing && existing.length > 0) {
      return NextResponse.json({ message: null });
    }

    // Fetch student context.
    const [collegesRes, essaysRes, listRes, commentsRes] = await Promise.all([
      db
        .from("user_colleges")
        .select("application_status, application_round, admissions_category, personal_deadline, decision, colleges(name, acceptance_rate)")
        .eq("user_id", user.id),
      db
        .from("essays")
        .select("status, prompt, colleges(name)")
        .eq("user_id", user.id),
      db
        .from("user_lists")
        .select("colleges")
        .eq("user_id", user.id)
        .maybeSingle(),
      profile.counselor_id
        ? db
            .from("essay_comments")
            .select("essay_id, essays!inner(user_id)")
            .eq("resolved", false)
            .eq("read_by_student", false)
            .eq("essays.user_id", user.id)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const colleges = (collegesRes.data ?? []) as Array<{
      application_status: string;
      application_round: string;
      admissions_category: string | null;
      personal_deadline: string | null;
      decision: string | null;
      colleges: { name: string; acceptance_rate: number | null } | null;
    }>;
    const essays = (essaysRes.data ?? []) as Array<{
      status: string;
      prompt: string;
      colleges: { name: string } | null;
    }>;
    const listRaw = (listRes.data?.colleges ?? []) as unknown;
    let listEntries: ListBuilderEntry[] = [];
    let quizAnswers: Record<string, unknown> | null = null;
    if (Array.isArray(listRaw)) {
      listEntries = listRaw as ListBuilderEntry[];
    } else if (listRaw && typeof listRaw === "object") {
      const obj = listRaw as Record<string, unknown>;
      if (Array.isArray(obj.list)) listEntries = obj.list as ListBuilderEntry[];
      if (obj.quiz_answers && typeof obj.quiz_answers === "object") quizAnswers = obj.quiz_answers as Record<string, unknown>;
    }
    const unreadCommentCount = ((commentsRes.data ?? []) as Array<unknown>).length;
    const today = new Date().toISOString().slice(0, 10);

    // Build a compact context string for the opening prompt.
    const collegesContext = colleges.length
      ? colleges
          .map((c) => {
            const name = c.colleges?.name ?? "Unknown";
            const rate = c.colleges?.acceptance_rate;
            const tier = listEntries.find((e) => e.name === name)?.tier;
            const days = c.personal_deadline ? daysUntil(c.personal_deadline) : null;
            return (
              `${name}` +
              (rate !== null && rate !== undefined ? ` (${rate.toFixed(1)}% admit)` : "") +
              (tier ? ` [${tier}]` : "") +
              ` — status: ${c.application_status}, round: ${c.application_round}` +
              (c.admissions_category ? `, category: ${c.admissions_category}` : "") +
              (c.decision ? `, decision: ${c.decision}` : "") +
              (c.personal_deadline && c.application_status !== "submitted"
                ? `, application submission deadline: ${c.personal_deadline} (${days === 0 ? "TODAY" : days === 1 ? "tomorrow" : days !== null && days < 0 ? `${Math.abs(days)} days ago` : days !== null ? `in ${days} days` : ""})`
                : "")
            );
          })
          .join("\n")
      : "none tracked yet";

    const essaysContext = essays.length
      ? essays
          .map((e) => `${e.colleges?.name ?? "Unknown"}: "${e.prompt.slice(0, 80)}…" — ${e.status}`)
          .join("\n")
      : "none";

    const quizContext = quizAnswers
      ? (() => {
          const q = quizAnswers;
          const testInfo = Array.isArray(q.testTypes) && (q.testTypes as string[]).length > 0
            ? (q.testTypes as string[]).map((t: string) =>
                t === "SAT" ? `SAT ${q.satScore ?? "n/a"}` : `ACT ${q.actScore ?? "n/a"}`
              ).join(", ")
            : "not yet tested";
          return [
            `GPA: ${q.gpa}/4.0, Tests: ${testInfo}`,
            `Intended major: ${q.major || "undecided"}`,
            `Target careers: ${q.careers || "not specified"}`,
            `Grad school: ${q.gradSchool}${Array.isArray(q.gradSchoolTypes) && (q.gradSchoolTypes as string[]).length > 0 ? ` (${(q.gradSchoolTypes as string[]).join(", ")})` : ""}`,
            `Preferences: ${q.setting} setting, ${Array.isArray(q.sizes) ? (q.sizes as string[]).join("/") : q.sizes} school, ${q.schoolType} institution`,
            `Budget: ${q.budget}, FAFSA: ${q.fafsa ? "Yes" : "No"}, Loans: ${q.loans}`,
            `Key priorities: major ranking ${q.majorImportance}/5, career services ${q.coopImportance}/5, alumni network ${q.alumniNetworkImportance}/5`,
            q.otherPriorities ? `Other priorities: ${q.otherPriorities}` : null,
            q.careerCultureDescription ? `Career culture: ${q.careerCultureDescription}` : null,
          ].filter(Boolean).join("\n");
        })()
      : "No quiz data — student hasn't used List Builder yet.";

    const openingPrompt = `You are Trailr's AI college admissions assistant. Generate a warm but substantive opening message for a student returning to their assistant.

TODAY: ${today}

STUDENT DATA:
Colleges tracked:
${collegesContext}

Essays:
${essaysContext}

Unread counselor comments: ${unreadCommentCount}

Student preferences (from List Builder quiz):
${quizContext}

ANGLE SELECTION — pick the SINGLE most relevant angle from this list based on the student's current data, then lead with it:
1. URGENT DEADLINE: A deadline within 14 days that isn't yet submitted — name the school and exact days remaining.
2. RECENT DECISION: A decision just received (accepted/deferred/waitlisted/rejected) and what it means strategically for the rest of their list.
3. ESSAY BEHIND: An essay that is critically behind relative to its word limit and the school's deadline — name the school and how far behind.
4. DECISION PATTERN: A pattern emerging across multiple decisions this cycle (e.g., multiple deferrals, strong acceptance streak) and what it signals.
5. STRATEGIC OBSERVATION: A proactive observation about their list structure, round strategy, or a risk you see — something specific to their actual schools.
6. REFLECTION PROMPT: A pointed question about a specific school or decision they are actively facing — something that sparks genuine reflection, not a preference question.

Choose whichever angle has the most concrete, specific data to anchor it. If multiple apply, pick the one with the highest stakes right now.

HARD RULES:
- NEVER ask the student what they want to focus on, what their preferences are, or what they'd like help with. You already know their situation — lead with it.
- NEVER use the same opening angle or sentence structure as any message listed in RECENT OPENING MESSAGES above.
- Do NOT open with "Hi!", "Welcome!", "Great to see you!", or any generic greeting.
- Do NOT reference being an AI or say "as your AI assistant."
- 3–5 sentences. No bullet points. No headers.
- Use **bold** for school names and deadlines.
- Sound like a human advisor who has read their file and has something specific to say.
- End with one direct, specific question that gets them talking about the angle you led with.`;

    const { text, usage } = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      prompt: openingPrompt,
      maxOutputTokens: 300,
      temperature: 0.8,
    });

    const message = text.trim();

    // Record the billable hit before returning — ensures navigate-away can't skip it.
    const costCents = estimateCostCents("claude-sonnet-4-6", {
      input_tokens: usage?.inputTokens ?? 0,
      output_tokens: usage?.outputTokens ?? 0,
      cache_read_input_tokens: usage?.cachedInputTokens ?? 0,
    });
    await recordRateLimitHit(supabase, {
      endpoint: "assistant",
      userId: user.id,
      billable: true,
      costCents: costCents ?? undefined,
    });

    // Persist so it's in the model's context on the student's first reply.
    await db.from("assistant_messages").insert({
      user_id: user.id,
      role: "assistant",
      content: message,
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Opening route error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Opening failed: ${msg}` }, { status: 500 });
  }
}
