"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { PasswordStrengthIndicator } from "@/components/ui/premium-auth";
import { Calendar, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { UsageMeter, useUsage } from "@/components/usage-meter";
import { UpgradeModal } from "@/components/upgrade-modal";

type CalendarStatus = "loading" | "connected" | "disconnected";

function SettingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);

  // Change password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Calendar integration
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>("loading");
  const [disconnecting, setDisconnecting] = useState(false);

  // Billing
  const { data: usage, loading: usageLoading, refresh: refreshUsage } = useUsage();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/auth"); return; }
      setUser(user);
    });
  }, [supabase, router]);

  // Handle OAuth callback result
  useEffect(() => {
    const result = searchParams.get("calendar");
    if (!result) return;
    if (result === "connected") toast.success("Google Calendar connected", { description: "Your deadlines will now sync automatically." });
    else if (result === "denied") toast.info("Google Calendar access denied", { description: "You can connect anytime from this page." });
    else if (result === "error") toast.error("Couldn't connect Google Calendar", { description: "Something went wrong. Please try again." });
    router.replace("/settings");
  }, [searchParams, router]);

  // Handle post-checkout return: ?upgraded=1&session_id=... fires the
  // session-verify fallback so a slow webhook doesn't leave the user blocked.
  useEffect(() => {
    const upgraded = searchParams.get("upgraded");
    const sessionId = searchParams.get("session_id");
    if (upgraded === "1" && sessionId) {
      fetch(`/api/billing/verify-session?session_id=${encodeURIComponent(sessionId)}`, {
        method: "POST",
      })
        .then((r) => r.json())
        .then(() => {
          toast.success("Subscription active", { description: "Your plan has been upgraded." });
          refreshUsage();
        })
        .catch(() => {
          toast.error("We couldn't verify the payment yet. It should activate within a minute.");
        });
      router.replace("/settings");
    } else if (upgraded === "0") {
      toast.info("Checkout cancelled");
      router.replace("/settings");
    }
  }, [searchParams, router, refreshUsage]);

  async function handleOpenPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed");
      window.location.href = data.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error("Couldn't open billing portal", { description: msg });
      setPortalLoading(false);
    }
  }

  // Fetch calendar connection status
  useEffect(() => {
    if (!user) return;
    fetch("/api/calendar/google/status")
      .then((r) => r.json())
      .then((d: { connected: boolean }) => setCalendarStatus(d.connected ? "connected" : "disconnected"))
      .catch(() => setCalendarStatus("disconnected"));
  }, [user]);

  async function handleCalendarDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/calendar/google/disconnect", { method: "POST" });
      if (res.ok) { setCalendarStatus("disconnected"); toast.success("Google Calendar disconnected"); }
      else toast.error("Couldn't disconnect. Please try again.");
    } catch { toast.error("Couldn't disconnect. Please try again."); }
    finally { setDisconnecting(false); }
  }

  function validatePassword(pw: string): string | null {
    if (pw.length < 8)              return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(pw))         return "Password must contain at least one uppercase letter.";
    if (!/[a-z]/.test(pw))         return "Password must contain at least one lowercase letter.";
    if (!/\d/.test(pw))            return "Password must contain at least one number.";
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw))
                                   return "Password must contain at least one special character.";
    return null;
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    const strengthError = validatePassword(newPassword);
    if (strengthError) { setPwError(strengthError); return; }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match.");
      return;
    }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwLoading(false);
    if (error) { setPwError(error.message); return; }
    setPwSuccess(true);
    setNewPassword("");
    setConfirmPassword("");
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== "delete") return;
    setDeleteLoading(true);
    setDeleteError(null);
    const res = await fetch("/api/delete-account", { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setDeleteError(data.error ?? "Something went wrong. Try again.");
      setDeleteLoading(false);
      return;
    }
    await supabase.auth.signOut();
    router.push("/");
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-background" suppressHydrationWarning>
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-foreground mb-8">Settings</h1>

        {/* ── Account ── */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Account
          </h2>
          <div className="rounded-xl border border-border bg-card p-6">
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Email address
            </label>
            <div className="h-10 w-full rounded-lg border border-border bg-muted/50 px-3 flex items-center text-sm text-muted-foreground select-all">
              {user.email}
            </div>
          </div>
        </section>

        {/* ── Billing ── */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Billing
          </h2>
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <UsageMeter data={usage} loading={usageLoading} />
            <div className="flex flex-wrap items-center gap-2">
              {usage?.plan === "free" ? (
                <button
                  onClick={() => setUpgradeOpen(true)}
                  className="inline-flex items-center rounded-lg bg-primary px-4 h-9 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  Upgrade plan
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setUpgradeOpen(true)}
                    className="inline-flex items-center rounded-lg border border-border px-4 h-9 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    Change plan
                  </button>
                  <button
                    onClick={handleOpenPortal}
                    disabled={portalLoading}
                    className="inline-flex items-center rounded-lg border border-border px-4 h-9 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    {portalLoading ? "Opening…" : "Manage subscription"}
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── Security ── */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Security
          </h2>
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Change Password</h3>
            <form onSubmit={handleChangePassword} className="space-y-3 max-w-sm">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  New password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="New password"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow"
                />
                <PasswordStrengthIndicator password={newPassword} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Confirm new password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Confirm password"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow"
                />
              </div>
              {pwError && (
                <p className="text-xs text-destructive">{pwError}</p>
              )}
              {pwSuccess && (
                <p className="text-xs text-[hsl(142,60%,35%)]">Password updated successfully.</p>
              )}
              <button
                type="submit"
                disabled={pwLoading}
                className="inline-flex items-center rounded-lg bg-primary px-4 h-9 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {pwLoading ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>
        </section>

        {/* ── Integrations ── */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Integrations
          </h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Calendar className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Google Calendar</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {calendarStatus === "loading" ? (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    ) : calendarStatus === "connected" ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        <span className="text-xs text-emerald-600 font-medium">Connected — deadlines syncing</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 text-muted-foreground/50" />
                        <span className="text-xs text-muted-foreground">Not connected</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="shrink-0">
                {calendarStatus === "loading" ? null : calendarStatus === "connected" ? (
                  <button
                    onClick={handleCalendarDisconnect}
                    disabled={disconnecting}
                    className="h-8 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    {disconnecting ? "Disconnecting…" : "Disconnect"}
                  </button>
                ) : (
                  <a
                    href="/api/calendar/google/connect"
                    className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Connect
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Danger Zone ── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Danger Zone
          </h2>
          <div className="rounded-xl border border-destructive/40 bg-card p-6">
            <h3 className="text-sm font-semibold text-foreground mb-1">Delete Account</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Permanently delete your account and all tracked data. This cannot be undone.
            </p>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center rounded-lg border border-destructive/50 px-4 h-9 text-sm font-semibold text-destructive hover:bg-destructive/5 transition-colors"
              >
                Delete Account
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-foreground">
                  Type <span className="font-mono font-bold">delete</span> to confirm.
                </p>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value.toLowerCase())}
                  placeholder='Type "delete"'
                  className="h-10 w-full max-w-xs rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-destructive/30 transition-shadow"
                />
                {deleteError && (
                  <p className="text-xs text-destructive">{deleteError}</p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirm !== "delete" || deleteLoading}
                    className="inline-flex items-center rounded-lg bg-destructive px-4 h-9 text-sm font-semibold text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    {deleteLoading ? "Deleting..." : "Confirm Delete"}
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirm("");
                      setDeleteError(null);
                    }}
                    className="inline-flex items-center rounded-lg px-4 h-9 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        currentPlan={usage?.plan ?? "free"}
        initialTier={usage?.plan === "plus" ? "unlimited" : "plus"}
      />
    </main>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPageInner />
    </Suspense>
  );
}
