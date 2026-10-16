/**
 * Mock provider — NOT a placeholder. This is the real Phase-1 rule-based
 * decision engine: it delegates all classification, disambiguation and
 * required-field tracking to services/classification.js and grounds its
 * legal output in the curated legalDb. A future LLM provider (alibaba.js)
 * only has to satisfy the same analyze() contract to replace it.
 */

const classification = require("../classification");
const legalDb = require("../legalDb");
const { CATEGORY_FIELDS } = require("../fieldDetectors");
const { buildDraft } = require("../draftBuilder");
const officialSourceFallback = require("../officialSourceFallback");

/**
 * Compose the human-facing chat message for the current turn.
 * The pure question always stays in follow_up_questions[0]; `message` is
 * what the assistant actually says (may add a short acknowledgement).
 */
function composeMessage(result, categoryData) {
  const question = result.follow_up_questions[0] || "";
  const label = categoryData
    ? `${categoryData.label_en} (${categoryData.label_roman})`
    : null;

  switch (result.message_hint) {
    case "greeting":
    case "clarify":
    case "disambiguate":
      return question;
    case "disambiguate_retry":
      return `Sorry — I still need to be sure before going further. ${question}`;
    case "reask":
      return `Thank you. Could you be a bit more specific? ${question}`;
    case "confirm_first":
      return `Thank you for sharing. From what you describe, this looks like it may involve ${label}. I need a few details before I can prepare your complaint. ${question}`;
    case "progress":
      return `Noted — thank you. ${question}`;
    case "finalize":
      return "Thank you. I have prepared your complaint draft, the legal references that may apply, and your suggested next steps. Open the results below to view and edit everything.";
    default:
      return question;
  }
}

/**
 * Provider interface: analyze(text, language, context) -> AnalysisResult.
 * context: { conversation: [{ role, content }] } — prior messages only
 * (the current user text is passed separately).
 */
async function analyze(text, language, context) {
  const conversation = (context && Array.isArray(context.conversation))
    ? context.conversation
    : [];

  const result = classification.analyzeConversation({ text, conversation });

  // No confident category yet: give the out-of-scope official-source fallback
  // (safety net for descriptions outside the 8 curated categories) a chance
  // first; otherwise ask the clarifying question as before.
  if (!result.category) {
    const outOfScope = await officialSourceFallback.maybeHandleOutOfScope({
      text,
      language: result.language,
      result,
      conversation,
    });
    if (outOfScope) return outOfScope;

    return {
      category: null,
      confidence: result.confidence,
      language: result.language,
      needs_follow_up: true,
      follow_up_questions: result.follow_up_questions,
      missing_fields: [],
      matched_fields: [],
      legal_references: [],
      explanation: null,
      authority: null,
      next_steps: [],
      draft: null,
      sources: [],
      message: composeMessage(result, null),
      message_hint: result.message_hint,
      disambiguation: result.disambiguation,
    };
  }

  const categoryData = legalDb.getCategory(result.category);
  if (!categoryData) {
    // Category id must always exist in the curated database
    return {
      category: null,
      confidence: "none",
      language: result.language,
      needs_follow_up: true,
      follow_up_questions: [classification.GENERIC_DESCRIBE_QUESTION],
      missing_fields: [],
      matched_fields: [],
      legal_references: [],
      explanation: null,
      authority: null,
      next_steps: [],
      draft: null,
      sources: [],
      message: classification.GENERIC_DESCRIBE_QUESTION,
      message_hint: "clarify",
      disambiguation: null,
    };
  }

  // Still collecting the required facts for this category.
  if (result.needs_follow_up) {
    return {
      category: {
        id: categoryData.id,
        label: categoryData.label_en,
        label_ur: categoryData.label_ur,
        label_roman: categoryData.label_roman,
        icon: categoryData.icon,
        workflow_type: categoryData.workflow_type,
      },
      confidence: result.confidence,
      language: result.language,
      needs_follow_up: true,
      follow_up_questions: result.follow_up_questions,
      missing_fields: result.missing_fields,
      matched_fields: result.matched_fields,
      legal_references: categoryData.laws,
      explanation: categoryData.description_en,
      authority: categoryData.complaint_authority,
      next_steps: [],
      draft: null,
      sources: [],
      facts: result.facts,
      message: composeMessage(result, categoryData),
      message_hint: result.message_hint,
      disambiguation: null,
    };
  }

  // All required facts collected: finalize with a structured draft.
  const draft = buildDraft(
    categoryData,
    result.facts,
    result.summary,
    CATEGORY_FIELDS[result.category]
  );

  return {
    category: {
      id: categoryData.id,
      label: categoryData.label_en,
      label_ur: categoryData.label_ur,
      label_roman: categoryData.label_roman,
      icon: categoryData.icon,
      workflow_type: categoryData.workflow_type,
    },
    confidence: result.confidence,
    language: result.language,
    needs_follow_up: false,
    follow_up_questions: [],
    missing_fields: [],
    matched_fields: result.matched_fields,
    legal_references: categoryData.laws,
    explanation: categoryData.description_en,
    authority: categoryData.complaint_authority,
    next_steps: categoryData.next_steps,
    draft,
    sources: legalDb.getSourcesForCategory(categoryData.id),
    facts: result.facts,
    message: composeMessage(result, categoryData),
    message_hint: result.message_hint,
    disambiguation: null,
  };
}

module.exports = { analyze };
