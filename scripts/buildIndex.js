require("dotenv").config();
const path = require("path");
const fs = require("fs");
const legalDb = require("../src/services/legalDb");
const { embed } = require("../src/services/rag/embedder");

const EXAMPLES = {
  theft: "mera phone chori ho gaya; my bike was stolen; چوری ہو گئی; someone snatched my wallet",
  fraud: "mujh se dhoka hua; someone cheated me of money; دھوکہ ہوا; false promise paisay le liye",
  criminal_breach_of_trust: "maine amanat di thi wapas nahi ki; they misused money I entrusted; خیانت",
  criminal_intimidation: "mujhe dhamki di; he threatened to kill me; دھمکی; mar dunga",
  harassment: "mujhe tang kar raha hai; eve teasing; ہراسانی; paresan karta hai",
  cyberstalking: "online harassment; fake profile; someone stalking me on Facebook or WhatsApp",
  online_scam: "OLX scam; fake online job; WhatsApp fraud; easypaisa jazzcash fraud",
  lost_property: "mera CNIC gum gaya; I lost my wallet; passport lost; lost phone",
};

function toList(x) {
  return Array.isArray(x) ? x : Object.values(x || {});
}

function collectChunks() {
  const chunks = [];

  // (a) categories
  for (const c of toList(legalDb.getAllCategories())) {
    const text = [
      `Category: ${c.label_en} (${c.label_roman}) ${c.label_ur}`,
      `Description: ${c.description_en}`,
      `Example phrases: ${EXAMPLES[c.id] || ""}`,
      `Complaint authority: ${JSON.stringify(c.complaint_authority)}`,
      `Laws: ${JSON.stringify(c.laws)}`,
      `Next steps: ${JSON.stringify(c.next_steps)}`,
    ].join("\n");
    chunks.push({ id: `category:${c.id}`, source: "legal_categories.json", text });
  }

  // (b) sources
  toList(legalDb.getAllSources()).forEach((s, i) => {
    chunks.push({
      id: `source:${s.id || i}`,
      source: "trusted_sources.json",
      text: `Official source: ${JSON.stringify(s)}`,
    });
  });

  // (c) legal_docs folder
  const docsDir = path.join(__dirname, "..", "src", "data", "legal_docs");
  try {
    const files = fs.readdirSync(docsDir).filter((f) => f.endsWith(".txt") || f.endsWith(".md"));
    for (const file of files) {
      const content = fs.readFileSync(path.join(docsDir, file), "utf8");
      const rawChunks = content.split(/\n\s*\n/);
      let buf = "";
      let i = 0;
      for (const block of rawChunks) {
        buf += (buf ? "\n\n" : "") + block.trim();
        if (buf.length >= 900) {
          chunks.push({ id: `doc:${file}#${i}`, source: file, text: buf });
          i++;
          buf = "";
        }
      }
      if (buf.trim()) {
        chunks.push({ id: `doc:${file}#${i}`, source: file, text: buf });
      }
    }
  } catch {
    // folder missing — skip silently
  }

  return chunks;
}

async function main() {
  const chunks = collectChunks();
  const total = chunks.length;
  const result = [];

  for (let i = 0; i < total; i++) {
    const chunk = chunks[i];
    try {
      const embedding = await embed(chunk.text, "document");
      result.push({ id: chunk.id, source: chunk.source, text: chunk.text, embedding });
      console.log(`${i + 1}/${total} ${chunk.id}`);
    } catch (e) {
      console.error("Index build failed:", e.message);
      process.exit(1);
    }
    if (i < total - 1) await new Promise((res) => setTimeout(res, 400));
  }

  const outPath = path.join(__dirname, "..", "src", "data", "rag_index.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
  console.log("Done");
}

main().catch((e) => {
  console.error("Index build failed:", e.message);
  process.exit(1);
});
