/**
 * relationships.js — multilingual relationship / person-entity normalization.
 *
 * Recognises common ways users describe the person involved in a legal problem
 * across English, Roman Urdu, and Urdu script. Returns a structured value
 * instead of collapsing all relationships into one bucket.
 *
 * Example:
 *   "meri biwi"        -> { type: "wife", sourceText: "meri biwi" }
 *   "mera shohar"      -> { type: "husband", sourceText: "mera shohar" }
 *   "landlord"         -> { type: "landlord", sourceText: "landlord" }
 *   "makaan maalik"    -> { type: "landlord", sourceText: "makaan maalik" }
 */

"use strict";

/**
 * relationship type -> canonical English label + synonyms.
 * Synonyms include spelling variants, Roman Urdu, and Urdu-script forms.
 */
const RELATIONSHIP_MAP = {
  husband: {
    label: "husband",
    synonyms: [
      "husband",
      "husbnd",
      "shohar",
      "shauhar",
      "sohar",
      "shohar",
      "shauhar",
      "khawand",
      "khasam",
      "pati",
      "پتی",
      "خاوند",
      "شوہر",
    ],
  },
  wife: {
    label: "wife",
    synonyms: [
      "wife",
      "wive",
      "biwi",
      "beevi",
      "begum",
      "begam",
      "zauja",
      "zoja",
      "jora",
      "biwi",
      "بیوی",
      "بیگم",
      "زوجہ",
    ],
  },
  spouse: {
    label: "spouse",
    synonyms: [
      "spouse",
      "spous",
      "husband or wife",
      "wife or husband",
      "jora",
      "jori",
      "hum safar",
      "humsafar",
      "شریک حیات",
    ],
  },
  partner: {
    label: "partner",
    synonyms: [
      "partner",
      "partnr",
      "life partner",
      "domestic partner",
      "boyfriend",
      "boy friend",
      "bf",
      "girlfriend",
      "girl friend",
      "gf",
      "fiance",
      "fiancee",
      "fiancé",
      "fiancée",
      "engaged",
      "lover",
      "saathi",
      "sathi",
      "dost",
      "janu",
      "mehboob",
      "mahboob",
      "محبوب",
      "ساتھی",
    ],
  },
  "ex-husband": {
    label: "ex-husband",
    synonyms: [
      "ex-husband",
      "ex husband",
      "exhusband",
      "former husband",
      "ex shohar",
      "ex-shohar",
      "purana shohar",
      "سابق شوہر",
    ],
  },
  "ex-wife": {
    label: "ex-wife",
    synonyms: [
      "ex-wife",
      "ex wife",
      "exwife",
      "former wife",
      "ex biwi",
      "ex-biwi",
      "purani biwi",
      "سابق بیوی",
    ],
  },
  "ex-partner": {
    label: "ex-partner",
    synonyms: [
      "ex-partner",
      "ex partner",
      "expartner",
      "former partner",
      "ex boyfriend",
      "ex-boyfriend",
      "ex girlfriend",
      "ex-girlfriend",
      "ex fiance",
      "ex-fiance",
      "purana saathi",
    ],
  },
  father: {
    label: "father",
    synonyms: [
      "father",
      "dad",
      "papa",
      "abba",
      "abbu",
      "abu",
      "walid",
      "baap",
      "bap",
      "ابا",
      "ابو",
      "والد",
      "باپ",
    ],
  },
  mother: {
    label: "mother",
    synonyms: [
      "mother",
      "mom",
      "mum",
      "amma",
      "ammi",
      "walida",
      "walda",
      "maa",
      "maan",
      "ma",
      "امی",
      "اماں",
      "والدہ",
      "ماں",
    ],
  },
  brother: {
    label: "brother",
    synonyms: [
      "brother",
      "bro",
      "bhai",
      "bhayya",
      "bhaiya",
      "bhaijan",
      "bhai jaan",
      "qaed",
      "بھائی",
      "بھیا",
    ],
  },
  sister: {
    label: "sister",
    synonyms: [
      "sister",
      "sis",
      "behan",
      "behen",
      "bhen",
      "bahin",
      "ben",
      "bahen",
      "baji",
      "apa",
      "apaa",
      "بہن",
      "باجی",
      "آپا",
    ],
  },
  son: {
    label: "son",
    synonyms: [
      "son",
      "beta",
      "baita",
      "ladka",
      "larka",
      "puttar",
      "بیٹا",
      "لڑکا",
      "پوت",
    ],
  },
  daughter: {
    label: "daughter",
    synonyms: [
      "daughter",
      "beti",
      "baiti",
      "ladki",
      "larki",
      "بیٹی",
      "لڑکی",
    ],
  },
  relative: {
    label: "relative",
    synonyms: [
      "relative",
      "family member",
      "familymember",
      "familys member",
      "relation",
      "rishtedar",
      "rishtaydar",
      "rishteydaar",
      "rishtedaar",
      "khandaan",
      "ghar wala",
      "ghar walay",
      "ghar ka",
      "رشتہ دار",
      "خاندان",
    ],
  },
  landlord: {
    label: "landlord",
    synonyms: [
      "landlord",
      "land lord",
      "landowner",
      "land owner",
      "property owner",
      "house owner",
      "home owner",
      "apartment owner",
      "flat owner",
      "makaan maalik",
      "makan malik",
      "makan maalik",
      "ghar ka maalik",
      "ghar ka malik",
      "kirayedar ka maalik",
      "kiraye ka maalik",
      "khirad maalik",
      "jarat maalik",
      "jagir maalik",
      "جائیداد کا مالک",
      "مکان مالک",
      "گھر کا مالک",
    ],
  },
  tenant: {
    label: "tenant",
    synonyms: [
      "tenant",
      "tenent",
      "renter",
      "rentee",
      "kirayedar",
      "kiraye daar",
      "kiraydaar",
      "keraeydaar",
      "makaan kirayedar",
      "کرایہ دار",
    ],
  },
  employer: {
    label: "employer",
    synonyms: [
      "employer",
      "boss",
      "manager",
      "supervisor",
      "head",
      "owner",
      "malik",
      "maalik",
      "sahib",
      "sahiba",
      "muqtadar",
      "employer",
      "ملازم کا مالک",
      "باس",
      "منیجر",
    ],
  },
  colleague: {
    label: "colleague",
    synonyms: [
      "colleague",
      "co-worker",
      "coworker",
      "co worker",
      "workmate",
      "fellow employee",
      "officemate",
      "office mate",
      "hamkaar",
      "ham kar",
      "kaam ka saathi",
      "kaam ka sathi",
      "همکار",
      "کام کا ساتھی",
    ],
  },
  teacher: {
    label: "teacher",
    synonyms: [
      "teacher",
      "techer",
      "professor",
      "lecturer",
      "ustaad",
      "ustad",
      "ustaz",
      "madam",
      "sir",
      "miss",
      "teacher",
      "استاد",
      "استاذ",
    ],
  },
  student: {
    label: "student",
    synonyms: [
      "student",
      "pupil",
      "classmate",
      "batchmate",
      "talib ilm",
      "talib-e-ilm",
      "shagird",
      "student",
      "طالب علم",
      "شاگرد",
    ],
  },
  friend: {
    label: "friend",
    synonyms: [
      "friend",
      "freind",
      "dost",
      "yaar",
      "yar",
      "companion",
      "buddy",
      "pal",
      "mate",
      "دوست",
      "یار",
    ],
  },
  neighbor: {
    label: "neighbor",
    synonyms: [
      "neighbor",
      "neighbour",
      "neigbour",
      "parosi",
      "parosi",
      "parosii",
      "padosi",
      "hamsaya",
      "humsaya",
      "پڑوسی",
      "ہمسایہ",
    ],
  },
  stranger: {
    label: "stranger",
    synonyms: [
      "stranger",
      "unknown person",
      "unknown",
      "unidentified",
      "anonymous",
      "anjani",
      "anjaan",
      "anjani shakhs",
      "anjaan shakhs",
      "na maloom",
      "namaloom",
      "pata nahi kaun",
      "pata nai kaun",
      "koi aur",
      "koi stranger",
      "اجنبی",
      "نامعلوم",
      "نا معلوم شخص",
    ],
  },
};

