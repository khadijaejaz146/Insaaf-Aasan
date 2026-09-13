/**
 * classification.js — the conversation engine (the heart of this rebuild).
 *
 * Replaces the old engine's failures:
 *   - exact keyword matching        -> normalization + variant map + fuzzy matching
 *   - silent default to "theft"     -> confidence scoring; ambiguous input asks ONE
 *                                      disambiguating question instead of guessing
 *   - answering immediately         -> at least one question is always asked
 *   - turn-counting                 -> required-field tracking per category; the
 *                                      conversation advances only when the actual
 *                                      facts are present in the conversation
 *   - loss vs theft confusion       -> an explicit check + dedicated disambiguator
 *
 * Public contract (provider-agnostic — any future LLM provider must satisfy
 * the same shape):
 *
 *   analyzeConversation({ text, conversation })
 *     -> { category, confidence, language, needs_follow_up, follow_up_questions,
 *          missing_fields, matched_fields, facts, disambiguation, message_hint }
 *
 *   classify(text) -> { category, confidence, scores }
 */

const {
  canonicalizeToken,
  isUrduToken,
  registerVocabulary,
} = require("./synonyms");
const {
  CATEGORY_FIELDS,
  isNonAnswer,
  isGreeting,
} = require("./fieldDetectors");
const { extractRelationship } = require("./relationships");

// ---------------------------------------------------------------------------
// Category signals
// ---------------------------------------------------------------------------

/**
 * Canonical token -> per-category weights. A token may signal more than one
 * category (e.g. "scam" hints both fraud and online scam; "harass" hints both
 * harassment and cyberstalking) — the confidence margin resolves which.
 */
const KEYWORD_WEIGHTS = {
  // theft
  chori: { theft: 4 },
  churaya: { theft: 4 },
  chor: { theft: 4 },
  snach: { theft: 3.5 },
  chheena: { theft: 3 },
  uthaya: { theft: 1.5 },
  theft: { theft: 4 },
  steal: { theft: 3.5 },
  stole: { theft: 4 },
  took: { theft: 2 },

  // lost property / documents
  gum: { lost_property: 4 },
  gumshuda: { lost_property: 4 },
  kho: { lost_property: 2.5 },
  khoi: { lost_property: 3 },
  lost: { lost_property: 4 },
  misplaced: { lost_property: 4 },
  missing: { lost_property: 3 },

  // fraud / cheating
  dhoka: { fraud: 4 },
  faraib: { fraud: 3 },
  fraud: { fraud: 4 },
  cheat: { fraud: 4 },
  deceiv: { fraud: 4 },
  scam: { fraud: 1.5, online_scam: 2.5 },

  // criminal breach of trust
  amanat: { criminal_breach_of_trust: 3.5 },
  khayanat: { criminal_breach_of_trust: 4 },
  entrusted: { criminal_breach_of_trust: 3.5 },
  misappropriate: { criminal_breach_of_trust: 3.5 },
  misappropriation: { criminal_breach_of_trust: 3.5 },
  misused: { criminal_breach_of_trust: 1 },
  trust: { criminal_breach_of_trust: 1 },

  // criminal intimidation / threats
  dhamki: { criminal_intimidation: 4 },
  threat: { criminal_intimidation: 4 },
  intimidation: { criminal_intimidation: 4 },
  intimidate: { criminal_intimidation: 3.5 },
  daraya: { criminal_intimidation: 2.5 },
  blackmail: { criminal_intimidation: 3, cyberstalking: 2 },

  // harassment
  harass: { harassment: 4, cyberstalking: 2 },
  harasani: { harassment: 4, cyberstalking: 2 },
  molested: { harassment: 4 },
  chherkhani: { harassment: 3.5 },
  chher: { harassment: 3 },
  stalk: { harassment: 1.5, cyberstalking: 2.5 },
  follow: { harassment: 1.5 },
  touch: { harassment: 1 },

  // cyberstalking / online harassment
  cyber: { cyberstalking: 3.5 },
  cyberstalking: { cyberstalking: 4 },
  cyberbully: { cyberstalking: 4, harassment: 1 },
  cyberbullied: { cyberstalking: 4, harassment: 1 },
  cyberbullying: { cyberstalking: 4, harassment: 1 },
  // Collapsed forms (ll→l): canonicalizeToken produces these, so they
  // must also be present as keys for the post-canonical lookup.
  cyberbulied: { cyberstalking: 4, harassment: 1 },
  cyberbuly: { cyberstalking: 4, harassment: 1 },
  cyberbuling: { cyberstalking: 4, harassment: 1 },
  bully: { cyberstalking: 3, harassment: 1.5 },
  bullied: { cyberstalking: 3.5, harassment: 1.5 },
  bullying: { cyberstalking: 3.5, harassment: 1.5 },
  // Collapsed forms for bully/bullied/bullying (ll→l)
  bulied: { cyberstalking: 3.5, harassment: 1.5 },
  buling: { cyberstalking: 3.5, harassment: 1.5 },
  morph: { cyberstalking: 3.5 },
  impersonation: { cyberstalking: 3.5 },
  hack: { cyberstalking: 1.5 },
  hacked: { cyberstalking: 2 },
  fake: { cyberstalking: 1 },
  account: { cyberstalking: 1 },
  profile: { cyberstalking: 1 },

  // online scam
  phishing: { online_scam: 4 },
  olx: { online_scam: 3.5 },
  daraz: { online_scam: 3 },
  investment: { online_scam: 1.5 },
};

