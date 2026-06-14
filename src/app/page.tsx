"use client";

import Link from "next/link";
import Footer from "@/components/footer";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { AnimatePresence, motion } from "framer-motion";
import { CollegeLogo } from "@/components/college-logo";
import {
  CalendarDays,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Search,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Sparkles,
  ExternalLink,
  X,
  Settings,
  Bold,
  Italic,
  Underline,
  Undo2,
  Redo2,
  ListChecks,
  RefreshCw,
} from "lucide-react";

// ── Motion variants ───────────────────────────────────────────────────────────

// ── Scroll reveal wrappers ────────────────────────────────────────────────────
// Content must always be visible. Prior versions used IntersectionObserver to
// gate opacity:0 → 1 on scroll, but the observer didn't fire reliably for
// sections below the fold (or under a hydration race), leaving the hero and
// most of the page invisible. Both wrappers are now plain passthroughs.

function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  stagger?: boolean;
}) {
  return <div className={className}>{children}</div>;
}

// ── Mock stat card ────────────────────────────────────────────────────────────

function MockStatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 flex flex-col gap-1 shadow-sm">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-3xl font-bold tabular-nums ${accent ?? "text-foreground"}`}>{value}</span>
    </div>
  );
}

// ── Mock table row ────────────────────────────────────────────────────────────

function MockRow({
  name, rate, category, catColor,
  status, statusColor,
  round, roundColor,
  decision, decisionColor,
  deadline,
}: {
  name: string; rate: string;
  category: string; catColor: string;
  status: string; statusColor: string;
  round: string; roundColor: string;
  decision: string; decisionColor: string;
  deadline: string;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="pl-4 pr-3 py-3.5"><span className="text-sm font-medium text-foreground">{name}</span></td>
      <td className="px-4 py-3.5 text-sm text-muted-foreground tabular-nums">{rate}</td>
      <td className="px-4 py-3.5"><span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${catColor}`}>{category}</span></td>
      <td className="px-4 py-3.5"><span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${statusColor}`}>{status}</span></td>
      <td className="px-4 py-3.5"><span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${roundColor}`}>{round}</span></td>
      <td className="px-4 py-3.5"><span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${decisionColor}`}>{decision}</span></td>
      <td className="px-4 py-3.5 text-xs text-muted-foreground tabular-nums">{deadline}</td>
      <td className="pl-2 pr-4 py-3.5">
        <button className="text-muted-foreground/30">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ── Mock dashboard data ────────────────────────────────────────────────────────

const RC  = "text-[hsl(0,65%,42%)] bg-[hsl(0,65%,96%)] border-[hsl(0,65%,80%)]";
const HC  = "text-[hsl(38,85%,35%)] bg-[hsl(38,85%,95%)] border-[hsl(38,85%,75%)]";
const MC  = "text-[hsl(213,80%,40%)] bg-[hsl(213,80%,95%)] border-[hsl(213,80%,75%)]";
const SC  = "text-[hsl(142,60%,30%)] bg-[hsl(142,60%,95%)] border-[hsl(142,60%,78%)]";
const SUB = "text-[hsl(205,85%,50%)] bg-[hsl(205,85%,96%)] border-[hsl(205,85%,78%)]";
const INP = "text-[hsl(38,85%,35%)] bg-[hsl(38,85%,95%)] border-[hsl(38,85%,75%)]";
const MUT = "text-muted-foreground bg-muted border-border";
const REA = "text-[hsl(262,60%,40%)] bg-[hsl(262,60%,95%)] border-[hsl(262,60%,78%)]";
const RED = "text-[hsl(215,75%,45%)] bg-[hsl(215,75%,95%)] border-[hsl(215,75%,78%)]";
const RRD = "text-[hsl(160,55%,32%)] bg-[hsl(160,55%,94%)] border-[hsl(160,55%,72%)]";
const PEN = "text-[hsl(220,70%,28%)] bg-[hsl(220,70%,95%)] border-[hsl(220,70%,72%)]";
const ACC = "text-[hsl(142,60%,30%)] bg-[hsl(142,60%,95%)] border-[hsl(142,60%,78%)]";
const WAI = "text-[hsl(38,85%,35%)] bg-[hsl(38,85%,95%)] border-[hsl(38,85%,75%)]";

