"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  GraduationCap,
  CalendarDays,
  LayoutList,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
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
  const inView = useInView(ref, { once: false, margin: "-60px" });

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
    <div className="rounded-xl border border-border bg-card px-6 py-5 shadow-sm flex flex-col gap-3 h-full transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
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
  name,
  rate,
  category,
  catColor,
  status,
  statusColor,
  decision,
  decisionColor,
  deadline,
}: {
  name: string;
  rate: string;
  category: string;
  catColor: string;
  status: string;
  statusColor: string;
  decision: string;
  decisionColor: string;
  deadline: string;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="pl-4 pr-3 py-3.5">
        <span className="text-sm font-medium text-foreground">{name}</span>
      </td>
      <td className="px-4 py-3.5 text-sm text-muted-foreground tabular-nums">{rate}</td>
      <td className="px-4 py-3.5">
        <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${catColor}`}>
          {category}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${statusColor}`}>
          {status}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${decisionColor}`}>
          {decision}
        </span>
      </td>
      <td className="px-4 py-3.5 text-xs text-muted-foreground">{deadline}</td>
    </tr>
  );
}

// ── Step ──────────────────────────────────────────────────────────────────────

function Step({ n, title, description }: { n: number; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-6 py-6 shadow-sm h-full transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30">
      <div className="flex gap-4 items-start">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
          {n}
        </div>
        <div className="pt-0.5">
          <p className="text-sm font-semibold text-foreground mb-0.5">{title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <main>
      {/* ── Hero ── */}
      <section className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 pt-24 pb-20 text-center">
        <Reveal delay={0}>
          <h1 className="text-6xl sm:text-8xl font-bold tracking-tight text-foreground mb-5 leading-[1.05]">
            Stay on top of it.
          </h1>
        </Reveal>

        <Reveal delay={0.14}>
          <p className="text-base text-muted-foreground max-w-sm mx-auto mb-10 leading-relaxed">
            Track every college, deadline, and decision — all in one place.
          </p>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/tracker"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#preview"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors shadow-sm"
            >
              View Demo
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.28}>
          <div className="mt-16 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 shadow-inner">
              <GraduationCap className="h-10 w-10 text-primary" />
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Features ── */}
      <section className="border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground">Built for the application season</h2>
          </Reveal>

          <Reveal stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StaggerItem>
              <FeatureCard
                icon={LayoutList}
                title="Track all your colleges"
                description="Add every school you're considering and keep them organized in one place."
                accent="bg-primary/10 text-primary"
              />
            </StaggerItem>
            <StaggerItem>
              <FeatureCard
                icon={CalendarDays}
                title="Never miss a deadline"
                description="Set personal deadlines for each college and get a clear countdown on every row."
                accent="bg-[hsl(142,60%,90%)] text-[hsl(142,60%,30%)]"
              />
            </StaggerItem>
            <StaggerItem>
              <FeatureCard
                icon={TrendingUp}
                title="Organize application status"
                description="Tag each school as Not Started, In Progress, or Submitted at a glance."
                accent="bg-[hsl(38,85%,92%)] text-[hsl(38,85%,35%)]"
              />
            </StaggerItem>
            <StaggerItem>
              <FeatureCard
                icon={CheckCircle2}
                title="Track decisions and outcomes"
                description="Record acceptances, rejections, waitlists, and deferrals as they arrive."
                accent="bg-[hsl(205,85%,93%)] text-[hsl(205,85%,40%)]"
              />
            </StaggerItem>
          </Reveal>
        </div>
      </section>

      {/* ── Dashboard preview ── */}
      <section id="preview" className="py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground">See exactly what you're working with</h2>
          </Reveal>

          <Reveal>
            <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
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
                  <div className="text-xs text-muted-foreground">Tracking 5 colleges</div>
                </div>

                {/* Stat cards — staggered inside the already-revealed parent */}
                <div className="grid grid-cols-5 gap-3 mb-5">
                  <MockStatCard label="Colleges" value="5" />
                  <MockStatCard label="Submitted" value="3" accent="text-[hsl(205,85%,45%)]" />
                  <MockStatCard label="Accepted" value="1" accent="text-[hsl(142,60%,35%)]" />
                  <MockStatCard label="Waitlisted" value="1" accent="text-[hsl(38,85%,35%)]" />
                  <MockStatCard label="Rejected" value="0" accent="text-[hsl(0,65%,45%)]" />
                </div>

                {/* Progress bar */}
                <div className="rounded-xl border border-border bg-card px-5 py-4 mb-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Application Progress</span>
                    <span className="text-sm text-muted-foreground tabular-nums">3 of 5 submitted</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: "60%" }} />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">2 remaining</p>
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
                        <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Decision</th>
                        <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Deadline</th>
                      </tr>
                    </thead>
                    <tbody>
                      <MockRow
                        name="MIT" rate="3.9%"
                        category="Reach" catColor="text-[hsl(0,65%,42%)] bg-[hsl(0,65%,96%)] border-[hsl(0,65%,80%)]"
                        status="Submitted" statusColor="text-[hsl(205,85%,50%)] bg-[hsl(205,85%,96%)] border-[hsl(205,85%,78%)]"
                        decision="Pending" decisionColor="text-[hsl(220,70%,28%)] bg-[hsl(220,70%,95%)] border-[hsl(220,70%,72%)]"
                        deadline="Jan 1"
                      />
                      <MockRow
                        name="UCLA" rate="8.6%"
                        category="Reach" catColor="text-[hsl(0,65%,42%)] bg-[hsl(0,65%,96%)] border-[hsl(0,65%,80%)]"
                        status="Submitted" statusColor="text-[hsl(205,85%,50%)] bg-[hsl(205,85%,96%)] border-[hsl(205,85%,78%)]"
                        decision="Accepted" decisionColor="text-[hsl(142,60%,30%)] bg-[hsl(142,60%,95%)] border-[hsl(142,60%,78%)]"
                        deadline="Nov 30"
                      />
                      <MockRow
                        name="UMich" rate="17.7%"
                        category="Target" catColor="text-[hsl(38,85%,35%)] bg-[hsl(38,85%,95%)] border-[hsl(38,85%,75%)]"
                        status="Submitted" statusColor="text-[hsl(205,85%,50%)] bg-[hsl(205,85%,96%)] border-[hsl(205,85%,78%)]"
                        decision="Waitlisted" decisionColor="text-[hsl(38,85%,35%)] bg-[hsl(38,85%,95%)] border-[hsl(38,85%,75%)]"
                        deadline="Feb 1"
                      />
                      <MockRow
                        name="Ohio State" rate="49%"
                        category="Safety" catColor="text-[hsl(142,60%,30%)] bg-[hsl(142,60%,95%)] border-[hsl(142,60%,78%)]"
                        status="In Progress" statusColor="text-[hsl(38,85%,35%)] bg-[hsl(38,85%,95%)] border-[hsl(38,85%,75%)]"
                        decision="—" decisionColor="text-muted-foreground bg-muted border-border"
                        deadline="Feb 15"
                      />
                      <MockRow
                        name="Penn State" rate="54%"
                        category="Safety" catColor="text-[hsl(142,60%,30%)] bg-[hsl(142,60%,95%)] border-[hsl(142,60%,78%)]"
                        status="Not Started" statusColor="text-muted-foreground bg-muted border-border"
                        decision="—" decisionColor="text-muted-foreground bg-muted border-border"
                        deadline="Mar 1"
                      />
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground">Simple by design</h2>
          </Reveal>

          <Reveal stagger className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <StaggerItem>
              <Step
                n={1}
                title="Add your colleges"
                description="Search any school and add it to your personal list in seconds."
              />
            </StaggerItem>
            <StaggerItem>
              <Step
                n={2}
                title="Track applications and deadlines"
                description="Set deadlines and update your application status as you go."
              />
            </StaggerItem>
            <StaggerItem>
              <Step
                n={3}
                title="Monitor decisions"
                description="Record outcomes as they come in and see your full picture at a glance."
              />
            </StaggerItem>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
              Stay organized through application season.
            </h2>
            <p className="text-sm text-muted-foreground mb-10 max-w-md mx-auto leading-relaxed">
              Everything you need to manage your college list, deadlines, and decisions — in one place, for free.
            </p>
            <Link
              href="/tracker"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              Start Tracking Your Colleges
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GraduationCap className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-bold text-foreground">Trailr</span>
            <span className="text-xs text-muted-foreground ml-1">© {new Date().getFullYear()}</span>
          </div>
          <nav className="flex items-center gap-5">
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">About</a>
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Contact</a>
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
