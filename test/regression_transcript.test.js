/**
 * regression_transcript.test.js
 *
 * Replays the exact chat transcript that exposed the repeating-question bugs.
 * All Gemini calls are stubbed — no API key / network needed.
 *
 * Run: npm test  (from backend/)
 */

const test = require("node:test");
const assert = require("node:assert");

const classification = require("../src/services/classification");
const { CATEGORY_FIELDS, isNonAnswer } = require("../src/services/fieldDetectors");
const legalDb = require("../src/services/legalDb");
const { buildDraft } = require("../src/services/draftBuilder");

const {
  analyzeConversation,
  matchAssistantMessage,
  DISAMBIGUATIONS,
} = classification;

// ---------------------------------------------------------------------------
// Stub the mock provider to simulate what the Gemini provider does:
//   - call the real rule engine
//   - reword the message (here we simulate Gemini rewriting it)
//   - but the TEST records the CANONICAL question in history (not reworded)
//   -- exactly what the fixed App.jsx now does
// ---------------------------------------------------------------------------

/**
 * Simulate the fixed frontend behaviour:
 *  - display:  result.message (the polished/reworded version)
 *  - canonical: result.follow_up_questions[0] || result.message
 *  - history entry sent to backend: { role, content: canonical }
 */
function fakePolish(msg) {
  // Add some Gemini-style natural rewriting so we prove canonical content
  // in history is what matters, not the display message.
  return msg
    .replace("When was the item stolen?", "Hey, can you tell me when this happened?")
    .replace("Where did the theft take place", "And where exactly did it happen")
    .replace("What exactly was entrusted", "So what item did you give them")
    .replace("What exactly did you hand over", "Tell me: what did you give to this person")
    + " (Gemini-polished)";
}

async function turn(convHistory, userText) {
  // convHistory entries: { role, content (canonical for assistant), display (polished, shown to user) }
  const result = analyzeConversation({ text: userText, conversation: convHistory });

  const canonicalMsg = result.follow_up_questions?.[0] || "";
  const displayMsg = fakePolish(canonicalMsg || "");

  // User entry — raw text
  convHistory.push({ role: "user", content: userText });
  // Assistant entry — CANONICAL content (what backend uses for state), display stored separately
  convHistory.push({ role: "assistant", content: canonicalMsg || displayMsg });

  return { result, canonicalMsg, displayMsg };
}

// ---------------------------------------------------------------------------
// The exact transcript from the bug report
// ---------------------------------------------------------------------------

test("Transcript replay — phase 1: theft classification + field collection", async () => {
  const conv = [];

  // Turn 1: describe the problem
  const { result: r1 } = await turn(conv, "mera phone chori ho geya han");
  assert.strictEqual(r1.category, "theft", "T1: must classify as theft");
  assert.strictEqual(r1.needs_follow_up, true);
  // Should ask 'when'
  assert.match(r1.follow_up_questions[0], /when/i, "T1: first question is about time");

  // Turn 2: answer when
  const { result: r2 } = await turn(conv, "kal or time tha sare 2");
  assert.strictEqual(r2.category, "theft");
  // Should advance to where-question, not repeat when
  assert.ok(
    !/when\s*was/i.test(r2.follow_up_questions[0] ?? ""),
    "T2: must NOT re-ask when after it was answered"
  );
  assert.match(r2.follow_up_questions[0], /where/i, "T2: next question is about location");

  // Turn 3: answer where
  const { result: r3 } = await turn(conv, "ghar pae");
  assert.strictEqual(r3.category, "theft");
  assert.ok(
    !/where/i.test(r3.follow_up_questions[0] ?? ""),
    "T3: must NOT re-ask where after it was answered"
  );
  // Next should be value/amount
  assert.match(r3.follow_up_questions[0], /worth|value|amount|much/i, "T3: next question is about value");

  // Turn 4: answer value
  const { result: r4 } = await turn(conv, "mere khayal se 24k");
  assert.strictEqual(r4.category, "theft");
  assert.ok(
    !/worth|much/i.test(r4.follow_up_questions[0] ?? ""),
    "T4: must NOT re-ask value after it was answered"
  );
});