const MOCK_ROWS = [
  { name: "Harvard",    rate: "3.2%",  category: "Reach",      catColor: RC, status: "Submitted",   statusColor: SUB, round: "EA", roundColor: REA, decision: "Accepted",   decisionColor: ACC, deadline: "Nov 1"  },
  { name: "MIT",        rate: "3.9%",  category: "Reach",      catColor: RC, status: "Submitted",   statusColor: SUB, round: "ED", roundColor: RED, decision: "Pending",    decisionColor: PEN, deadline: "Jan 1"  },
  { name: "Stanford",   rate: "3.7%",  category: "Reach",      catColor: RC, status: "In Progress", statusColor: INP, round: "RD", roundColor: RRD, decision: "—",          decisionColor: MUT, deadline: "Jan 2"  },
  { name: "UCLA",       rate: "8.6%",  category: "Reach",      catColor: RC, status: "Submitted",   statusColor: SUB, round: "RD", roundColor: RRD, decision: "Waitlisted", decisionColor: WAI, deadline: "Nov 30" },
  { name: "UMich",      rate: "17.7%", category: "High Match", catColor: HC, status: "Submitted",   statusColor: SUB, round: "RD", roundColor: RRD, decision: "Rejected",   decisionColor: RC,  deadline: "Feb 1"  },
  { name: "UT Austin",  rate: "31%",   category: "Match",      catColor: MC, status: "Submitted",   statusColor: SUB, round: "RD", roundColor: RRD, decision: "Accepted",   decisionColor: ACC, deadline: "Dec 1"  },
  { name: "Ohio State", rate: "49%",   category: "Safety",     catColor: SC, status: "In Progress", statusColor: INP, round: "EA", roundColor: REA, decision: "—",          decisionColor: MUT, deadline: "Feb 15" },
  { name: "Penn State", rate: "54%",   category: "Safety",     catColor: SC, status: "Not Started", statusColor: MUT, round: "—",  roundColor: MUT, decision: "—",          decisionColor: MUT, deadline: "Mar 1"  },
];

// ── Animated dashboard preview ────────────────────────────────────────────────

const MUTED_BTN = { color: "hsl(215,15%,50%)", backgroundColor: "hsl(210,20%,92%)", borderColor: "hsl(214,25%,90%)" };
const REACH_BTN = { color: "hsl(0,65%,42%)",   backgroundColor: "hsl(0,65%,96%)",   borderColor: "hsl(0,65%,80%)"   };
const INP_BTN   = { color: "hsl(38,85%,35%)",  backgroundColor: "hsl(38,85%,95%)",  borderColor: "hsl(38,85%,75%)"  };
const RD_BTN    = { color: "hsl(160,55%,32%)", backgroundColor: "hsl(160,55%,94%)", borderColor: "hsl(160,55%,72%)" };

