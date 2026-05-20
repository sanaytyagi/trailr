"use client";

import { use, useEffect, useState, useCallback, useRef, useLayoutEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw, ExternalLink, AlertCircle, SendHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Dossier, CitedItem } from "@/lib/research-brief/schema";
import { UpgradeModal } from "@/components/upgrade-modal";
import { useUsage } from "@/components/usage-meter";

interface BriefRow {
  id: string;
  status: "generating" | "ready" | "failed";
  content: Dossier | null;
  sources: string[] | null;
  error_message: string | null;
  generated_at: string | null;
  quality_flag: string | null;
}

interface CollegeRow {
  id: string;
  name: string;
  location: string | null;
  website_url: string | null;
}

interface FollowUpRow {
  id: string;
  prompt: string;
  items: CitedItem[];
}

type LoadState =
  | { kind: "loading" }
  | { kind: "unauthed" }
  | { kind: "not_tracked" }
  | { kind: "no_brief"; college: CollegeRow }
  | { kind: "has_brief"; college: CollegeRow; brief: BriefRow }
  | { kind: "error"; message: string };

export default function CollegeBriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: collegeId } = use(params);
  const supabase = createClient();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [followups, setFollowups] = useState<FollowUpRow[]>([]);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { data: usage, refresh: refreshUsage } = useUsage();
  const [followUpInput, setFollowUpInput] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setState({ kind: "unauthed" });
      return;
    }
    const userId = authData.user.id;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { data: tracked } = await db
      .from("user_colleges")
      .select("colleges(id, name, location, website_url)")
      .eq("user_id", userId)
      .eq("college_id", collegeId)
      .maybeSingle();

    if (!tracked?.colleges) {
      setState({ kind: "not_tracked" });
      return;
    }
    const college = tracked.colleges as CollegeRow;

    const { data: brief } = await db
      .from("research_briefs")
      .select("id, status, content, sources, error_message, generated_at, quality_flag")
      .eq("user_id", userId)
      .eq("college_id", collegeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!brief) {
      setState({ kind: "no_brief", college });
      return;
    }

    setState({ kind: "has_brief", college, brief: brief as BriefRow });

    // Load follow-ups for this brief
    if (brief.status === "ready") {
      const { data: fus } = await db
        .from("research_brief_followups")
        .select("id, prompt, items")
        .eq("brief_id", brief.id)
        .order("created_at", { ascending: true });
      if (fus) setFollowups(fus as FollowUpRow[]);
    }
  }, [supabase, collegeId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/assistant/research-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ college_id: collegeId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Request failed" }));
        if (res.status === 402 && body.code === "quota_exceeded") {
          setUpgradeOpen(true);
          throw new Error(body.error ?? "You've reached your monthly AI limit.");
        }
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    setGenerating(true);
    setGenError(null);
    setFollowups([]);
    try {
      const del = await fetch(
        `/api/assistant/research-brief?college_id=${encodeURIComponent(collegeId)}`,
        { method: "DELETE" }
      );
      if (!del.ok) {
        const body = await del.json().catch(() => ({ error: "Delete failed" }));
        throw new Error(body.error ?? `HTTP ${del.status}`);
      }
      const gen = await fetch("/api/assistant/research-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ college_id: collegeId }),
      });
      if (!gen.ok) {
        const body = await gen.json().catch(() => ({ error: "Generation failed" }));
        if (gen.status === 402 && body.code === "quota_exceeded") {
          setUpgradeOpen(true);
          throw new Error(body.error ?? "You've reached your monthly AI limit.");
        }
        throw new Error(body.error ?? `HTTP ${gen.status}`);
      }
      await load();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleFollowUp = async () => {
    const prompt = followUpInput.trim();
    if (!prompt || followUpLoading) return;
    if (state.kind !== "has_brief" || state.brief.status !== "ready") return;

    setFollowUpLoading(true);
    setFollowUpError(null);
    try {
      const res = await fetch("/api/assistant/research-brief/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief_id: state.brief.id, prompt }),
      });
      const data = await res.json().catch(() => ({ error: "Request failed" }));
      if (!res.ok) {
        if (res.status === 402 && data.code === "quota_exceeded") {
          setUpgradeOpen(true);
          throw new Error(data.error ?? "You've reached your monthly AI limit.");
        }
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setFollowups((prev) => [...prev, { id: data.id, prompt: data.prompt, items: data.items }]);
      setFollowUpInput("");
    } catch (err) {
      setFollowUpError(err instanceof Error ? err.message : "Follow-up failed");
    } finally {
      setFollowUpLoading(false);
    }
  };

  if (state.kind === "loading") {
    return <Centered><Loader2 className="h-6 w-6 animate-spin" /></Centered>;
  }
  if (state.kind === "unauthed") {
    return (
      <Centered>
        <p className="text-sm text-muted-foreground">Please sign in to view research briefs.</p>
      </Centered>
    );
  }
  if (state.kind === "not_tracked") {
    return (
      <Centered>
        <p className="text-sm text-muted-foreground">
          Add this college to your tracker to generate a research brief.
        </p>
        <Link href="/tracker" className="text-sm text-primary hover:underline mt-2">
          Back to tracker
        </Link>
      </Centered>
    );
  }
  if (state.kind === "error") {
    return (
      <Centered>
        <p className="text-sm text-destructive">{state.message}</p>
      </Centered>
    );
  }

  const college = state.college;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={`/essays?college=${collegeId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to essays
        </Link>
        {state.kind === "has_brief" && state.brief.status === "ready" && (
          <button
            onClick={handleRegenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Regenerate
          </button>
        )}
      </div>

      <header className="mb-6">
        <h1 className="text-3xl font-bold">{college.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Research brief · {college.location ?? ""}
        </p>
      </header>

      {state.kind === "no_brief" && (
        <GenerateCard
          onGenerate={handleGenerate}
          generating={generating}
          error={genError}
          collegeName={college.name}
        />
      )}

      {state.kind === "has_brief" && state.brief.status === "generating" && (
        <div className="rounded-lg border border-border p-6 text-center space-y-4">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          <p className="text-sm">Brief is generating. This page will update when it&apos;s ready.</p>
          <button
            onClick={handleRegenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Cancel and retry
          </button>
        </div>
      )}

      {state.kind === "has_brief" && state.brief.status === "failed" && (
        <FailedCard
          message={state.brief.error_message ?? "Generation failed."}
          onRetry={handleRegenerate}
          generating={generating}
        />
      )}

      {state.kind === "has_brief" &&
        state.brief.status === "ready" &&
        state.brief.content && (
          <>
            <DossierView
              dossier={state.brief.content}
              generatedAt={state.brief.generated_at}
            />

            {followups.map((fu) => (
              <FollowUpSection key={fu.id} prompt={fu.prompt} items={fu.items} />
            ))}

            <FollowUpInput
              value={followUpInput}
              onChange={setFollowUpInput}
              onSubmit={handleFollowUp}
              loading={followUpLoading}
              error={followUpError}
            />
          </>
        )}

      {genError && (
        <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{genError}</span>
        </div>
      )}
      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={(o) => {
          setUpgradeOpen(o);
          if (!o) refreshUsage();
        }}
        currentPlan={(usage?.plan ?? "free") as "free" | "plus" | "unlimited"}
        initialTier={usage?.plan === "plus" ? "unlimited" : "plus"}
        title="You've reached your monthly AI limit"
        description="Upgrade to generate more research briefs this month."
      />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-2">
      {children}
    </div>
  );
}

function GenerateCard({
  onGenerate,
  generating,
  error,
  collegeName,
}: {
  onGenerate: () => void;
  generating: boolean;
  error: string | null;
  collegeName: string;
}) {
  return (
    <div className="rounded-lg border border-border p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Generate your research brief</h2>
        <p className="text-sm text-muted-foreground mt-1">
          We&apos;ll search {collegeName}&apos;s programs, faculty, communities, traditions, and recent
          news, then match them to your profile. Every claim will include a source URL. Takes about
          60 to 90 seconds.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          We do the research. You write the essay.
        </p>
      </div>
      <button
        onClick={onGenerate}
        disabled={generating}
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {generating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Generating brief...
          </>
        ) : (
          "Generate brief"
        )}
      </button>
      {generating && (
        <p className="text-xs text-muted-foreground text-center">
          Searching the web and writing your brief. Don&apos;t close this tab.
        </p>
      )}
      {error && (
        <div className="text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function FailedCard({
  message,
  onRetry,
  generating,
}: {
  message: string;
  onRetry: () => void;
  generating: boolean;
}) {
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-destructive">Generation failed</h2>
        <p className="text-sm text-muted-foreground mt-1">{message}</p>
      </div>
      <button
        onClick={onRetry}
        disabled={generating}
        className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
      >
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Try again
      </button>
    </div>
  );
}

function DossierView({
  dossier,
  generatedAt,
}: {
  dossier: Dossier;
  generatedAt: string | null;
}) {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-base leading-relaxed">{dossier.fit_summary}</p>
        {generatedAt && (
          <p className="text-xs text-muted-foreground mt-3">
            Generated {new Date(generatedAt).toLocaleDateString()}
          </p>
        )}
      </section>

      <Section title="Programs that match your interests" items={dossier.programs} />
      {dossier.faculty.length > 0 && (
        <Section title="Faculty to know" items={dossier.faculty} />
      )}
      {dossier.communities.length > 0 && (
        <Section title="Communities and clubs" items={dossier.communities} />
      )}
      {dossier.traditions.length > 0 && (
        <Section title="Traditions and distinctive programs" items={dossier.traditions} />
      )}
      {dossier.news.length > 0 && (
        <Section
          title="Recent news"
          items={dossier.news.map((n) => ({
            ...n,
            detail: n.date ? `${n.detail} (${n.date})` : n.detail,
          }))}
        />
      )}
    </div>
  );
}

function FollowUpSection({ prompt, items }: { prompt: string; items: CitedItem[] }) {
  return (
    <div className="mt-8 pt-8 border-t border-border space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Your follow-up
        </p>
        <p className="text-sm font-medium text-foreground mt-0.5">&ldquo;{prompt}&rdquo;</p>
      </div>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="rounded-md border border-border p-4">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              {item.title}
              <ExternalLink className="h-3 w-3" />
            </a>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              {item.detail}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FollowUpInput({
  value,
  onChange,
  onSubmit,
  loading,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  return (
    <div className="sticky bottom-0 bg-background mt-10 pt-6 pb-4 border-t border-border space-y-3 shadow-[0_-8px_16px_-4px_hsl(var(--background))]">
      <div>
        <h2 className="text-base font-semibold">Want more research?</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ask for more specific findings to add to your brief.
        </p>
      </div>
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !loading && value.trim()) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder='e.g. "Find me three professors doing AI research"'
          maxLength={1000}
          disabled={loading}
          rows={1}
          className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow disabled:opacity-50 resize-none overflow-y-auto"
        />
        <button
          onClick={onSubmit}
          disabled={loading || !value.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-4 w-4" />
          )}
          {loading ? "Searching..." : "Ask"}
        </button>
      </div>
      <p className={`text-xs text-right ${value.length >= 900 ? "text-destructive" : "text-muted-foreground"}`}>
        {value.length}/1000
      </p>
      {loading && (
        <p className="text-xs text-muted-foreground">
          Searching the web for specific results...
        </p>
      )}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items: CitedItem[] }) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="rounded-md border border-border p-4">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              {item.title}
              <ExternalLink className="h-3 w-3" />
            </a>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              {item.detail}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
