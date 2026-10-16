const express = require("express");
const router = express.Router();
const aiService = require("../services/aiService");
const legalDb = require("../services/legalDb");

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

    if (conversation !== undefined && !Array.isArray(conversation)) {
      return res.status(400).json({
        error: "conversation must be an array of { role, content } messages.",
      });
    }

    const result = await aiService.analyze(text, language || "auto", {
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
