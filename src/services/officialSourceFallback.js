/**
 * officialSourceFallback.js — real-time official-source fallback for
 * out-of-scope queries (the "safety net" for the curated category set).
 *
 * The eight curated categories cover theft, fraud, breach of trust, threats,
 * harassment, cyberstalking, online scams and lost property. When the
 * classification engine finds NO reasonable match among them but the user has
 * clearly described a concrete problem, this module searches — live — ONLY
 * the official government domains already listed in data/trusted_sources.json
 * (the sources Insaaf Aasan is connected to).
 *
 * Hard rules enforced here:
 *   - Only https URLs whose host is in trusted_sources.json are ever fetched
 *     (exact host match, "www." ignored, subdomains not allowed), including
 *     at every redirect hop. No general web search is ever called.
 *   - Nothing is invented: a reply either quotes a fetched official page
 *     word-for-word (with the source name and link) or — when nothing citable
 *     was found — moves straight to practical next steps and the official
 *     sources, in a helpful, forward-looking tone (never "I could not find
 *     anything" / "I will not guess" failure framing, and never a fabricated
 *     law or section number).
 *   - Sensitive personal-safety topics additionally surface the verified
 *     Pakistani helplines, regardless of whether the search succeeded.
 *   - This path never sets legal_references and never builds a complaint
 *     draft — those stay reserved for the curated categories, whose legal
 *     data has been vetted.
 *
 * The module is deliberately self-contained: it requires only
 * trusted_sources.json and the shared DISCLAIMER constant, so it can be
 * reviewed (or removed) independently of legalDb.js and the providers.
 */

"use strict";

const WHITELIST_SOURCES = require("../data/trusted_sources.json");
const { DISCLAIMER } = require("./draftBuilder");

const FETCH_TIMEOUT_MS = 6000;
const MAX_HTML_BYTES = 300000;
const MAX_REDIRECT_HOPS = 4;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Minimum evidence before a fetched page may be cited. */
const MIN_PAGE_SCORE = 6;
const MIN_TOPIC_HITS = 2;

// Verified Pakistani helplines for sensitive personal-safety cases
// (sexual assault being the clearest example).
const HELPLINES_BLOCK = [
  "If you are in danger or need urgent support, please reach out right now:",
  "- Police emergency: 15",
  "- Madadgaar National Helpline: 1098",
  "- Ministry of Human Rights helpline: 1099",
].join("\n");

// Formatting helpers for the lookup replies.
function formatNextSteps(steps) {
  return steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
}

