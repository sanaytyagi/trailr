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

function daysSince(dateStr: string): number {
  return -daysUntil(dateStr);
}

function deadlineLabel(deadline: string): string {
  const days = daysUntil(deadline);
  if (days < 0) return `${deadline} (OVERDUE by ${Math.abs(days)} days)`;
  if (days === 0) return `${deadline} (TODAY)`;
  if (days === 1) return `${deadline} (tomorrow)`;
  return `${deadline} (in ${days} days)`;
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
        .select("application_status, application_round, decision, admissions_category, personal_deadline, updated_at, notes, colleges(name, acceptance_rate)")
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
    const todayDate = new Date();

    // Fix 5: Build the set of submitted schools at the data layer so they are
    // never passed to the model for deadline or essay tasks.
    const submittedSchools = new Set(
      colleges
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((c: any) => c.application_status === "submitted")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((c: any) => c.colleges?.name ?? "Unknown")
    );

    // Fix 1: Categorize colleges — submitted schools are excluded entirely from
    // deadline tasks. Accepted schools carry enrollment deadlines, not application ones.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applicationColleges = colleges.filter((c: any) =>
      c.application_status !== "submitted" &&
      (!c.decision || c.decision === "pending")
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const acceptedColleges = colleges.filter((c: any) => c.decision === "accepted");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deferredColleges = colleges.filter((c: any) => c.decision === "deferred");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const waitlistedColleges = colleges.filter((c: any) => c.decision === "waitlisted");

    // Fix 5: Strip essays for submitted schools before the prompt is built.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeEssays = essays.filter((e: any) =>
      !submittedSchools.has(e.colleges?.name ?? "Unknown")
    );

    // Fix 4: Build a deadline map so each essay can reference its school's deadline.
    const collegeDeadlineMap: Record<string, string | null> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const c of applicationColleges as any[]) {
      const name = c.colleges?.name ?? "Unknown";
      collegeDeadlineMap[name] = c.personal_deadline ?? null;
    }

    // Fix 3: Decision season — April 15 to May 1.
    const month = todayDate.getMonth(); // 0-indexed
    const day = todayDate.getDate();
    const isDecisionSeason =
      (month === 3 && day >= 15) || (month === 4 && day <= 1);
    const hasUncommittedAcceptance = acceptedColleges.length > 0;

    // ── Build context strings ──────────────────────────────────────────────

    // Fix 1 + Fix 2: Application deadline context (submitted schools excluded).
    const appDeadlinesContext = applicationColleges.length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (applicationColleges as any[]).map((c) => {
          const name = c.colleges?.name ?? "Unknown";
          const deadlineDesc = c.personal_deadline
            ? deadlineLabel(c.personal_deadline)
            : "no deadline set";
          return `${name} — round: ${c.application_round}, deadline: ${deadlineDesc} [APPLICATION DEADLINE]`;
        }).join("\n")
      : "(none)";

    // Fix 1 + Fix 3 + Fix 7: Enrollment deadline context for accepted schools.
    const enrollmentContext = acceptedColleges.length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (acceptedColleges as any[]).map((c) => {
          const name = c.colleges?.name ?? "Unknown";
          const deadlineDesc = c.personal_deadline
            ? deadlineLabel(c.personal_deadline)
            : "no enrollment deadline recorded";
          return `${name} — ACCEPTED, enrollment deadline: ${deadlineDesc} [ENROLLMENT/COMMITMENT DEADLINE — not an application task]`;
        }).join("\n")
      : "(none)";

    // Fix 6: School-specific deferral context with recency.
    const deferredContext = deferredColleges.length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (deferredColleges as any[]).map((c) => {
          const name = c.colleges?.name ?? "Unknown";
          const since = c.updated_at ? daysSince(c.updated_at.slice(0, 10)) : null;
          const recency = since !== null ? `decision received ${since} days ago` : "recency unknown";
          return `${name} — DEFERRED, ${recency}`;
        }).join("\n")
      : "(none)";

    // Fix 6: School-specific waitlist context with recency.
    const waitlistedContext = waitlistedColleges.length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (waitlistedColleges as any[]).map((c) => {
          const name = c.colleges?.name ?? "Unknown";
          const since = c.updated_at ? daysSince(c.updated_at.slice(0, 10)) : null;
          const recency = since !== null ? `decision received ${since} days ago` : "recency unknown";
          return `${name} — WAITLISTED, ${recency}`;
        }).join("\n")
      : "(none)";

    // Fix 4: Essay context cross-referenced with college deadline.
    const essaysContext = activeEssays.length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (activeEssays as any[]).map((e) => {
          const collegeName = e.colleges?.name ?? "Unknown";
          const body: string = e.body ?? "";
          const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
          const collegeDeadline = collegeDeadlineMap[collegeName] ?? null;
          const deadlineDesc = collegeDeadline
            ? `college application deadline: ${deadlineLabel(collegeDeadline)}`
            : "no college deadline set";
          return `${collegeName} — ${wordCount}/${e.word_limit ?? 0} words, status: ${e.status}, ${deadlineDesc}, prompt: "${(e.prompt ?? "").slice(0, 80)}…"`;
        }).join("\n")
      : "(no active essays)";

    // Fix 3: Decision season flag for the prompt.
    const decisionSeasonNote = isDecisionSeason && hasUncommittedAcceptance
      ? "\nDECISION SEASON ACTIVE: Today falls between April 15 and May 1. The student has at least one acceptance with no recorded commitment. Commitment/enrollment tasks must be at minimum medium urgency regardless of specific deadline date — flag them as time-sensitive."
      : "";

    const prompt = `You are generating a focused, personalized "next actions" list for a college applicant's dashboard sidebar.

TODAY: ${today}

STUDENT DATA:

Schools with pending application deadlines (application NOT yet submitted):
${appDeadlinesContext}

Schools where student was ACCEPTED — enrollment/commitment deadlines only:
${enrollmentContext}

Deferred schools:
${deferredContext}

Waitlisted schools:
${waitlistedContext}

Active essays (only for schools not yet submitted):
${essaysContext}

Unread counselor comments: ${unreadComments}
${decisionSeasonNote}

YOUR TASK:
Return a JSON array of 3–6 prioritized tasks. Only include a task if it represents a genuine action the student should take this week or that requires planning soon. Do NOT pad the list to reach 6. A focused list of 3 high-quality specific tasks beats 6 where the last ones are vague or low-value.

Each task object MUST have:
- "title": short imperative (max ~60 chars), naming the specific school wherever relevant
- "subtitle": one short clause of context (max ~70 chars)
- "urgency": "high", "medium", or "low" — follow the rules below exactly
- "destination": "tracker" (college/deadline/decision actions), "essays" (essay drafts), or "chat" (strategy/brainstorming)
- "prompt": ONLY if destination is "chat" — a pre-filled question for the chat input (max ~120 chars)

URGENCY RULES — apply precisely:

Application deadlines (only for schools not yet submitted):
- 0–3 days away → "high"
- 4–7 days away → "medium"
- 8–14 days away → "low" (only include if the list has no higher-priority items)
- Past due and application NOT submitted → "high", subtitle must say "OVERDUE"
- NEVER generate a deadline task for a submitted application — they are done.

Enrollment/commitment deadlines (accepted schools only):
- Within 7 days → "high", place above all other tasks
- 8–30 days away → "medium", place above application tasks only if no high-urgency application deadlines exist
- 30+ days away → "low", only include as a planning nudge if the list is otherwise quiet
- Title must name the school and frame as a commitment/enrollment decision — never imply application work remains
- Good title: "Commit to USC — enrollment deadline in 4 days"
- Bad title: "USC deadline approaching" or "Submit USC application"

Essay urgency — cross-reference word count WITH college deadline, not word count alone:
- 0% complete + deadline in ≤5 days → "high"
- 0–30% complete + deadline in 6–14 days → "medium"
- 0–30% complete + deadline in 15+ days → "low"
- 30–80% complete + deadline in ≤7 days → "medium"
- 80%+ complete regardless of deadline → skip or "low" only
- Word count alone must never determine urgency — the college deadline is the primary factor.

Deferral and waitlist tasks — school-specific, not generic:
- Generate one task per deferred/waitlisted school, naming the school explicitly in the title
- Title should reference the specific next action (e.g., "Send a Letter of Continued Interest to MIT")
- Urgency based on recency of the decision:
  - Decision received within 14 days → "low" (too soon to act)
  - 15–42 days ago → "medium"
  - 43+ days ago → "high" if no higher-priority item exists
- Good title: "Send LOCI to MIT — deferred 7 weeks ago"
- Bad title: "Follow up on your deferrals"

Output ONLY the JSON array. No prose, no fences, no commentary. Example:
[
  { "title": "Commit to USC — enrollment deadline in 4 days", "subtitle": "Must decide before May 1", "urgency": "high", "destination": "tracker" },
  { "title": "Finish UPenn supplemental essay", "subtitle": "180/250 words, deadline in 6 days", "urgency": "medium", "destination": "essays" },
  { "title": "Send LOCI to MIT — deferred 8 weeks ago", "subtitle": "Strong follow-up window now", "urgency": "medium", "destination": "chat", "prompt": "Help me write a Letter of Continued Interest for MIT after my deferral 8 weeks ago." }
]`;

    const { text } = await generateText({
      model: openai("gpt-4o"),
      prompt,
      maxOutputTokens: 800,
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