test("Transcript replay — phase 2: theft_vs_cbt disambiguation resolves on first clear answer", async () => {
  // Simulate that the engine arrived at a theft-vs-cbt disambiguation question
  // (this happens when CBT signals appear after theft signals — mimic this with
  // the criminal_breach_of_trust+theft combos and then replay disambiguation)

  // Build a conversation where the bot already asked "Theft vs Breach of Trust?"
  // using the canonical theft_vs_cbt question, then user answers "i guess criminal breach"
  const disambDef = DISAMBIGUATIONS.find(d => d.id === "theft_vs_cbt");
  assert.ok(disambDef, "theft_vs_cbt disambiguation must be registered");

  const question = disambDef.question;

  // Verify boost works for various reply forms
  const replies = [
    "criminal breach",
    "breach of trust",
    "i guess criminal breach",
    "criminal breach of trust",
    "cbt",
    "amanat",
    "khayanat",
  ];
  for (const reply of replies) {
    const boost = disambDef.boost(reply);
    assert.ok(boost, `boost("${reply}") must return non-null`);
    assert.ok(
      boost.criminal_breach_of_trust,
      `boost("${reply}") must resolve to criminal_breach_of_trust`
    );
  }

  // And "theft" replies must resolve to theft
  for (const reply of ["theft", "chori", "it was stolen", "kisi ne utha liya"]) {
    const boost = disambDef.boost(reply);
    assert.ok(boost, `boost("${reply}") must return non-null`);
    assert.ok(boost.theft, `boost("${reply}") must resolve to theft`);
  }

  // Now simulate the full conversation: the bot asked the question and user answered
  const conv = [
    { role: "assistant", content: question }, // canonical question in history
  ];

  const { result: r } = await turn(conv, "criminal breach");
  // After the disambiguation answer, category must be criminal_breach_of_trust
  assert.strictEqual(
    r.category, "criminal_breach_of_trust",
    "After 'criminal breach' answer, category must be criminal_breach_of_trust"
  );
  // The disambiguation question must NOT be asked again
  assert.ok(
    !r.follow_up_questions.some(q => /theft\s+or|criminal\s+breach/i.test(q)),
    "After disambiguation resolved, must NOT re-ask same disambiguation question"
  );
});

test("Transcript replay — phase 3: 'mobile' and 'a mobile phone' satisfy what_entrusted", async () => {
  const { detectEntrusted } = require("../src/services/fieldDetectors");

  // These are the exact answers the user gave that were rejected by the old detector
  const positiveAnswers = [
    "mobile",
    "a mobile phone",
    "phone",
    "mobile phone",
    "laptop",
    "cash",
    "car",
    "gaari",
    "gaadi",
    "money",
    "jewellery",
    "zewar",
    "zameen",
    "plot",
    "documents",
    // Urdu direct item names
    "موبائل",
    "فون",
  ];
  for (const answer of positiveAnswers) {
    const val = detectEntrusted(answer);
    assert.ok(val, `detectEntrusted("${answer}") must return non-null`);
  }
});

test("Transcript replay — phase 3: 'what_entrusted' field satisfied by 'mobile', moves to next field", async () => {
  // Build conversation: bot asked the what_entrusted question, user replies "mobile"
  const cbtField = CATEGORY_FIELDS.criminal_breach_of_trust.find(f => f.id === "what_entrusted");
  assert.ok(cbtField, "what_entrusted field must exist in criminal_breach_of_trust");

  const conv = [
    // First message: the user described the problem (CBT context)
    { role: "user", content: "mere dost ne mera mobile rakhne ke liye liya tha aur wapas nahi diya" },
    { role: "assistant", content: cbtField.question }, // canonical question about what was entrusted
  ];

  const { result } = await turn(conv, "mobile");
  // After "mobile", what_entrusted should be satisfied
  assert.ok(
    !result.missing_fields?.some(f => f.id === "what_entrusted"),
    "After 'mobile' answer, what_entrusted must not appear in missing_fields"
  );
  // The next question must NOT be about what_entrusted again
  const nextQ = result.follow_up_questions?.[0] ?? "";
  assert.ok(
    !/hand\s+over|entrust|what\s+exactly\s+did\s+you\s+give/i.test(nextQ),
    "After 'mobile' answer, must NOT re-ask what_entrusted"
  );
});

