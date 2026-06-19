"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  Newspaper,
  ListChecks,
  PieChart,
  FileText,
  AlertTriangle,
  MessageSquarePlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { AssistantTask } from "@/app/api/assistant/tasks/route";

type DecisionRow = {
  decision: string | null;
};

type EssayRow = {
  word_limit: number;
  body: string;
  essay_type: string | null;
  college_name: string | null;
};

type DigestState =
  | { status: "loading" }
  | { status: "ready"; content: string; generatedAt: string }
  | { status: "empty" }
  | { status: "error"; message: string };

type TasksState =
  | { status: "loading" }
  | { status: "ready"; tasks: AssistantTask[] }
  | { status: "error"; message: string };

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

const URGENCY_DOT: Record<AssistantTask["urgency"], string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-sky-500",
};

const URGENCY_LABEL: Record<AssistantTask["urgency"], string> = {
  high: "Urgent",
  medium: "This week",
  low: "When you can",
};

export function AssistantSidebar({
  userId,
  onPrefillChat,
  onQuotaExceeded,
  mobileOpen = false,
  onMobileOpenChange,
}: {
  userId: string;
  onPrefillChat: (prompt: string) => void;
  onQuotaExceeded?: () => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [tasksState, setTasksState] = useState<TasksState>({ status: "loading" });
  const [digestState, setDigestState] = useState<DigestState>({ status: "loading" });
  const [decisions, setDecisions] = useState<DecisionRow[] | null>(null);
  const [essays, setEssays] = useState<EssayRow[] | null>(null);
  const [sentToChat, setSentToChat] = useState<number | null>(null);

  const fetchTasks = async () => {
    setTasksState({ status: "loading" });
    try {
      const res = await fetch("/api/assistant/tasks", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 402 && body.code === "quota_exceeded") {
          onQuotaExceeded?.();
          setTasksState({ status: "error", message: "Monthly AI limit reached." });
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as { tasks?: AssistantTask[]; error?: string };
      if (json.error) throw new Error(json.error);
      setTasksState({ status: "ready", tasks: json.tasks ?? [] });
    } catch (err) {
      setTasksState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load tasks",
      });
    }
  };

  const fetchDigest = async () => {
    setDigestState({ status: "loading" });
    try {
      const res = await fetch("/api/assistant/digest", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { content?: string; generated_at?: string; error?: string };
      if (json.error) throw new Error(json.error);
      if (json.content && json.generated_at) {
        setDigestState({ status: "ready", content: json.content, generatedAt: json.generated_at });
      } else {
        setDigestState({ status: "empty" });
      }
    } catch (err) {
      setDigestState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load digest",
      });
    }
  };

  // Fetch tasks + digest on mount
  useEffect(() => {
    fetchTasks();
    fetchDigest();
  }, []);

  // Fetch decisions + essays directly for client-side computed panels
  useEffect(() => {
    let cancelled = false;
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const [decisionRes, essayRes] = await Promise.all([
        db
          .from("user_colleges")
          .select("decision")
          .eq("user_id", userId),
        db
          .from("essays")
          .select("word_limit, body, essay_type, colleges(name)")
          .eq("user_id", userId),
      ]);
      if (cancelled) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const decisionRows = ((decisionRes.data ?? []) as any[]).map((r) => ({ decision: r.decision ?? null }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const essayRows = ((essayRes.data ?? []) as any[]).map((r) => ({
        word_limit: r.word_limit ?? 0,
        body: r.body ?? "",
        essay_type: r.essay_type ?? null,
        college_name: r.colleges?.name ?? null,
      }));
      setDecisions(decisionRows);
      setEssays(essayRows);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  const handleTaskClick = (task: AssistantTask, index: number) => {
    if (task.destination === "tracker") {
      router.push("/tracker");
    } else if (task.destination === "essays") {
      router.push("/essays");
    } else {
      onPrefillChat(task.prompt ?? task.title);
      setSentToChat(index);
      setTimeout(() => setSentToChat(null), 2000);
    }
  };

  // Decision pattern (client-side)
  const decisionStats = useMemo(() => {
    if (!decisions) return null;
    const realDecisions = decisions.filter((d) => d.decision && d.decision !== "pending");
    const total = realDecisions.length;
    if (total < 3) return null;
    const counts = {
      accepted: realDecisions.filter((d) => d.decision === "accepted").length,
      deferred: realDecisions.filter((d) => d.decision === "deferred").length,
      waitlisted: realDecisions.filter((d) => d.decision === "waitlisted").length,
      rejected: realDecisions.filter((d) => d.decision === "rejected").length,
    };
    return { total, counts };
  }, [decisions]);

  const decisionInsight = useMemo(() => {
    if (!decisionStats) return null;
    const { total, counts } = decisionStats;
    const acceptRate = Math.round((counts.accepted / total) * 100);
    if (counts.accepted === total) {
      return `Every decision so far is an acceptance. You're trending well, ${total} for ${total}.`;
    }
    if (counts.rejected === total) {
      return `All ${total} decisions have been rejections. It's worth a strategy conversation about your remaining schools.`;
    }
    if (counts.accepted >= Math.ceil(total / 2)) {
      return `${counts.accepted} of ${total} decisions are acceptances (${acceptRate}%). Strong shape so far.`;
    }
    if (counts.waitlisted + counts.deferred >= Math.ceil(total / 2)) {
      return `${counts.waitlisted + counts.deferred} of ${total} decisions are waitlists or deferrals — most schools are still keeping you in play.`;
    }
    return `${counts.accepted} accepted, ${counts.rejected} rejected out of ${total}. Mixed bag, but the picture is taking shape.`;
  }, [decisionStats]);

  // Essay health (client-side)
  const essayStats = useMemo(() => {
    if (!essays || essays.length === 0) return null;
    const enriched = essays.map((e) => {
      const wordCount = e.body.trim() ? e.body.trim().split(/\s+/).length : 0;
      const limit = Math.max(e.word_limit, 1);
      const pct = wordCount / limit;
      return {
        college: e.college_name ?? (e.essay_type === "personal_statement" ? "Common App" : "Unknown"),
        wordCount,
        limit: e.word_limit,
        pct,
      };
    });
    const mostBehind = [...enriched].sort((a, b) => a.pct - b.pct)[0];
    return { essays: enriched, mostBehind };
  }, [essays]);

  const essayInsight = useMemo(() => {
    if (!essayStats) return null;
    const { mostBehind } = essayStats;
    if (mostBehind.pct >= 0.8) {
      return `All essays are nearly there. Consider doing a final read-through pass.`;
    }
    if (mostBehind.pct < 0.2 && mostBehind.limit > 0) {
      return `${mostBehind.college} essay is at ${mostBehind.wordCount}/${mostBehind.limit} words — that's the one most behind.`;
    }
    return `${mostBehind.college} essay is at ${mostBehind.wordCount}/${mostBehind.limit} words. Worth carving out time this week.`;
  }, [essayStats]);

  // Weekly digest visibility gate
  const showDigest = useMemo(() => {
    if (digestState.status !== "ready") return digestState.status === "loading";
    const today = new Date();
    const isMonday = today.getDay() === 1;
    if (isMonday) return true;
    const generated = new Date(digestState.generatedAt);
    return generated < startOfWeek(today);
  }, [digestState]);

  // The drawer is mobile-only. If the viewport grows to lg while it's open
  // (rotation/resize), close it so the Sheet overlay doesn't dim the desktop
  // layout with no reachable close affordance.
  useEffect(() => {
    if (!mobileOpen) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    if (mq.matches) {
      onMobileOpenChange?.(false);
      return;
    }
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) onMobileOpenChange?.(false);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mobileOpen, onMobileOpenChange]);

  const panels = (
    <>
      {/* Panel 1: AI Tasks */}
      <Panel
        icon={<ListChecks className="h-3.5 w-3.5" />}
        title="What to do next"
        action={
          <button
            onClick={fetchTasks}
            disabled={tasksState.status === "loading"}
            aria-label="Refresh tasks"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <RefreshCw className={cn("h-3 w-3", tasksState.status === "loading" && "animate-spin")} />
          </button>
        }
      >
        {tasksState.status === "loading" && <TaskSkeleton />}
        {tasksState.status === "error" && (
          <p className="px-1 py-2 text-xs text-destructive">{tasksState.message}</p>
        )}
        {tasksState.status === "ready" && tasksState.tasks.length === 0 && (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            Nothing pressing right now. Add a college or essay to get tailored next steps.
          </p>
        )}
        {tasksState.status === "ready" && tasksState.tasks.length > 0 && (
          <ul className="flex flex-col">
            {tasksState.tasks.map((task, i) => {
              const isSent = sentToChat === i;
              return (
                <li key={i}>
                  <button
                    onClick={() => handleTaskClick(task, i)}
                    className={cn(
                      "group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left",
                      "border transition-all duration-150",
                      "hover:bg-background hover:border-border hover:shadow-sm hover:-translate-y-px",
                      isSent
                        ? "border-primary/30 bg-primary/5"
                        : "border-transparent bg-transparent"
                    )}
                  >
                    <span
                      aria-label={URGENCY_LABEL[task.urgency]}
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full transition-transform duration-150",
                        URGENCY_DOT[task.urgency],
                        "group-hover:scale-125"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        "text-xs font-medium leading-snug transition-colors",
                        isSent ? "text-primary" : "text-foreground group-hover:text-foreground"
                      )}>
                        {task.title}
                      </p>
                      {task.subtitle && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{task.subtitle}</p>
                      )}
                      {isSent && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-primary animate-in fade-in duration-200">
                          <MessageSquarePlus className="h-3 w-3" />
                          Added to chat
                        </p>
                      )}
                    </div>
                    {isSent ? (
                      <MessageSquarePlus className="mt-1 h-3.5 w-3.5 shrink-0 text-primary animate-in fade-in duration-200" />
                    ) : (
                      <ChevronRight className="mt-1 h-3 w-3 shrink-0 text-muted-foreground/30 transition-all group-hover:text-muted-foreground group-hover:translate-x-0.5" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* Panel 2: Weekly Digest */}
      {showDigest && (
        <Panel
          icon={<Newspaper className="h-3.5 w-3.5" />}
          title="Weekly briefing"
          tint="blue"
        >
          {digestState.status === "loading" && <DigestSkeleton />}
          {digestState.status === "error" && (
            <p className="px-1 py-2 text-xs text-destructive">{digestState.message}</p>
          )}
          {digestState.status === "ready" && (
            <>
              <p className="px-1 text-xs leading-relaxed text-foreground/90">{digestState.content}</p>
              <p className="mt-2 px-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                Generated {new Date(digestState.generatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </p>
            </>
          )}
        </Panel>
      )}

      {/* Panel 3: Decision Pattern */}
      {decisionStats && (
        <Panel icon={<PieChart className="h-3.5 w-3.5" />} title="Decision pattern">
          <DecisionBars counts={decisionStats.counts} total={decisionStats.total} />
          {decisionInsight && (
            <p className="mt-3 px-1 text-xs leading-relaxed text-muted-foreground">{decisionInsight}</p>
          )}
        </Panel>
      )}

      {/* Panel 4: Essay Progress */}
      {essayStats && (
        <Panel icon={<FileText className="h-3.5 w-3.5" />} title="Essay progress">
          <ul className="flex flex-col divide-y divide-border/50">
            {essayStats.essays.map((e, i) => {
              const pct = Math.min(e.pct, 1);
              const status = pct >= 0.8 ? "On track" : pct >= 0.2 ? "Drafting" : "Not started";
              const statusColor = pct >= 0.8 ? "text-emerald-600" : pct >= 0.2 ? "text-amber-600" : "text-muted-foreground/60";
              return (
                <li key={i} className="flex items-center justify-between gap-3 px-1 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground/90">{e.college}</p>
                    <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                      {e.wordCount} / {e.limit || "?"} words
                    </p>
                  </div>
                  <span className={cn("shrink-0 text-[11px] font-medium", statusColor)}>{status}</span>
                </li>
              );
            })}
          </ul>
          {essayInsight && (
            <div className={cn(
              "mt-2 flex items-start gap-2 rounded-lg border px-2.5 py-2",
              essayStats.mostBehind.pct < 0.8 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"
            )}>
              {essayStats.mostBehind.pct < 0.8 ? (
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
              )}
              <p className={cn("text-[11px] leading-snug", essayStats.mostBehind.pct < 0.8 ? "text-amber-900" : "text-emerald-900")}>
                {essayInsight}
              </p>
            </div>
          )}
        </Panel>
      )}
    </>
  );

  return (
    <>
      {/* Desktop: persistent right rail */}
      <aside className="hidden lg:flex h-full w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border bg-muted/30 px-4 py-5">
        {panels}
      </aside>

      {/* Mobile: slide-over drawer toggled from the chat header */}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="right"
          className="w-[88%] max-w-sm gap-0 bg-muted/30 p-0 lg:hidden"
        >
          <SheetHeader className="border-border">
            <SheetTitle>Assistant context</SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-5">
            {panels}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Panel({
  icon,
  title,
  action,
  tint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  tint?: "blue";
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-card px-3 py-3 shadow-sm",
        tint === "blue" ? "border-sky-200 bg-sky-50/60" : "border-border"
      )}
    >
      <header className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("text-muted-foreground", tint === "blue" && "text-sky-600")}>{icon}</span>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function TaskSkeleton() {
  return (
    <ul className="flex flex-col gap-2 px-1 py-1">
      {[...Array(4)].map((_, i) => (
        <li key={i} className="flex items-start gap-2.5 animate-pulse">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-4/5 rounded bg-muted" />
            <div className="h-2 w-2/3 rounded bg-muted/70" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function DigestSkeleton() {
  return (
    <div className="space-y-1.5 px-1 py-1 animate-pulse">
      <div className="h-2.5 w-full rounded bg-muted" />
      <div className="h-2.5 w-11/12 rounded bg-muted" />
      <div className="h-2.5 w-3/4 rounded bg-muted" />
    </div>
  );
}

function DecisionBars({
  counts,
  total,
}: {
  counts: { accepted: number; deferred: number; waitlisted: number; rejected: number };
  total: number;
}) {
  const segments: Array<{ key: string; label: string; count: number; color: string }> = [
    { key: "accepted", label: "Accepted", count: counts.accepted, color: "bg-emerald-500" },
    { key: "deferred", label: "Deferred", count: counts.deferred, color: "bg-violet-500" },
    { key: "waitlisted", label: "Waitlisted", count: counts.waitlisted, color: "bg-amber-500" },
    { key: "rejected", label: "Rejected", count: counts.rejected, color: "bg-red-500" },
  ];

  return (
    <div className="px-1">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((s) =>
          s.count > 0 ? (
            <div
              key={s.key}
              className={s.color}
              style={{ width: `${(s.count / total) * 100}%` }}
              title={`${s.label}: ${s.count}`}
            />
          ) : null
        )}
      </div>
      <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1">
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <li key={s.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn("h-1.5 w-1.5 rounded-full", s.color)} />
              <span className="text-foreground/80">{s.count}</span>
              <span>{s.label.toLowerCase()}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}
