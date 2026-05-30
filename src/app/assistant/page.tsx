"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { ArrowUp, Globe, Sparkles, RotateCcw, Square, Loader2 } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/components/ui/prompt-input";
import { AssistantSidebar } from "@/components/assistant-sidebar";
import { PaywallSheet } from "@/components/paywall-sheet";
import { useUsage } from "@/components/usage-meter";

type DBMessage = { id: string; role: "user" | "assistant"; content: string };

function toUIMessage(m: DBMessage): UIMessage {
  return {
    id: m.id,
    role: m.role,
    parts: [{ type: "text", text: m.content }],
  };
}

function messageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function isActiveToolCall(m: UIMessage): boolean {
  return m.parts.some((p) => {
    if (!isToolUIPart(p as never)) return false;
    const state = (p as { state?: string }).state;
    return state === "input-streaming" || state === "input-available";
  });
}

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Reveals text character-by-character using rAF so the stream feels smooth
// regardless of how large or irregular the server chunks are.
function useTypewriter(fullText: string, active: boolean): string {
  const [revealed, setRevealed] = useState(() => (active && !REDUCED_MOTION ? "" : fullText));
  const fullTextRef = useRef(fullText);
  const revealedLenRef = useRef(active && !REDUCED_MOTION ? 0 : fullText.length);
  const rafRef = useRef<number | null>(null);

  // Keep the latest received text in a ref without restarting the loop.
  useEffect(() => {
    fullTextRef.current = fullText;
    if (!active) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      revealedLenRef.current = fullText.length;
      setRevealed(fullText);
    }
  }, [fullText, active]);

  const tick = useCallback(() => {
    const cur = revealedLenRef.current;
    const target = fullTextRef.current;
    if (cur < target.length) {
      const next = Math.min(cur + 3, target.length);
      revealedLenRef.current = next;
      setRevealed(target.slice(0, next));
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!active || REDUCED_MOTION) return;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active, tick]);

  return revealed;
}

const SUGGESTED_PROMPTS = {
  prioritize: "What should I prioritize this week?",
  brainstorm: "Help me brainstorm my Common App essay",
  earlyAction: "Should I apply early action anywhere?",
} as const;

