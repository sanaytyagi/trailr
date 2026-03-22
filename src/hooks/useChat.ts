"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import type { Message, StudentProfile, ChecklistItem } from "@/types/counselor";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_RAW_MESSAGES,
  SUMMARIZE_THRESHOLD,
  MESSAGES_TO_SUMMARIZE,
} from "@/lib/counselor/constants";

export function useChat(profile: StudentProfile | null = null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [pendingChecklist, setPendingChecklist] = useState<ChecklistItem[] | null>(null);

  const hasProcessedChecklistRef = useRef(false);
  const conversationSummaryRef = useRef<{ text: string; lastSummarizedAt: string } | null>(null);
  const fullHistoryRef = useRef<Message[]>([]);

  // Load history + summary on mount — set isReady only after both complete
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const [messagesResult, summaryResult] = await Promise.all([
          supabase
            .from("conversation_messages")
            .select("role, content, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("conversation_summaries")
            .select("summary, last_summarized_at")
            .eq("user_id", user.id)
            .single(),
        ]);

        if (cancelled) return;

        if (summaryResult.data) {
          conversationSummaryRef.current = {
            text: summaryResult.data.summary,
            lastSummarizedAt: summaryResult.data.last_summarized_at,
          };
        }

        const allMessages: Message[] = (messagesResult.data ?? []).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        fullHistoryRef.current = allMessages;
        setMessages(allMessages.slice(-MAX_RAW_MESSAGES));
      } catch (err) {
        console.error("Failed to load chat history:", err);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    }

    loadHistory();
    return () => { cancelled = true; };
  }, []);

  const sendMessage = useCallback(
    async (content: string, { saveUserMessage = true }: { saveUserMessage?: boolean } = {}) => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userMessage: Message = { role: "user", content };

      // 1. Update UI with user message immediately
      flushSync(() => {
        setMessages((prev) => [...prev, userMessage]);
      });

      // 2. Update full history ref
      fullHistoryRef.current = [...fullHistoryRef.current, userMessage];

      // 3. Save user message to DB (fire-and-forget) — skipped for silent auto-fire prompts
      if (saveUserMessage) {
        supabase.from("conversation_messages").insert({
          user_id: user.id,
          role: "user",
          content,
        }).then(() => {}).catch(() => {});
      }

      // 4. Append empty assistant placeholder and set loading
      flushSync(() => {
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
        setIsLoading(true);
      });

      // 5. Build API context
      const recentHistory = fullHistoryRef.current.slice(-(MAX_RAW_MESSAGES + 1), -1);
      const apiMessages: Array<{ role: string; content: string }> = [];
      if (conversationSummaryRef.current) {
        apiMessages.push({
          role: "system",
          content: `Summary of earlier conversation: ${conversationSummaryRef.current.text}`,
        });
      }
      apiMessages.push(...recentHistory.map((m) => ({ role: m.role, content: m.content })));
      apiMessages.push({ role: "user", content });

      let assistantContent = "";

      try {
        const res = await fetch("/api/counselor/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, profile }),
        });

        if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === "[DONE]") continue;
            try {
              const parsed = JSON.parse(raw);
              if (parsed.type === "content" && parsed.text) {
                assistantContent += parsed.text;
                flushSync(() => {
                  setMessages((prev) => {
                    if (prev.length === 0) return prev;
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (!last || last.role !== "assistant") return prev;
                    updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                    return updated;
                  });
                });
              } else if (parsed.type === "content_replace" && parsed.text) {
                assistantContent = parsed.text;
                flushSync(() => {
                  setMessages((prev) => {
                    if (prev.length === 0) return prev;
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (!last || last.role !== "assistant") return prev;
                    updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                    return updated;
                  });
                });
              } else if (parsed.type === "checklist") {
                if (!hasProcessedChecklistRef.current) {
                  hasProcessedChecklistRef.current = true;
                  const flat: ChecklistItem[] = (parsed.data ?? []).flatMap(
                    (group: { college: string; items: Array<{ id: string; action: string; why: string; urgency: string }> }) =>
                      (group.items ?? []).map((item) => ({
                        id: item.id,
                        college: group.college,
                        action: item.action,
                        why: item.why,
                        urgency: item.urgency as ChecklistItem["urgency"],
                        completed: false,
                      }))
                  );
                  setPendingChecklist(flat);
                }
              }
            } catch {
              // malformed chunk — skip
            }
          }
        }
      } catch (error) {
        console.error("Streaming error:", error);
        flushSync(() => {
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            // If we got some content before the error, keep it; otherwise show error
            if (!assistantContent) {
              updated[updated.length - 1] = {
                role: "assistant",
                content: "Something went wrong. Please try again.",
              };
            }
            return updated;
          });
        });
      } finally {
        setIsLoading(false);

        // Only save + update history if we actually got a response
        if (assistantContent) {
          const assistantMessage: Message = { role: "assistant", content: assistantContent };
          fullHistoryRef.current = [...fullHistoryRef.current, assistantMessage];

          try {
            await supabase.from("conversation_messages").insert({
              user_id: user.id,
              role: "assistant",
              content: assistantContent,
            });
            // Background summarization — never blocks UI
            runSummarizationIfNeeded(user.id, supabase).catch(() => {});
          } catch (err) {
            console.error("Failed to save assistant message:", err);
          }
        }
      }
    },
    [profile]
  );

  return {
    messages,
    isLoading,
    isReady,
    conversationSummary: conversationSummaryRef.current,
    pendingChecklist,
    sendMessage,
  };
}

async function runSummarizationIfNeeded(
  userId: string,
  supabase: ReturnType<typeof createClient>
) {
  const { count } = await supabase
    .from("conversation_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if ((count ?? 0) <= SUMMARIZE_THRESHOLD) return;

  const { data: oldMessages } = await supabase
    .from("conversation_messages")
    .select("id, role, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(MESSAGES_TO_SUMMARIZE);

  if (!oldMessages || oldMessages.length === 0) return;

  const existingSummaryResult = await supabase
    .from("conversation_summaries")
    .select("summary")
    .eq("user_id", userId)
    .single();

  const existingSummary = existingSummaryResult.data?.summary ?? null;

  const res = await fetch("/api/counselor/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: oldMessages.map((m) => ({ role: m.role, content: m.content })),
      existingSummary,
    }),
  });

  if (!res.ok) return;

  const { summary } = await res.json();
  if (!summary) return;

  const ids = oldMessages.map((m) => m.id);
  await Promise.all([
    supabase.from("conversation_summaries").upsert({
      user_id: userId,
      summary,
      messages_summarized_count: oldMessages.length,
      last_summarized_at: new Date().toISOString(),
    }),
    supabase.from("conversation_messages").delete().in("id", ids),
  ]);
}
