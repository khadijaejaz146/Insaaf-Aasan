/**
 * Engine test suite — the Section 19 self-tests of the rebuild spec, plus
 * regression tests for every failure mode of the old engine:
 *
 *   - silent default to "theft"
 *   - exact keyword matching failing on spelling variants
 *   - turn-counting instead of required-field tracking
 *   - answering immediately instead of asking follow-ups
 *   - loss vs theft confusion
 *
 * Run:  npm test   (from backend/)
 */

const test = require("node:test");
const assert = require("node:assert");

const classification = require("../src/services/classification");
const mockProvider = require("../src/services/providers/mock");
const { CATEGORY_FIELDS } = require("../src/services/fieldDetectors");

const {
  classify,
  analyzeConversation,
  matchAssistantMessage,
  detectLanguage,
  DISAMBIGUATIONS,
  GENERIC_DESCRIBE_QUESTION,
  GREETING_QUESTION,
} = classification;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run one exchange through the mock provider (the real rule-based engine),
 * appending both messages to the growing conversation — exactly the way the
 * frontend will drive it.
 */
async function turn(conversation, text) {
  const result = await mockProvider.analyze(text, "auto", { conversation });
  conversation.push({ role: "user", content: text });
  conversation.push({ role: "assistant", content: result.message });
  return result;
}

// ---------------------------------------------------------------------------
// Section 19 — required self-tests
// ---------------------------------------------------------------------------

test("Section 19 #1: 'Mera phone chori ho gaya' -> theft follow-ups, never an immediate draft", async () => {
  const r = await mockProvider.analyze("Mera phone chori ho gaya", "auto", {
    conversation: [],
  });
  assert.strictEqual(r.category?.id, "theft");
  assert.strictEqual(r.confidence, "high");
  assert.strictEqual(r.needs_follow_up, true);
  assert.strictEqual(r.follow_up_questions.length, 1);
  assert.strictEqual(r.draft, null);
  assert.match(r.follow_up_questions[0], /when/i);
  assert.strictEqual(r.message_hint, "confirm_first");
  assert.match(r.message, /theft/i, "the first reply should acknowledge the category");
});

test("Section 19 #2: unseen Roman Urdu spelling variants of 'chori' still classify as theft", async () => {
  for (const variant of ["choree", "chorie", "chaurhi", "chawri", "chorya", "chourya"]) {
    const r = await mockProvider.analyze(`Mera phone ${variant} ho gaya`, "auto", {
      conversation: [],
    });
    assert.strictEqual(r.category?.id, "theft", `variant '${variant}' should be theft`);
    assert.strictEqual(r.needs_follow_up, true, `variant '${variant}' should trigger follow-ups`);
    assert.strictEqual(r.draft, null, `variant '${variant}' must not produce an immediate draft`);
  }
});

test("Section 19 #3: 'I got harassed on the road' -> Harassment, never Theft, never an immediate answer", async () => {
  const r = await mockProvider.analyze("I got harassed on the road", "auto", {
    conversation: [],
  });
  if (r.category) {
    assert.strictEqual(r.category.id, "harassment");
  } else if (r.disambiguation) {
    assert.ok(
      r.disambiguation.candidates.includes("harassment"),
      "a real disambiguation between harassment-related candidates is acceptable"
    );
  } else {
    assert.fail("either a category or a disambiguation must be produced");
  }
  assert.notStrictEqual(r.category?.id, "theft", "must never silently default to theft");
  assert.strictEqual(r.needs_follow_up, true);
  assert.strictEqual(r.draft, null);
  assert.ok(r.follow_up_questions.length >= 1);
});

