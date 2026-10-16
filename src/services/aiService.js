/**
 * aiService.js — thin orchestrator that delegates to the active AI provider.
 *
 * All decision-making logic lives in services/classification.js and the
 * provider itself; this module only selects the provider via AI_PROVIDER
 * (default "mock") so routes never depend on a specific implementation.
 */

const providers = require("./providers");

const activeProviderName = providers.activeProviderName;

/**
 * analyze(text, language, context) -> AnalysisResult (Section-13 shape).
 */
async function analyze(text, language, context) {
  const provider = providers[activeProviderName];
  return provider.analyze(text, language, context);
}

module.exports = {
  analyze,
  activeProviderName,
};
