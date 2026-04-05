"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Send, GraduationCap, Loader2, UserPen, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChat } from "@/hooks/useChat";
import { ProfileQuiz } from "@/components/counselor/ProfileQuiz";
import { ChecklistPanel } from "@/components/counselor/ChecklistPanel";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import type { StudentProfile, ChecklistItem } from "@/types/counselor";

type ProfileState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "editing"; profile: StudentProfile; userId: string }
  | { status: "loaded"; profile: StudentProfile; userId: string };

const INITIAL_PROMPT =
  "Based on my profile, give me your honest initial assessment — what are my realistic chances at each of my target schools, what are my biggest strengths, what are my biggest weaknesses, and what are the most important things I should focus on right now?";

export default function AdvisorPage() {
  const router = useRouter();

  // Redirect — page temporarily hidden
  useEffect(() => { router.replace("/tracker"); }, [router]);
  return null;

  const [profileState, setProfileState] = useState<ProfileState>({ status: "loading" });
  const isNewProfileRef = useRef(false);
  const [chatKey, setChatKey] = useState(0);

  const fetchProfile = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setProfileState({ status: "missing" }); return; }

    const { data } = await supabase
      .from("student_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setProfileState({ status: "loaded", profile: data as StudentProfile, userId: user.id });
    } else {
      setProfileState({ status: "missing" });
    }
  }, []);

  const handleQuizComplete = useCallback(async () => {
    isNewProfileRef.current = true;
    setChatKey((k) => k + 1);
    await fetchProfile();
  }, [fetchProfile]);

  const handleEditProfile = useCallback((profile: StudentProfile, userId: string) => {
    setProfileState({ status: "editing", profile, userId });
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  if (profileState.status === "loading") {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profileState.status === "missing") {
    return <ProfileQuiz onComplete={handleQuizComplete} />;
  }

  if (profileState.status === "editing") {
    const editingProfile = profileState.profile;
    const editingUserId = profileState.userId;
    return (
      <ProfileQuiz
        onComplete={handleQuizComplete}
        initialProfile={editingProfile}
        onCancel={() => setProfileState({ status: "loaded", profile: editingProfile, userId: editingUserId })}
      />
    );
  }

  return (
    <ChatView
      key={chatKey}
      profile={profileState.profile}
      userId={profileState.userId}
      isNew={isNewProfileRef.current}
      onEditProfile={handleEditProfile}
    />
  );
}

// Custom ReactMarkdown components for readable assistant responses
const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: ({ children }) => (
    <h1 style={{ fontSize: 20, fontWeight: 500, marginTop: 28, marginBottom: 8, color: "hsl(var(--primary))" }}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: 17, fontWeight: 700, marginTop: 28, marginBottom: 6, color: "hsl(var(--primary))" }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: 20, marginBottom: 4, color: "hsl(var(--primary))" }}>
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p style={{ marginBottom: 12, lineHeight: 1.75 }}>{children}</p>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 600 }}>{children}</strong>
  ),
  ul: ({ children }) => (
    <ul style={{ marginBottom: 12, paddingLeft: 20, listStyleType: "disc" }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ marginBottom: 12, paddingLeft: 20, listStyleType: "decimal" }}>{children}</ol>
  ),
  li: ({ children }) => (
    <li style={{ marginBottom: 6, lineHeight: 1.75 }}>{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote
      style={{
        borderLeft: "3px solid hsl(var(--primary))",
        background: "hsl(var(--primary) / 0.05)",
        padding: "12px 16px",
        borderRadius: 8,
        marginBottom: 24,
      }}
    >
      {children}
    </blockquote>
  ),
};

function ChatView({ profile, userId, isNew, onEditProfile }: {
  profile: StudentProfile;
  userId: string;
  isNew: boolean;
  onEditProfile: (profile: StudentProfile, userId: string) => void;
}) {
  const { messages, isLoading, isReady, conversationSummary, pendingChecklist, sendMessage } = useChat(profile);
  const [latestChecklist, setLatestChecklist] = useState<ChecklistItem[] | null>(null);

  useEffect(() => {
    if (pendingChecklist && pendingChecklist.length > 0) {
      setLatestChecklist(pendingChecklist);
    }
  }, [pendingChecklist]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasSentInitialRef = useRef(false);

  const sendMessageRef = useRef(sendMessage);
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  useEffect(() => {
    if (!isNew || !isReady || hasSentInitialRef.current) return;
    hasSentInitialRef.current = true;
    sendMessageRef.current(INITIAL_PROMPT, { saveUserMessage: false });
  }, [isNew, isReady]);

  const prevMessageCountRef = useRef(0);
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      prevMessageCountRef.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    sendMessage(trimmed);
  }

  const showTypingIndicator = isLoading && messages[messages.length - 1]?.content === "";

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Chat column */}
      <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-card px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-foreground leading-tight">AI Advisor</h1>
            <p className="text-xs text-muted-foreground">Your personal college admissions advisor</p>
          </div>
          <button
            onClick={() => onEditProfile(profile, userId)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <UserPen className="h-3.5 w-3.5" />
            Edit Profile
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-8 flex flex-col gap-6">
          {!isReady && (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading your conversation...</span>
            </div>
          )}

          {isReady && conversationSummary && (
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Earlier conversation summarized · {new Date(conversationSummary.lastSummarizedAt).toLocaleDateString()}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}

          {isReady && messages.length === 0 && !isLoading && (
            <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                <GraduationCap className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Ready when you are</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Tell me about yourself and your target colleges to get started
              </p>
            </div>
          )}

          {messages.map((msg, i) => {
            if (isNew && i === 0 && msg.role === "user") return null;
            return (
            <div
              key={i}
              className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start gap-3")}
            >
              {msg.role === "assistant" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                  <GraduationCap className="h-4 w-4 text-primary" />
                </div>
              )}

              {msg.role === "user" ? (
                <div className="max-w-[72%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm text-primary-foreground">
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              ) : (
                <div className="flex-1 min-w-0 text-sm text-foreground" style={{ lineHeight: 1.75 }}>
                  {msg.content === "" && showTypingIndicator ? (
                    <TypingIndicator />
                  ) : (
                    <ReactMarkdown components={mdComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
              )}
            </div>
            );
          })}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-border bg-card px-6 py-4">
        <div className="mx-auto max-w-4xl">
          <div className={cn(
            "flex items-end gap-2 rounded-xl border border-input bg-muted/50 px-4 py-2",
            "focus-within:ring-2 focus-within:ring-primary/20 transition-all"
          )}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message your advisor..."
              rows={1}
              className="flex-1 resize-none bg-transparent py-2 text-sm placeholder:text-muted-foreground focus:outline-none leading-relaxed"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={cn(
                "mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
                "hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground/60 mt-2">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
      </div>

      {/* Checklist panel — visible on md+ */}
      <div className="hidden md:block w-80 shrink-0">
        <ChecklistPanel userId={userId} newItems={latestChecklist} />
      </div>

      {/* Mobile: floating button + Sheet */}
      <div className="md:hidden fixed bottom-24 right-4 z-40">
        <Sheet>
          <SheetTrigger asChild>
            <button className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors">
              <ListChecks className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 p-0">
            <ChecklistPanel userId={userId} newItems={latestChecklist} />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </div>
  );
}
