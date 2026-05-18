import { NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createClient } from "@/lib/supabase/server";
import {
  buildDigestPrompt,
  type DigestCollege,
  type DigestEssay,
} from "@/lib/assistant/digest-prompt";

export const maxDuration = 30;

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
      .select("id, role")
      .eq("id", user.id)
      .single() as { data: { id: string; role: "student" | "counselor" } | null };

    if (!profile || profile.role !== "student") {
      return NextResponse.json({ error: "Student-only" }, { status: 403 });
    }

    // The weekly batch job keeps digests fresh — serve whatever is cached.
    const { data: existing } = await db
      .from("assistant_digests")
      .select("content, generated_at")
      .eq("user_id", user.id)
      .maybeSingle() as { data: { content: string; generated_at: string } | null };

    if (existing) {
      return NextResponse.json({
        content: existing.content,
        generated_at: existing.generated_at,
        cached: true,
      });
    }

    // No digest yet (new student before their first weekly batch) — generate one now.
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

    const colleges = (collegesRes.data ?? []) as DigestCollege[];
    const essays = (essaysRes.data ?? []) as DigestEssay[];

    const { text } = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      prompt: buildDigestPrompt(colleges, essays),
      maxOutputTokens: 200,
      temperature: 0.4,
    });

    const content = text.trim();
    const generatedAt = new Date().toISOString();

    await db.from("assistant_digests").insert({
      user_id: user.id,
      content,
      generated_at: generatedAt,
    });

    return NextResponse.json({ content, generated_at: generatedAt, cached: false });
  } catch (error) {
    console.error("Digest route error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Digest failed: ${msg}` }, { status: 500 });
  }
}
