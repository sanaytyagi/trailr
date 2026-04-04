"use client";

import Link from "next/link";
import Footer from "@/components/footer";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  LayoutList,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Search,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ── Motion variants ───────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 18, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
  },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 14, filter: "blur(3px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
  },
};

// ── Scroll reveal wrapper ─────────────────────────────────────────────────────

function Reveal({
  children,
  className,
  delay = 0,
  stagger = false,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  stagger?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  if (stagger) {
    return (
      <motion.div
        ref={ref}
        variants={staggerContainer}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
        className={className}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Stagger child — wrap individual items inside a <Reveal stagger> parent
function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
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
      <td className="px-4 py-3.5 text-xs text-muted-foreground">{deadline}</td>
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
const TC  = "text-[hsl(38,85%,35%)] bg-[hsl(38,85%,95%)] border-[hsl(38,85%,75%)]";
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
  { name: "Harvard",    rate: "3.2%",  category: "Reach",  catColor: RC,  status: "Submitted",   statusColor: SUB, round: "EA", roundColor: REA, decision: "Accepted",   decisionColor: ACC, deadline: "Nov 1"  },
  { name: "MIT",        rate: "3.9%",  category: "Reach",  catColor: RC,  status: "Submitted",   statusColor: SUB, round: "ED", roundColor: RED, decision: "Pending",    decisionColor: PEN, deadline: "Jan 1"  },
  { name: "Stanford",   rate: "3.7%",  category: "Reach",  catColor: RC,  status: "In Progress", statusColor: INP, round: "RD", roundColor: RRD, decision: "—",          decisionColor: MUT, deadline: "Jan 2"  },
  { name: "UCLA",       rate: "8.6%",  category: "Reach",  catColor: RC,  status: "Submitted",   statusColor: SUB, round: "RD", roundColor: RRD, decision: "Waitlisted", decisionColor: WAI, deadline: "Nov 30" },
  { name: "UMich",      rate: "17.7%", category: "Target", catColor: TC,  status: "Submitted",   statusColor: SUB, round: "RD", roundColor: RRD, decision: "Rejected",   decisionColor: RC,  deadline: "Feb 1"  },
  { name: "UT Austin",  rate: "31%",   category: "Target", catColor: TC,  status: "Submitted",   statusColor: SUB, round: "RD", roundColor: RRD, decision: "Accepted",   decisionColor: ACC, deadline: "Dec 1"  },
  { name: "Ohio State", rate: "49%",   category: "Safety", catColor: SC,  status: "In Progress", statusColor: INP, round: "EA", roundColor: REA, decision: "—",          decisionColor: MUT, deadline: "Feb 15" },
  { name: "Penn State", rate: "54%",   category: "Safety", catColor: SC,  status: "Not Started", statusColor: MUT, round: "—",  roundColor: MUT, decision: "—",          decisionColor: MUT, deadline: "Mar 1"  },
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
  const [cursorPos, setCursorPos]       = useState({ x: 0, y: 0 });
  const [cursorVisible, setCursorVisible]   = useState(false);
  const [cursorClicking, setCursorClicking] = useState(false);

  const containerRef       = useRef<HTMLDivElement>(null);
  const searchInputRef     = useRef<HTMLDivElement>(null);
  const dropdownResultRef  = useRef<HTMLDivElement>(null);
  const catCellRef         = useRef<HTMLTableCellElement>(null);
  const statusCellRef      = useRef<HTMLTableCellElement>(null);
  const roundCellRef       = useRef<HTMLTableCellElement>(null);

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

    function moveTo(ref: { current: HTMLElement | null }) {
      const pos = getElPos(ref);
      if (pos) setCursorPos(pos);
    }

    function cycle() {
      if (!mounted) return;
      setSearchText(""); setShowDropdown(false);
      setShowNewRow(false); setHighlightNew(false); setCollegeCount(8);
      setDukeCat("—"); setDukeStatus("Not Started"); setDukeRound("—");
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

      t(() => setCursorVisible(false), d);
      d += 500;

      t(() => { setShowNewRow(false); setCollegeCount(8); t(cycle, 700); }, d);
    }

    t(cycle, 0);
    return () => { mounted = false; timers.forEach(clearTimeout); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitted = 5;
  const catStyle    = dukeCat    === "Reach"       ? REACH_BTN : MUTED_BTN;
  const statusStyle = dukeStatus === "In Progress" ? INP_BTN   : MUTED_BTN;
  const roundStyle  = dukeRound  === "RD"          ? RD_BTN    : MUTED_BTN;

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
        <div className="ml-4 h-6 flex-1 max-w-xs rounded-md bg-muted/70 text-[10px] text-muted-foreground flex items-center px-3">
          trailr.org/tracker
        </div>
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

// ── Mock calendar (homepage preview) ─────────────────────────────────────────

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
      {/* Calendar card */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-foreground">January 2026</span>
          <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {CAL_DAYS.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        {/* Day grid */}
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

        {/* Selected day tooltip */}
        <div className="mt-3 border-t border-border pt-3 space-y-1">
          {["Harvard", "Princeton"].map((name) => (
            <div key={name} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-destructive" />
              <span className="text-xs text-foreground">{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming deadlines card */}
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
            <h1 className="text-6xl sm:text-8xl font-bold tracking-tight text-foreground mb-6 leading-[1.05] whitespace-nowrap">
              Ditch the Spreadsheet.
            </h1>
          </Reveal>

          <Reveal delay={0.14}>
            <p
              className="text-xl sm:text-2xl max-w-xl mx-auto mb-10 leading-relaxed"
              style={{ color: "#4a5568" }}
            >
              Track every college application, deadline, and decision in one organized dashboard.
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
            <h2 className="text-4xl font-bold text-foreground">Built for the application season</h2>
          </Reveal>

          <Reveal stagger className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-stretch">
            <StaggerItem className="h-full">
              <FeatureCard
                icon={LayoutList}
                title="Track all your colleges"
                description="Add any school and keep your full list organized in one place."
                accent="bg-primary/10 text-primary"
              />
            </StaggerItem>
            <StaggerItem className="h-full">
              <FeatureCard
                icon={TrendingUp}
                title="Organize application status"
                description="Mark each school Not Started, In Progress, or Submitted as you go."
                accent="bg-[hsl(215,75%,92%)] text-[hsl(215,75%,40%)]"
              />
            </StaggerItem>
            <StaggerItem className="h-full">
              <FeatureCard
                icon={CheckCircle2}
                title="Track decisions and outcomes"
                description="Log acceptances, rejections, waitlists, and deferrals the moment they arrive."
                accent="bg-[hsl(200,70%,92%)] text-[hsl(200,65%,35%)]"
              />
            </StaggerItem>
          </Reveal>
        </div>
      </section>

      {/* ── Calendar preview ── */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-10">
            {/* Text */}
            <Reveal className="flex-1 min-w-0">
              <div className="max-w-lg">
                <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
                  Never miss a deadline
                </h2>
                <p className="text-base text-muted-foreground leading-relaxed mb-8">
                  Every school gets its own deadline on a built-in calendar. Track EA, ED, and RD windows so you always know what's coming up.
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

            {/* Mock calendar */}
            <Reveal delay={0.1} className="shrink-0">
              <MockCalendar />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">How It Works</p>
            <h2 className="text-4xl font-bold text-foreground">Simple by design</h2>
          </Reveal>

          <Reveal stagger className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
            <StaggerItem className="h-full">
              <Step
                n={1}
                title="Add your colleges"
                description="Search any school and add it to your list in seconds."
              />
            </StaggerItem>
            <StaggerItem className="h-full">
              <Step
                n={2}
                title="Track deadlines & progress"
                description="Set deadlines, update your status, and know exactly where each application stands."
              />
            </StaggerItem>
            <StaggerItem className="h-full">
              <Step
                n={3}
                title="Monitor decisions"
                description="Record outcomes as they arrive and see your full results in one place."
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
              Stay organized through application season.
            </h2>
            <p className="text-sm text-muted-foreground mb-10 max-w-md mx-auto leading-relaxed">
              Start tracking your college applications today. Deadlines, decisions, and progress all in one place, for free.
            </p>
            <Link
              href="/auth?mode=signup"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              Start Tracking Your Colleges
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      <Footer />
    </main>
  );
}
