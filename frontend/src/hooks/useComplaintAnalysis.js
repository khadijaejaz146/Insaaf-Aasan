import { useMemo, useState } from "react";
import { analyzeMessage } from "../services/api";

/**
 * Drives the complaint-intake conversation against POST /api/analyze.
 *
 * The backend replays the whole intake from the message history, so the
 * frontend simply keeps the full chat log and sends it as `conversation`
 * (prior messages only — the latest message travels as `text`).
 *
 * Replaces the old frontend's keyword-matching mock entirely: all
 * classification, follow-up questions, and field tracking happen in the
 * backend engine.
 */
export function useComplaintAnalysis() {
  /** UI log: [{ role: "user"|"assistant", content, result? }] */
  const [messages, setMessages] = useState([]);
  /** The latest analysis result returned by the backend. */
  const [analysis, setAnalysis] = useState(null);
  /** "idle" | "sending" */
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  /** Prior messages only, in the shape the API expects. */
  const conversation = useMemo(
    () => messages.map(({ role, content }) => ({ role, content })),
    [messages]
  );

  /**
   * Send the user's latest message and record the assistant's reply.
   * Returns the analysis result, or null when the request failed.
   */
  async function sendMessage(text) {
    const trimmed = (text || "").trim();
    if (!trimmed || status === "sending") return null;

    const priorConversation = messages.map(({ role, content }) => ({ role, content }));

    setError(null);
    setStatus("sending");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);

    try {
      const result = await analyzeMessage({
        text: trimmed,
        language: "auto",
        conversation: priorConversation,
      });

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.message, result },
      ]);
      setAnalysis(result);
      setStatus("idle");
      return result;
    } catch (err) {
      // Remove the optimistic user message so the turn can be retried cleanly.
      setMessages((prev) => prev.slice(0, -1));
      setError(
        err && err.message
          ? err.message
          : "Something went wrong. Please try again."
      );
      setStatus("idle");
      return null;
    }
  }

  /** Clear the whole intake and start over. */
  function reset() {
    setMessages([]);
    setAnalysis(null);
    setStatus("idle");
    setError(null);
  }

  /** True once every required fact has been collected and a draft exists. */
  const isComplete = Boolean(
    analysis && analysis.needs_follow_up === false && analysis.draft
  );

  const detectedLanguage = analysis ? analysis.language : null;

  return {
    messages,
    conversation,
    analysis,
    status,
    error,
    sendMessage,
    reset,
    isComplete,
    detectedLanguage,
  };
}

export default useComplaintAnalysis;
