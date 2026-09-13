/**
 * Synonym / spelling-variant map for Roman Urdu, English and Urdu legal terms.
 *
 * Roman Urdu has no single accepted spelling — "chori", "chory", "chorii",
 * "choury" are all the same word. The old engine required exact substring
 * hits, so any unseen variant failed silently. This module fixes that:
 *
 *   1. every token is lowercased and stripped of punctuation,
 *   2. runs of repeated letters are collapsed ("chorii" -> "chori"),
 *   3. a curated variant map maps the collapsed form to a canonical token,
 *   4. if that still fails, an edit-distance (Levenshtein) fuzzy lookup
 *      against the full vocabulary finds the closest known term, so an
 *      unseen spelling like "chawri" still resolves to "chori".
 */

/**
 * canonical token -> known spelling variants (variants are stored already
 * letter-collapsed where relevant; the collapse step runs at lookup time).
 */
const VARIANT_GROUPS = {
  // ---- theft ----
  chori: ["chory", "choury", "chauri", "choriya", "chorya", "chorie", "chauriya", "chourya", "chawri", "chorri", "chaurri", "chorrii", "choree", "choriy"],
  churaya: ["choraya", "churai", "churra", "chorra", "chura", "chora", "churraa"],
  chor: ["chorr", "chour", "chaur", "thief", "theif"],
  chheena: ["chheen", "chhina", "chheenaya", "cheena", "chheenliya", "cheenliya", "chheenaya"],
  snach: ["snached", "snaching", "loot", "lut", "lutliya", "lutliya"],

  // ---- lost property ----
  gum: ["ghum", "gumm"],
  gumshuda: ["gumshudah", "gumshda", "gumshooda"],
  khoi: ["khoie", "khoee", "khoii", "khoiy"],
  kho: ["khoo"],
  lost: ["lose", "losing", "loss"],

  // ---- fraud / cheating ----
  dhoka: ["dhokha", "dhoke", "dhokay", "dhokhe", "dhokai"],
  faraib: ["farib", "fraib", "faraib"],
  cheat: ["cheeted", "cheated", "cheeting", "cheating", "cheater"],
  deceiv: ["deceived", "deceive", "deception", "deceptive", "decieved"],

  // ---- criminal breach of trust ----
  amanat: ["amanah", "amanaat", "amaanat", "amanat", "amant"],
  khayanat: ["khaynat", "khiyanat", "khayanat", "khayanaat", "khayant", "khiyant"],
  entrusted: ["entrust", "entrusting", "entrustment", "amant"],

  // ---- criminal intimidation ----
  dhamki: ["dhamkiyan", "dhanki", "dhumki", "damki", "dhamky", "dhamkiya", "dhamkiyaa", "dhumkiyan", "dhamake", "dhamkey"],
  threat: ["threats", "threaten", "threatened", "threatening", "threatned", "threatend", "treatened"],
  daraya: ["dhamkaya", "darana", "dara", "darra", "dhamkia"],

  // ---- harassment ----
  harasani: ["haraasani", "hirasani", "harasni", "haraasni", "harasani", "herasani", "harassani", "harasanee", "harasni"],
  harass: ["harased", "harased", "harasment", "harassment", "harrased", "harassed", "harasing", "harassing"],
  molested: ["molest", "molestation", "molested", "molsted"],
  chherkhani: ["chherkhari", "chherchhad", "chharchhad", "chherkhari", "chirharri", "chhirchhad"],

  // ---- cyberstalking / online harassment ----
  cyberstalking: ["cyberstalking", "cyberstalking"],
  stalk: ["stalking", "stalked", "staker"],
  morph: ["morphing", "morphed", "morphs", "morhp"],
  impersonation: ["impersonate", "impersonated", "impersonating", "imprsonation"],

  // ---- online scam ----
  scam: ["scamed", "scammed", "scaming", "scamming"],
  phishing: ["phising", "phising", "phishng", "phishin"],

  // ---- misc vocabulary used by context detection ----
  online: ["onlien", "online", "onlne"],
  phone: ["fone", "phn", "mobil", "mobile", "mobail", "cell"],
  paisa: ["paise", "paisay", "paisa", "paisay", "paisaa", "rupees", "rupay", "rupey", "rupess"],
  gawah: ["gawahi", "gawahon", "gawaho"],
  saboot: ["suboot", "sabut", "sabooot", "proof", "evidence", "evdence"],
};