/** Multi-word phrases (over canonical tokens) -> category boosts. */
const PHRASE_SIGNALS = [
  { tokens: ["chori", "ho"], w: 1, cat: "theft" },
  { tokens: ["kisi", "ne", "chori"], w: 1.5, cat: "theft" },
  { tokens: ["kisi", "ne", "utha"], w: 1.5, cat: "theft" },
  { tokens: ["without", "permission"], w: 3, cat: "theft" },
  { tokens: ["without", "my", "permission"], w: 3, cat: "theft" },
  { tokens: ["without", "your", "permission"], w: 3, cat: "theft" },
  { tokens: ["without", "his", "permission"], w: 3, cat: "theft" },
  { tokens: ["without", "her", "permission"], w: 3, cat: "theft" },
  { tokens: ["took", "without"], w: 1.5, cat: "theft" },
  { tokens: ["took", "my"], w: 1, cat: "theft" },
  { tokens: ["gum", "ho"], w: 1, cat: "lost_property" },
  { tokens: ["missing", "ho"], w: 1.5, cat: "lost_property" },
  { tokens: ["kho", "gaya"], w: 1.5, cat: "lost_property" },
  { tokens: ["kho", "gai"], w: 1.5, cat: "lost_property" },
  { tokens: ["nahi", "mil"], w: 2, cat: "lost_property" },
  { tokens: ["dhoka", "diya"], w: 1.5, cat: "fraud" },
  { tokens: ["dhoka", "de"], w: 1.5, cat: "fraud" },
  { tokens: ["dhoke", "mein"], w: 1.5, cat: "fraud" },
  { tokens: ["online", "scam"], w: 2.5, cat: "online_scam" },
  { tokens: ["online", "dhoka"], w: 2.5, cat: "online_scam" },
  { tokens: ["fake", "job"], w: 3, cat: "online_scam" },
  { tokens: ["paisa", "double"], w: 2.5, cat: "online_scam" },
  { tokens: ["breach", "of", "trust"], w: 4, cat: "criminal_breach_of_trust" },
  { tokens: ["amanat", "mein"], w: 1.5, cat: "criminal_breach_of_trust" },
  { tokens: ["wapas", "nahi"], w: 2, cat: "criminal_breach_of_trust" },
  { tokens: ["rakhne", "ke"], w: 1.5, cat: "criminal_breach_of_trust" },
  { tokens: ["mar", "dunga"], w: 2.5, cat: "criminal_intimidation" },
  { tokens: ["mar", "dalega"], w: 2.5, cat: "criminal_intimidation" },
  { tokens: ["marne", "ki", "dhamki"], w: 2, cat: "criminal_intimidation" },
  { tokens: ["dhamki", "di"], w: 1.5, cat: "criminal_intimidation" },
  { tokens: ["eve", "teasing"], w: 3.5, cat: "harassment" },
  { tokens: ["chher", "chhad"], w: 3.5, cat: "harassment" },
  { tokens: ["touch", "kiya"], w: 2, cat: "harassment" },
  { tokens: ["tang", "karta"], w: 2.5, cat: "harassment" },
  { tokens: ["tang", "kar"], w: 2.5, cat: "harassment" },
  { tokens: ["paresan", "karta"], w: 2.5, cat: "harassment" },
  { tokens: ["cyber", "harasani"], w: 3, cat: "cyberstalking" },
  { tokens: ["cyber", "harass"], w: 3, cat: "cyberstalking" },
  { tokens: ["online", "harasani"], w: 3, cat: "cyberstalking" },
  { tokens: ["online", "harassment"], w: 5, cat: "cyberstalking" },
  { tokens: ["fake", "profile"], w: 3, cat: "cyberstalking" },
  { tokens: ["fake", "account"], w: 3, cat: "cyberstalking" },
  { tokens: ["cyber", "bully"], w: 3, cat: "cyberstalking" },
  { tokens: ["cyber", "bullied"], w: 3, cat: "cyberstalking" },
  { tokens: ["cyber", "bullying"], w: 3, cat: "cyberstalking" },
  { tokens: ["online", "bully"], w: 3, cat: "cyberstalking" },
  { tokens: ["online", "bullied"], w: 3, cat: "cyberstalking" },
  { tokens: ["online", "bullying"], w: 3, cat: "cyberstalking" },
];

