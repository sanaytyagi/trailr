"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { ArrowUp, Globe, Sparkles, RotateCcw } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/use-profile";

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

const SUGGESTED_PROMPTS = {
  prioritize: "What should I prioritize this week?",
  brainstorm: "Help me brainstorm my Common App essay",
  earlyAction: "Should I apply early action anywhere?",
} as const;

export default function AssistantPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const [supabase] = useState(() => createClient());

  const [initialReady, setInitialReady] = useState(false);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [firstCollege, setFirstCollege] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

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

  // Load history + opening + first college (only once we know we're a student)
  useEffect(() => {
    if (profileLoading || !profile || profile.role !== "student") return;

    let cancelled = false;

    async function init() {
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

        // No history — fetch opening message from server (which also persists it).
        const res = await fetch("/api/assistant/opening", { method: "POST" });
        if (cancelled) return;
        if (!res.ok) {
          setInitialMessages([]);
          setInitialReady(true);
          return;
        }
        const { message } = (await res.json()) as { message: string };
        setInitialMessages([
          {
            id: `opening-${Date.now()}`,
            role: "assistant",
            parts: [{ type: "text", text: message }],
          },
        ]);
        setInitialReady(true);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to init assistant:", err);
        setInitError(err instanceof Error ? err.message : "Failed to load assistant");
        setInitialReady(true);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [profile, profileLoading, supabase]);

  if (profileLoading || !initialReady || !profile || profile.role !== "student") {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <ChatView
      key={initialMessages.map((m) => m.id).join("|") || "empty"}
      initialMessages={initialMessages}
      firstCollege={firstCollege}
      initError={initError}
      onReset={() => setInitialMessages([])}
    />
  );
}

function ChatView({
  initialMessages,
  firstCollege,
  initError,
  onReset,
}: {
  initialMessages: UIMessage[];
  firstCollege: string | null;
  initError: string | null;
  onReset: () => void;
}) {
  const transport = useMemo(
    () => new DefaultChatTransport<UIMessage>({ api: "/api/assistant" }),
    [],
  );

  const { messages, sendMessage, status, setMessages, error } = useChat({
    messages: initialMessages,
    transport,
  });

  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streaming = status === "streaming" || status === "submitted";
  const hasSentAnything = messages.some((m) => m.role === "user");

  // Auto-grow textarea up to 4 lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 24;
    const maxHeight = lineHeight * 4 + 16;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [input]);

  // Auto-scroll to bottom when messages change or during streaming.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Only pull to bottom if user is already near the bottom.
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, streaming]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setInput("");
    sendMessage({ text: trimmed });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
  }

  function handleNewConversation() {
    setMessages([]);
    onReset();
  }

  const showChips = !hasSentAnything && !streaming;
  const lastMessage = messages[messages.length - 1];
  const showSearching =
    streaming &&
    lastMessage?.role === "assistant" &&
    isActiveToolCall(lastMessage) &&
    !messageText(lastMessage).trim();

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border bg-card px-6 py-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Assistant
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            AI-generated advice — always verify important information and consult your counselor for major decisions.
          </p>
        </div>
        <button
          onClick={handleNewConversation}
          disabled={streaming || messages.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          New conversation
        </button>
      </div>

      {/* Scroll area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {showSearching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
              <Globe className="h-4 w-4" />
              Searching the web…
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error.message || "Something went wrong. Try again."}
            </div>
          )}
          {initError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {initError}
            </div>
          )}
        </div>
      </div>

      {/* Input + chips */}
      <div className="border-t border-border bg-background">
        <div className="mx-auto max-w-3xl px-4 py-3">
          {showChips && (
            <div className="mb-3 flex flex-wrap gap-2">
              <Chip onClick={() => submit(SUGGESTED_PROMPTS.prioritize)} label={SUGGESTED_PROMPTS.prioritize} />
              {firstCollege && (
                <Chip
                  onClick={() => submit(`Tell me about ${firstCollege}`)}
                  label={`Tell me about ${firstCollege}`}
                />
              )}
              <Chip onClick={() => submit(SUGGESTED_PROMPTS.brainstorm)} label={SUGGESTED_PROMPTS.brainstorm} />
              <Chip onClick={() => submit(SUGGESTED_PROMPTS.earlyAction)} label={SUGGESTED_PROMPTS.earlyAction} />
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card px-3 py-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={streaming}
              placeholder={streaming ? "Waiting for response…" : "Ask anything about your applications…"}
              className="flex-1 resize-none bg-transparent text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              onClick={() => submit(input)}
              disabled={streaming || !input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
    >
      {label}
    </button>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = messageText(message);

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-6",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted/40 text-foreground",
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{text}</div>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-headings:mt-3 prose-headings:mb-1 prose-pre:bg-background prose-pre:text-foreground">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
