"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
}

interface Share {
  id: string;
  shared_with_email: string;
}

export function ShareModal({ open, onOpenChange, userId, userEmail }: ShareModalProps) {
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [userName, setUserName] = useState("");

  // Fetch user data and shares when modal opens
  useEffect(() => {
    if (!open) return;

    async function fetchData() {
      // Get current user's full name
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const name = user.user_metadata?.name || userEmail;
        setUserName(name);
      }

      // Fetch shares
      const { data, error } = await supabase
        .from("list_shares")
        .select("id, shared_with_email")
        .eq("owner_id", userId);

      if (!error && data) {
        setShares(data);
      }
    }

    fetchData();
  }, [open, userId, userEmail, supabase]);

  const isValidEmail = (email: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleAdd = async () => {
    setEmailError("");
    setSuccessMessage("");

    if (!email.trim()) {
      setEmailError("Please enter an email address");
      return;
    }

    if (!isValidEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    if (shares.some((s) => s.shared_with_email === email)) {
      setEmailError("This email is already in your share list");
      return;
    }

    setLoading(true);

    // Validate that the email belongs to a registered user
    const checkRes = await fetch("/api/validate-share-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const { exists } = await checkRes.json();

    if (!exists) {
      setLoading(false);
      setEmailError("No account found with that email address");
      return;
    }

    const { error } = await supabase.from("list_shares").insert({
      owner_id: userId,
      owner_email: userEmail,
      owner_name: userName,
      shared_with_email: email,
    });

    setLoading(false);

    if (error) {
      setEmailError(error.message || "Failed to add share");
      return;
    }

    setSuccessMessage(`${email} can now view your list`);
    setEmail("");

    // Refresh shares list
    const { data: updated } = await supabase
      .from("list_shares")
      .select("id, shared_with_email")
      .eq("owner_id", userId);

    if (updated) {
      setShares(updated);
    }

    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const handleRemove = async (shareId: string) => {
    setRemoving(shareId);

    const { error } = await supabase.from("list_shares").delete().eq("id", shareId);

    setRemoving(null);

    if (!error) {
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Share Your List</DialogTitle>
          <DialogDescription>
            Add email addresses to share your college list with others
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Input section */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Enter email address"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                  setSuccessMessage("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <Button onClick={handleAdd} disabled={loading || !email.trim()}>
                Add
              </Button>
            </div>

            {/* Error message */}
            {emailError && <p className="text-xs text-red-500">{emailError}</p>}

            {/* Success message */}
            {successMessage && <p className="text-xs text-green-600">{successMessage}</p>}
          </div>

          {/* Current shares list */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">
              Shared with ({shares.length})
            </h3>

            {shares.length === 0 ? (
              <p className="text-xs text-muted-foreground">No shares yet</p>
            ) : (
              <ul className="space-y-1.5">
                {shares.map((share) => (
                  <li
                    key={share.id}
                    className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                  >
                    <span className="text-sm text-foreground">{share.shared_with_email}</span>
                    <button
                      onClick={() => handleRemove(share.id)}
                      disabled={removing === share.id}
                      className={cn(
                        "rounded p-1 transition-colors hover:bg-muted",
                        removing === share.id
                          ? "text-muted-foreground cursor-not-allowed"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      aria-label="Remove share"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
