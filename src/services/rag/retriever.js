const fs = require("fs");
const path = require("path");
const { embed } = require("./embedder");
const INDEX_PATH = path.join(__dirname, "..", "..", "data", "rag_index.json");
let index = [];
try {
  index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  console.log(`[rag] loaded ${index.length} chunks`);
} catch {
  console.warn("[rag] index not found. Run: npm run rag:index");
}
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
async function retrieve(query, { topK = Number(process.env.RAG_TOP_K) || 3, minScore = Number(process.env.RAG_MIN_SCORE) || 0.55 } = {}) {
  if (!index.length || !query) return [];
  const qv = await embed(query, "query");
  return index
    .map((c) => ({ id: c.id, source: c.source, text: c.text, score: cosine(qv, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((c) => c.score >= minScore);
}
module.exports = { retrieve };
