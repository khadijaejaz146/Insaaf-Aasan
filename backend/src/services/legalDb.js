/**
 * legalDb.js — loads the curated legal knowledge base
 * (data/legal_categories.json + data/trusted_sources.json) and exposes it
 * to the providers. Kept strictly separate from the AI providers.
 *
 * Category search uses the same normalization / synonym / fuzzy matching as
 * the classification engine (see services/classification.js) — never naive
 * substring search.
 */

const path = require("path");
const fs = require("fs");
const { classify } = require("./classification");

const CATEGORIES_PATH = path.join(__dirname, "..", "data", "legal_categories.json");
const SOURCES_PATH = path.join(__dirname, "..", "data", "trusted_sources.json");

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (err) {
    console.error(`[legalDb] Failed to load ${filePath}:`, err.message);
    return [];
  }
}

const categories = loadJSON(CATEGORIES_PATH);
const sources = loadJSON(SOURCES_PATH);

function getAllCategories() {
  return categories;
}

function getCategory(id) {
  return categories.find((c) => c.id === id) || null;
}

function getAllSources() {
  return sources;
}

function getSourcesForCategory(categoryId) {
  return sources.filter((s) => Array.isArray(s.categories) && s.categories.includes(categoryId));
}

/**
 * Search categories by a free-text query using the normalized, fuzzy
 * classifier — returns categories ranked by signal strength (strongest
 * first). Falls back to an empty array for queries with no legal signal.
 */
function searchCategories(query) {
  const { scores, confidence } = classify(query || "");
  if (confidence === "none") return [];
  return categories
    .map((c) => ({ category: c, score: scores[c.id] || 0 }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.category);
}

function getLegalReferences(categoryId) {
  const category = getCategory(categoryId);
  return category ? category.laws : [];
}

function getNextSteps(categoryId) {
  const category = getCategory(categoryId);
  return category ? category.next_steps : [];
}

module.exports = {
  getAllCategories,
  getCategory,
  getAllSources,
  getSourcesForCategory,
  searchCategories,
  getLegalReferences,
  getNextSteps,
};
