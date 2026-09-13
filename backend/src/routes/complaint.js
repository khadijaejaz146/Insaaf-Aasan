const express = require("express");
const router = express.Router();
const aiService = require("../services/aiService");
const legalDb = require("../services/legalDb");

const MAX_TEXT_LENGTH = 4000;
const MAX_CONVERSATION_MESSAGES = 32;
const VALID_LANGUAGES = new Set(["auto", "en", "ur", "roman-ur"]);

function isValidConversationMessage(message) {
  return (
    message &&
    typeof message === "object" &&
    !Array.isArray(message) &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.trim().length > 0 &&
    message.content.length <= MAX_TEXT_LENGTH
  );
}

/**
 * POST /api/analyze
 *
 * Analyze the user's latest message within the conversation context.
 *
 * Input:
 *   { text, language, conversation: [{ role: "user" | "assistant", content }] }
 *   - `conversation` contains the PRIOR messages only (the current message
 *     is passed as `text`), so the engine can replay the full intake.
 *
 * Response (Section 13):
 *   { category, confidence, language, needs_follow_up, follow_up_questions,
 *     missing_fields, matched_fields, legal_references, explanation,
 *     authority, next_steps, draft, sources, message, disambiguation }
 */
router.post("/analyze", async (req, res) => {
  try {
    const { text, language, conversation } = req.body || {};

    if (!text || typeof text !== "string" || text.trim().length < 2) {
      return res.status(400).json({
        error: "Message text is required.",
      });
    }

    if (text.trim().length > MAX_TEXT_LENGTH) {
      return res.status(400).json({
        error: `Message text must not exceed ${MAX_TEXT_LENGTH} characters.`,
      });
    }

    if (language !== undefined && (!VALID_LANGUAGES.has(language))) {
      return res.status(400).json({
        error: "language must be auto, en, ur, or roman-ur.",
      });
    }

    if (conversation !== undefined && !Array.isArray(conversation)) {
      return res.status(400).json({
        error: "conversation must be an array of { role, content } messages.",
      });
    }

    if (conversation && conversation.length > MAX_CONVERSATION_MESSAGES) {
      return res.status(400).json({
        error: `conversation must not exceed ${MAX_CONVERSATION_MESSAGES} messages.`,
      });
    }

    if (conversation && !conversation.every(isValidConversationMessage)) {
      return res.status(400).json({
        error: "Each conversation message requires a user or assistant role and non-empty text.",
      });
    }

    const result = await aiService.analyze(text.trim(), language || "auto", {
      conversation: conversation || [],
    });

    return res.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[analyze] Error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * GET /api/categories
 * Return all legal categories.
 */
router.get("/categories", (req, res) => {
  res.json(legalDb.getAllCategories());
});

/**
 * GET /api/sources
 * Return all trusted sources.
 */
router.get("/sources", (req, res) => {
  res.json(legalDb.getAllSources());
});

/**
 * GET /api/health
 * Lightweight service info (provider + category count).
 */
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    provider: aiService.activeProviderName,
    categories: legalDb.getAllCategories().length,
    sources: legalDb.getAllSources().length,
  });
});

module.exports = router;
