"use client";

import Link from "next/link";
import Footer from "@/components/footer";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  LayoutList,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  ArrowLeft,
  Search,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Share2,
  Users,
  MessageSquare,
  Check,
  Activity,
  Trash2,
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

function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

// ── Feature card ──────────────────────────────────────────────────────────────

function FeatureCard({
  icon: Icon,
  title,
  description,
  accent,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-8 py-8 shadow-sm flex flex-col gap-5 h-full transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accent}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-lg font-semibold text-foreground mb-2">{title}</p>
        <p className="text-base text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
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

// ── Step ──────────────────────────────────────────────────────────────────────

function Step({ n, title, description }: { n: number; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-8 py-8 shadow-sm h-full transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30">
      <div className="flex gap-5 items-start">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-base font-bold">
          {n}
        </div>
        <div className="pt-1">
          <p className="text-lg font-semibold text-foreground mb-1.5">{title}</p>
          <p className="text-base text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
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
        <div className="grid grid-cols-5 gap-3 mb-5">
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
    <div className="flex flex-col gap-4 w-96">
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

const ESSAY_COLORS = [
  { bg: "rgba(251,191,36,0.28)",  border: "hsl(38,85%,50%)"  },
  { bg: "rgba(59,130,246,0.20)",  border: "hsl(205,85%,50%)" },
];

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
        {/* Top bar — matches the actual editor */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm shrink-0 select-none">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </div>
          <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-foreground truncate">
            Northwestern University
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 shrink-0">
            <MessageSquare className="h-3 w-3" />
            2 comments
          </span>
        </div>

        {/* Two-column layout — matches the actual review mode */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-start">

          {/* Essay card */}
          <div className="flex-1 min-w-0 rounded-xl border border-border bg-card overflow-hidden shadow-sm">

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

            {/* Essay body with highlights */}
            <div className="px-5 py-5 text-sm leading-relaxed">
              <mark style={{ backgroundColor: ESSAY_COLORS[0].bg, borderBottom: `2px solid ${ESSAY_COLORS[0].border}`, borderRadius: "2px" }}>
                Northwestern&apos;s Medill School of Journalism
              </mark>
              {" has defined what I want from a college education. Since founding my high school paper junior year, I've understood that "}
              <mark style={{ backgroundColor: ESSAY_COLORS[1].bg, borderBottom: `2px solid ${ESSAY_COLORS[1].border}`, borderRadius: "2px" }}>
                the combination of rigorous academic theory and hands-on reporting
              </mark>
              {" is what I need to grow as a journalist. Medill's dual-degree programs and proximity to Chicago give me exactly that — a city where every neighborhood is a story waiting to be told. Northwestern is the only place I can pursue journalism at this level while staying close to a world-class urban beat."}
            </div>

            {/* Word count footer */}
            <div className="flex items-center justify-between px-5 py-2.5 border-t border-border bg-muted/10">
              <span className="text-[11px] text-muted-foreground tabular-nums">178 words · 1,021 characters</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">72 words remaining</span>
            </div>
          </div>

          {/* Comment sidebar — matches the actual sidebar style */}
          <div className="w-full md:w-64 md:shrink-0 flex flex-col gap-3">

            {/* Comment 1 — yellow */}
            <div
              className="rounded-xl border border-border bg-card p-3.5 shadow-sm cursor-pointer hover:bg-muted/30 transition-colors"
              style={{ borderLeft: `3px solid ${ESSAY_COLORS[0].border}` }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-foreground">Ms. Chen</span>
                <span className="text-[11px] text-muted-foreground">Jan 12</span>
              </div>
              <p className="text-[11px] italic leading-snug mb-2 rounded px-1.5 py-0.5"
                style={{ backgroundColor: ESSAY_COLORS[0].bg, color: "hsl(var(--foreground) / 0.7)" }}>
                &ldquo;Northwestern&apos;s Medill School of Journalism&rdquo;
              </p>
              <p className="text-xs text-foreground leading-snug mb-2.5">
                Strong anchor! Tie this to a specific career goal or a story you&apos;ve already published to make it personal.
              </p>
              <button className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                <Check className="h-3.5 w-3.5" />
                Resolve
              </button>
            </div>

            {/* Comment 2 — blue */}
            <div
              className="rounded-xl border border-border bg-card p-3.5 shadow-sm cursor-pointer hover:bg-muted/30 transition-colors"
              style={{ borderLeft: `3px solid ${ESSAY_COLORS[1].border}` }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-foreground">Ms. Chen</span>
                <span className="text-[11px] text-muted-foreground">Jan 12</span>
              </div>
              <p className="text-[11px] italic leading-snug mb-2 rounded px-1.5 py-0.5"
                style={{ backgroundColor: ESSAY_COLORS[1].bg, color: "hsl(var(--foreground) / 0.7)" }}>
                &ldquo;the combination of rigorous academic theory and hands-on reporting&rdquo;
              </p>
              <p className="text-xs text-foreground leading-snug mb-2.5">
                This is a bit vague — try naming a specific Medill program like the Journalism Residency or a professor whose work inspires you.
              </p>
              <button className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                <Check className="h-3.5 w-3.5" />
                Resolve
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mock counselor data ───────────────────────────────────────────────────────

const MOCK_STUDENTS = [
  {
    name: "Alex Rivera", email: "alex.r@email.com",
    totalColleges: 10, submitted: 7, accepted: 2, waitlisted: 1, rejected: 0,
    urgentDeadlines: 2, overdueDeadlines: 0,
  },
  {
    name: "Jamie Park", email: "jamie.p@email.com",
    totalColleges: 8, submitted: 8, accepted: 2, waitlisted: 0, rejected: 1,
    urgentDeadlines: 0, overdueDeadlines: 0,
  },
  {
    name: "Sam Torres", email: "sam.t@email.com",
    totalColleges: 12, submitted: 4, accepted: 0, waitlisted: 0, rejected: 0,
    urgentDeadlines: 0, overdueDeadlines: 1,
  },
];

const MOCK_STAT_CHIPS = [
  { key: "totalColleges" as const, label: "Colleges",   color: undefined,             bg: undefined             },
  { key: "submitted"     as const, label: "Submitted",  color: "hsl(205,85%,50%)",    bg: "hsl(205,85%,96%)"   },
  { key: "accepted"      as const, label: "Accepted",   color: "hsl(142,60%,30%)",    bg: "hsl(142,60%,95%)"   },
  { key: "waitlisted"    as const, label: "Waitlisted", color: "hsl(38,85%,35%)",     bg: "hsl(38,85%,95%)"    },
  { key: "rejected"      as const, label: "Rejected",   color: "hsl(0,65%,42%)",      bg: "hsl(0,65%,96%)"     },
];

// Alex's college list — matches the actual student detail table
const ALEX_COLLEGES = [
  { name: "Harvard",    category: { label: "Reach",      color: "hsl(0,65%,42%)",   bg: "hsl(0,65%,96%)",   border: "hsl(0,65%,80%)" },
    status:   { label: "Submitted",   color: "hsl(205,85%,50%)", bg: "hsl(205,85%,96%)" },
    decision: { label: "Accepted",    color: "hsl(142,60%,30%)", bg: "hsl(142,60%,95%)" },
    deadline: "Nov 1, 2025",   deadlineStatus: null, urgencyDot: null,
    counselorNote: "Highlight research experience in essays." },
  { name: "MIT",        category: { label: "Reach",      color: "hsl(0,65%,42%)",   bg: "hsl(0,65%,96%)",   border: "hsl(0,65%,80%)" },
    status:   { label: "Submitted",   color: "hsl(205,85%,50%)", bg: "hsl(205,85%,96%)" },
    decision: { label: "Pending",     color: "hsl(220,70%,28%)", bg: "hsl(220,70%,95%)" },
    deadline: "Jan 1, 2026",   deadlineStatus: null, urgencyDot: null, counselorNote: null },
  { name: "Stanford",   category: { label: "Reach",      color: "hsl(0,65%,42%)",   bg: "hsl(0,65%,96%)",   border: "hsl(0,65%,80%)" },
    status:   { label: "In Progress", color: "hsl(38,85%,35%)",  bg: "hsl(38,85%,95%)"  },
    decision: null,
    deadline: "Jan 2, 2026",   deadlineStatus: { label: "5d left", color: "hsl(38,85%,35%)" }, urgencyDot: "hsl(38,85%,50%)",
    counselorNote: "Needs to finish Why Stanford — deadline is very soon." },
  { name: "UCLA",       category: { label: "Reach",      color: "hsl(0,65%,42%)",   bg: "hsl(0,65%,96%)",   border: "hsl(0,65%,80%)" },
    status:   { label: "Submitted",   color: "hsl(205,85%,50%)", bg: "hsl(205,85%,96%)" },
    decision: { label: "Waitlisted",  color: "hsl(38,85%,35%)",  bg: "hsl(38,85%,95%)"  },
    deadline: "Nov 30, 2025",  deadlineStatus: null, urgencyDot: null, counselorNote: null },
  { name: "UMich",      category: { label: "High Match", color: "hsl(38,85%,35%)",  bg: "hsl(38,85%,95%)",  border: "hsl(38,85%,75%)" },
    status:   { label: "Submitted",   color: "hsl(205,85%,50%)", bg: "hsl(205,85%,96%)" },
    decision: null,
    deadline: "Feb 1, 2026",   deadlineStatus: null, urgencyDot: null, counselorNote: null },
];

// Alex's essays grouped by college
const ALEX_ESSAY_GROUPS = [
  {
    college: "Common Application",
    essays: [
      { prompt: "Some students have a background, identity, interest, or talent that is so meaningful they believe their application would be incomplete without it. If this sounds like you, then please share your story.",
        words: 612, wordLimit: 650, status: "Complete" as const },
    ],
  },
  {
    college: "Northwestern University",
    essays: [
      { prompt: "Why Northwestern? What aspects of the Northwestern curriculum or community make it a good fit for you?",
        words: 178, wordLimit: 250, status: "Drafting" as const },
    ],
  },
  {
    college: "Stanford University",
    essays: [
      { prompt: "The Stanford community is deeply curious and driven to learn in and out of the classroom. Reflect on an idea or experience that makes you genuinely excited about learning.",
        words: 0, wordLimit: 250, status: "Not Started" as const },
      { prompt: "Virtually all of Stanford's undergraduates live on campus. Write a note to your future roommate that reveals something about you.",
        words: 0, wordLimit: 250, status: "Not Started" as const },
    ],
  },
];

// ── Counselor preview ─────────────────────────────────────────────────────────

function CounselorPreview() {
  const [scene, setScene]   = useState<"list" | "detail">("list");
  const [tab, setTab]       = useState<"colleges" | "essays">("colleges");
  const [backHovered, setBackHovered]   = useState(false);
  const [cursorPos, setCursorPos]       = useState({ x: 46, y: 220 });
  const [cursorClicking, setCursorClicking] = useState(false);

  const containerRef   = useRef<HTMLDivElement>(null);
  const alexRowRef     = useRef<HTMLDivElement>(null);
  const essaysTabRef   = useRef<HTMLButtonElement>(null);
  const backBtnRef     = useRef<HTMLDivElement>(null);

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
      setScene("list");
      setTab("colleges");
      setBackHovered(false);

      // 600ms  — cursor glides to Alex row
      t(() => moveTo(alexRowRef), 600);
      // 1500ms — click Alex; scene transitions to detail/colleges
      t(() => click(() => setScene("detail")), 1500);
      // 4800ms — 3s after scene is fully visible, cursor glides to Essays tab
      t(() => moveTo(essaysTabRef), 4800);
      // 5700ms — cursor has arrived; click Essays tab
      t(() => click(() => setTab("essays")), 5700);
      // 8400ms — 3s on essays; cursor moves to Back button
      t(() => moveTo(backBtnRef), 8400);
      t(() => setBackHovered(true), 8820);
      // 9200ms — click Back; scene returns to list
      t(() => click(() => { setBackHovered(false); setScene("list"); }), 9200);
      // 9900ms — loop
      t(cycle, 9900);
    }

    t(cycle, 0);
    return () => { mounted = false; timers.forEach(clearTimeout); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden relative w-full" style={{ minHeight: "820px" }}>

      {/* Browser chrome */}
      <div className="border-b border-border bg-card px-6 py-4 flex items-center gap-3">
        <div className="h-3 w-3 rounded-full bg-destructive/50" />
        <div className="h-3 w-3 rounded-full bg-[hsl(38,85%,55%)]/60" />
        <div className="h-3 w-3 rounded-full bg-[hsl(142,60%,45%)]/60" />
      </div>

      {/* Animated cursor */}
      <motion.div
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 100 }}
        animate={{
          x: cursorPos.x, y: cursorPos.y,
          scale: cursorClicking ? 0.8 : 1,
        }}
        transition={{
          x: { duration: 0.42, ease: "easeInOut" },
          y: { duration: 0.42, ease: "easeInOut" },
          scale: { duration: 0.09 },
        }}
      >
        <svg width="14" height="20" viewBox="0 0 14 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 1L2 17L5.5 13L8.5 20L11 19L8 12L13.5 12L2 1Z"
            fill="white" stroke="#1f2937" strokeWidth="1.5"
            strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </motion.div>

      {/* Scenes */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {scene === "list" ? (
            <motion.div key="list"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
            >
              {/* ── List scene ── */}

              {/* Page header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="text-base font-bold text-foreground">My Students</div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[11px]">
                      <span className="text-muted-foreground">Invite code</span>
                      <span className="font-mono font-semibold tracking-widest text-foreground">TR-4829</span>
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">3 students connected</p>
                </div>
              </div>

              {/* Stat cards row */}
              <div className="grid grid-cols-4 gap-2.5 mb-4">
                {[
                  { label: "Total Students",  value: 3,  color: undefined            },
                  { label: "Total Submitted", value: 19, color: "hsl(205,85%,50%)"  },
                  { label: "Total Accepted",  value: 4,  color: "hsl(142,60%,30%)"  },
                  { label: "Urgent Flags",    value: 2,  color: "hsl(38,85%,35%)"   },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-sm flex flex-col gap-0.5">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                    <span className="text-xl font-bold tabular-nums" style={color ? { color } : undefined}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Two-column */}
              <div className="flex gap-4 items-start">

                {/* Student roster */}
                <div className="flex-1 min-w-0 rounded-xl border border-border bg-card overflow-hidden shadow-sm divide-y divide-border">
                  {MOCK_STUDENTS.map((s, i) => {
                    const pct = (s.submitted / s.totalColleges) * 100;
                    const isComplete = pct === 100;
                    return (
                      <div key={s.name}
                        ref={i === 0 ? alexRowRef : undefined}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer group"
                      >
                        <div className="w-32 shrink-0">
                          <p className="text-xs font-medium text-foreground leading-tight">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{s.email}</p>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 flex-wrap mb-1.5">
                            {MOCK_STAT_CHIPS.map(({ key, label, color, bg }) => {
                              const val = s[key];
                              if (key !== "totalColleges" && val === 0) return null;
                              return (
                                <span key={key}
                                  className="inline-flex items-center gap-0.5 text-[10px] font-medium rounded-md px-1.5 py-0.5 whitespace-nowrap"
                                  style={color ? { color, backgroundColor: bg } : { color: "hsl(var(--foreground))", backgroundColor: "hsl(var(--muted))" }}
                                >
                                  <span className="tabular-nums">{val}</span>
                                  <span className="opacity-70">{label}</span>
                                </span>
                              );
                            })}
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-[width]"
                              style={{ width: `${pct}%`, backgroundColor: isComplete ? "hsl(142,60%,40%)" : "hsl(var(--primary))" }} />
                          </div>
                          <p className="text-[9px] text-muted-foreground mt-0.5 tabular-nums">
                            {s.submitted} of {s.totalColleges} submitted
                          </p>
                        </div>

                        {s.overdueDeadlines > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-700 shrink-0">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                            {s.overdueDeadlines} overdue
                          </span>
                        )}
                        {s.urgentDeadlines > 0 && s.overdueDeadlines === 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700 shrink-0">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                            {s.urgentDeadlines} due soon
                          </span>
                        )}

                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                      </div>
                    );
                  })}
                </div>

                {/* Sidebar */}
                <div className="w-56 shrink-0 flex flex-col gap-3">
                  <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                    <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-border bg-muted/30">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-foreground">Upcoming Deadlines</span>
                    </div>
                    <ul className="divide-y divide-border">
                      {[
                        { college: "Stanford", student: "Alex Rivera", days: 3,  overdue: false },
                        { college: "MIT",      student: "Sam Torres",  days: 5,  overdue: false },
                        { college: "UChicago", student: "Sam Torres",  days: -2, overdue: true  },
                      ].map((dl, i) => (
                        <li key={i} className="px-3.5 py-2 flex items-start gap-1.5 cursor-pointer hover:bg-muted/20 transition-colors">
                          <span className={`h-2 w-2 rounded-full mt-1 shrink-0 ${dl.overdue ? "bg-red-400" : "bg-amber-400"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-foreground leading-snug truncate">{dl.college}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{dl.student}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[10px] font-semibold tabular-nums ${dl.overdue ? "text-red-600" : "text-amber-600"}`}>
                                {dl.overdue ? `${Math.abs(dl.days)}d ago` : `${dl.days}d`}
                              </span>
                              <span className={`text-[9px] font-semibold rounded-full px-1.5 py-0.5 ${dl.overdue ? "text-red-700 bg-red-50 border border-red-200" : "text-amber-700 bg-amber-50 border border-amber-200"}`}>
                                {dl.overdue ? "Overdue" : "Action needed"}
                              </span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                    <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-border bg-muted/30">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-foreground">Recent Activity</span>
                    </div>
                    <ul className="divide-y divide-border">
                      <li className="px-3.5 py-2">
                        <div className="flex items-start gap-1.5">
                          <span className="h-2 w-2 rounded-full mt-1 shrink-0 bg-emerald-400" />
                          <div>
                            <p className="text-[11px] leading-snug">
                              <span className="font-semibold text-foreground">Alex Rivera</span>{" "}
                              <span className="text-muted-foreground">received a decision for</span>{" "}
                              <span className="font-medium text-foreground">Harvard</span>
                              <span className="ml-1 text-[10px] font-bold text-emerald-700"> — Accepted</span>
                            </p>
                            <p className="text-[9px] text-muted-foreground mt-0.5">Jan 15, 5:30 PM</p>
                          </div>
                        </div>
                      </li>
                      <li className="px-3.5 py-2">
                        <p className="text-[11px] leading-snug">
                          <span className="font-semibold text-foreground/80">Sam Torres</span>{" "}
                          <span className="text-muted-foreground">updated status for</span>{" "}
                          <span className="font-medium text-foreground">MIT</span>
                          <span className="ml-1 text-[10px] text-muted-foreground">→ Submitted</span>
                        </p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">Jan 14, 9:12 AM</p>
                      </li>
                      <li className="px-3.5 py-2">
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          <span className="font-medium text-foreground/80">Jamie Park</span>{" "}
                          added <span className="italic">Penn State</span>
                        </p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">Jan 13, 2:44 PM</p>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="detail"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
            >
              {/* ── Detail scene ── */}

              {/* Page header — Back + student name */}
              <div className="flex items-center gap-3 mb-5">
                <div ref={backBtnRef} className={`flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground shadow-sm shrink-0 select-none transition-colors ${backHovered ? "bg-muted" : "bg-card"}`}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground leading-tight">Alex Rivera</div>
                  <p className="text-xs text-muted-foreground">alex.r@email.com</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-4 border-b border-border">
                {(["colleges", "essays"] as const).map((t) => (
                  <button key={t}
                    ref={t === "essays" ? essaysTabRef : undefined}
                    className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                      tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {tab === "colleges" ? (
                  <motion.div key="colleges"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Colleges card */}
                    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                      {/* Stats strip */}
                      <div className="flex items-center gap-8 px-5 py-3 border-b border-border bg-muted/20 flex-wrap">
                        {[
                          { label: "Colleges",  value: 10, color: undefined           },
                          { label: "Submitted", value: 7,  color: "hsl(205,85%,45%)" },
                          { label: "Accepted",  value: 2,  color: "hsl(142,60%,35%)" },
                          { label: "Waitlisted",value: 1,  color: "hsl(38,85%,35%)"  },
                          { label: "Rejected",  value: 0,  color: "hsl(0,65%,45%)"   },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="flex flex-col">
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                            <span className="text-xl font-bold tabular-nums" style={color ? { color } : undefined}>{value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Progress bar strip */}
                      <div className="px-5 py-2.5 border-b border-border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-foreground">Application Progress</span>
                          <span className="text-xs text-muted-foreground tabular-nums">7 of 10 submitted</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: "70%" }} />
                        </div>
                      </div>

                      {/* College table */}
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            <th className="text-left pl-4 pr-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">College</th>
                            <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Category</th>
                            <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Application</th>
                            <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Decision</th>
                            <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Deadline</th>
                            <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">Counselor Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ALEX_COLLEGES.map((c, i) => (
                            <tr key={c.name} className={i < ALEX_COLLEGES.length - 1 ? "border-b border-border" : ""}>
                              <td className="pl-4 pr-3 py-3">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-medium text-foreground">{c.name}</p>
                                  {c.urgencyDot && (
                                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: c.urgencyDot }} />
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <span className="text-[10px] font-semibold rounded-md border px-1.5 py-0.5 whitespace-nowrap"
                                  style={{ color: c.category.color, backgroundColor: c.category.bg, borderColor: c.category.border }}>
                                  {c.category.label}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <span className="text-[10px] font-medium rounded-md px-1.5 py-0.5 whitespace-nowrap"
                                  style={{ color: c.status.color, backgroundColor: c.status.bg }}>
                                  {c.status.label}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                {c.decision ? (
                                  <span className="text-[10px] font-medium rounded-md px-1.5 py-0.5 whitespace-nowrap"
                                    style={{ color: c.decision.color, backgroundColor: c.decision.bg }}>
                                    {c.decision.label}
                                  </span>
                                ) : <span className="text-[10px] text-muted-foreground/40">—</span>}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[10px] text-muted-foreground">{c.deadline}</span>
                                  {c.deadlineStatus && (
                                    <span className="text-[10px] font-medium" style={{ color: c.deadlineStatus.color }}>
                                      {c.deadlineStatus.label}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3 max-w-[180px]">
                                {c.counselorNote ? (
                                  <span className="text-[10px] text-amber-700 leading-snug line-clamp-2">{c.counselorNote}</span>
                                ) : (
                                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                                    <MessageSquare className="h-3 w-3" />
                                    Add note
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="essays"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-3"
                  >
                    {/* Essay groups */}
                    {ALEX_ESSAY_GROUPS.map((g) => (
                      <div key={g.college} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/30">
                          <p className="text-xs font-semibold text-foreground">{g.college}</p>
                        </div>
                        <div className="divide-y divide-border">
                          {g.essays.map((e, i) => {
                            const pct = Math.min((e.words / e.wordLimit) * 100, 100);
                            const badgeCls =
                              e.status === "Complete"   ? "bg-emerald-100 text-emerald-700" :
                              e.status === "Drafting"   ? "bg-amber-100 text-amber-700"     :
                              "bg-muted text-muted-foreground";
                            return (
                              <div key={i} className="px-4 py-3 hover:bg-primary/5 transition-colors cursor-pointer group">
                                <p className="text-xs text-foreground line-clamp-2 leading-snug mb-2 group-hover:text-primary transition-colors">
                                  {e.prompt}
                                </p>
                                <div className="flex items-center gap-3 mb-1.5">
                                  <div className="flex-1 min-w-0">
                                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                                    </div>
                                    <p className="text-[10px] mt-0.5 tabular-nums text-muted-foreground">
                                      {e.words} / {e.wordLimit} words
                                    </p>
                                  </div>
                                  <span className={`shrink-0 text-[10px] font-semibold rounded-full px-2 py-0.5 ${badgeCls}`}>
                                    {e.status}
                                  </span>
                                </div>
                                <button className="text-[11px] font-medium text-primary hover:underline whitespace-nowrap">
                                  View essay →
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
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
            <h1 className="text-5xl sm:text-8xl font-bold tracking-tight text-foreground mb-6 leading-[1.05] sm:whitespace-nowrap text-balance">
              Ditch the Spreadsheet.
            </h1>
          </Reveal>

          <Reveal delay={0.14}>
            <p className="text-xl sm:text-2xl max-w-2xl mx-auto mb-10 leading-relaxed text-muted-foreground">
              Track every application, write your essays, and stay in sync with your counselor — all in one place.
            </p>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="flex flex-col items-center gap-2">
              <Link
                href="/auth?mode=signup"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                Start Tracking Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="text-sm text-muted-foreground/70">Free · No credit card required</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Dashboard preview ── */}
      <section id="preview" className="border-t border-border py-12">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <Reveal>
            <DashboardPreview />
          </Reveal>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Features</p>
            <h2 className="text-4xl font-bold text-foreground">Everything you need, in one platform</h2>
          </Reveal>

          <Reveal stagger className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-stretch mb-6">
            <StaggerItem className="h-full">
              <FeatureCard
                icon={LayoutList}
                title="Build your college list"
                description="Add any school, set categories like Reach or Safety, and keep your full list organized in one place."
                accent="bg-primary/10 text-primary"
              />
            </StaggerItem>
            <StaggerItem className="h-full">
              <FeatureCard
                icon={FileText}
                title="Essay workspace"
                description="Write and track all your college essays with per-school prompts, word count, and draft status."
                accent="bg-[hsl(262,60%,92%)] text-[hsl(262,60%,40%)]"
              />
            </StaggerItem>
            <StaggerItem className="h-full">
              <FeatureCard
                icon={Share2}
                title="Share your list"
                description="Share your college list with your counselor or family with a single link — no account required to view."
                accent="bg-[hsl(200,70%,92%)] text-[hsl(200,65%,35%)]"
              />
            </StaggerItem>
          </Reveal>

          <Reveal stagger className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-stretch">
            <StaggerItem className="h-full">
              <FeatureCard
                icon={TrendingUp}
                title="Track application status"
                description="Mark each school Not Started, In Progress, or Submitted as you work through your applications."
                accent="bg-[hsl(215,75%,92%)] text-[hsl(215,75%,40%)]"
              />
            </StaggerItem>
            <StaggerItem className="h-full">
              <FeatureCard
                icon={Users}
                title="Counselor dashboard"
                description="Counselors get a live view of every student's list, essay progress, deadlines, and application status."
                accent="bg-[hsl(142,60%,90%)] text-[hsl(142,60%,30%)]"
              />
            </StaggerItem>
            <StaggerItem className="h-full">
              <FeatureCard
                icon={CheckCircle2}
                title="Track decisions and outcomes"
                description="Log acceptances, rejections, waitlists, and deferrals the moment they arrive."
                accent="bg-[hsl(38,85%,92%)] text-[hsl(38,85%,35%)]"
              />
            </StaggerItem>
          </Reveal>
        </div>
      </section>

      {/* ── Essay section ── */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Essays</p>
            <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
              Write your essays. Get feedback that actually helps.
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Every college essay lives in one place with its prompt and word count. Your counselor can highlight specific passages and leave comments — you resolve them as you revise.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <MockEssayPanel />
          </Reveal>
        </div>
      </section>

      {/* ── Calendar section ── */}
      <section className="border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-10">
            <Reveal className="flex-1 min-w-0">
              <div className="max-w-lg">
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Deadlines</p>
                <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
                  Never miss a deadline
                </h2>
                <p className="text-base text-muted-foreground leading-relaxed mb-8">
                  Every school gets its own deadline on a built-in calendar. Track EA, ED, and RD windows so you always know what's coming — and so does your counselor.
                </p>
                <ul className="space-y-3">
                  {[
                    "Deadlines color-coded by urgency",
                    "Click any date to see which colleges are due",
                    "Upcoming deadlines panel always in view",
                    "Counselors see all student deadlines in one feed",
                  ].map((pt) => (
                    <li key={pt} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={0.1} className="shrink-0">
              <MockCalendar />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Counselor section ── */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Counselors</p>
            <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
              A real-time window into every student's journey
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Counselors get a dedicated dashboard to monitor all their students at once: application progress, urgent deadlines, recent activity, and more. No more chasing updates over email.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <CounselorPreview />
          </Reveal>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">How It Works</p>
            <h2 className="text-4xl font-bold text-foreground">Simple by design</h2>
          </Reveal>

          <Reveal stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            <StaggerItem className="h-full">
              <Step
                n={1}
                title="Build your list"
                description="Search any school and add it to your list in seconds. Categorize as Reach, Match, or Safety."
              />
            </StaggerItem>
            <StaggerItem className="h-full">
              <Step
                n={2}
                title="Write your essays"
                description="Draft every college essay in one place. Track word count and status for each school."
              />
            </StaggerItem>
            <StaggerItem className="h-full">
              <Step
                n={3}
                title="Connect with your counselor"
                description="Share your list and essays with your counselor. Get direct comments and feedback in real time."
              />
            </StaggerItem>
            <StaggerItem className="h-full">
              <Step
                n={4}
                title="Monitor decisions"
                description="Record outcomes as they arrive and see your full results — acceptances, waitlists, and more."
              />
            </StaggerItem>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-border bg-[hsl(215,60%,97%)] py-24">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
              Your application season, organized.
            </h2>
            <p className="text-sm text-muted-foreground mb-10 max-w-md mx-auto leading-relaxed">
              Students track applications and write essays. Counselors monitor progress and leave feedback. Everyone stays on the same page.
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