export default function AssistantPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, loading: profileLoading } = useProfile();
  const [supabase] = useState(() => createClient());

  const [initialReady, setInitialReady] = useState(false);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [pendingOpening, setPendingOpening] = useState<UIMessage | null>(null);
  const [fetchingOpening, setFetchingOpening] = useState(false);
  const [firstCollege, setFirstCollege] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const initializingRef = useRef(false);
  const setChatInputRef = useRef<(value: string) => void>(() => {});
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { data: usage, refresh: refreshUsage } = useUsage();

  const handlePrefill = (text: string) => {
    setChatInputRef.current(text);
  };

  // Auth + role gating
  useEffect(() => {
    if (profileLoading) return;
    if (!profile) {
      router.replace("/auth?mode=login");
      return;
    }
    if (profile.role === "counselor") {
      router.replace("/counselor");
      return;
    }
  }, [profile, profileLoading, router]);

  // Load history + opening + first college
  useEffect(() => {
    if (profileLoading || !profile || profile.role !== "student") return;

    let cancelled = false;

    async function init() {
      if (initializingRef.current) return;
      initializingRef.current = true;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any;
        const [historyRes, collegesRes] = await Promise.all([
          db
            .from("assistant_messages")
            .select("id, role, content")
            .order("created_at", { ascending: true })
            .limit(20),
          db
            .from("user_colleges")
            .select("sort_order, colleges(name)")
            .order("sort_order", { ascending: true, nullsFirst: false })
            .limit(1),
        ]);

        if (cancelled) return;

        const firstCollegeName =
          (collegesRes.data?.[0] as { colleges?: { name?: string } } | undefined)?.colleges?.name ?? null;
        setFirstCollege(firstCollegeName);

        const history = (historyRes.data ?? []) as DBMessage[];

        if (history.length > 0) {
          setInitialMessages(history.map(toUIMessage));
          setInitialReady(true);
          return;
        }

        // No history: show the page immediately, fetch the opening in the background.
        // This prevents blocking the spinner on the Claude API call (~5-15s).
        setInitialReady(true);
        setFetchingOpening(true);

        try {
          const res = await fetch("/api/assistant/opening", { method: "POST" });
          if (cancelled) return;
          if (!res.ok) {
            setFetchingOpening(false);
            return;
          }
          const { message } = (await res.json()) as { message: string | null };
          if (cancelled) return;
          if (!message) {
            // Messages already exist server-side (race condition) — reload history.
            const { data: freshHistory } = await (supabase as any)
              .from("assistant_messages")
              .select("id, role, content")
              .order("created_at", { ascending: true })
              .limit(20);
            if (cancelled) return;
            setFetchingOpening(false);
            setInitialMessages(((freshHistory ?? []) as DBMessage[]).map(toUIMessage));
            return;
          }
          setPendingOpening({
            id: `opening-${Date.now()}`,
            role: "assistant",
            parts: [{ type: "text", text: message }],
          });
          setFetchingOpening(false);
        } catch {
          if (!cancelled) setFetchingOpening(false);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to init assistant:", err);
        setInitError(err instanceof Error ? err.message : "Failed to load assistant");
        setInitialReady(true);
      } finally {
        initializingRef.current = false;
      }
    }

    init();
    return () => {
      cancelled = true;
      initializingRef.current = false;
    };
  }, [profile, profileLoading, supabase, pathname]);

  if (profileLoading || !initialReady || !profile || profile.role !== "student") {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleReset = async () => {
    initializingRef.current = false;
    setPendingOpening(null);
    setFetchingOpening(false);
    setInitialReady(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    await db.from("assistant_messages").delete().eq("user_id", profile.id);
    try {
      const res = await fetch("/api/assistant/opening", { method: "POST" });
      if (res.ok) {
        const { message } = (await res.json()) as { message: string | null };
        if (message) {
          setInitialMessages([
            {
              id: `opening-${Date.now()}`,
              role: "assistant",
              parts: [{ type: "text", text: message }],
            },
          ]);
        } else {
          setInitialMessages([]);
        }
      } else {
        const body = await res.json().catch(() => ({}));
        if (res.status === 402 && body.code === "quota_exceeded") {
          setUpgradeOpen(true);
        }
        setInitialMessages([]);
      }
    } catch {
      setInitialMessages([]);
    }
    setInitialReady(true);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <ChatView
        key={initialMessages.map((m) => m.id).join("|") || "empty"}
        initialMessages={initialMessages}
        pendingOpening={pendingOpening}
        fetchingOpening={fetchingOpening}
        firstCollege={firstCollege}
        initError={initError}
        onReset={handleReset}
        setInputRef={setChatInputRef}
      />
      <AssistantSidebar
        userId={profile.id}
        onPrefillChat={handlePrefill}
        onQuotaExceeded={() => setUpgradeOpen(true)}
      />
      <PaywallSheet
        open={upgradeOpen}
        onOpenChange={(o) => {
          setUpgradeOpen(o);
          if (!o) refreshUsage();
        }}
        context="assistant"
        currentPlan={usage?.plan ?? "free"}
        usage={usage ? { used: usage.used, cap: usage.cap } : undefined}
      />
    </div>
  );
}

function ChatView({
  initialMessages,
  pendingOpening,
  fetchingOpening,
  firstCollege,
  initError,
  onReset,
  setInputRef,
}: {
  initialMessages: UIMessage[];
  pendingOpening: UIMessage | null;
  fetchingOpening: boolean;
  firstCollege: string | null;
  initError: string | null;
  onReset: () => void | Promise<void>;
  setInputRef: React.MutableRefObject<(value: string) => void>;
}) {
  const transport = useMemo(
    () => new DefaultChatTransport<UIMessage>({ api: "/api/assistant" }),
    [],
  );

  const { messages, sendMessage, stop, status, setMessages, error } = useChat({
    messages: initialMessages,
    transport,
  });

  // Inject the async opening message once it arrives, but only if the user
  // hasn't already sent a message (in which case we leave the chat alone).
  const openingInjectedRef = useRef(false);
  useEffect(() => {
    if (!pendingOpening || openingInjectedRef.current) return;
    if (messages.some((m) => m.role === "user")) return;
    openingInjectedRef.current = true;
    setMessages([pendingOpening]);
  }, [pendingOpening, messages, setMessages]);

  // Quota / upgrade handling: on any chat error, fetch /api/usage and open the
  // upgrade modal if the user is over their monthly cap (402 quota_exceeded).
  const { data: usage, refresh: refreshUsage } = useUsage();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  useEffect(() => {
    if (!error) return;
    fetch("/api/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((u: { plan: string; used: number; cap: number | null } | null) => {
        if (u && u.cap !== null && u.used >= u.cap) {
          setUpgradeOpen(true);
        }
      })
      .catch(() => {});
  }, [error]);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const streaming = status === "streaming" || status === "submitted";
  const hasSentAnything = messages.some((m) => m.role === "user");

  // Scroll to bottom on initial load.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const userScrolledUpRef = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      userScrolledUpRef.current = !nearBottom;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const prevMessageCountRef = useRef(messages.length);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prev = prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;
    if (messages.length > prev) {
      const newest = messages[messages.length - 1];
      if (newest?.role === "user") {
        userScrolledUpRef.current = false;
        el.scrollTop = el.scrollHeight;
      } else if (!userScrolledUpRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    } else if (streaming && !userScrolledUpRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, streaming]);

  // Expose setInput to the parent via ref so the sidebar can prefill the chat input.
  useEffect(() => {
    setInputRef.current = setInput;
  }, [setInputRef]);

  function submit() {
    const trimmed = input.trim();
    if (!trimmed || streaming || fetchingOpening) return;
    setInput("");
    sendMessage({ text: trimmed });
  }

  function handleStop() {
    stop();
  }

  function handleNewConversation() {
    setMessages([]);
    onReset();
  }

  const inputLocked = streaming || fetchingOpening;
  const showChips = !hasSentAnything && !inputLocked;
  const showTypingIndicator = status === "submitted" || fetchingOpening;
  const lastMessage = messages[messages.length - 1];
  const showSearching =
    streaming &&
    lastMessage?.role === "assistant" &&
    isActiveToolCall(lastMessage) &&
    !messageText(lastMessage).trim();

  return (
    <div className="flex h-full flex-1 min-w-0 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-foreground">AI Counselor</h1>
            <p className="text-xs text-muted-foreground">Personalized college guidance based on your applications</p>
          </div>
        </div>
        <button
          onClick={handleNewConversation}
          disabled={streaming || fetchingOpening || messages.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-3 w-3" />
          New chat
        </button>
      </div>

      {/* Scroll area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-muted/20">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 pt-6 pb-10">
          {messages.length === 0 && !showTypingIndicator && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">Your AI Counselor is ready</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">Ask anything about your colleges, essays, or application strategy below.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              message={m}
              isStreaming={streaming && i === messages.length - 1 && m.role === "assistant"}
            />
          ))}
          {showTypingIndicator && <TypingIndicatorBubble />}
          {showSearching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
              <Globe className="h-4 w-4" />
              Searching the web…
            </div>
          )}
          {error && (
            usage && usage.cap !== null && usage.used >= usage.cap ? (
              <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm flex items-center justify-between gap-3">
                <span className="text-muted-foreground">
                  You&apos;ve hit your monthly AI limit ({usage.used}/{usage.cap}).
                </span>
                <button
                  onClick={() => setUpgradeOpen(true)}
                  className="rounded-md bg-primary px-3 h-7 text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  Upgrade
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error.message || "Something went wrong. Try again."}
              </div>
            )
          )}
          {initError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {initError}
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="mx-auto max-w-5xl px-4 pt-4 pb-8">
          {showChips && (
            <div className="mb-3 flex flex-wrap gap-2">
              <Chip onClick={() => { setInput(SUGGESTED_PROMPTS.prioritize); }} label={SUGGESTED_PROMPTS.prioritize} />
              {firstCollege && (
                <Chip
                  onClick={() => { setInput(`Tell me about ${firstCollege}`); }}
                  label={`Tell me about ${firstCollege}`}
                />
              )}
              <Chip onClick={() => { setInput(SUGGESTED_PROMPTS.brainstorm); }} label={SUGGESTED_PROMPTS.brainstorm} />
              <Chip onClick={() => { setInput(SUGGESTED_PROMPTS.earlyAction); }} label={SUGGESTED_PROMPTS.earlyAction} />
            </div>
          )}
          {inputLocked && (
            <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/70 chat-dot" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-primary/70 chat-dot" style={{ animationDelay: "160ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-primary/70 chat-dot" style={{ animationDelay: "320ms" }} />
              <span>{fetchingOpening ? "Generating your welcome message…" : "AI is responding…"}</span>
            </div>
          )}
          <PromptInput
            value={input}
            onValueChange={setInput}
            isLoading={inputLocked}
            onSubmit={submit}
            className="w-full"
          >
            <PromptInputTextarea
              placeholder={fetchingOpening ? "Generating your welcome message…" : streaming ? "Waiting for response…" : "Ask anything about your applications…"}
              maxLength={4000}
            />
            <PromptInputActions className="justify-between pt-1">
              <span className={`text-xs px-1 ${input.length >= 3600 ? "text-destructive" : "text-muted-foreground"}`}>
                {input.length > 0 ? `${input.length}/4000` : ""}
              </span>
              <PromptInputAction
                tooltip={streaming ? "Stop generation" : "Send message"}
                side="top"
              >
                <Button
                  variant="default"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={streaming ? handleStop : submit}
                  disabled={fetchingOpening || (!streaming && !input.trim())}
                >
                  {streaming ? (
                    <Square className="size-4 fill-current" />
                  ) : (
                    <ArrowUp className="size-4" />
                  )}
                </Button>
              </PromptInputAction>
            </PromptInputActions>
          </PromptInput>
        </div>
      </div>
      <PaywallSheet
        open={upgradeOpen}
        onOpenChange={(o) => {
          setUpgradeOpen(o);
          if (!o) refreshUsage();
        }}
        context="assistant"
        currentPlan={usage?.plan ?? "free"}
        usage={usage ? { used: usage.used, cap: usage.cap } : undefined}
      />
    </div>
  );
}

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground/80 shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-foreground hover:shadow-none active:scale-[0.98]"
    >
      <ArrowUp className="h-3 w-3 rotate-45 text-primary/60 shrink-0" />
      {label}
    </button>
  );
}

function TypingIndicatorBubble() {
  return (
    <div className="flex w-full items-start gap-2">
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="max-w-2xl rounded-2xl border border-border/50 bg-card px-4 py-3 shadow-sm">
        <div className="flex h-5 items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/60 chat-dot" style={{ animationDelay: "0ms" }} />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/60 chat-dot" style={{ animationDelay: "160ms" }} />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/60 chat-dot" style={{ animationDelay: "320ms" }} />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, isStreaming }: { message: UIMessage; isStreaming?: boolean }) {
  const isUser = message.role === "user";
  const rawText = messageText(message);
  const animatedText = useTypewriter(rawText, !isUser && (isStreaming ?? false));
  const text = isUser ? rawText : animatedText;

  return (
    <div className={cn("flex w-full card-enter", isUser ? "justify-end" : "items-start gap-2")}>
      {!isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
      <div
        className={cn(
          "rounded-2xl px-4 py-3 text-sm",
          isUser
            ? "max-w-[85%] bg-primary text-primary-foreground leading-6"
            : "max-w-2xl border border-border/50 bg-card text-foreground leading-relaxed shadow-sm",
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{text}</div>
        ) : (
          <div className={cn("prose prose-sm max-w-none dark:prose-invert prose-p:my-2.5 prose-ul:my-2.5 prose-ol:my-2.5 prose-headings:mt-3.5 prose-headings:mb-1.5 prose-headings:font-semibold prose-pre:bg-muted prose-pre:text-foreground prose-strong:font-semibold prose-strong:text-foreground/90", isStreaming && "prose-streaming")}>
            <ReactMarkdown
              components={{
                li: ({ children }) => (
                  <li className="border-l-2 border-border/60 py-0.5 pl-3 my-1.5">{children}</li>
                ),
              }}
            >
              {text}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