/** Build variant -> canonical lookup (collapsed keys). */
function collapse(word) {
  return word.replace(/(.)\1+/g, "$1");
}

const VARIANT_LOOKUP = new Map();
for (const [canonical, variants] of Object.entries(VARIANT_GROUPS)) {
  VARIANT_LOOKUP.set(collapse(canonical), canonical);
  for (const v of variants) {
    VARIANT_LOOKUP.set(collapse(v), canonical);
  }
}

/**
 * Levenshtein edit distance with an early exit once the distance is known
 * to exceed `max` — keeps the fuzzy fallback cheap.
 */
function levenshtein(a, b, max) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/** Allowed edit distance depends on word length (short words: exact only). */
function fuzzyThreshold(len) {
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  return 2;
}

/**
 * Common English words that sit within edit distance 1–2 of vocabulary
 * terms ("most" vs "lost", "back" vs "hack", "treat" vs "threat"…).
 * Fuzzy lookup never maps these, so ordinary words cannot accidentally
 * trigger a category signal.
 */
const FUZZY_BLOCKLIST = new Set([
  "most", "host", "post", "cost", "toast", "roast", "ghost", "mist", "mast",
  "last", "lest", "lust", "list", "char", "choir", "chez",
  "store", "style", "stale", "stone", "chop", "scar", "scum", "stark",
  "bost", "china", "talk", "talks", "fishing", "closing",
  "scan", "sham", "treat", "treated", "treats", "thread", "throat",
  "chore", "core", "chord", "back", "pack", "sack", "lack", "rack", "tack",
  "jack", "take", "make", "lake", "bake", "cake", "sake", "wake", "fake",
  "amount", "count", "provide", "project", "outline", "messing", "intimate",
  "yellow", "fellow", "stack", "stall", "chalk", "snack", "wheat", "heat",
  "beat", "meat", "neat", "seat", "feat", "steel", "still", "steam",
  "solemn", "left", "heft", "phone", "fine",
  // Common English words that should never fuzzy-match to category keywords
  "giving", "given", "give", "gives", "getting", "geting",
  "security", "deposit", "deposited",
  "refund", "refunded", "returning", "returned", "returns", "rental",
  "renting", "rented", "tenancy", "tenant", "landlord", "property",
]);

/**
 * Fuzzy lookup for a (collapsed, lowercase) token that is not an exact
 * vocabulary hit. Returns the canonical token or null.
 */
function fuzzyLookup(token) {
  if (!token || token.length < 3) return null;
  if (FUZZY_BLOCKLIST.has(token)) return null;
  const max = fuzzyThreshold(token.length);
  if (max === 0) return null;
  let best = null;
  let bestDist = max + 1;
  for (const [vocabWord, canonical] of VARIANT_LOOKUP.entries()) {
    if (Math.abs(vocabWord.length - token.length) > max) continue;
    const d = levenshtein(token, vocabWord, max);
    if (d <= max && (best === null || d < bestDist || (d === bestDist && vocabWord.length < best.length))) {
      best = vocabWord;
      bestDist = d;
    }
  }
  return best ? VARIANT_LOOKUP.get(best) : null;
}

/** True when the token contains Urdu-script characters. */
function isUrduToken(token) {
  return /[\u0600-\u06FF]/.test(token);
}

/**
 * Resolve one raw token to its canonical vocabulary form.
 * Urdu-script tokens are returned unchanged.
 */
function canonicalizeToken(rawToken) {
  const token = rawToken.toLowerCase();
  if (isUrduToken(token)) return token;
  const collapsed = collapse(token);
  const exact = VARIANT_LOOKUP.get(collapsed);
  if (exact) return exact;
  const fuzzy = fuzzyLookup(collapsed);
  if (fuzzy) return fuzzy;
  return collapsed;
}

/**
 * Register additional canonical vocabulary (used by classification.js so its
 * category keywords also take part in fuzzy matching — a typo like
 * "intimidasion" still resolves to "intimidation").
 */
function registerVocabulary(words) {
  for (const w of words) {
    const collapsed = collapse(w.toLowerCase());
    if (!VARIANT_LOOKUP.has(collapsed)) {
      VARIANT_LOOKUP.set(collapsed, w.toLowerCase());
    }
  }
}

module.exports = {
  VARIANT_GROUPS,
  VARIANT_LOOKUP,
  collapse,
  levenshtein,
  fuzzyThreshold,
  fuzzyLookup,
  isUrduToken,
  canonicalizeToken,
  registerVocabulary,
};
