import { NextRequest, NextResponse } from "next/server";
import { streamText, type UIMessage, type ModelMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

function extractText(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function buildSystemPrompt(ctx: {
  today: string;
  profileName: string | null;
  colleges: Array<{
    name: string;
    location: string | null;
    acceptance_rate: number | null;
    application_status: string;
    application_round: string;
    decision: string | null;
    admissions_category: string | null;
    personal_deadline: string | null;
    notes: string;
  }>;
  essays: Array<{
    college_name: string | null;
    prompt: string;
    word_limit: number;
    word_count: number;
    status: string;
  }>;
  listBuilder: Array<{ name: string; tier: string; reason: string }>;
  counselorConnected: boolean;
  counselorNotes: Array<{ college_name: string | null; note: string }>;
}) {
  const collegesText = ctx.colleges.length
    ? ctx.colleges
        .map(
          (c) =>
            `- ${c.name}${c.location ? ` (${c.location})` : ""}` +
            `${c.acceptance_rate !== null ? ` — ${c.acceptance_rate.toFixed(1)}% admit rate` : ""}` +
            ` — status: ${c.application_status}, round: ${c.application_round}` +
            `${c.admissions_category ? `, category: ${c.admissions_category}` : ""}` +
            `${c.decision ? `, decision: ${c.decision}` : ""}` +
            `${c.personal_deadline ? `, deadline: ${c.personal_deadline}` : ""}` +
            `${c.notes ? `, notes: ${c.notes}` : ""}`
        )
        .join("\n")
    : "(none yet — student hasn't added any colleges to their tracker)";

  const essaysText = ctx.essays.length
    ? ctx.essays
        .map(
          (e) =>
            `- ${e.college_name ?? "Unknown school"}: "${e.prompt.slice(0, 120)}${e.prompt.length > 120 ? "…" : ""}"` +
            ` — ${e.word_count}/${e.word_limit} words, status: ${e.status}`
        )
        .join("\n")
    : "(no essays started yet)";

  const listBuilderText = ctx.listBuilder.length
    ? ctx.listBuilder
        .map((c) => `- ${c.name} [${c.tier}] — ${c.reason}`)
        .join("\n")
    : "(student hasn't generated a list via List Builder yet)";

  const counselorNotesText = ctx.counselorConnected
    ? ctx.counselorNotes.length
      ? ctx.counselorNotes
          .map((n) => `- On ${n.college_name ?? "a college"}: ${n.note}`)
          .join("\n")
      : "(counselor is connected but hasn't left college-specific notes yet)"
    : "(no counselor connected — don't invent one)";

  return `You are Trailr's AI college admissions assistant, helping a high-school student navigate the application process.

TODAY'S DATE: ${ctx.today}

STUDENT CONTEXT:
Name: ${ctx.profileName ?? "the student"}

Tracked colleges:
${collegesText}

Essays in progress:
${essaysText}

List Builder — AI-generated shortlist with tiers and reasons:
${listBuilderText}

Counselor notes on the student's colleges:
${counselorNotesText}

HOW TO RESPOND:
- OPEN EVERY RESPONSE by referencing something specific from the student's actual data — a named college, a real deadline date, a specific decision, a tracked essay. Never open with a generic observation, a restatement of the question, or filler like "Great question!" or "As a college applicant...". The first sentence must prove you know this specific student's situation.
- Always give CONCRETE, PERSONALIZED advice grounded in the student's actual data above. Reference specific colleges, deadlines, and essays by name whenever relevant. Avoid generic "you should research your options" filler.
- Use your web search tool whenever the student asks about school-specific facts — deadlines, programs, acceptance rates, scholarships, campus life, news — so the answer reflects current information, not training-cutoff assumptions.
- NEVER write essays for the student. You can brainstorm topics, critique drafts they share, suggest structures, or ask questions to help them find their angle — but do not produce finished essay prose on their behalf.
- Defer to the counselor on major strategic decisions (final college list, ED vs EA strategy, whether to appeal a decision, etc.) when one is connected. Offer your own perspective, then recommend they confirm with their counselor.
- NEVER guarantee admissions outcomes. Talk in terms of fit, competitiveness, and probability — never "you'll get in" or "you won't get in".
- Be encouraging but honest. If their list is reach-heavy, say so plainly; if an essay draft isn't working, point out specifically why. Don't flatter, don't catastrophize.
- Format responses in markdown: use bullet points for lists, **bold** for emphasis, and short paragraphs. Keep responses focused — don't dump everything you know, answer the question they actually asked.
- If context is missing (e.g., they ask about "my Stanford essay" and there isn't one tracked), ask a clarifying question instead of guessing.`;
}

export async function POST(req: NextRequest) {
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
      return NextResponse.json({ error: "Assistant is student-only" }, { status: 403 });
    }

    const body = await req.json() as { messages: UIMessage[] };
    const clientMessages = body.messages ?? [];
    const latest = clientMessages[clientMessages.length - 1];
    if (!latest || latest.role !== "user") {
      return NextResponse.json({ error: "Missing user message" }, { status: 400 });
    }
    const latestText = extractText(latest);
    if (!latestText.trim()) {
      return NextResponse.json({ error: "Empty user message" }, { status: 400 });
    }

    // Fetch all context in parallel
    const [
      collegesRes,
      essaysRes,
      listRes,
      notesRes,
      historyRes,
    ] = await Promise.all([
      db
        .from("user_colleges")
        .select("application_status, application_round, decision, admissions_category, personal_deadline, notes, colleges(name, location, acceptance_rate)")
        .eq("user_id", user.id),
      db
        .from("essays")
        .select("prompt, word_limit, body, status, colleges(name)")
        .eq("user_id", user.id),
      db
        .from("user_lists")
        .select("colleges")
        .eq("user_id", user.id)
        .maybeSingle(),
      profile.counselor_id
        ? db
            .from("counselor_college_notes")
            .select("note, colleges(name)")
            .eq("student_id", user.id)
        : Promise.resolve({ data: [], error: null }),
      db
        .from("assistant_messages")
        .select("role, content")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(20),
    ]);

    const colleges = (collegesRes.data ?? []).map((row: any) => ({
      name: row.colleges?.name ?? "Unknown",
      location: row.colleges?.location ?? null,
      acceptance_rate: row.colleges?.acceptance_rate ?? null,
      application_status: row.application_status,
      application_round: row.application_round,
      decision: row.decision,
      admissions_category: row.admissions_category,
      personal_deadline: row.personal_deadline,
      notes: row.notes ?? "",
    }));

    const essays = (essaysRes.data ?? []).map((row: any) => {
      const bodyText: string = row.body ?? "";
      const word_count = bodyText.trim() ? bodyText.trim().split(/\s+/).length : 0;
      return {
        college_name: row.colleges?.name ?? null,
        prompt: row.prompt ?? "",
        word_limit: row.word_limit ?? 0,
        word_count,
        status: row.status,
      };
    });

    const listBuilderRaw = (listRes.data?.colleges ?? []) as unknown;
    const listBuilder = Array.isArray(listBuilderRaw)
      ? (listBuilderRaw as Array<{ name?: string; tier?: string; reason?: string }>)
          .filter((c) => c && typeof c.name === "string")
          .map((c) => ({ name: c.name!, tier: c.tier ?? "?", reason: c.reason ?? "" }))
      : [];

    const counselorNotes = (notesRes.data ?? []).map((row: any) => ({
      college_name: row.colleges?.name ?? null,
      note: row.note ?? "",
    }));

    const history = (historyRes.data ?? []) as Array<{ role: "user" | "assistant"; content: string }>;

    const today = new Date().toISOString().slice(0, 10);
    const systemPrompt = buildSystemPrompt({
      today,
      profileName: profile.full_name ?? null,
      colleges,
      essays,
      listBuilder,
      counselorConnected: !!profile.counselor_id,
      counselorNotes,
    });

    const historyModel: ModelMessage[] = history.map((h) => ({
      role: h.role,
      content: h.content,
    }));

    const modelMessages: ModelMessage[] = [
      ...historyModel,
      { role: "user", content: latestText },
    ];

    console.log("SYSTEM PROMPT:", systemPrompt);
    console.log("CONTEXT DATA:", { colleges, essays, listBuilder, counselorNotes });

    const result = streamText({
      model: openai.responses("gpt-4o"),
      system: systemPrompt,
      messages: modelMessages,
      tools: {
        web_search_preview: openai.tools.webSearchPreview({}),
      },
      onFinish: async ({ text }) => {
        try {
          await db.from("assistant_messages").insert({
            user_id: user.id,
            role: "user",
            content: latestText,
          });
          await db.from("assistant_messages").insert({
            user_id: user.id,
            role: "assistant",
            content: text,
          });
        } catch (err) {
          console.error("Failed to persist assistant messages:", err);
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Assistant route error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Assistant failed: ${message}` }, { status: 500 });
  }
}
