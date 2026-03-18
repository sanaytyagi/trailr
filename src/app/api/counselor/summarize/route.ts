import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import type { Message } from "@/types/counselor";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { messages, existingSummary }: { messages: Message[]; existingSummary: string | null } =
    await req.json();

  const messageText = messages
    .map((m) => `${m.role === "user" ? "Student" : "Counselor"}: ${m.content}`)
    .join("\n\n");

  const userContent = existingSummary
    ? `Here is the existing summary of earlier conversation:\n\n${existingSummary}\n\nNow incorporate these additional messages into an updated summary:\n\n${messageText}`
    : `Summarize the following college admissions counseling conversation:\n\n${messageText}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    stream: false,
    messages: [
      {
        role: "system",
        content:
          "You are summarizing a college admissions counseling conversation. Produce a concise but complete summary that preserves: all specific advice given, all action items recommended, all colleges discussed and their evaluations, any personal details the student shared, and any decisions or conclusions reached. The summary will be used as context in future messages so nothing important should be lost. Write it as a single cohesive paragraph or two — not a bullet list.",
      },
      { role: "user", content: userContent },
    ],
  });

  const summary = completion.choices[0]?.message?.content ?? "";
  return NextResponse.json({ summary });
}
