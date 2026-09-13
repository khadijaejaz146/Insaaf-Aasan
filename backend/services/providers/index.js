/**
 * AI Provider registry.
 *
 * Every provider implements the same interface:
 *   analyze(text, language, context) -> AnalysisResult
 *     - text:        the user's current message
 *     - language:    "auto" | "en" | "ur" | "roman-ur" (auto-detected server-side)
 *     - context:     { conversation: [{ role: "user" | "assistant", content }] }
 *     - returns the Section-13 API shape (category, confidence, language,
 *       needs_follow_up, follow_up_questions, missing_fields,
 *       legal_references, explanation, authority, next_steps, draft, sources)
 *
 * The active provider is selected by AI_PROVIDER (default: "mock").
 * Nothing outside this folder knows which provider is active.
 */

const mockProvider = require("./mock");
const alibabaProvider = require("./alibaba");

const providers = {
  mock: mockProvider,
  alibaba: alibabaProvider,
};

const activeProviderName = process.env.AI_PROVIDER || "mock";

if (!providers[activeProviderName]) {
  throw new Error(
    `[providers] Unknown AI_PROVIDER "${activeProviderName}". Available: ${Object.keys(providers).join(", ")}`
  );
}

module.exports = providers;
module.exports.activeProvider = providers[activeProviderName];
module.exports.activeProviderName = activeProviderName;
