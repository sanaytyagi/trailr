"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Message, StudentProfile } from "@/types/counselor";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_RAW_MESSAGES,
  SUMMARIZE_THRESHOLD,
  MESSAGES_TO_SUMMARIZE,
} from "@/lib/counselor/constants";

export function useChat(profile: StudentProfile | null = null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Stored as a ref — doesn't need to trigger re-renders
  const conversationSummaryRef = useRef<{ text: string; lastSummarizedAt: string } | null>(null);
  // Full message history for building context window (may exceed MAX_RAW_MESSAGES in UI)
  const fullHistoryRef = useRef<Message[]>([]);

  // Load history + summary on mount
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setIsLoadingHistory(false); return; }

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
      // Show only the most recent MAX_RAW_MESSAGES in the UI
      setMessages(allMessages.slice(-MAX_RAW_MESSAGES));
      setIsLoadingHistory(false);
    }

    loadHistory();
    return () => { cancelled = true; };
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userMessage: Message = { role: "user", content };

      // Update UI and full history
      fullHistoryRef.current = [...fullHistoryRef.current, userMessage];
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      // Save user message to DB immediately
      supabase.from("conversation_messages").insert({
        user_id: user.id,
        role: "user",
        content,
      }).then(() => {});

      // Append empty assistant message to stream into
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      // Build context: optional summary injection + last MAX_RAW_MESSAGES
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

        if (!res.ok || !res.body) throw new Error("Request failed");

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
            if (raw === "[DONE]") break;
            try {
              const { content: delta } = JSON.parse(raw);
              if (delta) {
                assistantContent += delta;
                setMessages((prev) => {
                  if (prev.length === 0) return prev;
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (!last || last.role !== "assistant") return prev;
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: last.content + delta,
                  };
                  return updated;
                });
              }
            } catch {
              // ignore malformed chunks
            }
          }
        }
      } catch {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Something went wrong. Please try again.",
          };
          return updated;
        });
        setIsLoading(false);
        return;
      }

      // Save assistant message to DB
      const assistantMessage: Message = { role: "assistant", content: assistantContent };
      fullHistoryRef.current = [...fullHistoryRef.current, assistantMessage];

      await supabase.from("conversation_messages").insert({
        user_id: user.id,
        role: "assistant",
        content: assistantContent,
      });

      setIsLoading(false);

      // Background summarization check — never blocks the UI
      runSummarizationIfNeeded(user.id, supabase).catch(() => {});
    },
    [profile]
  );

  return { messages, isLoading, isLoadingHistory, conversationSummary: conversationSummaryRef.current, sendMessage };
}

async function runSummarizationIfNeeded(
  userId: string,
  supabase: ReturnType<typeof createClient>
) {
  // Count total messages for this user
  const { count } = await supabase
    .from("conversation_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if ((count ?? 0) <= SUMMARIZE_THRESHOLD) return;

  // Fetch the oldest messages to summarize
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

  // Upsert new summary and delete summarized messages
  const ids = oldMessages.map((m) => m.id);
  await Promise.all([
    supabase.from("conversation_summaries").upsert({
      user_id: userId,
      summary,
      messages_summarized_count: (existingSummaryResult.data ? 0 : 0) + oldMessages.length,
      last_summarized_at: new Date().toISOString(),
    }),
    supabase.from("conversation_messages").delete().in("id", ids),
  ]);
}
