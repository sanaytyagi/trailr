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
    const listEntries: ListBuilderEntry[] = Array.isArray(listRaw) ? (listRaw as ListBuilderEntry[]) : [];
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

    const openingPrompt = `You are Trailr's AI college admissions assistant. Generate a single proactive opening message for a student who just opened their assistant for the first time.

TODAY: ${today}

STUDENT DATA:
Colleges tracked:
${collegesContext}

Essays:
${essaysContext}

Unread counselor comments: ${unreadCommentCount}

YOUR TASK:
Scan the student's data and identify the SINGLE most urgent or notable thing right now. Lead with that specifically. Priority order:
1. Any deadline within 14 days that isn't submitted — name the school and exact days remaining.
2. Any pending decisions (decision=pending, status=submitted) from schools that released decisions recently — name the schools.
3. Multiple deferrals or waitlists that need a response — name the schools.
4. Unread counselor comments — say how many and what to do next.
5. A list structure issue (e.g. all reaches, no safeties) — be specific about the imbalance.
6. The most pressing essay not yet in "final" status — name the school and prompt.
7. If nothing is urgent, give a brief specific snapshot of where they stand (name real schools, not generic counts).

FORMAT RULES:
- 2–3 sentences maximum. No bullet points. No headers.
- Start with the specific situation, not "Hi!" or "Welcome!" or "Great to see you!"
- Use **bold** for school names and deadlines.
- Sound like a knowledgeable human advisor checking in, not a chatbot intro message.
- Do not say "as your AI assistant" or reference being an AI.
- End with one direct, specific question or prompt to get them talking.`;

    const { text } = await generateText({
      model: openai("gpt-4o"),
      prompt: openingPrompt,
      maxOutputTokens: 150,
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