test("Section 19 #4: 'Mera CNIC gum ho gaya' -> Lost Property (loss report, not a theft FIR)", async () => {
  const r1 = await mockProvider.analyze("Mera CNIC gum ho gaya", "auto", {
    conversation: [],
  });
  assert.strictEqual(r1.category?.id, "lost_property");
  assert.strictEqual(r1.needs_follow_up, true, "asks when/where — no immediate draft");

  const conversation = [
    { role: "user", content: "Mera CNIC gum ho gaya" },
    { role: "assistant", content: r1.message },
  ];
  const r2 = await mockProvider.analyze("kal subah office mein tha", "auto", {
    conversation,
  });
  assert.strictEqual(r2.needs_follow_up, false, "all three required facts are present");
  assert.strictEqual(r2.category.workflow_type, "loss_report");
  assert.match(r2.draft.subject, /Loss Report/i);
  assert.match(r2.draft.body, /have not alleged theft/i);
  assert.strictEqual(r2.message_hint, "finalize");
});

test("Section 19 #5: 'Mera CNIC kisi ne chori kar liya' -> Theft may be considered", async () => {
  const r = await mockProvider.analyze("Mera CNIC kisi ne chori kar liya", "auto", {
    conversation: [],
  });
  assert.strictEqual(r.category?.id, "theft");
  assert.strictEqual(r.needs_follow_up, true);
});

test("Section 19 #6: an ambiguous one-liner gets a clarifying question, never a guess", async () => {
  for (const text of [
    "Meri zindagi barbad ho gayi hai",
    "kuch masla hai mujhe",
    "help chahiye mujhe",
    "bohat paresan hoon",
  ]) {
    const r = await mockProvider.analyze(text, "auto", { conversation: [] });
    assert.strictEqual(r.category, null, `'${text}' must not lock onto a category`);
    assert.strictEqual(r.confidence, "none");
    assert.strictEqual(r.needs_follow_up, true);
    assert.strictEqual(r.follow_up_questions[0], GENERIC_DESCRIBE_QUESTION);
  }
});

test("Section 19 #7: no category is finalized after only the first message", async () => {
  const openings = [
    "Mera phone chori ho gaya",
    "I got harassed on the road",
    "Mera CNIC gum ho gaya",
    "Mera CNIC kisi ne chori kar liya",
    "mujhe online dhoka diya gaya 50 hazaar ka",
  ];
  for (const text of openings) {
    const r = await mockProvider.analyze(text, "auto", { conversation: [] });
    assert.strictEqual(r.needs_follow_up, true, `'${text}' must produce a follow-up question`);
    assert.strictEqual(r.draft, null, `'${text}' must not finalize immediately`);
    assert.ok(r.follow_up_questions.length >= 1, `'${text}' must ask at least one question`);
  }
});

// ---------------------------------------------------------------------------
// Field tracking (replaces turn-counting)
// ---------------------------------------------------------------------------