/**
 * Flatten the relationship map into:
 *   - regex patterns (for multi-word synonyms)
 *   - a lookup table keyed by normalized single-word/token synonyms
 */
function buildMatchers() {
  const tokenMap = new Map();
  const phrasePatterns = [];

  for (const [type, { label, synonyms }] of Object.entries(RELATIONSHIP_MAP)) {
    for (const raw of synonyms) {
      const normalized = normalizeRelationshipText(raw);
      const words = normalized.split(/\s+/).filter(Boolean);
      if (words.length === 1) {
        tokenMap.set(words[0], { type, label });
      } else {
        phrasePatterns.push({
          type,
          label,
          pattern: new RegExp(
            "(?:^|[^\\p{L}\\p{N}])" +
              escapeRegex(normalized) +
              "(?:[^\\p{L}\\p{N}]|$)",
            "iu"
          ),
          normalized,
        });
      }
      // also index the canonical label itself
      tokenMap.set(label, { type, label });
    }
  }

  return { tokenMap, phrasePatterns };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeRelationshipText(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "") // remove Arabic diacritics
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // punctuation -> space
    .replace(/\s+/g, " ")
    .trim();
}

const { tokenMap, phrasePatterns } = buildMatchers();

/**
 * Extract a relationship from free text.
 * Returns { type, label, sourceText } or null.
 *
 * Prefer phrase matches (more specific) over single-token matches.
 */
function extractRelationship(text) {
  if (!text || typeof text !== "string") return null;
  const normalized = normalizeRelationshipText(text);
  const lower = text.toLowerCase();

  // 1. phrase matches (run on normalized text so punctuation variations match)
  for (const { pattern, type, label, normalized: normSynonym } of phrasePatterns) {
    const m = normalized.match(pattern);
    if (m) {
      // Try to capture the original spelling from the raw text near the match.
      const idx = normalized.indexOf(normSynonym);
      const sourceText = idx >= 0
        ? captureSourceText(lower, idx, normSynonym.length)
        : normSynonym;
      return { type, label, sourceText };
    }
  }

  // 2. token matches (skip very short tokens)
  const tokens = normalized
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2);
  for (const token of tokens) {
    const hit = tokenMap.get(token);
    if (hit) return { type: hit.type, label: hit.label, sourceText: token };
  }

  return null;
}

/** Capture the corresponding slice from the raw lowercased text. */
function captureSourceText(lower, idx, len) {
  const end = Math.min(lower.length, idx + len + 8);
  let captured = lower.slice(idx, end).trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  if (captured.length > 60) captured = captured.slice(0, 57) + "...";
  return captured || lower.slice(idx, idx + len).trim();
}

/**
 * Return true if the text contains a known relationship word.
 */
function hasRelationship(text) {
  return extractRelationship(text) !== null;
}

module.exports = {
  RELATIONSHIP_MAP,
  extractRelationship,
  hasRelationship,
  normalizeRelationshipText,
};
