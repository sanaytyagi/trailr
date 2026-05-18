import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const LOOKBACK_MS = 48 * 60 * 60 * 1000;

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
    const cutoff = Date.now() - LOOKBACK_MS;
    let collected = 0;

    for await (const batch of anthropic.messages.batches.list({ limit: 20 })) {
      if (new Date(batch.created_at).getTime() < cutoff) break;
      if (batch.processing_status !== "ended") continue;

      for await (const entry of await anthropic.messages.batches.results(batch.id)) {
        if (entry.result.type !== "succeeded") continue;

        const content = entry.result.message.content.find((b) => b.type === "text");
        const text = content?.type === "text" ? content.text.trim() : "";
        if (!text) continue;

        const now = new Date().toISOString();
        await db.from("assistant_digests").upsert(
          { user_id: entry.custom_id, content: text, generated_at: now, updated_at: now },
          { onConflict: "user_id" },
        );
        collected += 1;
      }
    }

    return NextResponse.json({ collected });
  } catch (error) {
    console.error("Digest collect cron error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Digest collect failed: ${msg}` }, { status: 500 });
  }
}
