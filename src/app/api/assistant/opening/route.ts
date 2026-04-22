import { NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";

type ListBuilderEntry = { name?: string; tier?: string; reason?: string };

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

export async function POST() {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
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
      .select("id, role, counselor_id")
      .eq("id", user.id)
      .single() as { data: { id: string; role: "student" | "counselor"; counselor_id: string | null } | null };

    if (!profile || profile.role !== "student") {
      return NextResponse.json({ error: "Student-only" }, { status: 403 });
    }

    // Guard: return the first assistant message if one already exists.
    const { data: existing } = await db
      .from("assistant_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1) as { data: Array<{ role: "user" | "assistant"; content: string }> | null };

    if (existing && existing.length > 0 && existing[0].role === "assistant") {
      return NextResponse.json({ message: existing[0].content });
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
              (c.personal_deadline
                ? `, deadline: ${c.personal_deadline} (${days === 0 ? "TODAY" : days === 1 ? "tomorrow" : days !== null && days < 0 ? `${Math.abs(days)} days ago` : days !== null ? `in ${days} days` : ""})`
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

    const openingPrompt = `You are Trailr's AI college admissions assistant. Generate a warm but substantive opening message for a student who just opened their assistant for the first time.

TODAY: ${today}

STUDENT DATA:
Colleges tracked:
${collegesContext}

Essays:
${essaysContext}

Unread counselor comments: ${unreadCommentCount}

Student preferences (from List Builder quiz):
${quizContext}

YOUR TASK:
Write a personalized opening message that does TWO things:
1. Lead with the SINGLE most urgent or time-sensitive item from their data. Priority order:
   a. Any deadline within 14 days that isn't submitted — name the school and exact days remaining.
   b. Pending decisions from recently-submitted schools — name them.
   c. Deferrals or waitlists needing a response — name the schools.
   d. Unread counselor comments — say how many and what to do.
   e. List structure issue (all reaches, no safeties) — be specific.
   f. Most pressing in-progress essay — name the school and prompt snippet.
   g. If nothing urgent, give a specific snapshot of where they stand.

2. Then briefly acknowledge 1–2 of their strongest preferences from the quiz (major, career path, key priorities) so they know you understand their goals — not just their deadlines.

FORMAT RULES:
- 3–5 sentences. No bullet points. No headers.
- Start with the specific urgent situation, not "Hi!" or "Welcome!" or "Great to see you!"
- Use **bold** for school names and deadlines.
- Sound like a knowledgeable human advisor who has read their file — not a chatbot intro.
- Do not say "as your AI assistant" or reference being an AI.
- End with one direct, specific question or prompt to get them talking.
- If quiz data is available, reference their major or career goals naturally in the message.`;

    const { text } = await generateText({
      model: openai("gpt-4o"),
      prompt: openingPrompt,
      maxOutputTokens: 300,
      temperature: 0.4,
    });

    const message = text.trim();

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
