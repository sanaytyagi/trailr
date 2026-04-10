"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, CheckCircle2, X,
  Undo2, Redo2, MessageSquare, Check,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Bold, Italic, Underline,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { useCounselorNotifications } from "@/hooks/use-counselor-notifications";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Essay {
  id: string;
  user_id: string;
  college_id: string;
  prompt: string;
  word_limit: number;
  body: string;
  status: "not_started" | "drafting" | "final";
}

interface EssayComment {
  id: string;
  essay_id: string;
  counselor_id: string;
  counselor_name: string;
  text: string;
  start_offset: number;
  end_offset: number;
  color_index: number;
  resolved: boolean;
  created_at: string;
}

interface Segment {
  text: string;
  commentId: string | null;
  colorIndex: number;
}

// ── Color palette ──────────────────────────────────────────────────────────────

const HIGHLIGHT_COLORS = [
  { bg: "rgba(251,191,36,0.28)",  border: "hsl(38,85%,50%)"  },
  { bg: "rgba(59,130,246,0.20)",  border: "hsl(205,85%,50%)" },
  { bg: "rgba(16,185,129,0.20)",  border: "hsl(142,60%,45%)" },
  { bg: "rgba(139,92,246,0.20)",  border: "hsl(270,60%,55%)" },
  { bg: "rgba(239,68,68,0.20)",   border: "hsl(0,65%,55%)"   },
  { bg: "rgba(20,184,166,0.20)",  border: "hsl(175,60%,40%)" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function getCharOffset(container: Node, node: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(container, 0);
  range.setEnd(node, offset);
  return range.toString().length;
}

function buildSegments(
  body: string,
  comments: EssayComment[],
  pending?: { start: number; end: number; colorIndex: number },
): Segment[] {
  type Event = { pos: number; open: boolean; id: string; colorIndex: number };
  const events: Event[] = [];

  for (const c of comments) {
    if (c.resolved) continue;
    events.push({ pos: c.start_offset, open: true,  id: c.id, colorIndex: c.color_index });
    events.push({ pos: c.end_offset,   open: false, id: c.id, colorIndex: c.color_index });
  }
  if (pending) {
    events.push({ pos: pending.start, open: true,  id: "__pending__", colorIndex: pending.colorIndex });
    events.push({ pos: pending.end,   open: false, id: "__pending__", colorIndex: pending.colorIndex });
  }

  events.sort((a, b) => a.pos - b.pos || (a.open ? -1 : 1));

  const segments: Segment[] = [];
  let pos = 0;
  let activeId: string | null = null;
  let activeColor = 0;

  for (const ev of events) {
    if (ev.pos > pos) {
      segments.push({ text: body.slice(pos, ev.pos), commentId: activeId, colorIndex: activeColor });
    }
    if (ev.open) { activeId = ev.id; activeColor = ev.colorIndex; }
    else         { activeId = null;  activeColor = 0; }
    pos = ev.pos;
  }
  if (pos < body.length) {
    segments.push({ text: body.slice(pos), commentId: null, colorIndex: 0 });
  }
  return segments;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function truncateQuote(text: string, max = 80) {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

/** Returns urgency level for the bottom bar based on words remaining. */
function barUrgency(words: number, limit: number): "over" | "warn" | "ok" {
  if (words > limit)        return "over";
  if (words >= limit - 100) return "warn";
  return "ok";
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function EssayEditorPage({ params }: { params: Promise<{ essayId: string }> }) {
  const { essayId } = use(params);
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const [supabase] = useState(() => createClient());

  const [essay, setEssay] = useState<Essay | null>(null);
  const [collegeName, setCollegeName] = useState<string>("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<"owner" | "counselor" | null>(null);

  // Prompt collapsible (Change 1)
  const [promptCollapsed, setPromptCollapsed] = useState(false);

  // Sibling navigation (Change 3)
  const [siblingEssays, setSiblingEssays] = useState<{ id: string }[]>([]);

  // Comments
  const [comments, setComments] = useState<EssayComment[]>([]);
  const [selectionInfo, setSelectionInfo] = useState<{ start: number; end: number; rect: DOMRect } | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{ start: number; end: number } | null>(null);
  const [newCommentText, setNewCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Counselor notification banner
  const { notifications: counselorNotifs, markEssayRead } = useCounselorNotifications(profile ?? null);
  const essayUnread = viewMode === "owner" && counselorNotifs.some((n) => n.essay_id === essayId);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const showBanner = essayUnread && !bannerDismissed;

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyRef = useRef(body);
  bodyRef.current = body;
  const essayRef = useRef<Essay | null>(null);
  essayRef.current = essay;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const essayTextRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // Mark essay comments as read when the student scrolls essay text into view
  useEffect(() => {
    if (!showBanner || !essayTextRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          markEssayRead(essayId);
          setBannerDismissed(true);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(essayTextRef.current);
    return () => observer.disconnect();
  }, [showBanner, essayId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!profile) return;
    async function load() {
      const { data: essayData } = await (supabase as any)
        .from("essays")
        .select("id, user_id, college_id, prompt, word_limit, body, status")
        .eq("id", essayId)
        .single();

      if (!essayData) { router.push("/essays"); return; }

      if (essayData.user_id === profile!.id) {
        setViewMode("owner");
      } else if (profile!.role === "counselor") {
        const { data: sp } = await (supabase as any)
          .from("profiles")
          .select("counselor_id")
          .eq("id", essayData.user_id)
          .single();
        if (sp?.counselor_id !== profile!.id) { router.push("/essays"); return; }
        setViewMode("counselor");
      } else {
        router.push("/essays");
        return;
      }

      setEssay(essayData as Essay);
      setBody(essayData.body);

      const { data: collegeData } = await (supabase as any)
        .from("colleges")
        .select("name")
        .eq("id", essayData.college_id)
        .single();
      setCollegeName((collegeData as { name: string } | null)?.name ?? "");

      // Load sibling essays for navigation (Change 3)
      const { data: siblingsData } = await (supabase as any)
        .from("essays")
        .select("id")
        .eq("college_id", essayData.college_id)
        .eq("user_id", essayData.user_id)
        .order("created_at", { ascending: true });
      if (siblingsData) setSiblingEssays(siblingsData as { id: string }[]);

      // Load comments
      const { data: commentsData } = await (supabase as any)
        .from("essay_comments")
        .select("id, essay_id, counselor_id, text, start_offset, end_offset, color_index, resolved, created_at, counselor:profiles!counselor_id(full_name)")
        .eq("essay_id", essayId)
        .order("start_offset", { ascending: true });

      if (commentsData) {
        setComments(commentsData.map((c: Record<string, unknown>) => ({
          ...(c as object),
          counselor_name: (c.counselor as { full_name: string | null } | null)?.full_name ?? "Counselor",
        })) as EssayComment[]);
      }

      setLoading(false);
    }
    load();
  }, [profile, essayId, supabase, router]);

  // ── Save (owner only) ────────────────────────────────────────────────────────

  const save = useCallback(async (overrideBody?: string) => {
    const currentEssay = essayRef.current;
    if (!currentEssay || !profile) return;
    const textToSave = overrideBody ?? bodyRef.current;
    const newStatus: "not_started" | "drafting" | "final" =
      currentEssay.status === "final" ? "final"
      : textToSave.trim() ? "drafting"
      : "not_started";

    setSaving(true);
    await (supabase as any)
      .from("essays")
      .update({ body: textToSave, status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", currentEssay.id);
    setEssay((prev) => prev ? { ...prev, body: textToSave, status: newStatus } : prev);
    setSaving(false);
    setSavedAt(new Date());
  }, [profile, supabase]);

  function handleBodyChange(text: string) {
    setBody(text);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(text), 800);
  }

  function handleBlur() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    save();
  }

  async function toggleFinal() {
    if (!essay || !profile) return;
    const newStatus = essay.status === "final" ? (body.trim() ? "drafting" : "not_started") : "final";
    await (supabase as any)
      .from("essays")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", essay.id);
    setEssay((prev) => prev ? { ...prev, status: newStatus } : prev);
    setSavedAt(new Date());
  }

  // ── Toolbar ────────────────────────────────────────────────────────────────────

  function handleUndo() { textareaRef.current?.focus(); document.execCommand("undo"); }
  function handleRedo() { textareaRef.current?.focus(); document.execCommand("redo"); }

  function wrapSelection(before: string, after: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = body.slice(start, end);
    const newBody = body.slice(0, start) + before + selected + after + body.slice(end);
    handleBodyChange(newBody);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + before.length;
      ta.selectionEnd = end + before.length;
    });
  }

  function handleBold()      { wrapSelection("**", "**"); }
  function handleItalic()    { wrapSelection("_", "_"); }
  function handleUnderline() { wrapSelection("<u>", "</u>"); }

  // ── Comment system (counselor) ────────────────────────────────────────────────

  function handleTextSelect() {
    if (viewMode !== "counselor" || pendingSelection) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) { setSelectionInfo(null); return; }
    const range = sel.getRangeAt(0);
    if (!essayTextRef.current?.contains(range.commonAncestorContainer)) { setSelectionInfo(null); return; }
    const start = getCharOffset(essayTextRef.current, range.startContainer, range.startOffset);
    const end = getCharOffset(essayTextRef.current, range.endContainer, range.endOffset);
    if (start >= end) { setSelectionInfo(null); return; }
    if (comments.some((c) => !c.resolved && c.start_offset < end && c.end_offset > start)) {
      setSelectionInfo(null);
      return;
    }
    setSelectionInfo({ start, end, rect: range.getBoundingClientRect() });
  }

  function openCommentInput() {
    if (!selectionInfo) return;
    setPendingSelection({ start: selectionInfo.start, end: selectionInfo.end });
    setSelectionInfo(null);
    window.getSelection()?.removeAllRanges();
    setTimeout(() => commentInputRef.current?.focus(), 50);
  }

  async function submitComment() {
    if (!pendingSelection || !newCommentText.trim() || !profile || !essay) return;
    setSubmittingComment(true);
    const colorIndex = comments.filter((c) => !c.resolved).length % HIGHLIGHT_COLORS.length;
    const { data } = await (supabase as any)
      .from("essay_comments")
      .insert({
        essay_id: essayId,
        counselor_id: profile.id,
        text: newCommentText.trim(),
        start_offset: pendingSelection.start,
        end_offset: pendingSelection.end,
        color_index: colorIndex,
      })
      .select("id, essay_id, counselor_id, text, start_offset, end_offset, color_index, resolved, created_at")
      .single();

    if (data) {
      const newComment: EssayComment = {
        ...(data as object) as EssayComment,
        counselor_name: profile.full_name ?? "Counselor",
      };
      setComments((prev) =>
        [...prev, newComment].sort((a, b) => a.start_offset - b.start_offset)
      );
    }
    setPendingSelection(null);
    setNewCommentText("");
    setSubmittingComment(false);
  }

  async function resolveComment(commentId: string) {
    await (supabase as any).from("essay_comments").update({ resolved: true }).eq("id", commentId);
    setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, resolved: true } : c));
  }

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (essayTextRef.current?.contains(e.target as Node)) return;
      setSelectionInfo(null);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function scrollToComment(commentId: string) {
    essayTextRef.current
      ?.querySelector(`[data-comment="${commentId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (profileLoading || loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!essay || !viewMode) return null;

  const words = countWords(body);
  const chars = body.length;
  const over = words > essay.word_limit;
  const remaining = essay.word_limit - words;
  const isFinal = essay.status === "final";
  const urgency = barUrgency(words, essay.word_limit);
  const toolbarBtn = "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors";

  const activeComments = comments.filter((c) => !c.resolved).sort((a, b) => a.start_offset - b.start_offset);
  const pendingColorIndex = activeComments.length % HIGHLIGHT_COLORS.length;
  const segments = buildSegments(
    body,
    comments,
    pendingSelection ? { start: pendingSelection.start, end: pendingSelection.end, colorIndex: pendingColorIndex } : undefined,
  );

  // Change 3: sibling navigation (owner only)
  const siblingIndex = siblingEssays.findIndex(e => e.id === essayId);
  const hasPrev = siblingIndex > 0;
  const hasNext = siblingIndex < siblingEssays.length - 1;

  const navBtn = "h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors";

  // ── Shared: prompt section (Change 1) ────────────────────────────────────────

  function PromptSection({ collapsible = false }: { collapsible?: boolean }) {
    return (
      <div className="border-b border-border">
        <div
          className={cn(
            "flex items-center justify-between px-6 py-3 bg-muted/40",
            collapsible && "cursor-pointer select-none"
          )}
          onClick={collapsible ? () => setPromptCollapsed(c => !c) : undefined}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Prompt</p>
          {collapsible && (
            <span className="text-muted-foreground/60 hover:text-muted-foreground transition-colors">
              {promptCollapsed
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronUp   className="h-3.5 w-3.5" />}
            </span>
          )}
        </div>
        {(!collapsible || !promptCollapsed) && (
          <div className="px-6 py-4 bg-muted/20">
            <p className="text-sm text-foreground leading-relaxed">
              {essay!.prompt || <span className="italic text-muted-foreground">No prompt added</span>}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Shared: word-count footer (Changes 2 & 5) ────────────────────────────────

  function CountFooter({ urgencyLevel = urgency }: { urgencyLevel?: "over" | "warn" | "ok" }) {
    return (
      <div className={cn(
        "flex items-center justify-between px-6 py-3 border-t border-border transition-colors",
        urgencyLevel === "over" ? "bg-red-50"   :
        urgencyLevel === "warn" ? "bg-amber-50" : "bg-muted/10"
      )}>
        <span className={cn(
          "text-xs tabular-nums",
          urgencyLevel === "over" ? "text-red-700 font-semibold" :
          urgencyLevel === "warn" ? "text-amber-700 font-medium" : "text-muted-foreground"
        )}>
          {words.toLocaleString()} words · {chars.toLocaleString()} characters
        </span>
        <span className={cn(
          "text-xs tabular-nums",
          urgencyLevel === "over" ? "text-red-700 font-semibold" :
          urgencyLevel === "warn" ? "text-amber-700" : "text-muted-foreground"
        )}>
          {over
            ? `${(words - essay!.word_limit).toLocaleString()} over limit`
            : `${remaining.toLocaleString()} words remaining`}
        </span>
      </div>
    );
  }

  // ── Counselor view ────────────────────────────────────────────────────────────

  if (viewMode === "counselor") {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">

        {/* Top bar */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => router.push(`/counselor/${essay.user_id}?tab=essays`)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {collegeName && (
            <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-foreground truncate max-w-xs">
              {collegeName}
            </span>
          )}
          <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground shrink-0">
            Read-only
          </span>
          <div className="flex-1" />
        </div>

        {/* Two-column layout */}
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <PromptSection />
            <div
              ref={essayTextRef}
              onMouseUp={handleTextSelect}
              className="px-6 py-5 text-sm leading-relaxed whitespace-pre-wrap select-text min-h-[420px] cursor-text"
            >
              {body.trim() === "" ? (
                <span className="text-muted-foreground italic">No content yet.</span>
              ) : (
                segments.map((seg, i) => {
                  if (!seg.commentId) return <span key={i}>{seg.text}</span>;
                  const color = HIGHLIGHT_COLORS[seg.colorIndex % HIGHLIGHT_COLORS.length];
                  return (
                    <mark key={i} data-comment={seg.commentId}
                      style={{ backgroundColor: color.bg, borderBottom: `2px solid ${color.border}`, borderRadius: "2px" }}
                      className="cursor-pointer"
                    >{seg.text}</mark>
                  );
                })
              )}
            </div>
            <CountFooter />
          </div>

          {/* Comment sidebar */}
          <div className="w-72 shrink-0 flex flex-col gap-3 sticky top-20">
            {activeComments.length === 0 && !pendingSelection && (
              <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-border">
                <MessageSquare className="h-7 w-7 text-muted-foreground/30 mb-2" />
                <p className="text-xs font-medium text-foreground mb-0.5">No comments yet</p>
                <p className="text-xs text-muted-foreground">Select text in the essay to add a comment.</p>
              </div>
            )}
            {activeComments.map((c) => {
              const color = HIGHLIGHT_COLORS[c.color_index % HIGHLIGHT_COLORS.length];
              return (
                <div key={c.id} onClick={() => scrollToComment(c.id)}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm cursor-pointer transition-colors hover:bg-muted/30"
                  style={{ borderLeft: `3px solid ${color.border}` }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-foreground">{c.counselor_name}</span>
                    <span className="text-[11px] text-muted-foreground">{formatDate(c.created_at)}</span>
                  </div>
                  <p className="text-[11px] italic leading-snug mb-2 rounded px-1.5 py-0.5"
                    style={{ backgroundColor: color.bg, color: "hsl(var(--foreground) / 0.7)" }}>
                    &ldquo;{truncateQuote(body.slice(c.start_offset, c.end_offset))}&rdquo;
                  </p>
                  <p className="text-xs text-foreground leading-snug">{c.text}</p>
                </div>
              );
            })}
            {pendingSelection && (
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm"
                style={{ borderLeft: `3px solid ${HIGHLIGHT_COLORS[pendingColorIndex].border}` }}
              >
                <p className="text-[11px] italic leading-snug mb-2 rounded px-1.5 py-0.5"
                  style={{ backgroundColor: HIGHLIGHT_COLORS[pendingColorIndex].bg, color: "hsl(var(--foreground) / 0.7)" }}>
                  &ldquo;{truncateQuote(body.slice(pendingSelection.start, pendingSelection.end))}&rdquo;
                </p>
                <textarea
                  ref={commentInputRef}
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment(); }}
                  placeholder="Add a comment…"
                  rows={3}
                  className="w-full text-xs bg-muted/50 rounded-md px-2 py-1.5 resize-none outline-none focus:ring-2 focus:ring-ring mb-2"
                />
                <div className="flex gap-2">
                  <button onClick={submitComment} disabled={submittingComment || !newCommentText.trim()}
                    className="text-xs font-semibold text-primary hover:text-primary/80 disabled:opacity-50 transition-colors">
                    {submittingComment ? "Posting…" : "Comment"}
                  </button>
                  <button onClick={() => { setPendingSelection(null); setNewCommentText(""); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {selectionInfo && typeof window !== "undefined" && createPortal(
          <button
            onMouseDown={(e) => { e.preventDefault(); openCommentInput(); }}
            className="fixed z-50 flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background shadow-lg hover:bg-foreground/90 transition-colors"
            style={{
              top: selectionInfo.rect.top - 40 + window.scrollY,
              left: selectionInfo.rect.left + selectionInfo.rect.width / 2,
              transform: "translateX(-50%)",
            }}
          >
            <MessageSquare className="h-3 w-3" />
            Comment
          </button>,
          document.body,
        )}
      </main>
    );
  }

  // ── Owner view — review mode (active comments) ───────────────────────────────

  if (activeComments.length > 0) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">

        {/* Top bar */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => router.push("/essays")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {collegeName && (
            <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-foreground truncate max-w-xs">
              {collegeName}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 shrink-0">
            <MessageSquare className="h-3 w-3" />
            {activeComments.length} comment{activeComments.length !== 1 ? "s" : ""}
          </span>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground shrink-0">
            {saving ? "Saving…" : savedAt ? "Saved" : ""}
          </span>
        </div>

        {/* Counselor comment banner */}
        {showBanner && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-sm text-foreground">Your counselor left a comment on this essay.</span>
            </div>
            <button
              onClick={() => { markEssayRead(essayId); setBannerDismissed(true); }}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Two-column layout */}
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <PromptSection />
            <div ref={essayTextRef} className="px-6 py-5 text-sm leading-relaxed whitespace-pre-wrap min-h-[420px]">
              {body.trim() === "" ? (
                <span className="text-muted-foreground italic">No content yet.</span>
              ) : (
                segments.map((seg, i) => {
                  if (!seg.commentId) return <span key={i}>{seg.text}</span>;
                  const color = HIGHLIGHT_COLORS[seg.colorIndex % HIGHLIGHT_COLORS.length];
                  return (
                    <mark key={i} data-comment={seg.commentId}
                      style={{ backgroundColor: color.bg, borderBottom: `2px solid ${color.border}`, borderRadius: "2px" }}
                    >{seg.text}</mark>
                  );
                })
              )}
            </div>
            <CountFooter />
          </div>

          {/* Comment sidebar */}
          <div className="w-72 shrink-0 flex flex-col gap-3 sticky top-20">
            {activeComments.map((c) => {
              const color = HIGHLIGHT_COLORS[c.color_index % HIGHLIGHT_COLORS.length];
              return (
                <div key={c.id} onClick={() => scrollToComment(c.id)}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm cursor-pointer transition-colors hover:bg-muted/30"
                  style={{ borderLeft: `3px solid ${color.border}` }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-foreground">{c.counselor_name}</span>
                    <span className="text-[11px] text-muted-foreground">{formatDate(c.created_at)}</span>
                  </div>
                  <p className="text-[11px] italic leading-snug mb-2 rounded px-1.5 py-0.5"
                    style={{ backgroundColor: color.bg, color: "hsl(var(--foreground) / 0.7)" }}>
                    &ldquo;{truncateQuote(body.slice(c.start_offset, c.end_offset))}&rdquo;
                  </p>
                  <p className="text-xs text-foreground leading-snug mb-3">{c.text}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); resolveComment(c.id); }}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Resolve
                  </button>
                </div>
              );
            })}
          </div>
        </div>

      </main>
    );
  }

  // ── Owner view — editor (no active comments) ──────────────────────────────────

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">

      {/* Top bar */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => router.push("/essays")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {collegeName && (
          <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-foreground truncate max-w-xs">
            {collegeName}
          </span>
        )}

        {/* Change 3: essay navigation */}
        {siblingEssays.length > 1 && siblingIndex !== -1 && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => router.push(`/essays/${siblingEssays[siblingIndex - 1].id}`)}
              disabled={!hasPrev} className={navBtn}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap px-0.5">
              {siblingIndex + 1} of {siblingEssays.length}
            </span>
            <button onClick={() => router.push(`/essays/${siblingEssays[siblingIndex + 1].id}`)}
              disabled={!hasNext} className={navBtn}>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex-1" />

        <span className="text-xs text-muted-foreground shrink-0">
          {saving ? "Saving…" : savedAt ? "Saved" : ""}
        </span>

        <button
          onClick={toggleFinal}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors shrink-0",
            isFinal
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <CheckCircle2 className={cn("h-3.5 w-3.5", isFinal ? "text-emerald-600" : "text-muted-foreground/50")} />
          {isFinal ? "Completed" : "Mark as Complete"}
        </button>
      </div>

      {/* Counselor comment banner */}
      {showBanner && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-sm text-foreground">Your counselor left a comment on this essay.</span>
          </div>
          <button
            onClick={() => { markEssayRead(essayId); setBannerDismissed(true); }}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Editor card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">

        {/* Change 1: collapsible prompt */}
        <PromptSection collapsible />

        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-3 py-2 border-b border-border bg-muted/10">
          <button onClick={handleBold}      title="Bold"      className={toolbarBtn}><Bold      className="h-3.5 w-3.5" /></button>
          <button onClick={handleItalic}    title="Italic"    className={toolbarBtn}><Italic    className="h-3.5 w-3.5" /></button>
          <button onClick={handleUnderline} title="Underline" className={toolbarBtn}><Underline className="h-3.5 w-3.5" /></button>
          <div className="mx-1.5 h-4 w-px bg-border" />
          <button onClick={handleUndo}      title="Undo"      className={toolbarBtn}><Undo2     className="h-3.5 w-3.5" /></button>
          <button onClick={handleRedo}      title="Redo"      className={toolbarBtn}><Redo2     className="h-3.5 w-3.5" /></button>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => handleBodyChange(e.target.value)}
          onBlur={handleBlur}
          placeholder="Start writing your essay…"
          className="w-full min-h-[420px] bg-background px-6 py-5 text-sm leading-relaxed resize-none focus:outline-none block"
        />

        {/* Changes 2 & 5: urgency-aware footer with word + char count */}
        <CountFooter />

      </div>

    </main>
  );
}
