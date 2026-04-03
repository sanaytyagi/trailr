"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { TrackedCollege } from "@/types";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{
    ownerId: string;
  }>;
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: "Not Started", color: "hsl(215,15%,50%)", bg: "hsl(215,15%,94%)" },
  in_progress: { label: "In Progress", color: "hsl(38,85%,35%)", bg: "hsl(38,85%,95%)" },
  submitted: { label: "Submitted", color: "hsl(205,85%,50%)", bg: "hsl(205,85%,96%)" },
};

const DECISION_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "hsl(220,70%,28%)", bg: "hsl(220,70%,95%)" },
  accepted: { label: "Accepted", color: "hsl(142,60%,30%)", bg: "hsl(142,60%,95%)" },
  rejected: { label: "Rejected", color: "hsl(0,65%,42%)", bg: "hsl(0,65%,96%)" },
  waitlisted: { label: "Waitlisted", color: "hsl(38,85%,35%)", bg: "hsl(38,85%,95%)" },
  deferred: { label: "Deferred", color: "hsl(25,85%,38%)", bg: "hsl(25,85%,95%)" },
};

export default function SharedListPage({ params: paramsPromise }: PageProps) {
  const params = use(paramsPromise);
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [colleges, setColleges] = useState<TrackedCollege[]>([]);
  const [ownerName, setOwnerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth?mode=signin");
        return;
      }

      // Check if user has access to this list (via list_shares)
      const { data: shares } = await supabase
        .from("list_shares")
        .select("owner_name")
        .eq("owner_id", params.ownerId)
        .eq("shared_with_email", user.email)
        .single();

      if (!shares) {
        setLoading(false);
        setHasAccess(false);
        return;
      }

      setOwnerName(shares.owner_name);
      setHasAccess(true);

      // Fetch owner's colleges
      const { data, error } = await supabase
        .from("user_colleges")
        .select("*, college:colleges(*)")
        .eq("user_id", params.ownerId)
        .order("added_at", { ascending: true });

      setLoading(false);

      if (!error && data) {
        const colleges = (data as any[]).map((row) => ({
          ...row.college,
          application_status: row.application_status ?? "not_started",
          application_round: row.application_round ?? "unknown",
          decision: row.decision ?? null,
          admissions_category: row.admissions_category ?? null,
          personal_deadline: row.personal_deadline ?? null,
          notes: row.notes ?? "",
          added_at: row.added_at,
        }));

        setColleges(colleges);
      }
    }

    load();
  }, [params, supabase, router]);

  if (loading) {
    return (
      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </main>
    );
  }

  if (!hasAccess) {
    return (
      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don't have permission to view this list.
          </p>
          <Button onClick={() => router.push("/lists")}>Back to Lists</Button>
        </div>
      </main>
    );
  }

  const stats = {
    total: colleges.length,
    submitted: colleges.filter((c) => c.application_status === "submitted").length,
    accepted: colleges.filter((c) => c.decision === "accepted").length,
    rejected: colleges.filter((c) => c.decision === "rejected").length,
    waitlisted: colleges.filter((c) => c.decision === "waitlisted").length,
  };

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">{ownerName}'s College List</h1>
        <p className="text-sm text-muted-foreground">
          {colleges.length > 0
            ? `Viewing ${colleges.length} college${colleges.length !== 1 ? "s" : ""}`
            : "This list is empty"}
        </p>
      </div>

      {colleges.length === 0 ? (
        <div className="rounded-xl border border-border bg-card shadow-sm p-12 text-center">
          <p className="text-sm text-muted-foreground">{ownerName} hasn't added any colleges yet</p>
        </div>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            <div className="group rounded-xl border bg-card px-5 py-4 flex flex-col gap-1 text-left w-full shadow-sm border-border">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Colleges
              </span>
              <span className="text-3xl font-bold tabular-nums text-foreground">
                {stats.total}
              </span>
            </div>
            <div className="group rounded-xl border bg-card px-5 py-4 flex flex-col gap-1 text-left w-full shadow-sm border-border">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Submitted
              </span>
              <span className="text-3xl font-bold tabular-nums text-[hsl(205,85%,45%)]">
                {stats.submitted}
              </span>
            </div>
            <div className="group rounded-xl border bg-card px-5 py-4 flex flex-col gap-1 text-left w-full shadow-sm border-border">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Accepted
              </span>
              <span className="text-3xl font-bold tabular-nums text-[hsl(142,60%,35%)]">
                {stats.accepted}
              </span>
            </div>
            <div className="group rounded-xl border bg-card px-5 py-4 flex flex-col gap-1 text-left w-full shadow-sm border-border">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Waitlisted
              </span>
              <span className="text-3xl font-bold tabular-nums text-[hsl(38,85%,35%)]">
                {stats.waitlisted}
              </span>
            </div>
            <div className="group rounded-xl border bg-card px-5 py-4 flex flex-col gap-1 text-left w-full shadow-sm border-border">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Rejected
              </span>
              <span className="text-3xl font-bold tabular-nums text-[hsl(0,65%,45%)]">
                {stats.rejected}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-6 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Application Progress</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {stats.submitted} of {stats.total} submitted
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  stats.submitted === stats.total && stats.total > 0
                    ? "bg-[hsl(142,60%,40%)]"
                    : "bg-primary"
                }`}
                style={{
                  width: `${stats.total > 0 ? (stats.submitted / stats.total) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {stats.total - stats.submitted} remaining
            </p>
          </div>

          {/* College table - read-only version of tracker */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-6 py-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        College
                      </span>
                    </th>
                    <th className="text-left px-6 py-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Application
                      </span>
                    </th>
                    <th className="text-left px-6 py-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Decision
                      </span>
                    </th>
                    <th className="text-left px-6 py-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Deadline
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {colleges.map((college) => {
                    const status = STATUS_STYLE[college.application_status];
                    const decision = college.decision
                      ? DECISION_STYLE[college.decision]
                      : null;

                    return (
                      <tr
                        key={college.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        {/* College name + location */}
                        <td className="px-6 py-4">
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground truncate">
                              {college.name}
                            </div>
                            {college.location && (
                              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                {college.location}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Application status */}
                        <td className="px-6 py-4">
                          <span
                            className="text-xs font-medium rounded-md px-2 py-1 whitespace-nowrap inline-block"
                            style={{
                              color: status.color,
                              backgroundColor: status.bg,
                            }}
                          >
                            {status.label}
                          </span>
                        </td>

                        {/* Decision */}
                        <td className="px-6 py-4">
                          {decision ? (
                            <span
                              className="text-xs font-medium rounded-md px-2 py-1 whitespace-nowrap inline-block"
                              style={{
                                color: decision.color,
                                backgroundColor: decision.bg,
                              }}
                            >
                              {decision.label}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Deadline */}
                        <td className="px-6 py-4">
                          {college.personal_deadline ? (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(
                                college.personal_deadline + "T00:00:00"
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