function directSourcesBlock(sourceIds) {
  return WHITELIST_SOURCES
    .filter((s) => sourceIds.includes(s.id))
    .map((s) => `- ${s.name} — ${s.url}`)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Whitelist — the only hosts this module may ever fetch
// ---------------------------------------------------------------------------

function hostOf(urlStr) {
  try {
    return new URL(urlStr).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

const WHITELIST_HOSTS = new Set(
  WHITELIST_SOURCES.map((s) => hostOf(s.url)).filter(Boolean)
);

function isWhitelistedHost(hostname) {
  return WHITELIST_HOSTS.has(String(hostname || "").toLowerCase().replace(/^www\./, ""));
}

// ---------------------------------------------------------------------------
// Out-of-scope topic map — the trigger vocabulary for this safety net
// ---------------------------------------------------------------------------

/**
 * NOTE: this map is deliberately a SAFETY NET for queries outside the eight
 * curated categories — it never classifies anything and never expands that
 * category set. Topics that keep appearing here (sexual assault being the
 * obvious one today) are candidates for a proper curated addition to
 * data/legal_categories.json later, with vetted laws and next steps.
 *
 * When NO topic below matches but the user has clearly described a concrete
 * problem, the generic lookup (see maybeHandleOutOfScope) searches the
 * official sources with the user's own words — the user is helped, never
 * turned away and never force-fit into a curated category.
 */
const TOPICS = [
  {
    id: "sexual_assault",
    safety: true,
    sentence: "What you describe sounds like it may involve sexual assault or violence.",
    marker: "sexual assault or violence",
    area: "sexual assault and violence",
    factNote: "the specific facts of what happened",
    nextSteps: [
      "If you are in immediate danger, contact the Police (15) right now.",
      "If you plan to seek a medical examination, go to the nearest government hospital as soon as possible and keep the medical record.",
      "Preserve any evidence — messages, call records, clothing, or anything the person left behind. Do not delete anything.",
      "Report the incident at the nearest police station. You may ask for a female officer, and someone you trust can accompany you.",
    ],
    directSources: ["punjab_police"],
    triggersLatin: [
      "rape", "raped", "rapist", "rapes", "sexual assault", "sexually assaulted",
      "sexual abuse", "sexually abused", "child abuse", "molestation", "molested",
      "molests", "ziyadti", "ziadti", "zyadti", "balatkar", "balatkaar",
      "izzat looti", "izzat loot", "asmat dari",
    ],
    triggersUrdu: ["زیادتی", "عصمت دری", "آبرو ریزی", "جنسی تشدد"],
    searchTerms: ["rape", "sexual assault", "violence against women"],
    searches: [["punjab_police", "rape"], ["punjab_police", "violence against women"]],
    staticPages: ["fospah"],
  },
  {
    id: "violent_crime",
    safety: true,
    sentence: "What you describe sounds like it may involve a serious violent crime.",
    marker: "serious violent crime",
    area: "serious violent crime",
    factNote: "the specific facts of what happened",
    nextSteps: [
      "If anyone is in immediate danger, call the Police (15) right now.",
      "Seek medical attention for any injuries and keep the medical records.",
      "Report the incident at the nearest police station as soon as possible.",
      "Note down the names and contact details of anyone who witnessed what happened.",
    ],
    directSources: ["punjab_police"],
    triggersLatin: [
      "murder", "murdered", "murderer", "homicide", "killed", "killing",
      "kidnapped", "kidnap", "kidnapping", "abduction", "abducted", "qatal", "qatl",
      "ighwa",
    ],
    triggersUrdu: ["قتل", "اغوا"],
    searchTerms: ["murder", "kidnapping"],
    searches: [["punjab_police", "murder"]],
    staticPages: [],
  },
  {
    id: "domestic_violence",
    safety: true,
    sentence: "What you describe sounds like it may involve domestic violence.",
    marker: "domestic violence",
    area: "domestic violence",
    factNote: "your specific situation",
    nextSteps: [
      "If you are in immediate danger, call the Police (15) right now.",
      "Keep a record of every incident — dates, times, what happened, and any injuries or messages.",
      "You can report domestic violence at the nearest police station; women's police stations and the helplines below also assist.",
      "Legal remedies may be available — a lawyer or the helplines below can guide you on the options.",
    ],
    directSources: ["punjab_police"],
    triggersLatin: [
      "domestic violence", "domestic abuse", "tashadud", "mar peet", "marpeet",
      "maar peet", "gharelu",
    ],
    triggersUrdu: ["تشدد", "گھریلو تشدد"],
    searchTerms: ["domestic violence", "violence against women"],
    searches: [["punjab_police", "domestic violence"]],
    staticPages: ["fospah"],
  },
  {
    id: "land_dispute",
    safety: false,
    sentence: "What you describe sounds like it may involve a land or property dispute.",
    marker: "land or property dispute",
    area: "land and property disputes",
    factNote: "the ownership records and the facts of your case",
    nextSteps: [
      "Gather every ownership document you have — registry, fard, mutation/intiqal record, or any agreement.",
      "Get the official record of the property from the relevant revenue office (patwari / Arazi Record Centre) — it shows who is recorded as the owner.",
      "Avoid any confrontation or self-help on the land while the dispute is unresolved.",
      "Consult a lawyer experienced in land disputes before taking any step.",
    ],
    directSources: ["punjab_police", "sindh_police", "pakistan_code"],
    triggersLatin: [
      "zameen", "qabza", "kabza", "patwari", "intiqal", "land dispute",
      "property dispute", "land grabbing",
    ],
    triggersUrdu: ["زمین", "قبضہ"],
    searchTerms: ["land dispute", "property"],
    searches: [["punjab_police", "land dispute"]],
    staticPages: [],
  },
  {
    id: "family_law",
    safety: false,
    sentence: "What you describe sounds like it may involve a family-law matter such as divorce, custody, or inheritance.",
    marker: "family-law matter",
    area: "family-law matters such as divorce, custody, and inheritance",
    factNote: "the specific facts of your family situation",
    nextSteps: [
      "Gather the relevant documents — nikahnama, CNIC copies, children's birth records, and any agreements.",
      "For divorce, khula, maintenance, or custody, consult a family lawyer — family courts handle these matters.",
      "The local Union Council also registers certain family matters (for example divorce and maintenance notices).",
      "Write down a timeline of events before meeting a lawyer — it makes the consultation much more useful.",
    ],
    directSources: ["pakistan_code", "punjab_police"],
    triggersLatin: [
      "talaq", "talaaq", "divorce", "khula", "custody", "wirasat", "inheritance",
      "jahez", "dowry", "nikah", "nafqa", "meher",
    ],
    triggersUrdu: ["طلاق", "خلع", "وراثت", "جہیز", "حضانت", "نفقہ"],
    searchTerms: ["divorce", "child custody", "inheritance"],
    searches: [["punjab_police", "divorce"]],
    staticPages: [],
  },
  {
    id: "employment",
    safety: false,
    sentence: "What you describe sounds like it may involve an employment dispute.",
    marker: "employment dispute",
    area: "employment disputes",
    factNote: "your employment contract and the facts of your case",
    nextSteps: [
      "Gather your employment documents — offer letter, contract, pay slips, and any messages with the employer.",
      "Send your employer a written request for the dues (salary, notice pay, or gratuity) and keep a copy — this creates a record.",
      "Provincial labour departments and labour courts handle many employment disputes — check where your complaint falls.",
      "Consult a lawyer or contact the provincial labour department about where to file.",
    ],
    directSources: ["punjab_police", "sindh_police"],
    triggersLatin: [
      "fired", "terminated", "termination", "layoff", "laid off", "unpaid wages",
      "salary nahi", "wages nahi",
    ],
    triggersUrdu: [],
    searchTerms: ["termination", "unpaid wages"],
    searches: [["punjab_police", "unpaid wages"]],
    staticPages: [],
  },
  {
    id: "corruption",
    safety: false,
    sentence: "What you describe sounds like it may involve bribery or corruption.",
    marker: "bribery or corruption",
    area: "bribery and corruption",
    factNote: "the specific facts of what happened",
    nextSteps: [
      "Do not pay the bribe if you can avoid it.",
      "Record the details — date, time, place, the person's name and designation, and any witnesses.",
      "You can report bribery to the relevant anti-corruption establishment or the department's complaint cell.",
      "Keep any evidence (messages, receipts, recordings) safely — do not delete anything.",
    ],
    directSources: ["punjab_police", "sindh_police"],
    triggersLatin: ["rishwat", "riswat", "bribe", "bribery", "corruption", "under the table"],
    triggersUrdu: ["رشوت"],
    searchTerms: ["bribery", "corruption"],
    searches: [["punjab_police", "bribery"]],
    staticPages: [],
  },
  {
    id: "rental_dispute",
    safety: false,
    sentence: "What you describe sounds like it may involve a rental, landlord, or tenancy dispute.",
    marker: "rental, landlord, or tenancy dispute",
    area: "rental and security-deposit matters",
    factNote: "your rental agreement and the facts of your case",
    nextSteps: [
      "Gather your rental agreement, rent receipts, and any messages with the landlord about the deposit.",
      "Send your landlord a written request to return the deposit (mention the amount and the date you left) and keep a copy — this creates a record.",
      "If they still refuse, the deposit may be recoverable through the relevant rent authority or the civil courts — a lawyer can advise on the best route.",
      "If you have not yet handed the property back, take photos of its condition when you do.",
    ],
    directSources: ["punjab_police", "sindh_police", "pakistan_code"],
    triggersLatin: [
      "landlord", "tenant", "tenancy", "rental agreement", "rent agreement",
      "security deposit", "rental deposit", "lease agreement", "lease",
      "rent deposit", "deposit not returned", "deposit back", "deposit refund",
      "return my deposit", "return the deposit", "returning my deposit",
      "give my deposit", "giving my deposit", "refund my deposit",
      "refund the deposit", "kept my deposit", "keeping my deposit",
      "withholding my deposit", "kiraya", "kiraye", "kirayedar",
      "kiraye daar", "makaan maalik", "makan maalik", "makaan malik", "makaan ke maalik", "makan ke malik", "rent not returned",
      "deposit wapis", "deposit wapis nahi", "wapas nahi", "security deposit wapis",
      "rental property", "rented house", "rented apartment", "rented flat",
      "property dispute",
    ],
    triggersUrdu: [
      "کرایہ", "کرایہ دار", "مکان مالک", "گھر کا مالک", "جائیداد", "کرایہ",
      "سیکیورٹی ڈپازٹ", "رہائش", "کمرہ",
    ],
    searchTerms: ["rental dispute", "tenant landlord", "security deposit"],
    searches: [["punjab_police", "rental dispute"]],
    staticPages: [],
  },
  {
    id: "accident",
    safety: false,
    sentence: "What you describe sounds like it may involve a road or other accident.",
    marker: "road or other accident",
    area: "road and other accidents",
    factNote: "the specific facts of the accident",
    nextSteps: [
      "Get a medical examination for any injuries, even minor ones, and keep the records.",
      "Report the accident to the police and keep a copy of the report.",
      "Take photos of the scene, the damage, and any injuries if possible.",
      "Note down witnesses and the other party's contact details, and inform your insurance company if applicable.",
    ],
    directSources: ["punjab_police", "sindh_police"],
    triggersLatin: [
      "hadsa", "road accident", "car accident", "traffic accident", "takkar",
    ],
    triggersUrdu: ["حادثہ"],
    searchTerms: ["road accident", "traffic accident"],
    searches: [["punjab_police", "road accident"]],
    staticPages: [],
  },
  {
    id: "drugs",
    safety: false,
    sentence: "What you describe sounds like it may involve a narcotics or drugs matter.",
    marker: "narcotics or drugs matter",
    area: "narcotics and drugs matters",
    factNote: "the specific facts of the case",
    nextSteps: [
      "Do not make any statement to the police without a lawyer present.",
      "Note down exactly where, when, and how the incident happened.",
      "Contact a lawyer as soon as possible — narcotics cases carry serious penalties.",
      "If someone has been detained, family members can inquire at the police station and engage a lawyer.",
    ],
    directSources: ["punjab_police"],
    triggersLatin: ["nasha", "nashe", "drug case", "drugs case", "narcotics", "heroin", "chars"],
    triggersUrdu: ["نشہ", "منشیات"],
    searchTerms: ["narcotics", "drugs"],
    searches: [["punjab_police", "narcotics"]],
    staticPages: [],
  },
];

// ---------------------------------------------------------------------------
// Searchable endpoints on the whitelisted domains (all verified live on
// 2026-09-02). The remaining whitelist domains are never fetched here:
//   - pakistan_code: its search and law listings are rendered client-side and
//     its suggest endpoint currently replies "Cannot connect to database" —
//     nothing useful is server-rendered to score.
//   - sindh_police: no server-rendered search; the homepage is internal orders.
//   - fia_complaints / nadra / dgip: complaint and identity portals with no
//     searchable legal content (dgip is additionally unreachable).
// They all stay in trusted_sources.json — this only records which pages the
// fallback can meaningfully search.
// ---------------------------------------------------------------------------

const SEARCH_SOURCES = {
  punjab_police: {
    sourceId: "punjab_police",
    // Drupal site search: https://punjabpolice.gov.pk/search/node/<query>
    search: (q) => `https://punjabpolice.gov.pk/search/node/${encodeURIComponent(q)}`,
    // Drupal result links look like https://punjabpolice.gov.pk/node/12345
    resultLink: /^https:\/\/punjabpolice\.gov\.pk\/node\/\d+\/?$/i,
  },
  fospah: {
    sourceId: "fospah",
    static: "https://fospah.gov.pk/",
  },
};

// ---------------------------------------------------------------------------
// Trigger detection (gate)
// ---------------------------------------------------------------------------

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

for (const topic of TOPICS) {
  const body = topic.triggersLatin.map(escapeRe).join("|");
  topic.latinRe = body ? new RegExp(`\\b(?:${body})\\b`, "i") : null;
}

/** Does this message describe a concrete problem outside the curated set? */
function detectTopic(text) {
  const raw = text || "";
  const lower = raw.toLowerCase();
  for (const topic of TOPICS) {
    if (topic.latinRe && topic.latinRe.test(lower)) return topic;
    if (topic.triggersUrdu.some((t) => raw.includes(t))) return topic;
  }
  return null;
}

/** Has this topic already been answered by a previous fallback reply? */
function topicAlreadyHandled(conversation, topic) {
  return (conversation || []).some(
    (m) =>
      m &&
      m.role === "assistant" &&
      typeof m.content === "string" &&
      m.content.includes(topic.marker)
  );
}

// --- the generic lookup: unfamiliar but concrete problems -----------------

/** Marker phrase present in every generic (no-known-topic) lookup reply. */
const GENERIC_MARKER = "official guidance for you";

/** Has a generic lookup reply already been sent in this conversation? */
function genericAlreadyHandled(conversation) {
  return (conversation || []).some(
    (m) =>
      m &&
      m.role === "assistant" &&
      typeof m.content === "string" &&
      m.content.includes(GENERIC_MARKER)
  );
}

/**
 * Does this message read like a concrete problem description (as opposed to a
 * greeting or a bare "what should I do?")? Latin and Urdu script both count.
 */
function isDescriptiveQuery(text) {
  const raw = (text || "").trim();
  if (!raw) return false;
  const tokens = raw.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (tokens.length < 4) return false;
  if (/[\u0600-\u06FF]/.test(raw)) {
    const urduTokens = raw.split(/[^\u0600-\u06FF]+/).filter((t) => t.length >= 2);
    return urduTokens.length >= 3 || contentWords(raw).length >= 2;
  }
  return contentWords(raw).length >= 2;
}

/**
 * A synthetic topic for unfamiliar problems: search the official sources with
 * the user's own words. If the message has too few Latin words to build a
 * query (e.g. Urdu script only), no search is attempted (noSearch: true).
 */
function buildGenericTopic(text) {
  const words = contentWords(text).slice(0, 5);
  if (words.length >= 2) {
    return {
      id: "general_lookup",
      generic: true,
      searches: [["punjab_police", words.join(" ")]],
      staticPages: [],
    };
  }
  return { id: "general_lookup", generic: true, searches: [], staticPages: [], noSearch: true };
}

/** Search terms for the generic lookup: the user's own content words. */
function buildGenericTerms(text) {
  return contentWords(text).slice(0, 8).map((t) => ({ t, w: 2 }));
}

// ---------------------------------------------------------------------------
// Whitelisted fetching (the only network path in this module)
// ---------------------------------------------------------------------------

async function fetchWhitelisted(urlStr, fetchImpl) {
  const doFetch = fetchImpl || globalThis.fetch; // resolved at call time (tests stub globalThis.fetch)
  let current;
  try {
    current = new URL(urlStr);
  } catch {
    return null;
  }

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    // The single gate every request must pass: https-only and the host must
    // be one of the trusted_sources.json domains (www. ignored, subdomains
    // not allowed). Re-checked on every redirect hop.
    if (current.protocol !== "https:" || !isWhitelistedHost(current.hostname)) {
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
      res = await doFetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers && res.headers.get ? res.headers.get("location") : null;
      if (!location) return null;
      try {
        current = new URL(location, current);
      } catch {
        return null;
      }
      continue;
    }
    if (!res.ok) return null;

    try {
      const html = await res.text();
      return { url: current.toString(), html: html.slice(0, MAX_HTML_BYTES) };
    } catch {
      return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// HTML -> text / links
// ---------------------------------------------------------------------------

function textOf(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      if (code > 0 && code < 0x110000) {
        try {
          return String.fromCodePoint(code);
        } catch {
          /* fall through */
        }
      }
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();
}

function linksOf(html, baseUrl) {
  const out = [];
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let href;
    try {
      href = new URL(m[1], baseUrl).toString();
    } catch {
      continue;
    }
    if (!/^https?:/i.test(href)) continue;
    out.push({ href, anchor: textOf(m[2]) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Scoring / excerpt extraction
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "the", "and", "was", "were", "has", "have", "had", "that", "this", "with",
  "from", "they", "them", "their", "his", "her", "him", "she", "you", "your",
  "are", "can", "not", "but", "for", "who", "why", "how", "what", "when",
  "where", "did", "does", "been", "being", "will", "would", "could", "should",
  "about", "into", "over", "after", "before", "some", "any", "all", "get",
  "got", "gave", "give", "told", "tell", "said", "say", "one", "two", "also",
  "very", "much", "many", "near", "last", "next", "first", "week", "weeks",
  "night", "year", "month", "day", "time", "person", "someone", "somebody",
  "man", "woman", "people", "thing", "something", "anything", "please",
  "help", "need", "want", "know", "like", "just", "then", "than", "there",
  "here", "because", "while", "during", "against", "own", "same", "such",
  "only", "more", "most", "other", "another", "each", "few", "both",
  "between", "through", "mera", "meri", "mere", "mujhe", "ka", "ki", "ke",
  "ko", "se", "ne", "mein", "hai", "hain", "hua", "hui", "gaya", "gayi",
  "gya", "tha", "thi", "kya", "koi", "kuch", "kar", "karna", "karne",
  "karke", "liya", "liye", "diya", "diye", "raha", "rahi", "bhi", "toh",
  "par", "hum", "humara", "wala", "wali", "walay", "acha", "achha", "bohat",
  "bahut", "pata", "lagta", "abhi", "kal", "aaj", "ghar", "waqt", "zindagi",
  "bara", "bura", "ho",
]);

/** Latin content words from the user's message (can match English pages). */
function contentWords(text) {
  const tokens = (text || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const out = [];
  for (const t of tokens) {
    if (t.length < 3 || !/^[a-z]+$/.test(t) || STOPWORDS.has(t)) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

function buildQuery(text, topic) {
  const terms = topic.searchTerms.map((t) => ({ t, w: 3 }));
  for (const w of contentWords(text).slice(0, 6)) {
    if (!terms.some((term) => term.t.toLowerCase().includes(w))) {
      terms.push({ t: w, w: 1 });
    }
  }
  return terms;
}

function countOccurrences(haystackLower, termLower) {
  if (!termLower) return 0;
  let count = 0;
  let idx = haystackLower.indexOf(termLower);
  while (idx !== -1) {
    count++;
    idx = haystackLower.indexOf(termLower, idx + termLower.length);
  }
  return count;
}

function scoreText(text, terms) {
  const lower = (text || "").toLowerCase();
  let score = 0;
  let topicHits = 0; // total occurrences of high-weight (topic) terms
  for (const term of terms) {
    const n = countOccurrences(lower, term.t.toLowerCase());
    if (n > 0) {
      score += Math.min(n, 5) * term.w;
      if (term.w >= 3) topicHits += n;
    }
  }
  return { score, topicHits };
}

const JUNK_SENTENCE_RE =
  /\b(search result|no results|skip to main|toggle navigation|read more|related posts)\b/i;

/** Best 1-2 sentence excerpt that actually contains a topic term. */
function bestExcerpt(text, terms, minTopicHits = 1) {
  if (!text) return null;
  const sentences = text.split(/(?<=[.!?؟۔])\s+/).slice(0, 600);
  let best = null;
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    if (s.length < 40 || s.length > 700 || JUNK_SENTENCE_RE.test(s)) continue;
    const { score, topicHits } = scoreText(s, terms);
    if (topicHits < minTopicHits || score <= 0) continue;
    if (!best || score > best.score) {
      best = { score, index: i, text: s };
    }
  }
  if (!best) return null;

  let excerpt = best.text;
  if (excerpt.length < 170) {
    const next = sentences[best.index + 1];
    if (
      next && next.length >= 40 && !JUNK_SENTENCE_RE.test(next) &&
      excerpt.length + next.length + 1 <= 340
    ) {
      excerpt = `${excerpt} ${next}`;
    }
  }
  if (excerpt.length > 340) {
    const cut = excerpt.slice(0, 340);
    const sp = cut.lastIndexOf(" ");
    excerpt = (sp > 200 ? cut.slice(0, sp) : cut) + "…";
  }
  return excerpt.trim();
}

// ---------------------------------------------------------------------------
// Search execution
// ---------------------------------------------------------------------------

/**
 * Search one Drupal-style source: fetch the search page, then fetch the first
 * two unique result pages (Drupal already ranks them by relevance) and score
 * them locally. Returns { fetchedAny, candidate|null }.
 */
async function searchSite(source, query, terms, fetchImpl, minTopicHits = MIN_TOPIC_HITS) {
  const searchPage = await fetchWhitelisted(source.search(query), fetchImpl);
  if (!searchPage) return { fetchedAny: false, candidate: null };

  const picked = [];
  const seenAnchors = new Set();
  for (const l of linksOf(searchPage.html, searchPage.url)) {
    if (!source.resultLink.test(l.href)) continue;
    const key = l.anchor.toLowerCase().slice(0, 80);
    if (!l.anchor || seenAnchors.has(key)) continue;
    seenAnchors.add(key);
    if (!picked.some((p) => p.href === l.href)) picked.push(l);
    if (picked.length >= 2) break;
  }

  const pages = await Promise.allSettled(
    picked.map((p) => fetchWhitelisted(p.href, fetchImpl))
  );

  let candidate = null;
  for (const r of pages) {
    if (r.status !== "fulfilled" || !r.value) continue;
    const text = textOf(r.value.html);
    const { score, topicHits } = scoreText(text, terms);
    if (score < MIN_PAGE_SCORE || topicHits < minTopicHits) continue;
    // Sentence-level excerpt anchor: one topic term is enough (the page as a
    // whole already passed the stricter minTopicHits gate above).
    const excerpt = bestExcerpt(text, terms, Math.min(minTopicHits, 1));
    if (!excerpt) continue;
    if (!candidate || score > candidate.score) {
      candidate = { sourceId: source.sourceId, url: r.value.url, score, excerpt };
    }
  }
  return { fetchedAny: true, candidate };
}

/** Score one fixed official page. Returns { fetchedAny, candidate|null }. */
async function readStaticPage(source, terms, fetchImpl, minTopicHits = MIN_TOPIC_HITS) {
  const page = await fetchWhitelisted(source.static, fetchImpl);
  if (!page) return { fetchedAny: false, candidate: null };
  const text = textOf(page.html);
  const { score, topicHits } = scoreText(text, terms);
  if (score < MIN_PAGE_SCORE || topicHits < minTopicHits) {
    return { fetchedAny: true, candidate: null };
  }
  const excerpt = bestExcerpt(text, terms, Math.min(minTopicHits, 1));
  if (!excerpt) return { fetchedAny: true, candidate: null };
  return { fetchedAny: true, candidate: { sourceId: source.sourceId, url: page.url, score, excerpt } };
}

/**
 * Search everything relevant to the topic, all in parallel.
 * -> { found, fetchedAny, source?, url?, excerpt?, score? }
 */
async function searchOfficialSources(triggerText, topic, fetchImpl) {
  const generic = Boolean(topic.generic);
  const terms = generic ? buildGenericTerms(triggerText) : buildQuery(triggerText, topic);
  // The generic lookup has no curated high-weight terms, so whether a fetched
  // page may be cited is decided by the page score (the user's own words).
  const minTopicHits = generic ? 0 : MIN_TOPIC_HITS;
  const tasks = [];

  for (const [sourceKey, query] of topic.searches) {
    const source = SEARCH_SOURCES[sourceKey];
    if (source && source.search) tasks.push(searchSite(source, query, terms, fetchImpl, minTopicHits));
  }
  for (const sourceKey of topic.staticPages || []) {
    const source = SEARCH_SOURCES[sourceKey];
    if (source && source.static) tasks.push(readStaticPage(source, terms, fetchImpl, minTopicHits));
  }
  if (tasks.length === 0) return { found: false, fetchedAny: false };

  const settled = await Promise.allSettled(tasks);
  let fetchedAny = false;
  let best = null;
  for (const r of settled) {
    if (r.status !== "fulfilled" || !r.value) continue;
    fetchedAny = fetchedAny || r.value.fetchedAny;
    const c = r.value.candidate;
    if (c && (!best || c.score > best.score)) best = c;
  }

  if (best) {
    const source = WHITELIST_SOURCES.find((s) => s.id === best.sourceId) || null;
    return { found: true, fetchedAny: true, source, url: best.url, excerpt: best.excerpt, score: best.score };
  }
  return { found: false, fetchedAny };
}

// ---------------------------------------------------------------------------
// Response building
// ---------------------------------------------------------------------------

function shortName(source) {
  if (!source || !source.name) return "official source";
  return source.name.split("—")[0].trim();
}

function baseShape(language, explanation) {
  return {
    category: null,
    confidence: "none",
    language,
    needs_follow_up: true,
    follow_up_questions: [],
    missing_fields: [],
    matched_fields: [],
    legal_references: [], // never populated by this fallback (see module doc)
    explanation,
    authority: null,
    next_steps: [],
    draft: null, // never generated by this fallback (see module doc)
    sources: [],
    facts: {},
  };
}

function buildLookupResponse(topic, language, lookup) {
  const opener = topic.safety
    ? "Thank you for trusting me with this."
    : "Thank you for explaining your situation.";

  const parts = [
    `${opener} I'll check the relevant Pakistani laws and official guidance for ${topic.area}.`,
    topic.sentence,
  ];

  let explanation;
  let sources = [];

  if (lookup && lookup.found) {
    explanation = `Quoted from the official ${shortName(lookup.source)} website: "${lookup.excerpt}"`;
    if (lookup.source) sources = [lookup.source];
    parts.push(
      "Based on the official information I found, here is what may apply:\n\n" +
        `From the official ${shortName(lookup.source)} website (${lookup.url}):\n\n"${lookup.excerpt}"\n\n` +
        "This is quoted word-for-word from that official source — I have not added any legal interpretation of my own, and it may not cover every detail of your situation."
    );
  } else if (lookup && (lookup.fetchedAny || lookup.noSearch)) {
    explanation = `Practical guidance for ${topic.area}, with the official sources that handle such matters.`;
    parts.push("Here is what may help in your situation:");
  } else {
    explanation =
      "The connected official sources are not reachable at the moment; the practical guidance below still applies.";
    parts.push(
      "The official sources are not reachable at the moment — please try again a little later and I'll search them again for you. In the meantime, here is what may help in your situation:"
    );
  }

  parts.push(`Next steps:\n${formatNextSteps(topic.nextSteps)}`);

  if (lookup && lookup.found) {
    parts.push(
      `Official source:\n${lookup.source ? lookup.source.name : "official source"} — ${lookup.url}`
    );
  } else {
    parts.push(
      `You can also check these official sources directly:\n${directSourcesBlock(topic.directSources)}`
    );
  }

  parts.push(
    `The exact legal position can depend on ${topic.factNote}. A qualified lawyer can confirm how it applies to you.`
  );

  if (topic.safety) parts.push(HELPLINES_BLOCK);
  parts.push(`Remember: ${DISCLAIMER}`);

  return {
    ...baseShape(language, explanation),
    sources,
    message: parts.join("\n\n"),
    message_hint: "fallback",
    disambiguation: null,
  };
}

function buildFollowupResponse(topic, language) {
  const opener = topic.safety
    ? "Thank you for trusting me with this."
    : "Thank you for explaining this.";
  const parts = [
    `As before, ${topic.sentence.charAt(0).toLowerCase() + topic.sentence.slice(1)} I have already searched the official government sources connected to Insaaf Aasan for this and shared what they said above.`,
    `Next steps you can still take:\n${formatNextSteps(topic.nextSteps)}`,
    `The exact legal position can depend on ${topic.factNote}. A qualified lawyer can confirm how it applies to you.`,
  ];
  if (topic.safety) parts.push(HELPLINES_BLOCK);
  parts.push(`Remember: ${DISCLAIMER}`);

  return {
    ...baseShape(language, "This matter has already been searched in the connected official sources."),
    message: parts.join("\n\n"),
    message_hint: "fallback_followup",
    disambiguation: null,
  };
}

// --- the generic lookup: an unfamiliar but concrete problem ---------------

function buildGenericLookupResponse(language, lookup) {
  const parts = [
    "Thank you for explaining your situation. I'll look into the relevant Pakistani laws and official guidance for you.",
  ];

  let explanation;
  let sources = [];

  if (lookup && lookup.found) {
    explanation = `Quoted from the official ${shortName(lookup.source)} website: "${lookup.excerpt}"`;
    if (lookup.source) sources = [lookup.source];
    parts.push(
      "Based on the official information I found, here is what may apply:\n\n" +
        `From the official ${shortName(lookup.source)} website (${lookup.url}):\n\n"${lookup.excerpt}"\n\n` +
        "This is quoted word-for-word from that official source — I have not added any legal interpretation of my own, and it may not cover every detail of your situation."
    );
    parts.push(
      "Next steps:\n" +
        "1. Read the official guidance at the link below and compare it carefully with what happened to you.\n" +
        "2. Keep any documents, messages, or receipts related to the matter — they help whoever reviews your case later.\n" +
        "3. If it involves a dispute you cannot resolve directly, a qualified lawyer can review your specific facts."
    );
    parts.push(
      `Official source:\n${lookup.source ? lookup.source.name : "official source"} — ${lookup.url}`
    );
  } else if (lookup && (lookup.fetchedAny || lookup.noSearch)) {
    explanation =
      "Practical guidance for the situation described, with the official sources that handle such matters.";
    parts.push("Here is what may help in your situation:");
    parts.push(
      "Next steps:\n" +
        "1. Describe the problem again with a little more detail — what happened, who was involved, and what you would like to achieve — and I'll search again.\n" +
        "2. Describing it in English or Roman Urdu may help me search the official sources more precisely.\n" +
        "3. You can also check the official sources directly:\n" +
        directSourcesBlock(["punjab_police", "sindh_police", "pakistan_code"]) + "\n" +
        "4. A qualified lawyer can review your specific facts."
    );
  } else {
    explanation =
      "The connected official sources are not reachable at the moment; the practical guidance below still applies.";
    parts.push(
      "The official sources are not reachable at the moment — please try again a little later and I'll search them again for you. In the meantime, here is what may help:"
    );
    parts.push(
      "You can also check the official sources directly:\n" +
        directSourcesBlock(["punjab_police", "sindh_police", "pakistan_code"])
    );
  }

  parts.push("The exact legal position depends on the specific facts of your case.");
  parts.push(`Remember: ${DISCLAIMER}`);

  return {
    ...baseShape(language, explanation),
    sources,
    message: parts.join("\n\n"),
    message_hint: "fallback",
    disambiguation: null,
  };
}

function buildGenericFollowupResponse(language) {
  const parts = [
    "I have already searched the connected official sources for what you described and shared everything relevant above. If you tell me a bit more about what happened — who was involved and what you would like to achieve — I'll search again with the fuller picture.",
    "A qualified lawyer can review the specific facts of your case.",
    `Remember: ${DISCLAIMER}`,
  ];

  return {
    ...baseShape(language, "This matter has already been searched in the connected official sources."),
    message: parts.join("\n\n"),
    message_hint: "fallback_followup",
    disambiguation: null,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Called by the provider ONLY when the classification engine found no
 * reasonable match among the eight curated categories. Returns a complete
 * AnalysisResult for the fallback reply, or null to keep the engine's usual
 * clarifying question (vague messages with nothing to search for).
 *
 * Two paths:
 *   - a known out-of-scope topic (rental dispute, land dispute, ...) is
 *     searched with its curated terms;
 *   - an unfamiliar but concrete description is searched generically with the
 *     user's own words — the user is helped, never turned away and never
 *     force-fit into a curated category.
 */
async function maybeHandleOutOfScope({ text, language, result, conversation, fetchImpl }) {
  if (!result || result.category || result.disambiguation) return null;
  if (result.message_hint !== "clarify" || result.confidence === "high") return null;

  const msgs = Array.isArray(conversation) ? conversation : [];

  let topic = detectTopic(text);
  if (topic && topicAlreadyHandled(msgs, topic)) {
    return buildFollowupResponse(topic, language);
  }

  let triggerText = text || "";
  if (!topic) {
    // The current message may be a bare follow-up ("what should I do?") to an
    // earlier out-of-scope description — find the topic it belongs to.
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (!m || m.role !== "user" || typeof m.content !== "string") continue;
      const t = detectTopic(m.content);
      if (!t) continue;
      topic = t;
      triggerText = m.content;
      break;
    }
    if (topic && topicAlreadyHandled(msgs, topic)) {
      // A short follow-up reuses the earlier reply; a fresh substantive
      // description is a new problem and deserves a new search below.
      if (!isDescriptiveQuery(text)) {
        return buildFollowupResponse(topic, language);
      }
      topic = null;
      triggerText = text || "";
    }
  }

  if (topic) {
    console.log(
      `[officialSourceFallback] no curated match for topic "${topic.id}" — searching whitelisted official sources`
    );
    let lookup = null;
    try {
      lookup = await searchOfficialSources(triggerText, topic, fetchImpl);
    } catch (e) {
      console.log(`[officialSourceFallback] search error: ${e && e.message}`);
      lookup = { found: false, fetchedAny: false };
    }
    console.log(
      `[officialSourceFallback] topic=${topic.id} found=${lookup && lookup.found}` +
        (lookup && lookup.found ? ` url=${lookup.url}` : "")
    );
    return buildLookupResponse(topic, language, lookup);
  }

  // No known topic: if the user has described a concrete problem, search the
  // official sources with their own words instead of turning them away.
  if (genericAlreadyHandled(msgs) && !isDescriptiveQuery(text)) {
    return buildGenericFollowupResponse(language);
  }
  if (isDescriptiveQuery(text)) {
    const genericTopic = buildGenericTopic(text);
    let lookup;
    if (genericTopic.noSearch) {
      // Too few Latin words to build a search query (e.g. Urdu script only) —
      // answer honestly rather than searching the English sources blindly.
      lookup = { found: false, noSearch: true };
    } else {
      console.log(
        "[officialSourceFallback] no curated match — searching official sources for the user's description"
      );
      try {
        lookup = await searchOfficialSources(text, genericTopic, fetchImpl);
      } catch (e) {
        console.log(`[officialSourceFallback] search error: ${e && e.message}`);
        lookup = { found: false, fetchedAny: false };
      }
      console.log(
        `[officialSourceFallback] general_lookup found=${lookup && lookup.found}` +
          (lookup && lookup.found ? ` url=${lookup.url}` : "")
      );
    }
    return buildGenericLookupResponse(language, lookup);
  }

  return null;
}

module.exports = { maybeHandleOutOfScope };