test("full theft intake: every required field is tracked across the conversation, then a structured draft", async () => {
  const conv = [];

  const r1 = await turn(conv, "Mera phone chori ho gaya");
  assert.strictEqual(r1.category.id, "theft");
  assert.match(r1.follow_up_questions[0], /when/i);

  const r2 = await turn(conv, "kal raat ko hua tha"); // datetime
  assert.match(r2.follow_up_questions[0], /where/i);
  assert.strictEqual(r2.message_hint, "progress");

  const r3 = await turn(conv, "Lahore ke market mein tha"); // location
  assert.match(r3.follow_up_questions[0], /worth/i);

  const r4 = await turn(conv, "pachas hazaar ka tha"); // value
  assert.match(r4.follow_up_questions[0], /suspect|who/i);

  const r5 = await turn(conv, "pata nahi"); // non-answer for suspect
  assert.ok(
    !/suspect|who might/i.test(r5.follow_up_questions[0] ?? ""),
    "an explicit 'don't know' must be recorded and never re-asked forever"
  );
  assert.match(r5.follow_up_questions[0], /evidence|cctv/i);

  const r6 = await turn(conv, "CCTV footage market ki hai"); // evidence
  assert.match(r6.follow_up_questions[0], /witness/i);

  const r7 = await turn(conv, "dukaan wale ne dekha tha"); // witnesses
  assert.match(r7.follow_up_questions[0], /imei/i);

  const r8 = await turn(conv, "imei box pe likha hai"); // imei -> finalize
  assert.strictEqual(r8.needs_follow_up, false);
  assert.strictEqual(r8.message_hint, "finalize");
  assert.ok(r8.draft, "a structured draft must be produced");
  assert.match(r8.draft.subject, /Complaint regarding/i);
  assert.ok(r8.draft.to.length > 0, "the draft must name the authority");

  // 8 theft fields: 5 facts + 3 evidence-list entries
  assert.strictEqual(r8.draft.facts.length, 5);
  assert.strictEqual(r8.draft.evidence.length, 3);
  const suspect = r8.draft.facts.find((f) => /suspect/i.test(f.label));
  assert.ok(suspect, "suspect field must appear in the draft");
  assert.strictEqual(suspect.value, "Not known");
  assert.match(r8.draft.signature, /\[Your Name\]/);

  assert.ok(r8.legal_references.length >= 1);
  for (const law of r8.legal_references) {
    assert.ok(["confirmed", "possible_fact_dependent"].includes(law.certainty));
    assert.ok(law.section && law.law_name);
    if (law.certainty === "possible_fact_dependent") assert.ok(law.note);
  }
  assert.ok(r8.sources.length >= 1);
  for (const s of r8.sources) {
    assert.strictEqual(s.source_type, "government");
    assert.ok(s.url.startsWith("https://"));
  }
  assert.ok(r8.next_steps.length >= 1);
});

test("'I don't know' answers are recorded as Not known — never counted as answered", async () => {
  const conv = [];
  const r1 = await turn(conv, "Mera CNIC gum ho gaya");
  assert.strictEqual(r1.category.id, "lost_property");
  const r2 = await turn(conv, "pata nahi");
  assert.strictEqual(r2.needs_follow_up, false, "unknown still lets the intake finish");
  const whenWhere = r2.draft.facts.find((f) => /when and where/i.test(f.label));
  assert.ok(whenWhere);
  assert.strictEqual(whenWhere.value, "Not known");
});

test("vague answers are re-asked once, more specifically", async () => {
  const conv = [];
  await turn(conv, "Mera phone chori ho gaya"); // asks datetime
  const r2 = await turn(conv, "matlab kuch samajh nahi"); // no date info
  assert.strictEqual(r2.message_hint, "reask");
  assert.match(r2.message, /more specific|approximately|roughly/i);
});

test("missing_fields / matched_fields reflect real field tracking", async () => {
  const r = await mockProvider.analyze("Mera phone chori ho gaya", "auto", {
    conversation: [],
  });
  assert.ok(r.matched_fields.some((f) => f.id === "property_stolen"));
  assert.ok(r.missing_fields.some((f) => f.id === "datetime"));
  assert.ok(!r.missing_fields.some((f) => f.id === "property_stolen"));
});

// ---------------------------------------------------------------------------
// Disambiguation (never silently default)
// ---------------------------------------------------------------------------

test("mixed loss/theft signals ask the loss-vs-theft question; the answer sticks for the whole intake", async () => {
  const conv = [];
  const r1 = await turn(conv, "Mera phone gum ho gaya shayad kisi ne chori kar li");
  assert.strictEqual(r1.category, null, "no category may be locked on yet");
  assert.strictEqual(r1.disambiguation?.id, "theft_vs_lost");
  assert.match(r1.message, /theft.*lost|lost.*theft/i);

  const r2 = await turn(conv, "haan chori kiya hoga kisi ne");
  assert.strictEqual(r2.category?.id, "theft", "the answer must resolve to theft");
  assert.ok(
    !/believe someone took it|simply lost/i.test(r2.message),
    "the same either/or must not be asked again"
  );
  assert.match(r2.follow_up_questions[0], /when/i);

  // later turns must stay on theft — the confirmed choice stands
  const r3 = await turn(conv, "kal shaam ko market mein hua tha");
  assert.strictEqual(r3.category?.id, "theft");
  assert.ok(!/believe someone took it|simply lost/i.test(r3.message));
  assert.ok(!r3.disambiguation);
});

