"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, BookText, Loader2, MessageSquare, Search, ChevronRight, ArrowLeft, Minus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTrackedColleges } from "@/hooks/use-tracked-colleges";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CollegeLogo } from "@/components/college-logo";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Essay {
  id: string;
  college_id: string;
  prompt: string;
  word_limit: number;
  body: string;
  status: "not_started" | "drafting" | "final";
  created_at: string;
}

interface CollegeOption {
  id: string;
  name: string;
  location: string | null;
  website_url: string | null;
  logo_url: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function deriveStatus(essay: Essay): { label: string; className: string } {
  if (essay.status === "final")           return { label: "Done",        className: "bg-emerald-100 text-emerald-700" };
  if (!essay.body || !essay.body.trim()) return { label: "Not Started", className: "bg-slate-100 text-slate-500" };
  return                                         { label: "In Progress", className: "bg-amber-100 text-amber-700" };
}

function statusDotColor(essay: Essay): string {
  if (essay.status === "final") return "bg-emerald-400";
  if (essay.body && essay.body.trim()) return "bg-amber-400";
  return "bg-slate-300";
}

function wordCountClass(words: number, limit: number): string {
  if (words > limit)       return "text-red-600 font-semibold";
  if (words >= limit - 50) return "text-amber-600 font-semibold";
  return "text-muted-foreground";
}

// ── Add Essay Modal ───────────────────────────────────────────────────────────

interface AddEssayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colleges: CollegeOption[];
  essayCountsByCollege: Record<string, number>;
  lockedCollegeId: string | null;
  onCreated: (essayId: string, collegeId: string) => void;
}

type Step = "school" | "prompt";