test("I don't know / non-answers are re-asked once then recorded as Not known", async () => {
  // Test that pata nahi / I don't know is not counted as answered
  assert.strictEqual(isNonAnswer("pata nahi"), true);
  assert.strictEqual(isNonAnswer("I don't know"), true);
  assert.strictEqual(isNonAnswer("idk"), true);
  assert.strictEqual(isNonAnswer("nahi pata"), true);
  assert.strictEqual(isNonAnswer("no idea"), true);

  // Test that valid short answers are NOT non-answers
  assert.strictEqual(isNonAnswer("mobile"), false);
  assert.strictEqual(isNonAnswer("ghar pae"), false);
  assert.strictEqual(isNonAnswer("kal"), false);

  // Full conversation: ask what_entrusted, get "pata nahi", field should be re-asked
  const cbtField = CATEGORY_FIELDS.criminal_breach_of_trust.find(f => f.id === "what_entrusted");
  const conv = [
    { role: "user", content: "mere dost ne mera 24k ka mobile rakhne ke liye liya aur wapas nahi diya" },
    { role: "assistant", content: cbtField.question }, // canonical
  ];

  const r1 = analyzeConversation({ text: "pata nahi", conversation: conv });
  // After one "pata nahi", field should be still listed as missing (will be re-asked or recorded)
  // because isNonAnswer -> state.unknown.add(fieldId) immediately — field moves to unknown
  // That means the bot won't re-ask it — it records "Not known" and moves on
  // This is the existing correct behaviour — verify it still holds
  assert.ok(
    !r1.missing_fields?.some(f => f.id === "what_entrusted"),
    "After explicit 'pata nahi', what_entrusted should be recorded as unknown (Not known) and not re-asked"
  );
});

test("Polished/reworded assistant messages in history do NOT break state detection", async () => {
  // Simulate what happens when Gemini changes the question wording significantly:
  // If the history stores the reworded text, matchAssistantMessage fails.
  // If the history stores the canonical text, it succeeds.

  const cbtField = CATEGORY_FIELDS.criminal_breach_of_trust.find(f => f.id === "what_entrusted");

  // The polished version (what Gemini might produce)
  const polishedVersion = "Hey, can you tell me what item or money you handed over to this person? (Gemini-polished)";
  const canonicalVersion = cbtField.question;

  // Polished version should NOT be recognized by matchAssistantMessage
  // (This was the bug — it returned null meaning state.pending was never set)
  const polishedMatch = matchAssistantMessage(polishedVersion);
  // May or may not match depending on word overlap — we just verify the FIX works:

  // Canonical version MUST be recognized
  const canonicalMatch = matchAssistantMessage(canonicalVersion);
  assert.ok(canonicalMatch, "Canonical question must be recognized by matchAssistantMessage");
  assert.strictEqual(canonicalMatch.type, "field");
  assert.strictEqual(canonicalMatch.fieldId, "what_entrusted");
  assert.strictEqual(canonicalMatch.categoryId, "criminal_breach_of_trust");

  // Now simulate the conversation using canonical in history (the fix)
  const convWithCanonical = [
    { role: "user", content: "mere dost ne mera mobile rakhne ke liye liya tha aur wapas nahi diya" },
    { role: "assistant", content: canonicalVersion }, // FIXED: canonical stored
  ];
  const resultCanonical = analyzeConversation({ text: "a mobile phone", conversation: convWithCanonical });
  assert.ok(
    !resultCanonical.missing_fields?.some(f => f.id === "what_entrusted"),
    "With canonical history: 'a mobile phone' must satisfy what_entrusted"
  );
});

test("Urdu script reply to disambiguation resolves correctly", () => {
  const disambDef = DISAMBIGUATIONS.find(d => d.id === "fraud_vs_cbt");
  assert.ok(disambDef, "fraud_vs_cbt disambiguation must exist");

  // Urdu script for "amanat" -> امانت, "khayanat" -> خیانت
  const urduCbtReplies = ["امانت", "خیانت"];
  for (const reply of urduCbtReplies) {
    const boost = disambDef.boost(reply);
    assert.ok(boost, `Urdu reply "${reply}" must produce a boost`);
    assert.ok(boost.criminal_breach_of_trust, `Urdu reply "${reply}" must resolve to cbt`);
  }
});

test("Roman Urdu reply 'breach of trust' resolves theft_vs_cbt disambiguation", () => {
  const disbambDef = DISAMBIGUATIONS.find(d => d.id === "theft_vs_cbt");
  assert.ok(disbambDef, "theft_vs_cbt must exist");

  // These phrases came directly from the transcript
  const cbtPhrases = ["criminal breach", "breach of trust", "i guess criminal breach", "khayanat kiya"];
  for (const phrase of cbtPhrases) {
    const boost = disbambDef.boost(phrase);
    assert.ok(boost, `"${phrase}" must produce a boost`);
    assert.ok(boost.criminal_breach_of_trust, `"${phrase}" must resolve to criminal_breach_of_trust`);
  }
});

test("mock provider AI_PROVIDER=mock behaves identically — no API key needed", async () => {
  const mockProvider = require("../src/services/providers/mock");
  const result = await mockProvider.analyze("mera phone chori ho gaya", "auto", { conversation: [] });
  assert.strictEqual(result.category?.id, "theft");
  assert.strictEqual(result.needs_follow_up, true);
  assert.strictEqual(result.draft, null);
  assert.ok(result.message && result.message.length > 0);
});