test("loss-vs-theft answer can also resolve to Lost Property", async () => {
  const conv = [];
  const r1 = await turn(conv, "Mera phone gum ho gaya shayad kisi ne chori kar li");
  assert.strictEqual(r1.disambiguation?.id, "theft_vs_lost");
  const r2 = await turn(conv, "nahi nahi, gum hi hoga shayad");
  assert.strictEqual(r2.category?.id, "lost_property");
  assert.match(r2.follow_up_questions[0], /when and where/i);
});

test("a failed disambiguation answer is re-asked once, then falls back to a plain description request", async () => {
  const conv = [];
  const r1 = await turn(conv, "scam"); // genuinely ambiguous: fraud vs online scam
  assert.strictEqual(r1.disambiguation?.id, "fraud_vs_online_scam");

  const r2 = await turn(conv, "haan ji");
  assert.strictEqual(r2.message_hint, "disambiguate_retry");
  assert.match(r2.message, /one word is enough/i);

  const r3 = await turn(conv, "matlab");
  assert.strictEqual(r3.category, null);
  assert.strictEqual(r3.follow_up_questions[0], GENERIC_DESCRIBE_QUESTION);
});

// ---------------------------------------------------------------------------
// Greetings and language handling
// ---------------------------------------------------------------------------

test("a pure greeting gets a greeting response and never pollutes the intake", async () => {
  const conv = [];
  const r1 = await turn(conv, "Assalam o Alaikum");
  assert.strictEqual(r1.category, null);
  assert.strictEqual(r1.message, GREETING_QUESTION);
  assert.strictEqual(r1.message_hint, "greeting");

  const r2 = await turn(conv, "mujhe dhoka diya gaya hai");
  assert.strictEqual(r2.category?.id, "fraud");
  assert.strictEqual(r2.message_hint, "confirm_first");
  // "what happened" must come from the description, not the greeting
  assert.ok(
    r2.matched_fields.some((f) => f.id === "what_happened"),
    "the description should already satisfy 'what happened'"
  );
});

test("language detection: Urdu script, Roman Urdu, English", () => {
  assert.strictEqual(detectLanguage("میرا فون چوری ہو گیا"), "ur");
  assert.strictEqual(detectLanguage("Mera phone chori ho gaya"), "roman-ur");
  assert.strictEqual(detectLanguage("My phone was stolen yesterday"), "en");
});

test("Urdu script input classifies and asks follow-ups", async () => {
  const r = await mockProvider.analyze("میرا فون چوری ہو گیا ہے", "auto", {
    conversation: [],
  });
  assert.strictEqual(r.language, "ur");
  assert.strictEqual(r.category?.id, "theft");
  assert.strictEqual(r.needs_follow_up, true);
});

// ---------------------------------------------------------------------------
// Normalization / fuzzy matching guards
// ---------------------------------------------------------------------------

test("ordinary English words never trigger category signals via fuzzy matching", () => {
  // "last" must not become "lost" — and the real signal ("stole") must win
  const a = classify("last night someone stole my phone");
  assert.strictEqual(a.top, "theft");
  assert.strictEqual(a.confidence, "high");

  // "char" (Roman Urdu for "four") must not become "chor"
  const b = classify("usne mujhe char lakh ka dhoka diya");
  assert.strictEqual(b.top, "fraud");

  // abstract "lost" is not lost property...
  const c = classify("I lost my job last month");
  assert.strictEqual(c.confidence, "none");
  // ...but a genuinely lost phone is
  const d = classify("I lost my phone yesterday");
  assert.strictEqual(d.top, "lost_property");
  assert.strictEqual(d.confidence, "high");
});

