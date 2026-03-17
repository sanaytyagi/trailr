"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { PasswordStrengthIndicator } from "@/components/ui/premium-auth";

export default function SettingsPage() {
  const router = useRouter();
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/auth"); return; }
      setUser(user);
    });
  }, [supabase, router]);

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
    <main className="min-h-screen bg-background">
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
    </main>
  );
}
