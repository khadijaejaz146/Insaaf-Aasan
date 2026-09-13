/**
 * Alibaba Cloud Model Studio (Qwen) provider — STUB / scaffold only.
 *
 * Not wired to a real API call in this build. Kept here so the provider can
 * be implemented later without touching the routes, the frontend, or
 * legalDb.js — only this file needs to change.
 *
 * PLANNED APPROACH — retrieval-augmented prompting (RAG), NOT fine-tuning:
 *   1. Take the conversation and the user's latest message.
 *   2. Retrieve the relevant category records from
 *      src/data/legal_categories.json (+ trusted_sources.json) and pass them
 *      into the prompt context as grounded reference data.
 *   3. Ask the model to (a) classify into one of the 8 fixed categories with
 *      a confidence level, (b) list which required fields (per category, as
 *      defined in fieldDetectors.js) are present/missing, and (c) when all
 *      fields are present, draft the complaint using ONLY the grounded legal
 *      references — never inventing sections or sources.
 *   4. Validate the model's output against the same contract as
 *      mock.js: analyze(text, language, context) -> AnalysisResult
 *      (the Section-13 API shape), so the rest of the app is unchanged.
 *
 * The rule-based engine in classification.js defines the exact contract this
 * provider must satisfy; fall back to it when the model output is invalid.
 */

// Example env (documented in .env.example):
//   AI_PROVIDER=alibaba
//   DASHSCOPE_API_KEY=sk-...
//   ALIBABA_MODEL=qwen-plus

const classification = require("../classification");
const legalDb = require("../legalDb");
const mockProvider = require("./mock");

/**
 * analyze(text, language, context) -> AnalysisResult
 *
 * Stub behaviour: logs that the real integration is pending and falls back
 * to the rule-based engine so the app remains fully functional.
 */
async function analyze(text, language, context) {
  console.warn(
    "[providers/alibaba] Alibaba Cloud Model Studio integration not implemented yet — " +
      "falling back to the rule-based engine (mock provider). " +
      "Planned approach: retrieval-augmented prompting over legal_categories.json (see file comment)."
  );
  return mockProvider.analyze(text, language, context);
}

// Exported for the future implementation; unused by the stub itself.
function buildPromptContext(categoryIds) {
  // RAG grounding: pass the curated category data into the prompt context.
  return (categoryIds || []).map((id) => legalDb.getCategory(id)).filter(Boolean);
}

module.exports = { analyze, buildPromptContext };