/** Urdu-script signals (substring match on the raw text). */
const URDU_SIGNALS = [
  { term: "چوری", w: 4, cat: "theft" },
  { term: "چرایا", w: 4, cat: "theft" },
  { term: "چرائی", w: 3.5, cat: "theft" },
  { term: "چور", w: 2.5, cat: "theft" },
  { term: "گمشدہ", w: 4, cat: "lost_property" },
  { term: "کھوئی", w: 3, cat: "lost_property" },
  { term: "گم", w: 3.5, cat: "lost_property" },
  { term: "کھو", w: 2.5, cat: "lost_property" },
  { term: "دھوکہ", w: 3.5, cat: "fraud" },
  { term: "دھوکھا", w: 3.5, cat: "fraud" },
  { term: "فراڈ", w: 3.5, cat: "fraud" },
  { term: "امانت", w: 3.5, cat: "criminal_breach_of_trust" },
  { term: "خیانت", w: 4, cat: "criminal_breach_of_trust" },
  { term: "دھمکی", w: 4, cat: "criminal_intimidation" },
  { term: "ہراسانی", w: 4, cat: "harassment" },
  { term: "ہراساں", w: 3.5, cat: "harassment" },
  { term: "چھیڑ", w: 3, cat: "harassment" },
  { term: "سائبر", w: 3.5, cat: "cyberstalking" },
];

/** Urdu phrases that indicate an online context. */
const URDU_ONLINE_TERMS = ["آن لائن", "فیس بک", "واٹس", "انسٹا", "ٹک ٹوک", "یوٹیوب", "سوشل میڈیا"];

/** Tokens that make the context clearly "online". */
const ONLINE_CTX = new Set([
  "online", "internet", "website", "web", "facebook", "fb", "insta", "instagram",
  "whatsapp", "olx", "daraz", "tiktok", "youtube", "snapchat", "telegram",
  "twitter", "email", "gmail", "sms", "phishing", "cyber", "social", "media",
  "google", "amazon", "aliexpress", "ebay", "linkedin", "imo", "viber",
]);

/**
 * "I lost my job / my temper / my phone" — only the last one is lost
 * property. These abstract "lost" collocations must not trigger the
 * lost-property category.
 */
const LOST_ABSTRACT_RE = /\b(job|jobs|weight|mind|temper|hope|appetite|interest|sleep|control)\b/;

// Register all Latin keywords so they participate in fuzzy matching.
registerVocabulary([
  ...Object.keys(KEYWORD_WEIGHTS),
  ...ONLINE_CTX,
  "paresan", "pareshan", "presan", "tang", "invest", "invested",
  "permission", "permisson",
  "bully", "bullied", "bullying", "cyberbully", "cyberbullied", "cyberbullying",
]);

const CATEGORY_IDS = [
  "theft", "fraud", "criminal_breach_of_trust", "criminal_intimidation",
  "harassment", "cyberstalking", "online_scam", "lost_property",
];

// Confidence thresholds
const HIGH_MIN_SCORE = 4;
const HIGH_MARGIN = 1.75;
const LOW_MIN_SCORE = 1.5;

/**
 * Maximum number of user turns before the intake is force-finalized.
 * After this many exchanges, remaining unknown fields are recorded as
 * "Not known" and the draft is generated. This prevents the intake from
 * getting stuck when a user cannot provide optional details (e.g. IMEI).
 */
const MAX_INTAKE_USER_TURNS = 10;

// ---------------------------------------------------------------------------
// Normalization / language detection
// ---------------------------------------------------------------------------

function normalizeText(text) {
  const raw = text || "";
  const lower = raw.toLowerCase();
  const tokens = lower
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map(canonicalizeToken);
  return { raw, lower, tokens };
}

