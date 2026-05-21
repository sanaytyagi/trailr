export type DigestCollege = {
  application_status: string;
  application_round: string;
  decision: string | null;
  personal_deadline: string | null;
  colleges: { name: string } | null;
};

export type DigestEssay = {
  status: string;
  word_limit: number | null;
  body: string | null;
  colleges: { name: string } | null;
};

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

export function buildDigestPrompt(colleges: DigestCollege[], essays: DigestEssay[]): string {
  const today = new Date().toISOString().slice(0, 10);

  const collegesContext = colleges.length
    ? colleges
        .map((c) => {
          const name = c.colleges?.name ?? "Unknown";
          const hasDecision = c.decision && c.decision !== "pending";
          const isSubmitted = c.application_status === "submitted";
          const days = (!hasDecision && !isSubmitted && c.personal_deadline) ? daysUntil(c.personal_deadline) : null;
          return (
            `${name}: ${c.application_status}/${c.application_round}` +
            (c.decision ? ` (${c.decision})` : "") +
            (days !== null ? ` — ${days >= 0 ? `${days} days to application deadline` : `application deadline ${Math.abs(days)} days ago`}` : "")
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

  return `You are writing a short weekly briefing for a college applicant — like a coach's Monday morning text.

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
}
