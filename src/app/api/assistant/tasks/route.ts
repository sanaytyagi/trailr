import { NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

type Urgency = "high" | "medium" | "low";
type Destination = "tracker" | "essays" | "chat";

export type AssistantTask = {
  title: string;
  subtitle: string;
  urgency: Urgency;
  destination: Destination;
  prompt?: string;
};

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

function extractJsonArray(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON array in model output");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function sanitizeTasks(raw: unknown): AssistantTask[] {
  if (!Array.isArray(raw)) return [];
  const out: AssistantTask[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const title = typeof r.title === "string" ? r.title.trim() : "";
    const subtitle = typeof r.subtitle === "string" ? r.subtitle.trim() : "";
    const urgency = (r.urgency === "high" || r.urgency === "medium" || r.urgency === "low")
      ? r.urgency
      : "medium";
    const destination = (r.destination === "tracker" || r.destination === "essays" || r.destination === "chat")
      ? r.destination
      : "chat";
    const prompt = typeof r.prompt === "string" ? r.prompt.trim() : undefined;
    if (!title) continue;
    out.push({ title, subtitle, urgency, destination, prompt });
  }
  return out.slice(0, 6);
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
      .select("id, full_name, role, counselor_id")
      .eq("id", user.id)
      .single() as { data: { id: string; full_name: string | null; role: "student" | "counselor"; counselor_id: string | null } | null };

    if (!profile || profile.role !== "student") {
      return NextResponse.json({ error: "Student-only" }, { status: 403 });
    }

    const [collegesRes, essaysRes, commentsRes] = await Promise.all([
      db
        .from("user_colleges")
        .select("application_status, application_round, decision, admissions_category, personal_deadline, notes, colleges(name, acceptance_rate)")
        .eq("user_id", user.id),
      db
        .from("essays")
        .select("prompt, word_limit, body, status, colleges(name)")
        .eq("user_id", user.id),
      profile.counselor_id
        ? db
            .from("essay_comments")
            .select("essay_id, essays!inner(user_id)")
            .eq("resolved", false)
            .eq("read_by_student", false)
            .eq("essays.user_id", user.id)
        : Promise.resolve({ data: [], error: null }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const colleges = (collegesRes.data ?? []) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const essays = (essaysRes.data ?? []) as any[];
    const unreadComments = ((commentsRes.data ?? []) as unknown[]).length;

    const today = new Date().toISOString().slice(0, 10);

    const collegesContext = colleges.length
      ? colleges
          .map((c) => {
            const name = c.colleges?.name ?? "Unknown";
            const days = c.personal_deadline ? daysUntil(c.personal_deadline) : null;
            return (
              `${name}` +
              ` — status: ${c.application_status}, round: ${c.application_round}` +
              (c.decision ? `, decision: ${c.decision}` : "") +
              (c.personal_deadline
                ? `, deadline: ${c.personal_deadline} (${days === 0 ? "TODAY" : days === 1 ? "tomorrow" : days !== null && days < 0 ? `${Math.abs(days)} days ago` : days !== null ? `in ${days} days` : ""})`
                : "")
            );
          })
          .join("\n")
      : "(no colleges tracked yet)";

    const essaysContext = essays.length
      ? essays
          .map((e) => {
            const body: string = e.body ?? "";
            const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
            return `${e.colleges?.name ?? "Unknown"} — ${wordCount}/${e.word_limit ?? 0} words, status: ${e.status}, prompt: "${(e.prompt ?? "").slice(0, 80)}…"`;
          })
          .join("\n")
      : "(no essays started)";

    const prompt = `You are generating a focused, personalized "next actions" list for a college applicant's dashboard sidebar.

TODAY: ${today}

STUDENT DATA:
Tracked colleges:
${collegesContext}

Essays:
${essaysContext}

Unread counselor comments: ${unreadComments}

YOUR TASK:
Return a JSON array of 4–6 prioritized tasks the student should focus on right now. Each task is a single concrete next step, not a vague reminder.

Each task object MUST have:
- "title": short imperative (max ~60 chars). e.g. "Submit Stanford EA app", "Reply to counselor's note on Yale essay"
- "subtitle": one short clause of context (max ~70 chars). e.g. "Deadline in 3 days", "2 unread comments waiting"
- "urgency": one of "high" (deadline within 7 days OR explicit blocker), "medium" (within 30 days OR active essay work), "low" (planning, exploration, longer-horizon)
- "destination": one of "tracker" (anything about colleges/deadlines/decisions), "essays" (anything about essay drafts), or "chat" (open-ended thinking, brainstorming, strategy questions)
- "prompt": ONLY if destination is "chat" — the question to pre-fill in the chat input (max ~120 chars)

PRIORITY RULES:
1. Real deadlines within 14 days come first (high urgency).
2. Essays under word limit on schools with upcoming deadlines come next.
3. Pending decisions, deferrals, or waitlists needing a response.
4. Unread counselor comments.
5. List-shape gaps (all reaches, no safeties, etc.) — these go to "chat" destination.
6. Strategy/brainstorming items go to "chat" with a specific prompt.

Output ONLY the JSON array. No prose, no fences, no commentary. Example:
[
  { "title": "Submit MIT EA application", "subtitle": "Deadline in 4 days", "urgency": "high", "destination": "tracker" },
  { "title": "Finish UPenn supplemental essay", "subtitle": "180/250 words, deadline Nov 1", "urgency": "high", "destination": "essays" },
  { "title": "Talk through ED strategy", "subtitle": "Your list has 4 reaches and 1 safety", "urgency": "medium", "destination": "chat", "prompt": "My list has 4 reaches and 1 safety — should I rebalance before ED deadlines?" }
]`;

    const { text } = await generateText({
      model: openai("gpt-4o"),
      prompt,
      maxOutputTokens: 700,
      temperature: 0.3,
    });

    const parsed = (() => {
      try {
        return extractJsonArray(text);
      } catch {
        return null;
      }
    })();

    const tasks = sanitizeTasks(parsed);

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("Tasks route error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Tasks failed: ${msg}` }, { status: 500 });
  }
}