function AddEssayModal({ open, onOpenChange, colleges, essayCountsByCollege, lockedCollegeId, onCreated }: AddEssayModalProps) {
  const [supabase] = useState(() => createClient());
  const { profile } = useProfile();

  const [step, setStep] = useState<Step>("school");
  const [selectedCollege, setSelectedCollege] = useState<CollegeOption | null>(null);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [wordLimit, setWordLimit] = useState(650);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => colleges.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [colleges, search]
  );

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setPrompt("");
    setWordLimit(650);
    setError(null);
    setActiveIndex(0);

    if (lockedCollegeId) {
      const found = colleges.find((c) => c.id === lockedCollegeId) ?? null;
      setSelectedCollege(found);
      setStep("prompt");
    } else {
      setSelectedCollege(null);
      setStep("school");
    }
  }, [open, lockedCollegeId, colleges]);

  // Focus search on step 1
  useEffect(() => {
    if (open && step === "school") {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open, step]);

  // Reset active index when search changes
  useEffect(() => {
    setActiveIndex(0);
  }, [search]);

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (step !== "school") return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[activeIndex]) {
      selectCollege(filtered[activeIndex]);
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function selectCollege(college: CollegeOption) {
    setSelectedCollege(college);
    setStep("prompt");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCollege || !prompt.trim() || !profile) return;
    setSubmitting(true);
    setError(null);

    const { data, error: insertError } = await (supabase as any)
      .from("essays")
      .insert({
        user_id: profile.id,
        college_id: selectedCollege.id,
        prompt: prompt.trim(),
        word_limit: wordLimit,
      })
      .select("id")
      .single();

    if (insertError || !data) {
      setError("Failed to create essay. Please try again.");
      setSubmitting(false);
      return;
    }

    onCreated((data as { id: string }).id, selectedCollege.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="p-0 gap-0 max-w-lg sm:max-w-lg overflow-hidden rounded-2xl">

        {/* ── Step 1: School picker ─────────────────────────────────────── */}
        {step === "school" && (
          <div onKeyDown={handleKeyDown}>
            {/* Search bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your schools…"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
              <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                esc
              </kbd>
            </div>

            {/* College list */}
            <div className="py-2">
              {colleges.length > 0 && (
                <p className="px-4 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Your Schools
                </p>
              )}

              <div ref={listRef} className="max-h-72 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">No schools match "{search}"</p>
                ) : (
                  filtered.map((college, i) => {
                    const essayCount = essayCountsByCollege[college.id] ?? 0;
                    const isActive = i === activeIndex;

                    return (
                      <button
                        key={college.id}
                        onClick={() => selectCollege(college)}
                        onMouseEnter={() => setActiveIndex(i)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 transition-colors text-left",
                          isActive ? "bg-primary/8" : "hover:bg-muted/40"
                        )}
                      >
                        <CollegeLogo
                          name={college.name}
                          website_url={college.website_url}
                          logo_url={college.logo_url}
                          size={36}
                        />

                        {/* Name + location */}
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium truncate", isActive ? "text-primary" : "text-foreground")}>
                            {college.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {college.location ?? ""}
                            {college.location ? " · " : ""}
                            {essayCount > 0
                              ? `${essayCount} essay${essayCount !== 1 ? "s" : ""} added`
                              : "no essays yet"}
                          </p>
                        </div>

                        <ChevronRight className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground/40")} />
                      </button>
                    );
                  })
                )}
              </div>

              {/* Add school prompt */}
              {colleges.length === 0 && (
                <button
                  onClick={() => onOpenChange(false)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                >
                  <div className="h-9 w-9 rounded-lg border-2 border-dashed border-border flex items-center justify-center shrink-0">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Add a school to your tracker first</p>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Prompt + word limit ───────────────────────────────── */}
        {step === "prompt" && selectedCollege && (
          <form onSubmit={handleSubmit} className="flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
              {!lockedCollegeId && (
                <button
                  type="button"
                  onClick={() => setStep("school")}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <CollegeLogo
                name={selectedCollege.name}
                website_url={selectedCollege.website_url}
                logo_url={selectedCollege.logo_url}
                size={28}
              />
              <p className="text-sm font-medium text-foreground truncate">{selectedCollege.name}</p>
            </div>

            <div className="flex flex-col gap-4 px-5 py-4">
              {/* Prompt */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Essay Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Paste the essay prompt here…"
                  required
                  rows={4}
                  autoFocus
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Word limit stepper */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Word Limit</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWordLimit((w) => Math.max(50, w - 50))}
                    className="h-8 w-8 rounded-lg border border-input bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="number"
                    value={wordLimit}
                    onChange={(e) => setWordLimit(Math.max(50, Math.round(parseInt(e.target.value) / 50) * 50 || 50))}
                    step={50}
                    min={50}
                    className="h-8 w-20 rounded-lg border border-input bg-background px-3 text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setWordLimit((w) => w + 50)}
                    className="h-8 w-8 rounded-lg border border-input bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="h-9 rounded-lg px-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !prompt.trim()}
                  className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {submitting ? "Creating…" : "Create & Open"}
                </button>
              </div>
            </div>
          </form>
        )}

      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function EssaysPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());
  const { trackedColleges, hydrated } = useTrackedColleges();
  const { profile } = useProfile();

  const [essays, setEssays] = useState<Essay[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [lockedCollegeId, setLockedCollegeId] = useState<string | null>(null);
  const [selectedCollegeId, setSelectedCollegeId] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("add") === "true") setAddOpen(true);
    const collegeParam = searchParams.get("college");
    if (collegeParam) setSelectedCollegeId(collegeParam);
  }, [searchParams]);

  const fetchEssays = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("essays")
      .select("id, college_id, prompt, word_limit, body, status, created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: true });
    const essayList = (data ?? []) as Essay[];
    setEssays(essayList);

    if (essayList.length > 0) {
      const { data: commentData } = await supabase
        .from("essay_comments")
        .select("essay_id")
        .in("essay_id", essayList.map((e) => e.id))
        .eq("resolved", false);
      if (commentData) {
        const counts: Record<string, number> = {};
        for (const row of commentData as { essay_id: string }[]) {
          counts[row.essay_id] = (counts[row.essay_id] ?? 0) + 1;
        }
        setCommentCounts(counts);
      }
    }

    setLoading(false);
  }, [profile, supabase]);

  useEffect(() => {
    if (profile) fetchEssays();
  }, [profile, fetchEssays]);

  const groupedByCollege = useMemo(() => {
    const map = new Map<string, Essay[]>();
    for (const e of essays) {
      const arr = map.get(e.college_id) ?? [];
      arr.push(e);
      map.set(e.college_id, arr);
    }
    return map;
  }, [essays]);

  const collegesWithEssays = useMemo(
    () => trackedColleges.filter((c) => groupedByCollege.has(c.id)),
    [trackedColleges, groupedByCollege]
  );

  const collegeOptions = useMemo<CollegeOption[]>(
    () => trackedColleges.map((c) => ({ id: c.id, name: c.name, location: c.location, website_url: c.website_url, logo_url: c.logo_url })),
    [trackedColleges]
  );

  const essayCountsByCollege = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [collegeId, essayList] of groupedByCollege) {
      counts[collegeId] = essayList.length;
    }
    return counts;
  }, [groupedByCollege]);

  // Auto-select first college
  useEffect(() => {
    if (collegesWithEssays.length > 0 && !selectedCollegeId) {
      setSelectedCollegeId(collegesWithEssays[0].id);
    }
  }, [collegesWithEssays.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCollege = useMemo(
    () => trackedColleges.find((c) => c.id === selectedCollegeId) ?? null,
    [trackedColleges, selectedCollegeId]
  );

  const selectedEssays = selectedCollegeId ? (groupedByCollege.get(selectedCollegeId) ?? []) : [];

  function handleAddEssay(collegeId: string) {
    setLockedCollegeId(collegeId);
    setAddOpen(true);
  }

  function handleModalClose(open: boolean) {
    if (!open) setLockedCollegeId(null);
    setAddOpen(open);
  }

  function handleCreated(essayId: string) {
    router.push(`/essays/${essayId}`);
  }

  const showLoader = !hydrated || loading;

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-r border-border bg-card overflow-y-auto sticky top-16 h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="px-4 py-4 border-b border-border">
          <h1 className="text-sm font-semibold text-foreground">My Essays</h1>
          {!showLoader && essays.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {essays.length} essay{essays.length !== 1 ? "s" : ""} · {collegesWithEssays.length} school{collegesWithEssays.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* College list */}
        {showLoader ? (
          <div className="p-3 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : collegesWithEssays.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-muted-foreground">No essays yet</p>
          </div>
        ) : (
          <div>
            {collegesWithEssays.map((college) => {
              const essayList = groupedByCollege.get(college.id) ?? [];
              const isActive = selectedCollegeId === college.id;
              return (
                <button
                  key={college.id}
                  onClick={() => setSelectedCollegeId(college.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-l-2 transition-colors",
                    isActive ? "border-primary bg-primary/8" : "border-transparent hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={cn("text-sm font-medium truncate", isActive ? "text-primary" : "text-foreground")}>
                      {college.name}
                    </span>
                    <span className="text-xs bg-muted rounded-full px-1.5 py-0.5 ml-2 shrink-0 tabular-nums">
                      {essayList.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {essayList.map((e) => (
                      <span key={e.id} className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusDotColor(e))} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </aside>

      {/* ── Right panel ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 px-8 py-8">
        {showLoader ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : collegesWithEssays.length === 0 ? (
          /* Empty state — no essays at all */
          <div className="flex flex-col items-center justify-center h-full text-center py-24">
            <BookText className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No essays yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              {collegeOptions.length === 0
                ? "Add colleges to your tracker first, then come back to write essays."
                : "Select a school and add your first essay."}
            </p>
            {collegeOptions.length > 0 && (
              <button
                onClick={() => { setLockedCollegeId(null); setAddOpen(true); }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Essay
              </button>
            )}
          </div>
        ) : selectedCollege ? (
          /* Selected college panel */
          <div>
            {/* College header + contextual add button */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <CollegeLogo
                  name={selectedCollege.name}
                  website_url={selectedCollege.website_url}
                  logo_url={selectedCollege.logo_url}
                  size={36}
                />
                <h2 className="text-xl font-bold text-foreground">{selectedCollege.name}</h2>
              </div>
              <button
                onClick={() => handleAddEssay(selectedCollege.id)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 h-10 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                Add Essay
              </button>
            </div>

            {/* Essays list */}
            {selectedEssays.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-border">
                <BookText className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm font-medium text-foreground mb-1">No essays yet</p>
                <p className="text-xs text-muted-foreground">Click the button above to add your first essay for this school.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="divide-y divide-border">
                  {selectedEssays.map((essay) => {
                    const words = countWords(essay.body);
                    const status = deriveStatus(essay);
                    const unresolvedCount = commentCounts[essay.id] ?? 0;

                    return (
                      <button
                        key={essay.id}
                        onClick={() => router.push(`/essays/${essay.id}`)}
                        className="w-full text-left px-5 py-4 hover:bg-muted/20 transition-colors group"
                      >
                        <p className="text-sm text-foreground line-clamp-2 leading-snug mb-2.5">
                          {essay.prompt || <span className="text-muted-foreground italic">No prompt</span>}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className={cn("text-[11px] tabular-nums flex-1 min-w-0", wordCountClass(words, essay.word_limit))}>
                            {words} / {essay.word_limit} words
                          </p>
                          {unresolvedCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                              <MessageSquare className="h-3 w-3" />
                              {unresolvedCount}
                            </span>
                          )}
                          <span className={cn("shrink-0 text-[11px] font-semibold rounded-full px-2.5 py-0.5", status.className)}>
                            {status.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <AddEssayModal
        open={addOpen}
        onOpenChange={handleModalClose}
        colleges={collegeOptions}
        essayCountsByCollege={essayCountsByCollege}
        lockedCollegeId={lockedCollegeId}
        onCreated={handleCreated}
      />
    </div>
  );
}

export default function EssaysPage() {
  return (
    <Suspense>
      <EssaysPageInner />
    </Suspense>
  );
}
