import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildDigestPrompt,
  type DigestCollege,
  type DigestEssay,
} from "@/lib/assistant/digest-prompt";

export const maxDuration = 300;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any;

    const { data: students } = await db
      .from("profiles")
      .select("id")
      .eq("role", "student");

    const studentIds = ((students ?? []) as Array<{ id: string }>).map((s) => s.id);
    if (studentIds.length === 0) {
      return NextResponse.json({ submitted: 0, message: "No students" });
    }

    const [collegesRes, essaysRes] = await Promise.all([
      db
        .from("user_colleges")
        .select("user_id, application_status, application_round, decision, personal_deadline, colleges(name)")
        .in("user_id", studentIds),
      db
        .from("essays")
        .select("user_id, status, word_limit, body, colleges(name)")
        .in("user_id", studentIds),
    ]);

    const collegesByUser = new Map<string, DigestCollege[]>();
    for (const row of (collegesRes.data ?? []) as Array<DigestCollege & { user_id: string }>) {
      const list = collegesByUser.get(row.user_id) ?? [];
      list.push(row);
      collegesByUser.set(row.user_id, list);
    }
    const essaysByUser = new Map<string, DigestEssay[]>();
    for (const row of (essaysRes.data ?? []) as Array<DigestEssay & { user_id: string }>) {
      const list = essaysByUser.get(row.user_id) ?? [];
      list.push(row);
      essaysByUser.set(row.user_id, list);
    }

    const requests = studentIds.map((userId) => ({
      custom_id: userId,
      params: {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        temperature: 0.4,
        messages: [
          {
            role: "user" as const,
            content: buildDigestPrompt(
              collegesByUser.get(userId) ?? [],
              essaysByUser.get(userId) ?? [],
            ),
          },
        ],
      },
    }));

    const batch = await anthropic.messages.batches.create({ requests });

    return NextResponse.json({ submitted: requests.length, batch_id: batch.id });
  } catch (error) {
    console.error("Digest submit cron error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Digest submit failed: ${msg}` }, { status: 500 });
  }
}