test("English fraud phrasing reaches confident classification", async () => {
  const r = await mockProvider.analyze("I was cheated by a shopkeeper", "auto", {
    conversation: [],
  });
  assert.strictEqual(r.category?.id, "fraud");
  assert.strictEqual(r.needs_follow_up, true);
});

test("online scam context specializes fraud into Online Scam", async () => {
  const r = await mockProvider.analyze(
    "mujhe online dhoka diya gaya 50 hazaar ka",
    "auto",
    { conversation: [] }
  );
  assert.strictEqual(r.category?.id, "online_scam");
  assert.strictEqual(r.needs_follow_up, true);
});

// ---------------------------------------------------------------------------
// Question matching integrity (no two questions may be confusable)
// ---------------------------------------------------------------------------

test("every intake question is uniquely recognizable", () => {
  for (const [categoryId, fields] of Object.entries(CATEGORY_FIELDS)) {
    for (const field of fields) {
      for (const q of [field.question, field.reask]) {
        const m = matchAssistantMessage(q);
        assert.ok(m, `question must match something: "${q}"`);
        assert.strictEqual(m.type, "field", `"${q}"`);
        assert.strictEqual(m.categoryId, categoryId, `"${q}"`);
        assert.strictEqual(m.fieldId, field.id, `"${q}"`);
      }
    }
  }
  for (const def of DISAMBIGUATIONS) {
    for (const q of [def.question, def.reask]) {
      const m = matchAssistantMessage(q);
      assert.ok(m, `disambiguation must match: "${q}"`);
      assert.strictEqual(m.type, "disamb", `"${q}"`);
      assert.strictEqual(m.def.id, def.id, `"${q}"`);
    }
  }
});

test("matchAssistantMessage recognizes the composed chat messages (prefixes included)", async () => {
  const conv = [];
  const r1 = await turn(conv, "Mera phone chori ho gaya");
  const m1 = matchAssistantMessage(r1.message);
  assert.ok(m1 && m1.type === "field" && m1.fieldId === "datetime");

  const r2 = await turn(conv, "kal raat ko hua tha");
  const m2 = matchAssistantMessage(r2.message);
  assert.ok(m2 && m2.type === "field" && m2.fieldId === "location");
});

test("long informational replies never register as pending intake questions", () => {
  // Official-source fallback guidance: declarative, long, and its safety
  // wording ("in immediate danger ... right now") overlaps the
  // immediate_danger intake question — it must still never match, or the
  // engine would treat the reply as an asked question and mis-sequence the
  // intake (e.g. progress instead of confirm_first for a later category).
  const fallbackReply = [
    "Thank you for explaining your situation. I'll check the relevant Pakistani laws and official guidance for you.",
    "Here is what may help in your situation:",
    "1. If you are in immediate danger, contact the Police (15) right now.",
    "2. Report the incident at the nearest police station. You may ask for a female officer.",
    "Remember: Insaaf Aasan provides general legal information only. It does not constitute legal advice. Always consult a qualified lawyer for your specific situation.",
  ].join("\n\n");
  assert.strictEqual(matchAssistantMessage(fallbackReply), null);

  // Short hint-style reasks without a question mark stay recognizable.
  const m = matchAssistantMessage(
    "A rough estimate is fine — for example 'about 50 thousand rupees'."
  );
  assert.ok(m && m.type === "field", "short declarative reask must still match");
});

// ---------------------------------------------------------------------------
// Provider contract
// ---------------------------------------------------------------------------

test("analyzeConversation is a pure, provider-agnostic function of (text, conversation)", () => {
  const r1 = analyzeConversation({ text: "Mera phone chori ho gaya", conversation: [] });
  const r2 = analyzeConversation({ text: "Mera phone chori ho gaya", conversation: [] });
  assert.deepStrictEqual(r1, r2);
  assert.strictEqual(r1.category, "theft");
  assert.ok(Array.isArray(r1.missing_fields) && r1.missing_fields.length > 0);
  assert.ok(Array.isArray(r1.matched_fields) && r1.matched_fields.length > 0);
});
