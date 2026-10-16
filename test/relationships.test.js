/**
 * Tests for the multilingual relationship normalizer and the rental/landlord
 * context handling added to the conversation engine.
 */

const test = require("node:test");
const assert = require("node:assert");

const { extractRelationship } = require("../src/services/relationships");
const mockProvider = require("../src/services/providers/mock");
const { classify } = require("../src/services/classification");

// ---------------------------------------------------------------------------
// Relationship extraction
// ---------------------------------------------------------------------------

test("extractRelationship recognises English relationship words", () => {
  for (const [text, expectedType] of [
    ["my husband", "husband"],
    ["my wife", "wife"],
    ["my spouse", "spouse"],
    ["my partner", "partner"],
    ["my boyfriend", "partner"],
    ["my ex-husband", "ex-husband"],
    ["my father", "father"],
    ["my mother", "mother"],
    ["my brother", "brother"],
    ["my sister", "sister"],
    ["my son", "son"],
    ["my daughter", "daughter"],
    ["a family member", "relative"],
    ["my landlord", "landlord"],
    ["my tenant", "tenant"],
    ["my employer", "employer"],
    ["my colleague", "colleague"],
    ["my teacher", "teacher"],
    ["my student", "student"],
    ["my friend", "friend"],
    ["my neighbor", "neighbor"],
    ["a stranger", "stranger"],
  ]) {
    const r = extractRelationship(text);
    assert.ok(r, `'${text}' should match a relationship`);
    assert.strictEqual(r.type, expectedType, `'${text}' -> ${expectedType}`);
  }
});

test("extractRelationship recognises Roman Urdu relationship words", () => {
  for (const [text, expectedType] of [
    ["mera shohar", "husband"],
    ["mere shohar ne", "husband"],
    ["meri biwi", "wife"],
    ["mera partner", "partner"],
    ["meri behen", "sister"],
    ["mera bhai", "brother"],
    ["mera dost", "friend"],
    ["mera parosi", "neighbor"],
    ["makaan maalik", "landlord"],
    ["kirayedar", "tenant"],
  ]) {
    const r = extractRelationship(text);
    assert.ok(r, `'${text}' should match a relationship`);
    assert.strictEqual(r.type, expectedType, `'${text}' -> ${expectedType}`);
  }
});

// ---------------------------------------------------------------------------
// Conversation engine: relationship is remembered and fills the threatener field
// ---------------------------------------------------------------------------

test("husband threat: relationship is extracted and stored, no repeated relationship question", async () => {
  const conv = [];
  const r1 = await mockProvider.analyze("My husband threatened to kill me.", "auto", { conversation: conv });
  conv.push({ role: "user", content: "My husband threatened to kill me." });
  conv.push({ role: "assistant", content: r1.message });

  assert.strictEqual(r1.category?.id, "criminal_intimidation");
  assert.strictEqual(r1.facts?.relationship?.type, "husband");
  assert.strictEqual(r1.facts?.who_threatened, "Relationship: Husband");

  // A follow-up that only repeats the relationship should not be asked again.
  const r2 = await mockProvider.analyze("My husband.", "auto", { conversation: conv });
  assert.strictEqual(r2.category?.id, "criminal_intimidation");
  assert.strictEqual(r2.facts?.relationship?.type, "husband");
  assert.strictEqual(r2.facts?.who_threatened, "Relationship: Husband");
  assert.ok(!r2.follow_up_questions[0]?.toLowerCase().includes("who"), "should not re-ask who threatened");
});

test("Roman Urdu husband threat is understood", async () => {
  const r = await mockProvider.analyze(
    "Mera shohar mujhe jaan se marne ki dhamki deta hai.",
    "auto",
    { conversation: [] }
  );
  assert.strictEqual(r.category?.id, "criminal_intimidation");
  assert.strictEqual(r.facts?.relationship?.type, "husband");
  assert.strictEqual(r.facts?.who_threatened, "Relationship: Husband");
});

// ---------------------------------------------------------------------------
// Landlord / deposit must not be classified as theft
// ---------------------------------------------------------------------------

test("landlord deposit is treated as rental/landlord dispute, not theft", async () => {
  for (const text of [
    "My landlord isn't giving my deposit back.",
    "Landlord refuses to return my security deposit.",
    "Mere landlord ne security deposit wapis nahi diya.",
  ]) {
    const r = await mockProvider.analyze(text, "auto", { conversation: [] });
    assert.notStrictEqual(r.category?.id, "theft", `'${text}' must not be theft`);
    assert.notStrictEqual(r.category?.id, "lost_property", `'${text}' must not be lost property`);
    assert.ok(
      r.message?.toLowerCase().includes("rental") ||
        r.message?.toLowerCase().includes("landlord") ||
        r.message?.toLowerCase().includes("tenancy"),
      `'${text}' should be identified as a rental/landlord/tenancy dispute`
    );
  }
});

// ---------------------------------------------------------------------------
// Theft still works for real theft cases
// ---------------------------------------------------------------------------

test("real theft cases still classify as theft", async () => {
  for (const text of [
    "My phone was stolen.",
    "Someone took my phone without my permission.",
  ]) {
    const r = await mockProvider.analyze(text, "auto", { conversation: [] });
    assert.strictEqual(r.category?.id, "theft", `'${text}' should be theft`);
    assert.strictEqual(r.confidence, "high", `'${text}' should reach high confidence`);
  }
});

// ---------------------------------------------------------------------------
// Classifier priority: context beats single keywords
// ---------------------------------------------------------------------------

test("classifier does not treat deposit/return as theft without an allegation of taking", () => {
  const r = classify("My landlord isn't giving my deposit back.");
  assert.strictEqual(r.topScore, 0, "no category should score without clear signals");
  assert.strictEqual(r.confidence, "none");
});
