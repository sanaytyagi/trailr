import { NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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
      .select("id, role")
      .eq("id", user.id)
      .single() as { data: { id: string; role: "student" | "counselor" } | null };

    if (!profile || profile.role !== "student") {
      return NextResponse.json({ error: "Student-only" }, { status: 403 });
    }

    // Return the cached digest if it's < 7 days old.
    const { data: existing } = await db
      .from("assistant_digests")
      .select("content, generated_at")
      .eq("user_id", user.id)
      .maybeSingle() as { data: { content: string; generated_at: string } | null };

    if (existing) {
      const ageMs = Date.now() - new Date(existing.generated_at).getTime();
      if (ageMs < SEVEN_DAYS_MS) {
        return NextResponse.json({
          content: existing.content,
          generated_at: existing.generated_at,
          cached: true,
        });
      }
    }

    const [collegesRes, essaysRes] = await Promise.all([
      db
        .from("user_colleges")
        .select("application_status, application_round, decision, personal_deadline, colleges(name)")
        .eq("user_id", user.id),
      db
        .from("essays")
        .select("status, word_limit, body, colleges(name)")
        .eq("user_id", user.id),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const colleges = (collegesRes.data ?? []) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const essays = (essaysRes.data ?? []) as any[];

    const today = new Date().toISOString().slice(0, 10);

    const collegesContext = colleges.length
      ? colleges
          .map((c) => {
            const name = c.colleges?.name ?? "Unknown";
            const days = c.personal_deadline ? daysUntil(c.personal_deadline) : null;
            return (
              `${name}: ${c.application_status}/${c.application_round}` +
              (c.decision ? ` (${c.decision})` : "") +
              (c.personal_deadline ? ` — ${days !== null && days >= 0 ? `${days} days to deadline` : `${Math.abs(days ?? 0)} days overdue`}` : "")
            );
          })
          .join("\n")
      : "(no colleges tracked)";

    const essaysContext = essays.length
      ? essays
          .map((e) => {
            const body: string = e.body ?? "";
            const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
            return `${e.colleges?.name ?? "Unknown"}: ${wordCount}/${e.word_limit ?? 0} words (${e.status})`;
          })
          .join("\n")
      : "(no essays)";

    const prompt = `You are writing a short weekly briefing for a college applicant — like a coach's Monday morning text.

TODAY: ${today}

STUDENT SNAPSHOT:
Colleges:
${collegesContext}

Essays:
${essaysContext}

YOUR TASK:
Write 2–3 sentences (max ~70 words total) that:
1. Open with the most concrete fact about THIS week — a specific deadline, a recent decision, an essay nearing completion. Name names.
2. Name the single most important thing to focus on this week.
3. End with a quick note of encouragement or perspective. Honest, not saccharine.

RULES:
- No headers, no bullets, no markdown bold.
- No "Hi!" or "Good morning!" — open with the substance.
- Sound like a knowledgeable advisor, not a chatbot.
- Plain prose only. Output the briefing text and nothing else.`;

    const { text } = await generateText({
      model: openai("gpt-4o"),
      prompt,
      maxOutputTokens: 200,
      temperature: 0.4,
    });

    const content = text.trim();
    const generatedAt = new Date().toISOString();

    if (existing) {
      await db
        .from("assistant_digests")
        .update({ content, generated_at: generatedAt, updated_at: generatedAt })
        .eq("user_id", user.id);
    } else {
      await db.from("assistant_digests").insert({
        user_id: user.id,
        content,
        generated_at: generatedAt,
      });
    }

    return NextResponse.json({ content, generated_at: generatedAt, cached: false });
  } catch (error) {
    console.error("Digest route error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Digest failed: ${msg}` }, { status: 500 });
  }
}
