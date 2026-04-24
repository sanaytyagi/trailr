"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { ShareModal } from "@/components/lists/ShareModal";
import { Button } from "@/components/ui/button";
import { SignInRequired } from "@/components/sign-in-required";
import { cn } from "@/lib/utils";

interface MyListStats {
  total: number;
  submitted: number;
  accepted: number;
  waitlisted: number;
  rejected: number;
  pending: number;
}

interface Share {
  id: string;
  owner_id: string;
  owner_email: string;
  owner_name: string;
  shared_with_email: string;
}

interface SharedListWithStats extends Share {
  stats: MyListStats;
}

export default function ListsPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [myStats, setMyStats] = useState<MyListStats | null>(null);
  const [sharedLists, setSharedLists] = useState<SharedListWithStats[]>([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharedSearch, setSharedSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser ?? null);

      if (!authUser) {
        setLoading(false);
        return;
      }

      // Fetch user's own college stats
      const { data: myColleges } = await supabase
        .from("user_colleges")
        .select("decision, application_status");

      if (myColleges) {
        const stats = {
          total: myColleges.length,
          submitted: myColleges.filter((c) => c.application_status === "submitted").length,
          accepted: myColleges.filter((c) => c.decision === "accepted").length,
          waitlisted: myColleges.filter((c) => c.decision === "waitlisted").length,
          rejected: myColleges.filter((c) => c.decision === "rejected").length,
          pending: myColleges.filter((c) => c.decision === "pending").length,
        };
        setMyStats(stats);
      }

      // Fetch shares where user is the recipient
      const { data: shares } = authUser.email
        ? await supabase
            .from("list_shares")
            .select("id, owner_id, owner_email, owner_name, shared_with_email")
            .eq("shared_with_email", authUser.email)
        : { data: [] };

      if (shares && shares.length > 0) {
        // For each share, fetch owner's college stats
        const sharedListsWithStats = await Promise.all(
          shares.map(async (share) => {
            const { data: ownerColleges } = await supabase
              .from("user_colleges")
              .select("decision, application_status")
              .eq("user_id", share.owner_id);

            const colleges = ownerColleges || [];
            return {
              ...share,
              stats: {
                total: colleges.length,
                submitted: colleges.filter((c) => c.application_status === "submitted").length,
                accepted: colleges.filter((c) => c.decision === "accepted").length,
                waitlisted: colleges.filter((c) => c.decision === "waitlisted").length,
                rejected: colleges.filter((c) => c.decision === "rejected").length,
                pending: colleges.filter((c) => c.decision === "pending").length,
              },
            };
          })
        );

        setSharedLists(sharedListsWithStats);
      }

      setLoading(false);
    }

    load();
  }, [supabase]);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </main>
    );
  }

  if (!user) {
    return <SignInRequired description="Sign in to view and share college lists." />;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">College Lists</h1>
        <p className="text-muted-foreground">
          View and manage your college list, plus any lists that have been shared with you.
        </p>
      </div>

      {/* My List Section */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-foreground mb-4">My List</h2>
        {myStats ? (
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-1">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">{user.email}</h3>

              {myStats.total === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You haven't added any colleges yet.{" "}
                  <Link href="/tracker" className="text-primary hover:underline">
                    Start tracking colleges
                  </Link>
                  .
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <div className="text-2xl font-bold text-foreground">{myStats.total}</div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <div className="text-2xl font-bold text-[hsl(205,85%,45%)]">
                        {myStats.submitted}
                      </div>
                      <div className="text-xs text-muted-foreground">Submitted</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <div className="text-2xl font-bold text-[hsl(142,60%,35%)]">
                        {myStats.accepted}
                      </div>
                      <div className="text-xs text-muted-foreground">Accepted</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <div className="text-2xl font-bold text-[hsl(38,85%,35%)]">
                        {myStats.waitlisted}
                      </div>
                      <div className="text-xs text-muted-foreground">Waitlisted</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <div className="text-2xl font-bold text-[hsl(0,65%,45%)]">
                        {myStats.rejected}
                      </div>
                      <div className="text-xs text-muted-foreground">Rejected</div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Link href="/tracker" className="flex-1">
                      <Button className="w-full">View List</Button>
                    </Link>
                    <Button
                      variant="outline"
                      onClick={() => setShareModalOpen(true)}
                      className="flex-1"
                    >
                      Share
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {/* Shared With Me Section */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-semibold text-foreground">Shared With Me</h2>
          {sharedLists.length > 0 && (
            <input
              type="text"
              placeholder="Search by name..."
              value={sharedSearch}
              onChange={(e) => setSharedSearch(e.target.value)}
              className="rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          )}
        </div>

        {sharedLists.length === 0 ? (
          <div className="rounded-xl border border-border bg-card shadow-sm p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No lists have been shared with you yet.
            </p>
          </div>
        ) : (() => {
          const filtered = sharedLists.filter((s) =>
            s.owner_name.toLowerCase().includes(sharedSearch.toLowerCase())
          );
          return filtered.length === 0 ? (
            <div className="rounded-xl border border-border bg-card shadow-sm p-8 text-center">
              <p className="text-sm text-muted-foreground">No results for "{sharedSearch}"</p>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((sharedList) => (
              <div
                key={sharedList.id}
                className="rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-1"
              >
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-foreground">{sharedList.owner_name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Shared by {sharedList.owner_name}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 my-4">
                    <div className="rounded-lg bg-muted/50 p-2 text-center">
                      <div className="text-lg font-bold text-foreground">
                        {sharedList.stats.total}
                      </div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2 text-center">
                      <div className="text-lg font-bold text-[hsl(142,60%,35%)]">
                        {sharedList.stats.accepted}
                      </div>
                      <div className="text-xs text-muted-foreground">Accepted</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2 text-center">
                      <div className="text-lg font-bold text-[hsl(38,85%,35%)]">
                        {sharedList.stats.waitlisted}
                      </div>
                      <div className="text-xs text-muted-foreground">Waitlisted</div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push(`/lists/${sharedList.owner_id}`)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View List
                  </Button>
                </div>
              </div>
            ))}
          </div>
          );
        })()}
      </section>

      {/* Share Modal */}
      {user && (
        <ShareModal
          open={shareModalOpen}
          onOpenChange={setShareModalOpen}
          userId={user.id}
          userEmail={user.email || ""}
        />
      )}
    </main>
  );
}