function DashboardPreview() {
  const [searchText, setSearchText]     = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewRow, setShowNewRow]     = useState(false);
  const [highlightNew, setHighlightNew] = useState(false);
  const [collegeCount, setCollegeCount] = useState(8);
  const [dukeCat, setDukeCat]           = useState("—");
  const [dukeStatus, setDukeStatus]     = useState("Not Started");
  const [dukeRound, setDukeRound]       = useState("—");
  const [trashHovered, setTrashHovered] = useState(false);
  const [cursorPos, setCursorPos]       = useState({ x: 0, y: 0 });
  const [cursorVisible, setCursorVisible]   = useState(false);
  const [cursorClicking, setCursorClicking] = useState(false);

  const containerRef      = useRef<HTMLDivElement>(null);
  const searchInputRef    = useRef<HTMLDivElement>(null);
  const dropdownResultRef = useRef<HTMLDivElement>(null);
  const catCellRef        = useRef<HTMLTableCellElement>(null);
  const statusCellRef     = useRef<HTMLTableCellElement>(null);
  const roundCellRef      = useRef<HTMLTableCellElement>(null);
  const trashBtnRef       = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let mounted = true;
    const timers: ReturnType<typeof setTimeout>[] = [];

    function t(fn: () => void, ms: number) {
      const id = setTimeout(() => { if (mounted) fn(); }, ms);
      timers.push(id);
    }

    function getElPos(ref: { current: HTMLElement | null }) {
      if (!ref.current || !containerRef.current) return null;
      const cr = ref.current.getBoundingClientRect();
      const pr = containerRef.current.getBoundingClientRect();
      return { x: cr.left - pr.left + 22, y: cr.top - pr.top + cr.height / 2 };
    }

    function click(onDone: () => void) {
      setCursorClicking(true);
      t(() => setCursorClicking(false), 90);
      t(onDone, 140);
    }

    function moveTo(ref: { current: HTMLElement | null }, offsetX = 0, offsetY = 0) {
      const pos = getElPos(ref);
      if (pos) setCursorPos({ x: pos.x + offsetX, y: pos.y + offsetY });
    }

    function cycle() {
      if (!mounted) return;
      setSearchText(""); setShowDropdown(false);
      setShowNewRow(false); setHighlightNew(false); setCollegeCount(8);
      setDukeCat("—"); setDukeStatus("Not Started"); setDukeRound("—");
      setTrashHovered(false);
      setCursorVisible(false);

      const name = "Duke University";
      let d = 1000;

      for (let i = 0; i < name.length; i++) {
        const n = i + 1;
        t(() => setSearchText(name.slice(0, n)), d + i * 65);
      }
      d += name.length * 65 + 300;

      t(() => setShowDropdown(true), d);

      t(() => {
        const pos = getElPos(searchInputRef);
        if (pos) { setCursorPos({ x: pos.x, y: pos.y }); setCursorVisible(true); }
      }, d + 150);
      t(() => moveTo(dropdownResultRef), d + 220);
      d += 850;

      t(() => click(() => {
        setShowDropdown(false); setSearchText("");
        setShowNewRow(true); setHighlightNew(true); setCollegeCount(9);
      }), d);
      d += 900;

      t(() => {
        const pos = getElPos(catCellRef);
        if (pos) { setCursorPos({ x: pos.x - 55, y: pos.y - 28 }); }
      }, d);
      t(() => moveTo(catCellRef), d + 60);
      d += 600;

      t(() => click(() => { setDukeCat("Reach"); setHighlightNew(false); }), d);
      d += 650;

      t(() => moveTo(statusCellRef), d);
      d += 520;

      t(() => click(() => setDukeStatus("In Progress")), d);
      d += 650;

      t(() => moveTo(roundCellRef), d);
      d += 520;

      t(() => click(() => setDukeRound("RD")), d);
      d += 1100;

      t(() => moveTo(trashBtnRef, -20, 0), d);
      t(() => setTrashHovered(true), d + 420);
      d += 550;

      t(() => click(() => { setTrashHovered(false); setShowNewRow(false); setCollegeCount(8); }), d);
      d += 700;

      t(() => setCursorVisible(false), d);
      d += 300;

      t(cycle, d);
    }

    t(cycle, 0);
    return () => { mounted = false; timers.forEach(clearTimeout); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitted = 5;
  const catStyle    = dukeCat    === "Reach"        ? REACH_BTN : MUTED_BTN;
  const statusStyle = dukeStatus === "In Progress"  ? INP_BTN   : MUTED_BTN;
  const roundStyle  = dukeRound  === "RD"           ? RD_BTN    : MUTED_BTN;

  return (
    <div ref={containerRef} className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden relative" style={{ minHeight: "1060px" }}>

      {/* ── Animated cursor ── */}
      <motion.div
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 100 }}
        animate={{
          x: cursorPos.x, y: cursorPos.y,
          opacity: cursorVisible ? 1 : 0,
          scale: cursorClicking ? 0.8 : 1,
        }}
        transition={{
          x: { duration: 0.42, ease: "easeInOut" },
          y: { duration: 0.42, ease: "easeInOut" },
          opacity: { duration: 0.2 },
          scale: { duration: 0.09 },
        }}
      >
        <svg width="14" height="20" viewBox="0 0 14 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 1L2 17L5.5 13L8.5 20L11 19L8 12L13.5 12L2 1Z"
            fill="white" stroke="#1f2937" strokeWidth="1.5"
            strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </motion.div>

      {/* Mock browser chrome */}
      <div className="border-b border-border bg-card px-6 py-4 flex items-center gap-3">
        <div className="h-3 w-3 rounded-full bg-destructive/50" />
        <div className="h-3 w-3 rounded-full bg-[hsl(38,85%,55%)]/60" />
        <div className="h-3 w-3 rounded-full bg-[hsl(142,60%,45%)]/60" />
      </div>

      <div className="p-6">
        <div className="mb-5">
          <div className="text-lg font-bold text-foreground mb-0.5">My College List</div>
          <div className="text-xs text-muted-foreground">Tracking {collegeCount} colleges</div>
        </div>

        {/* Search + Add */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <div ref={searchInputRef} className={`h-11 w-full rounded-xl border bg-card pl-9 pr-4 text-sm flex items-center transition-all ${searchText ? "border-primary/50 ring-2 ring-ring/20" : "border-border"}`}>
              {searchText ? (
                <span className="text-foreground">{searchText}<span className="inline-block w-0.5 h-4 bg-foreground ml-0.5 animate-pulse" /></span>
              ) : (
                <span className="text-muted-foreground">Search for a college to track...</span>
              )}
            </div>
            <AnimatePresence>
              {showDropdown && (
                <motion.div key="dropdown"
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 top-full z-50 mt-1.5 rounded-xl border border-border bg-card shadow-md overflow-hidden"
                >
                  <div ref={dropdownResultRef} className="flex items-center gap-3 px-4 py-2.5 bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">Duke University</p>
                      <p className="text-xs text-muted-foreground">Durham, NC <span className="ml-2 font-mono">6.4% acceptance</span></p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-primary px-4 h-11 text-sm font-semibold text-primary-foreground whitespace-nowrap shrink-0 select-none">
            <Plus className="h-4 w-4" />
            Add College
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
          <MockStatCard label="Colleges"   value={String(collegeCount)} />
          <MockStatCard label="Submitted"  value={String(submitted)} accent="text-[hsl(205,85%,45%)]" />
          <MockStatCard label="Accepted"   value="2" accent="text-[hsl(142,60%,35%)]" />
          <MockStatCard label="Waitlisted" value="1" accent="text-[hsl(38,85%,35%)]" />
          <MockStatCard label="Rejected"   value="1" accent="text-[hsl(0,65%,45%)]" />
        </div>

        {/* Progress bar */}
        <div className="rounded-xl border border-border bg-card px-5 py-4 mb-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Application Progress</span>
            <span className="text-sm text-muted-foreground tabular-nums">{submitted} of {collegeCount} submitted</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-in-out"
              style={{ width: `${(submitted / collegeCount) * 100}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{collegeCount - submitted} remaining</p>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left pl-4 pr-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">University</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Acceptance</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Category</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Application</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Round</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Decision</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Deadline</th>
                <th className="py-2.5 pr-4" />
              </tr>
            </thead>
            <tbody>
              {MOCK_ROWS.map((row) => <MockRow key={row.name} {...row} />)}
              <AnimatePresence>
                {showNewRow && (
                  <motion.tr key="duke"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                    className={`transition-colors duration-[1000ms] ${highlightNew ? "bg-primary/[0.05]" : "bg-transparent"}`}
                  >
                    <td className="pl-4 pr-3 py-3.5">
                      <span className="text-sm font-medium text-foreground">Duke University</span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground tabular-nums">6.4%</td>
                    <td ref={catCellRef} className="px-4 py-3.5">
                      <button className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-300" style={catStyle}>
                        {dukeCat}<ChevronDown className="h-3 w-3 opacity-50" />
                      </button>
                    </td>
                    <td ref={statusCellRef} className="px-4 py-3.5">
                      <button className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-300" style={statusStyle}>
                        {dukeStatus}<ChevronDown className="h-3.5 w-3.5 opacity-60" />
                      </button>
                    </td>
                    <td ref={roundCellRef} className="px-4 py-3.5">
                      <button className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-300" style={roundStyle}>
                        {dukeRound}<ChevronDown className="h-3 w-3 opacity-50" />
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${MUT}`}>—</span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">Jan 5</td>
                    <td className="pl-2 pr-4 py-3.5">
                      <button ref={trashBtnRef} className={`transition-colors ${trashHovered ? "text-destructive/70" : "text-muted-foreground/30"}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </motion.tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Mock assistant panel ──────────────────────────────────────────────────────

const ASSISTANT_MESSAGES = [
  { role: "user",      text: "Which of my Reach schools should I prioritize for Early Action?" },
  { role: "assistant", text: "Based on your list, Harvard and MIT both offer Restrictive Early Action: you can only apply EA to one of them. Harvard's RAEA acceptance rate was ~7.4% vs MIT's 4.7%.\n\nIf research is central to your application, MIT may align better. Harvard gives more weight to leadership and community impact. One thing to note: MIT's RAEA is Non-Restrictive for public schools, so you could still apply EA to any public university alongside it." },
  { role: "user",      text: "Help me brainstorm a stronger 'Why Northwestern' angle for Medill." },
  { role: "assistant", text: "Strong start with your current draft. A few angles to sharpen it:\n\n• Name the Journalism Residency city or outlet you'd target; readers respond to specificity.\n• If you're pairing journalism with another field, mention the dual-degree option explicitly.\n• Reference a faculty member's published work you've actually read.\n\nYour opening, 'Northwestern's Medill School,' is a solid anchor. The next move is making it personal: what story have you already reported that proves you belong in that newsroom?" },
];

function MockAssistantPanel() {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden w-full max-w-3xl mx-auto">
      <div className="border-b border-border bg-card px-5 py-3 flex items-center gap-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-destructive/50" />
        <div className="h-2.5 w-2.5 rounded-full bg-[hsl(38,85%,55%)]/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-[hsl(142,60%,45%)]/60" />
      </div>
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">Trailr Assistant</span>
          </div>
          <span className="text-xs text-muted-foreground">Personalized to your college list</span>
        </div>
        {ASSISTANT_MESSAGES.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" ? (
              <div className="flex items-start gap-2.5 max-w-[90%]">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-muted/50 border border-border px-4 py-3">
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">{msg.text}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-3 max-w-[70%]">
                <p className="text-xs text-primary-foreground leading-relaxed">{msg.text}</p>
              </div>
            )}
          </div>
        ))}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 mt-1">
          <span className="text-xs text-muted-foreground flex-1">Ask anything about your applications...</span>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <ArrowRight className="h-3.5 w-3.5 text-primary" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mock calendar ─────────────────────────────────────────────────────────────

const JAN_FIRST_DAY = 4;
const JAN_DAYS = 31;
const JAN_TOTAL_CELLS = 35;
const JAN_DOT_COLORS: Record<number, string> = {
  1:  "bg-destructive",
  3:  "bg-destructive",
  5:  "bg-destructive",
  8:  "bg-destructive",
  21: "bg-[hsl(38,85%,50%)]",
  25: "bg-[hsl(38,85%,50%)]",
};
const JAN_DEADLINE_DAYS = new Set(Object.keys(JAN_DOT_COLORS).map(Number));
const CAL_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function MockCalendar() {
  return (
    <div className="flex flex-col gap-4 w-full sm:w-96">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-foreground">January 2026</span>
          <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {CAL_DAYS.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {Array.from({ length: JAN_TOTAL_CELLS }, (_, i) => {
            const day = i - JAN_FIRST_DAY + 1;
            const inMonth = day >= 1 && day <= JAN_DAYS;
            const selected = day === 1;
            const hasDot = inMonth && JAN_DEADLINE_DAYS.has(day);
            return (
              <div
                key={i}
                className={`relative flex flex-col items-center justify-center h-11 w-full rounded-md text-sm select-none
                  ${!inMonth ? "invisible" : ""}
                  ${selected ? "bg-primary text-primary-foreground font-semibold" : "text-foreground"}
                `}
              >
                {inMonth ? day : ""}
                {hasDot && (
                  <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full
                    ${selected ? "bg-primary-foreground" : (JAN_DOT_COLORS[day] ?? "bg-[hsl(142,60%,45%)]")}`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 border-t border-border pt-3 space-y-1">
          {["Harvard", "Princeton"].map((name) => (
            <div key={name} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-destructive" />
              <span className="text-xs text-foreground">{name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            Upcoming Deadlines{" "}
            <span className="text-xs font-normal text-muted-foreground">(next 7 days)</span>
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Jan 5</p>
          {["Columbia", "Cornell", "MIT"].map((name) => (
            <div key={name} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-muted/50 transition-colors">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
              <span className="text-xs text-foreground">{name}</span>
            </div>
          ))}
          <div className="my-2 border-t border-border" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Jan 8</p>
          <div className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-muted/50 transition-colors">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
            <span className="text-xs text-foreground">Carnegie Mellon</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mock essay panel ──────────────────────────────────────────────────────────

const toolbarBtnCls = "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors";

function MockEssayPanel() {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden w-full">
      {/* Browser chrome */}
      <div className="border-b border-border bg-card px-5 py-3 flex items-center gap-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-destructive/50" />
        <div className="h-2.5 w-2.5 rounded-full bg-[hsl(38,85%,55%)]/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-[hsl(142,60%,45%)]/60" />
      </div>

      <div className="p-5">
        {/* Top bar — matches owner editor view */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm shrink-0 select-none">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 pl-1.5 pr-3 py-1 text-xs font-medium text-foreground truncate">
            <CollegeLogo name="Northwestern University" website_url="https://www.northwestern.edu" size={24} />
            Northwestern University
          </span>
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm shrink-0 select-none">
            <Sparkles className="h-3 w-3" />
            Research Brief
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm shrink-0 select-none">
            <Settings className="h-3 w-3" />
            Edit Settings
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm shrink-0 select-none">
            <CheckCircle2 className="h-3 w-3 text-muted-foreground/50" />
            Mark as Complete
          </div>
        </div>

        {/* Editor card */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">

          {/* Prompt section */}
          <div className="border-b border-border">
            <div className="px-5 py-2.5 bg-muted/40">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Prompt</p>
            </div>
            <div className="px-5 py-3.5 bg-muted/20">
              <p className="text-xs text-foreground leading-relaxed">
                Why Northwestern? What aspects of the Northwestern curriculum or community make it a good fit for you? (250 words)
              </p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-0.5 px-3 py-2 border-b border-border bg-muted/10">
            <button className={toolbarBtnCls}><Bold      className="h-3.5 w-3.5" /></button>
            <button className={toolbarBtnCls}><Italic    className="h-3.5 w-3.5" /></button>
            <button className={toolbarBtnCls}><Underline className="h-3.5 w-3.5" /></button>
            <div className="mx-1.5 h-4 w-px bg-border" />
            <button className={toolbarBtnCls}><Undo2     className="h-3.5 w-3.5" /></button>
            <button className={toolbarBtnCls}><Redo2     className="h-3.5 w-3.5" /></button>
          </div>

          {/* Essay body — plain text, no counselor highlights */}
          <div className="px-5 py-5 text-sm leading-relaxed text-foreground bg-background">
            Northwestern&apos;s Medill School of Journalism has defined what I want from a college education. Since founding my high school paper junior year, I&apos;ve understood that the combination of rigorous academic theory and hands-on reporting is what I need to grow as a journalist. Medill&apos;s dual-degree programs and proximity to Chicago give me exactly that: a city where every neighborhood is a story waiting to be told. Northwestern is the only place I can pursue journalism at this level while staying close to a world-class urban beat.
          </div>

          {/* Word count footer */}
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-border bg-muted/10">
            <span className="text-[11px] text-muted-foreground tabular-nums">178 words · 1,021 characters</span>
            <span className="text-[11px] text-muted-foreground tabular-nums">72 words remaining</span>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Mock list panel ───────────────────────────────────────────────────────────

function MockListPanel() {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
      <div className="border-b border-border bg-card px-5 py-3 flex items-center gap-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-destructive/50" />
        <div className="h-2.5 w-2.5 rounded-full bg-[hsl(38,85%,55%)]/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-[hsl(142,60%,45%)]/60" />
      </div>
      <div className="p-4 flex flex-col gap-3 bg-background">
        {/* Page header row */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-foreground leading-tight">Your Personalized College List</h3>
          <div className="flex items-center gap-1.5 shrink-0">
            <button className="rounded-lg border border-border bg-card px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
              Start Over
            </button>
            <button className="rounded-lg bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground flex items-center gap-1">
              <Plus className="h-2.5 w-2.5" />
              Add to Tracker
            </button>
          </div>
        </div>
        {/* Search bar */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">Add a college to your list...</span>
        </div>
        {/* Reach Schools */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Reach Schools</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: "California Institute of Technology", blurb: "Your background in quantum computing aligns with Caltech's core physics research clusters." },
              { name: "Stanford University", blurb: "d.school's design-thinking curriculum pairs perfectly with your product and engineering goals." },
              { name: "MIT", blurb: "CSAIL's open-research culture matches your interest in published undergraduate ML work." },
              { name: "Brown University", blurb: "Open Curriculum lets you build a self-designed CS and cognitive science concentration." },
            ].map((school) => (
              <div key={school.name} className="relative rounded-xl border border-border bg-card p-3 flex flex-col gap-1.5">
                <button className="absolute top-2 right-2 h-4 w-4 rounded-full flex items-center justify-center text-muted-foreground">
                  <X className="h-2.5 w-2.5" />
                </button>
                <p className="text-[11px] font-bold text-foreground pr-4 leading-tight">{school.name}</p>
                <span className="inline-flex w-fit items-center rounded-md border px-1.5 py-0.5 text-[9px] font-semibold text-[hsl(0,65%,42%)] bg-[hsl(0,65%,96%)] border-[hsl(0,65%,80%)]">
                  Reach
                </span>
                <p className="text-[9px] text-muted-foreground leading-relaxed">{school.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mock research brief panel ─────────────────────────────────────────────────

function MockResearchPanel() {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
      <div className="border-b border-border bg-card px-5 py-3 flex items-center gap-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-destructive/50" />
        <div className="h-2.5 w-2.5 rounded-full bg-[hsl(38,85%,55%)]/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-[hsl(142,60%,45%)]/60" />
      </div>
      <div className="p-4 flex flex-col gap-4 bg-background">
        {/* School header */}
        <div>
          <h3 className="text-sm font-bold text-foreground leading-tight">Massachusetts Institute of Technology</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">Research brief · Cambridge, MA</p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-2">
            Your focus on large-scale ML infrastructure maps directly to MIT&apos;s CSAIL, where undergraduates regularly co-author published research. The open lab culture means you can pitch ideas to faculty from day one.
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1.5">Generated 4/26/2026</p>
        </div>
        {/* Programs */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Programs that match your interests</p>
          <div className="space-y-2.5">
            {[
              { name: "Course 6-3: Computer Science and Engineering", desc: "Covers systems, AI, and theory with direct pathways into CSAIL research groups." },
              { name: "Course 6-9: Computation and Cognition", desc: "Bridges ML and cognitive science, ideal for your interest in human-AI interaction." },
            ].map((prog) => (
              <div key={prog.name}>
                <a href="#" className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary underline underline-offset-2">
                  {prog.name}
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                </a>
                <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{prog.desc}</p>
              </div>
            ))}
          </div>
        </div>
        {/* Faculty */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Faculty to know</p>
          <div className="space-y-1.5">
            {[
              { name: "Prof. Daniela Rus, CSAIL Director", desc: "Robotics and AI systems; open to undergraduate collaborators." },
              { name: "Prof. Aleksander Madry, RML Group", desc: "Robustness in ML models; publishes with undergrads regularly." },
            ].map((f) => (
              <div key={f.name}>
                <a href="#" className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary underline underline-offset-2">
                  {f.name}
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                </a>
                <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
        {/* Ask follow-up */}
        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground mb-0.5">Want more research?</p>
          <p className="text-[10px] text-muted-foreground mb-2">Ask for specific findings to add to your brief</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value=""
              placeholder="e.g. 'Find me three professors doing AI research'"
              className="flex-1 min-w-0 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[10px] text-muted-foreground placeholder:text-muted-foreground/50 outline-none"
            />
            <button className="rounded-lg bg-primary px-2.5 py-1.5 text-[10px] font-semibold text-primary-foreground flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5" />
              Ask
            </button>
          </div>
          <p className="text-[9px] text-muted-foreground/50 mt-1">0/1000</p>
        </div>
      </div>
    </div>
  );
}

// ── Mock tasks panel ──────────────────────────────────────────────────────────

const TASK_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-sky-500",
};

const MOCK_TASKS = [
  { title: "Submit your MIT application",                 subtitle: "Regular Decision · Jan 1 (in 3 days)", urgency: "high"   },
  { title: "Finish your UPenn supplement",               subtitle: "182 / 250 words · Jan 6 (in 8 days)",  urgency: "medium" },
  { title: "Commit to USC",                              subtitle: "Enrollment deadline in 4 days",         urgency: "high"   },
  { title: "Send a letter of continued interest to Yale", subtitle: "Deferred 8 weeks ago",                 urgency: "low"    },
];

function MockTasksPanel() {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden w-full lg:max-w-md">
      <div className="border-b border-border bg-card px-5 py-3 flex items-center gap-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-destructive/50" />
        <div className="h-2.5 w-2.5 rounded-full bg-[hsl(38,85%,55%)]/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-[hsl(142,60%,45%)]/60" />
      </div>
      {/* Sidebar background, matching the assistant page */}
      <div className="bg-muted/30 p-4">
        <section className="rounded-xl border border-border bg-card px-3 py-3 shadow-sm">
          <header className="mb-2 flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">What to do next</h2>
            </div>
            <RefreshCw className="h-3 w-3 text-muted-foreground" />
          </header>
          <ul className="flex flex-col">
            {MOCK_TASKS.map((task) => (
              <li key={task.title}>
                <div className="flex w-full items-start gap-2.5 rounded-lg border border-transparent px-2.5 py-2.5 text-left">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TASK_DOT[task.urgency]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium leading-snug text-foreground">{task.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{task.subtitle}</p>
                  </div>
                  <ChevronRight className="mt-1 h-3 w-3 shrink-0 text-muted-foreground/30" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Build your list",
    body: "Tell us your state, GPA, and major, then take a short quiz. Trailr generates a personalized list of reach, match, and safety schools.",
  },
  {
    step: "2",
    title: "Track everything",
    body: "Add schools to your tracker and manage deadlines, application rounds, decisions, and essays from one dashboard.",
  },
  {
    step: "3",
    title: "Let AI guide you",
    body: "Get a prioritized to-do list, research briefs, essay help, and answers to any question, all personalized to your profile.",
  },
];

function HowItWorks() {
  return (
    <section className="border-t border-border py-20">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">How it works</h2>
          <p className="text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            From your first search to your final decision, Trailr walks you through every step.
          </p>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.step} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground mb-4">
                {s.step}
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    async function redirect() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      router.replace(profile?.role === "counselor" ? "/counselor" : "/tracker");
    }
    redirect();
  }, [supabase, router]);

  return (
    <main>
      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden"
        style={{ background: "radial-gradient(ellipse 110% 55% at 50% -5%, hsl(215,85%,95%) 0%, transparent 72%)" }}
      >
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 pt-16 pb-16 text-center">
          <Reveal delay={0}>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-foreground mb-4 leading-[1.05] text-balance">
              College apps, simplified
            </h1>
          </Reveal>

          <Reveal delay={0.14}>
            <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-8 leading-relaxed text-muted-foreground">
              Build a personalized college list, track every deadline and essay, and get AI guidance at every step.
            </p>
          </Reveal>

          <Reveal delay={0.2}>
            <Link
              href="/auth?mode=signup"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              Start for Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── How it works ── */}
      <HowItWorks />

      {/* ── Step 1: List Builder ── */}
      <section id="list-builder" className="border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <Reveal className="flex-1 min-w-0">
              <div className="max-w-lg">
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Step 1 · Build your list</p>
                <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
                  Build the right list, fast.
                </h2>
                <p className="text-base text-muted-foreground leading-relaxed mb-8">
                  Tell us your state, GPA, and major when you sign up, then answer a short quiz about your goals and interests. Trailr builds a curated college list around your profile, sorted by fit, with an AI reason for every school.
                </p>
                <ul className="space-y-3">
                  {[
                    "Your profile is captured at sign up, so guidance is personalized from minute one",
                    "Reach, Match, and Safety schools balanced automatically",
                    "AI-written fit reason tailored to your background for every school",
                    "Add any school to your tracker with one click",
                  ].map((pt) => (
                    <li key={pt} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            {/* Mockup: college list view */}
            <Reveal delay={0.1} className="shrink-0 w-full lg:w-auto lg:max-w-md pointer-events-none select-none">
              <MockListPanel />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Step 2: Tracker ── */}
      <section id="tracker" className="border-t border-border py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Step 2 · Track everything</p>
            <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
              Track every application in one place.
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Add schools to your tracker and manage status, application rounds, decisions, and deadlines from one dashboard, with progress always in view.
            </p>
          </Reveal>
          <Reveal className="pointer-events-none select-none">
            <DashboardPreview />
          </Reveal>
        </div>
      </section>

      {/* ── Calendar section ── */}
      <section className="border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-10">
            <Reveal className="flex-1 min-w-0">
              <div className="max-w-lg">
                <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
                  Never miss a deadline
                </h2>
                <p className="text-base text-muted-foreground leading-relaxed mb-8">
                  Every school gets its own deadline on a built-in calendar. Track EA, ED, and RD windows so you always know what's coming.
                </p>
                <ul className="space-y-3">
                  {[
                    "Deadlines color-coded by urgency",
                    "Click any date to see which colleges are due",
                    "Upcoming deadlines panel always in view",
                  ].map((pt) => (
                    <li key={pt} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={0.1} className="shrink-0 pointer-events-none select-none">
              <MockCalendar />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Step 3: AI tasks ── */}
      <section id="tasks" className="border-t border-border py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <Reveal className="flex-1 min-w-0">
              <div className="max-w-lg">
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Step 3 · Let AI guide you</p>
                <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
                  Know exactly what to do next.
                </h2>
                <p className="text-base text-muted-foreground leading-relaxed mb-8">
                  Trailr reads your list, deadlines, and essay progress and turns them into a short, prioritized to-do list. Open the app and you always know your next move.
                </p>
                <ul className="space-y-3">
                  {[
                    "A prioritized to-do list built from your deadlines and progress",
                    "Urgency flags so you know what is critical right now",
                    "Every task links straight to the right place to act",
                  ].map((pt) => (
                    <li key={pt} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={0.1} className="shrink-0 w-full lg:w-auto pointer-events-none select-none">
              <MockTasksPanel />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Research Brief section ── */}
      <section id="research-brief" className="border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row-reverse items-center gap-12">
            <Reveal className="flex-1 min-w-0">
              <div className="max-w-lg">
                <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
                  &ldquo;Why Us?&rdquo; Not a problem.
                </h2>
                <p className="text-base text-muted-foreground leading-relaxed mb-8">
                  One click generates a personalized research brief for every school on your list: matching programs, faculty to know, and a clear angle for your Why Us essay.
                </p>
                <ul className="space-y-3">
                  {[
                    "Programs that match your stated academic interests",
                    "Faculty members doing work you actually care about",
                    "A specific 'Why Us' angle tailored to your background",
                    "Ask follow-up questions to go deeper on any finding",
                  ].map((pt) => (
                    <li key={pt} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            {/* Mockup: research brief view */}
            <Reveal delay={0.1} className="shrink-0 w-full lg:w-auto lg:max-w-md pointer-events-none select-none">
              <MockResearchPanel />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Essay section ── */}
      <section id="essays" className="border-t border-border py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-10">
            <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
              Write your essays. Track every draft.
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Every college essay lives in one place with its prompt and word count. Watch your progress on every supplement, from first draft to final word.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="pointer-events-none select-none">
            <MockEssayPanel />
          </Reveal>
        </div>
      </section>

      {/* ── Assistant section ── */}
      <section id="assistant" className="border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-10">
            <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
              Ask anything about your applications.
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Get answers based on your actual list and profile: which schools to prioritize, how to angle an essay, what to research before you apply.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="pointer-events-none select-none">
            <MockAssistantPanel />
          </Reveal>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
              Your application season, organized.
            </h2>
            <p className="text-base text-muted-foreground mb-8 max-w-lg mx-auto leading-relaxed">
              Track applications, write essays, and never miss a deadline. Your whole college season in one place.
            </p>
            <div className="flex items-center justify-center">
              <Link
                href="/auth?mode=signup"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <Footer />
    </main>
  );
}
