const { GoogleGenerativeAI, TaskType } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001",
});
async function embed(text, kind = "document") {
  const taskType = kind === "query" ? TaskType.RETRIEVAL_QUERY : TaskType.RETRIEVAL_DOCUMENT;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await model.embedContent({ content: { role: "user", parts: [{ text }] }, taskType });
      return r.embedding.values;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((res) => setTimeout(res, 1500 * attempt));
    }
  }
}
module.exports = { embed };
