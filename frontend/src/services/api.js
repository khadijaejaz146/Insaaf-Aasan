/**
 * API client for the Insaaf Aasan backend.
 *
 * In development, Vite proxies /api to the Express server on port 3001
 * (see vite.config.js). Set VITE_API_URL to target a different backend.
 */

const API_BASE = import.meta.env.VITE_API_URL || "/api";

/**
 * Analyze one conversational turn.
 *
 * @param {object} payload
 * @param {string} payload.text          the user's latest message
 * @param {string} [payload.language]    "auto" | "urdu" | "roman_urdu" | "english"
 * @param {Array}  payload.conversation  PRIOR messages only:
 *   [{ role: "user" | "assistant", content: string }]
 *
 * @returns {Promise<object>} the full analysis result:
 *   { category, confidence, language, needs_follow_up, follow_up_questions,
 *     missing_fields, matched_fields, legal_references, explanation,
 *     authority, next_steps, draft, sources, message, message_hint,
 *     disambiguation, timestamp }
 */
export async function analyzeMessage({ text, language = "auto", conversation = [] }) {
  let response;

  try {
    response = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language, conversation }),
    });
  } catch {
    throw new Error(
      "Could not reach the Insaaf Aasan service. Please make sure the backend is running, then try again."
    );
  }

  if (!response.ok) {
    let message = `The service returned an error (${response.status}).`;
    try {
      const body = await response.json();
      if (body && body.error) message = body.error;
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }

  return response.json();
}

/** Lightweight service check — used to warn when the backend is down. */
export async function checkHealth() {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) throw new Error(`Health check failed (${response.status}).`);
  return response.json();
}