function hasNGram(tokens, seq) {
  const n = seq.length;
  for (let i = 0; i + n <= tokens.length; i++) {
    let ok = true;
    for (let j = 0; j < n; j++) {
      if (tokens[i + j] !== seq[j]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

const ROMAN_URDU_MARKERS = new Set([
  "mera", "meri", "mere", "ho", "gaya", "gai", "gya", "gyi", "hai", "hain",
  "tha", "thi", "ka", "ki", "ke", "ko", "se", "ne", "mein",
  "nahi", "nai", "kya", "koi", "kuch", "mujhe", "usne", "uska", "uski",
  "kar", "karta", "karti", "karne", "liya", "liye", "diya", "diye", "raha",
  "rahi", "rahe", "walay", "wala", "wali", "jata", "aata", "parda", "chori",
]);
// ("the" and "me" are deliberately excluded — they are ordinary English
// words and caused English sentences to be misdetected as Roman Urdu.)

function detectLanguage(text) {
  const t = text || "";
  if (/[\u0600-\u06FF]/.test(t)) return "ur";
  const tokens = t.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (tokens.some((tok) => ROMAN_URDU_MARKERS.has(tok))) return "roman-ur";
  return "en";
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Classify complaint text. `boosts` is an optional map of
 * { categoryId: extraWeight } applied after regular scoring (used to apply
 * the user's answer to a disambiguation question).
 */
function classify(text, boosts) {
  const norm = normalizeText(text);
  const scores = {};
  for (const id of CATEGORY_IDS) scores[id] = 0;

  // token weights
  for (const token of norm.tokens) {
    const weights = KEYWORD_WEIGHTS[token];
    if (weights) {
      for (const [cat, w] of Object.entries(weights)) scores[cat] += w;
    }
  }

  // phrase signals
  for (const p of PHRASE_SIGNALS) {
    if (hasNGram(norm.tokens, p.tokens)) scores[p.cat] += p.w;
  }

  // Urdu-script signals
  for (const s of URDU_SIGNALS) {
    if (norm.raw.includes(s.term)) scores[s.cat] += s.w;
  }

  // guard: abstract "lost" (job, temper…) is not lost property
  if (scores.lost_property > 0 && LOST_ABSTRACT_RE.test(norm.lower)) {
    scores.lost_property *= 0.25;
  }

  // online context: specialize fraud/harassment/threats toward their
  // online counterparts instead of treating them as the same thing
  const onlineCtx =
    norm.tokens.some((t) => ONLINE_CTX.has(t)) ||
    URDU_ONLINE_TERMS.some((term) => norm.raw.includes(term));
  if (onlineCtx) {
    if (scores.fraud > 0) { scores.online_scam += 2.5; scores.fraud *= 0.5; }
    if (scores.harassment > 0) { scores.cyberstalking += 2.5; scores.harassment *= 0.5; }
    if (scores.criminal_intimidation > 0) {
      scores.cyberstalking += 2.5;
      scores.criminal_intimidation *= 0.5;
    }
  }

  // disambiguation boosts
  if (boosts) {
    for (const [cat, w] of Object.entries(boosts)) {
      if (scores[cat] !== undefined) scores[cat] += w;
    }
  }

  // rank
  const ranked = CATEGORY_IDS.map((id) => ({ id, score: scores[id] }))
    .sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const runnerUp = ranked[1];

  let confidence;
  if (top.score >= HIGH_MIN_SCORE && top.score >= HIGH_MARGIN * Math.max(runnerUp.score, 0.6)) {
    confidence = "high";
  } else if (top.score >= LOW_MIN_SCORE) {
    confidence = "low";
  } else {
    confidence = "none";
  }

  return { scores, top: top.id, topScore: top.score, runnerUp: runnerUp.id, runnerUpScore: runnerUp.score, confidence };
}

// ---------------------------------------------------------------------------
// Disambiguation registry
// ---------------------------------------------------------------------------

/**
 * Each entry: a pair of confusable categories, ONE plain-language question
 * that separates them, a blunt re-ask, and a boost() that interprets the
 * user's reply. Returns { categoryId: weight } or null when the reply does
 * not answer the question.
 */
const DISAMBIGUATIONS = [
  {
    id: "theft_vs_lost",
    pair: ["theft", "lost_property"],
    question: "Do you believe someone took it (theft), or do you think it was simply lost or misplaced?",
    reask: "Please reply with one word — 'taken' (someone took it) or 'lost' (it went missing on its own).",
    boost(reply) {
      const t = (reply || "").toLowerCase();
      const taken = /(chori|churaya|choraya|chura|kisi\s*ne|utha|chheena|snatch|stolen|stole|theft|taken|took)/.test(t);
      const lost = /(gum|gumshuda|kho\s*gaya|khoi|misplaced|lost|pata\s*nahi|nahi\s*mil|gira|bhool|shayad|chhoot|chut)/.test(t);
      if (taken && !lost) return { theft: 5 };
      if (lost && !taken) return { lost_property: 5 };
      return null;
    },
  },
  {
    id: "fraud_vs_online_scam",
    pair: ["fraud", "online_scam"],
    question: "Did this happen online (through a website, app, or social media), or in person?",
    reask: "One word is enough: did it happen 'online' or 'in person'?",
    boost(reply) {
      const t = (reply || "").toLowerCase();
      const online = /(online|internet|website|web|app|facebook|instagram|whatsapp|olx|daraz|tiktok|link|url|account|phone\s*call|call|sms|email)/.test(t);
      const inPerson = /(in\s*person|person|mila|mila\s*tha|milke|shaam|office|ghar|aake|aaya|tha\s*idhar|face\s*to\s*face|aamne|samne|dukan|shop|market)/.test(t);
      if (online && !inPerson) return { online_scam: 5 };
      if (inPerson && !online) return { fraud: 5 };
      return null;
    },
  },
  {
    id: "harassment_vs_intimidation",
    pair: ["harassment", "criminal_intimidation"],
    question: "Did the person directly threaten to harm you, or was it unwanted behaviour and comments without a direct threat?",
    reask: "In short: was there a direct threat of harm ('I will hurt you'), or unpleasant behaviour without a direct threat?",
    boost(reply) {
      const t = (reply || "").toLowerCase();
      // Word-bounded stems only: the old unbounded "mar"/"dar" matched
      // ordinary words like "market" or "sardar" and misrouted the reply.
      const threat = /\b(threat|threats|threaten|threatened|dhamki|kill|killed|hurt|harm|nuksan|damage|dara|daraya|daraa|dar|darr|darna|tabahi|nishaan)\b|\bmar\b|\bmaar\b|\bmar(na|ne|ni|dunga|dalega|dalenge|dala)\b/.test(t);
      const behaviour = /\b(harass|harassed|harassment|harasani|comment|comments|commenting|chher|chherkhani|chhera|chhu|chhoo|touch|touched|touching|follow|followed|following|baatein|batein|baton|behave|behaviour|behavior|gali|gaali|gaaliyan|dekh|dekhna|dekhta|stare|staring|paresan|pareshan|tang|ganda|gandi|harkat|dirty|abus(e|es|ed|ing|ive)|remark|remarks|tease|teased|teasing|molest|bother|bothered|unwanted|catcall|whistle|whistled)\b/.test(t);
      if (threat && !behaviour) return { criminal_intimidation: 5 };
      if (behaviour && !threat) return { harassment: 5 };
      return null;
    },
  },
  {
    id: "harassment_vs_cyberstalking",
    pair: ["harassment", "cyberstalking"],
    question: "Did this happen online (on social media or messaging apps), or in person / face to face?",
    reask: "Please just say 'online' or 'in person'.",
    boost(reply) {
      const t = (reply || "").toLowerCase();
      const online = /(online|internet|facebook|instagram|whatsapp|dm|inbox|message|sms|email|app|profile|account|page)/.test(t);
      const inPerson = /(in\s*person|person|mila|milke|office|ghar|road|sadak|sarak|bus|market|face\s*to\s*face|aamne|samne)/.test(t);
      if (online && !inPerson) return { cyberstalking: 5 };
      if (inPerson && !online) return { harassment: 5 };
      return null;
    },
  },
  {
    id: "intimidation_vs_cyberstalking",
    pair: ["criminal_intimidation", "cyberstalking"],
    question: "Are these threats being made online (through messages or social media), or in person / by phone?",
    reask: "Please reply with one word — 'online' or 'offline'.",
    boost(reply) {
      const t = (reply || "").toLowerCase();
      const online = /(online|internet|facebook|instagram|whatsapp|dm|inbox|message|sms|email|app|profile|account|page)/.test(t);
      const offline = /(offline|in\s*person|person|mila|milke|phone|call|aamne|samne|face\s*to\s*face)/.test(t);
      if (online && !offline) return { cyberstalking: 5 };
      if (offline && !online) return { criminal_intimidation: 5 };
      return null;
    },
  },
  {
    id: "fraud_vs_cbt",
    pair: ["fraud", "criminal_breach_of_trust"],
    question: "Did you hand over the money or property because of a false promise, or had you entrusted it to them to keep or return (for example a deposit, loan, or safekeeping)?",
    reask: "In short: were you deceived into paying (fraud), or did you give it in trust and they misused it (breach of trust)?",
    boost(reply) {
      const t = (reply || "").toLowerCase();
      const fraud = /(dhoka|dhokha|deceiv|lie|lie|jhoot|false|promise|waada|fraud|scam|offer|deal|invest|scheme)/.test(t);
      const cbt = /(amanat|entrust|entrusted|deposit|rakh|rakha|rakhwaya|safe|keep|qarz|loan|udhaar|udhar|return|wapas|trust)/.test(t);
      if (fraud && !cbt) return { fraud: 5 };
      if (cbt && !fraud) return { criminal_breach_of_trust: 5 };
      return null;
    },
  },
];

function findDisambiguation(a, b) {
  return DISAMBIGUATIONS.find(
    (d) => (d.pair[0] === a && d.pair[1] === b) || (d.pair[0] === b && d.pair[1] === a)
  );
}

/** Generic fallback for an unregistered confusable pair. */
function genericDisambiguation(a, b, labels) {
  return {
    id: `generic_${a}_vs_${b}`,
    pair: [a, b],
    question: `I want to be sure I understand. Which is closer to your situation: ${labels[a]} or ${labels[b]}?`,
    reask: `Please tell me briefly — is this more like ${labels[a]}, or ${labels[b]}?`,
    boost(reply) {
      const c = classify(reply);
      if (c.topScore >= 3 && (c.top === a || c.top === b)) {
        return { [c.top]: 5 };
      }
      return null;
    },
  };
}

// ---------------------------------------------------------------------------
// Question matching (which question is the conversation waiting on?)
// ---------------------------------------------------------------------------

function tokenSet(text) {
  return new Set(
    (text || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 1)
  );
}

/** Coverage of question tokens present in an assistant message (0..1). */
function coverage(msgTokens, questionText) {
  const qTokens = tokenSet(questionText);
  if (qTokens.size === 0) return 0;
  let hit = 0;
  for (const t of qTokens) if (msgTokens.has(t)) hit++;
  return hit / qTokens.size;
}

/**
 * Identify what a given assistant message was asking, if anything.
 * Returns { type: "field", categoryId, fieldId } | { type: "disamb", def } | null.
 */
function matchAssistantMessage(content) {
  const text = String(content || "");
  const msgTokens = tokenSet(text);
  if (msgTokens.size === 0) return null;
  // Declarative informational replies — official-source fallback guidance,
  // draft summaries — must never register as the pending intake question,
  // even though their safety wording ("in immediate danger ... right now")
  // can reach question coverage. A message that asks nothing (no question
  // mark) and is longer than any real intake question is informational.
  // Short hint-style reasks ("A rough estimate is fine — for example 'about
  // 50 thousand rupees'.") stay recognizable.
  if (!/[?؟]/.test(text) && msgTokens.size > 40) return null;

  let best = null;
  let bestScore = 0;
  let secondScore = 0;

  for (const [categoryId, fields] of Object.entries(CATEGORY_FIELDS)) {
    for (const field of fields) {
      for (const q of [field.question, field.reask]) {
        const c = coverage(msgTokens, q);
        if (c > bestScore) {
          secondScore = bestScore;
          bestScore = c;
          best = { type: "field", categoryId, fieldId: field.id };
        } else if (c > secondScore) {
          secondScore = c;
        }
      }
    }
  }

  for (const def of DISAMBIGUATIONS) {
    for (const q of [def.question, def.reask]) {
      const c = coverage(msgTokens, q);
      if (c > bestScore) {
        secondScore = bestScore;
        bestScore = c;
        best = { type: "disamb", def };
      } else if (c > secondScore) {
        secondScore = c;
      }
    }
  }

  if (bestScore >= 0.8 && bestScore - secondScore >= 0.15) return best;
  return null;
}

// ---------------------------------------------------------------------------
// Conversation analysis
// ---------------------------------------------------------------------------

const GENERIC_DESCRIBE_QUESTION =
  "I want to make sure I understand correctly. In a sentence or two, please describe what happened — for example: was something stolen or lost, did someone threaten or harass you, did someone deceive you, or was something entrusted and not returned?";

const GREETING_QUESTION =
  "Assalam-o-Alaikum! I'm Insaaf Aasan — I help you understand a legal problem and prepare a complaint. Please describe what happened, in Urdu, Roman Urdu, or English.";

/**
 * Walk the conversation chronologically and rebuild the intake state:
 * which fields were answered, which were explicitly unknown, and what the
 * last assistant message was waiting for. This is what replaces turn-counting.
 */
function replayConversation(conversation, currentText) {
  const state = {
    values: {},
    unknown: new Set(),
    askCount: {},
    pending: null,          // what the LAST assistant message was asking
    confirmedCategory: null,
    relationship: null,
  };

  const userTurns = [];
  const seq = [...conversation, { role: "user", content: currentText }];

  for (const msg of seq) {
    if (!msg || typeof msg.content !== "string") continue;

    if (msg.role === "assistant") {
      const pending = matchAssistantMessage(msg.content);
      state.pending = pending;
      if (pending && pending.type === "field") {
        state.askCount[pending.fieldId] = (state.askCount[pending.fieldId] || 0) + 1;
      }
      continue;
    }

    // user message — pure greetings carry no facts; keep them out of the
    // combined text so they never pollute "what happened" or the summary
    if (isGreeting(msg.content)) continue;
    userTurns.push(msg.content);
    const combinedSoFar = userTurns.join(" . ");

    if (state.pending && state.pending.type === "field") {
      const field = CATEGORY_FIELDS[state.pending.categoryId]?.find(
        (f) => f.id === state.pending.fieldId
      );
      if (field) {
        const value = field.detect(msg.content) || field.detect(combinedSoFar);
        if (value) {
          state.values[field.id] = value;
        } else if (isNonAnswer(msg.content)) {
          // explicit "I don't know" — never counted as answered
          state.unknown.add(field.id);
        } else if (
          (state.askCount[field.id] || 0) >= 1 &&
          msg.content.trim().length > 30
        ) {
          // User gave a substantive response that doesn't match this field's
          // detector — they likely don't have this information.  Mark as
          // unknown and move on instead of re-asking indefinitely.
          state.unknown.add(field.id);
        } else if ((state.askCount[field.id] || 0) >= 2) {
          // asked, re-asked more specifically, still nothing — move on
          state.unknown.add(field.id);
        }
      }
    } else if (state.pending && state.pending.type === "disamb") {
      const def = state.pending.def;
      const boost = def.boost(msg.content);
      if (boost) {
        const [a, b] = def.pair;
        const resolved = boost[a] ? a : b;
        state.confirmedCategory = resolved;
        // the loss-vs-theft disambiguator also answers the lost_property field
        if (def.id === "theft_vs_lost") {
          if (resolved === "lost_property") {
            state.values.lost_vs_taken = "Believes it was lost or misplaced";
          } else if (resolved === "theft") {
            state.values.lost_vs_taken = "Believes it was taken by someone (theft alleged)";
          }
        }
      }
    }
  }

  state.userTexts = userTurns;
  state.combinedText = userTurns.join(" . ");

  // Extract and persist any relationship / person-entity mentioned across the
  // conversation. This prevents re-asking "who is this person?" once the user
  // has already supplied the relationship (e.g. "my husband").
  const rel = extractRelationship(state.combinedText);
  if (rel) {
    state.relationship = rel;
    state.values.relationship = {
      type: rel.type,
      source_text: rel.sourceText,
    };
  }

  return state;
}

/** How many of the trailing assistant messages were this disambiguation? */
function countRecentDisambAttempts(conversation, def) {
  let count = 0;
  for (let i = conversation.length - 1; i >= 0; i--) {
    const m = conversation[i];
    if (!m || m.role !== "assistant") continue;
    const p = matchAssistantMessage(m.content);
    if (p && p.type === "disamb" && p.def.id === def.id) count++;
    else break;
  }
  return count;
}

/**
 * The main entry point. See module doc for the contract.
 */
function analyzeConversation({ text, conversation }) {
  const msgs = Array.isArray(conversation)
    ? conversation.filter((m) => m && typeof m.content === "string")
    : [];
  const current = (text || "").trim();

  const state = replayConversation(msgs, current);
  const language = detectLanguage(current || state.combinedText);
  const priorUserCount = msgs.filter((m) => m.role === "user").length;
  // Was any intake question asked before? If not, the current exchange is
  // the first substantive one and deserves an acknowledgment.
  const hadPriorIntakeQuestion = msgs.some(
    (m) => m.role === "assistant" && matchAssistantMessage(m.content)
  );

  const base = {
    language,
    category: null,
    confidence: "none",
    needs_follow_up: true,
    follow_up_questions: [],
    missing_fields: [],
    matched_fields: [],
    facts: {},
    disambiguation: null,
    message_hint: null,
  };

  // --- greeting with no content -------------------------------------------
  if (isGreeting(current) && priorUserCount === 0) {
    return {
      ...base,
      follow_up_questions: [GREETING_QUESTION],
      message_hint: "greeting",
    };
  }

  // --- apply the reply to a pending disambiguation -------------------------
  let boosts = null;
  const pendingAtReply = state.pending; // what the current text answers
  if (pendingAtReply && pendingAtReply.type === "disamb") {
    boosts = pendingAtReply.def.boost(current);
  }
  // Once a disambiguation has been answered, that choice stands for the rest
  // of the intake — without this standing boost, later turns would keep
  // re-asking the same either/or question (the reverse of a silent lock-on).
  if (state.confirmedCategory) {
    boosts = { [state.confirmedCategory]: 5, ...(boosts || {}) };
  }

  const cls = classify(state.combinedText, boosts);

  // --- not confident enough to name a category ------------------------------
  if (cls.confidence !== "high") {
    if (cls.confidence === "none") {
      return {
        ...base,
        confidence: "none",
        follow_up_questions: [GENERIC_DESCRIBE_QUESTION],
        message_hint: "clarify",
      };
    }

    // low confidence: ask exactly ONE disambiguating question
    let def = findDisambiguation(cls.top, cls.runnerUp);
    let isGeneric = false;
    if (!def) {
      // A made-up either/or is only meaningful when the runner-up is a real
      // competitor. When the margin is already decisive and the only problem
      // is thin evidence, asking "X or Y?" would be meaningless — ask for a
      // fuller description instead.
      const runnerIsCompetitor =
        cls.topScore < HIGH_MARGIN * Math.max(cls.runnerUpScore, 0.6);
      if (!runnerIsCompetitor) {
        return {
          ...base,
          confidence: "low",
          follow_up_questions: [GENERIC_DESCRIBE_QUESTION],
          message_hint: "clarify",
        };
      }
      def = genericDisambiguation(cls.top, cls.runnerUp, CATEGORY_LABELS);
      isGeneric = true;
    }

    const attempts = countRecentDisambAttempts(msgs, def);
    const userFailedToAnswer = pendingAtReply && pendingAtReply.type === "disamb" && !boosts;

    // If the user has already failed this disambiguation twice, stop pushing
    // the same either/or and ask for a plain description instead.
    if (attempts >= 2 && !isGeneric) {
      return {
        ...base,
        confidence: "low",
        follow_up_questions: [GENERIC_DESCRIBE_QUESTION],
        message_hint: "clarify",
      };
    }

    const question = userFailedToAnswer ? def.reask : def.question;
    return {
      ...base,
      confidence: "low",
      follow_up_questions: [question],
      disambiguation: { id: def.id, candidates: def.pair },
      message_hint: userFailedToAnswer ? "disambiguate_retry" : "disambiguate",
    };
  }

  // --- category confirmed with high confidence ------------------------------
  const categoryId = cls.top;
  const fields = CATEGORY_FIELDS[categoryId] || [];
  const categoryLabel = CATEGORY_LABELS[categoryId] || categoryId;

  // auto-fill any remaining fields from the whole conversation
  for (const field of fields) {
    if (state.values[field.id] || state.unknown.has(field.id)) continue;
    const value = field.detect(state.combinedText);
    if (value) state.values[field.id] = value;
  }

  // Force-finalize after too many exchanges: mark remaining fields as
  // "Not known" so the draft is generated instead of asking forever.
  const totalUserTurns = state.userTexts.length;
  if (totalUserTurns >= MAX_INTAKE_USER_TURNS) {
    for (const field of fields) {
      if (!state.values[field.id] && !state.unknown.has(field.id)) {
        state.unknown.add(field.id);
      }
    }
  }

  const matched = fields
    .filter((f) => state.values[f.id])
    .map((f) => ({ id: f.id, label: f.label }));
  const nextField = fields.find(
    (f) => !state.values[f.id] && !state.unknown.has(f.id)
  );

  if (nextField) {
    // If the current text failed to answer the pending question on its first
    // ask, re-ask more specifically. Never silently count it as answered.
    const wasPendingFirstAsk =
      pendingAtReply &&
      pendingAtReply.type === "field" &&
      pendingAtReply.categoryId === categoryId &&
      pendingAtReply.fieldId === nextField.id &&
      (state.askCount[nextField.id] || 0) === 1 &&
      !state.values[nextField.id];

    const question = wasPendingFirstAsk ? nextField.reask : nextField.question;
    const missing = fields
      .filter((f) => !state.values[f.id] && !state.unknown.has(f.id))
      .map((f) => ({ id: f.id, label: f.label }));

    return {
      ...base,
      category: categoryId,
      confidence: "high",
      needs_follow_up: true,
      follow_up_questions: [question],
      missing_fields: missing,
      matched_fields: matched,
      facts: state.values,
      message_hint: wasPendingFirstAsk
        ? "reask"
        : !hadPriorIntakeQuestion || matched.length === 0
          ? "confirm_first"
          : "progress",
    };
  }

  // --- all required facts are present: finalize ------------------------------
  const firstMessage =
    state.userTexts.find((t) => t.trim().length >= 4) ||
    state.userTexts[0] ||
    "";
  return {
    ...base,
    category: categoryId,
    confidence: "high",
    needs_follow_up: false,
    follow_up_questions: [],
    missing_fields: [],
    matched_fields: matched,
    facts: state.values,
    summary: firstMessage,
    message_hint: "finalize",
    categoryLabel,
  };
}

const CATEGORY_LABELS = {
  theft: "Theft (something was stolen)",
  fraud: "Fraud / Cheating (you were deceived)",
  criminal_breach_of_trust: "Criminal Breach of Trust (something entrusted was misused)",
  criminal_intimidation: "Criminal Intimidation / Threats (you were threatened)",
  harassment: "Harassment",
  cyberstalking: "Cyberstalking / Online Harassment",
  online_scam: "Online Scam",
  lost_property: "Lost Property / Documents (something was lost)",
};

module.exports = {
  normalizeText,
  detectLanguage,
  classify,
  analyzeConversation,
  matchAssistantMessage,
  DISAMBIGUATIONS,
  CATEGORY_LABELS,
  GENERIC_DESCRIBE_QUESTION,
  GREETING_QUESTION,
};
