/**
 * Required-field definitions per legal category (Section 8 of the spec)
 * and the detectors that recognise when a fact has actually been provided.
 *
 * This replaces the old engine's turn-counting: the conversation moves on
 * only when the *specific facts* below are present — no matter how many
 * messages that takes. Vague or "I don't know" replies are never counted
 * as answered; they are re-asked once (more specifically) and otherwise
 * explicitly recorded as "Not known".
 *
 * Detectors run on the raw (lowercased) conversation text and return the
 * captured fact as a human-readable string, or null.
 */

const { extractRelationship } = require("./relationships");

const URDU = "[\\u0600-\\u06FF]";

/** Capture the sentence around a regex match, for use in the draft. */
function captureAround(text, match) {
  const idx = match.index;
  let start = idx;
  const stops = /[.!?؟۔,،;:\n]/;
  while (start > 0 && !stops.test(text[start - 1]) && idx - start < 90) start--;
  while (start < idx && /\s/.test(text[start])) start++;
  let end = idx + match[0].length;
  while (end < text.length && !stops.test(text[end]) && end - idx < 110) end++;
  let captured = text.slice(start, end).trim().replace(/[.!?؟۔,،;:]+$/, "");
  if (captured.length > 180) captured = captured.slice(0, 177) + "...";
  return captured || match[0];
}

/** Run a list of regexes; return the first capture. */
function detectWith(text, regexes) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const re of regexes) {
    const m = lower.match(re);
    if (m) return captureAround(lower, m);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Shared detectors
// ---------------------------------------------------------------------------

const DATE_TIME_RE = [
  /\b(yesterday|today|last night|the day before yesterday)\b/,
  /\b\d{1,2}[:.]\d{2}\s*(am|pm)?\b/,
  /\b\d+\s*(baje|bajay|baje|o'?clock)\b/,
  /\b(kal|aaj|parso|parsu|parson|guzashta shab)\b/,
  /\b(subah|subha|morning|dopahar|dopeher|afternoon|shaam|shaam ko|sham|evening|raat|raat ko|night|maghrib)\b/,
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|peer|somwar|mangalwar|budhwar|jumeraat|jumma|hafta|hafte|haftey)\b/,
  /\b\d+\s*(din|dino|dinon|days|weeks|hafte|haftey|weeks|mahine|mahinay|months|saal|years|ghante|ghantay|hours|minute|minat|minat)\s*(pehle|pehly|pahle|pahlay|ago|baad|before|earlier|baad mein)\b/,
  /\b(pichle|pichlay|pichly|last|past|ghaliban)\s+(hafta|hafte|week|mahina|mahinay|month|saal|year|din|day)\b/,
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{1,2}\b/,
  /\b\d{1,2}[\/\-\.]\d{1,2}([\/\-\.]\d{2,4})?\b/,
  /\b(ghante|ghantay|hour|hours|ado ghanta|ghanta|thodi dair|der)\s*(pehle|pehly|pahle|ago)\b/,
  /\b(just now|abhi|abhi abhi|right now|filhaal)\b/,
  new RegExp(`\\b(${URDU}+)\\s*(تاریخ|کو)\\b`),
  /\b(رات|صبح|شام|دوپہر)\b/,
];

const AMOUNT_RE = [
  /\b(rs|rupees|rupay|rupey|paise|paisay|paisa|pkr)\.?\s*[\d,]+(?:\.\d+)?(?:\s*(k|hazaar|hazar|hajar|thousand|lakh|lac|crore|million))?/i,
  /\b[\d,]+(?:\.\d+)?\s*(rs|rupees|rupay|rupey|paise|paisay|pkr|hazaar|hazar|hajar|thousand|lakh|lac|crore|million|k)\b/i,
  /\b\d+\s*(hazaar|hazar|hajar|thousand|lakh|lac|crore|million)\b/i,
  /\b(hazaar|hazar|hajar|thousand|lakh|lac|crore)\b/i,
  /\b(worth|qeemat|qemat|value|price|mol|qeemat|bhaav|bav)\b/i,
];

const PROPERTY_RE = [
  /\b(phone|mobile|mobail|cell\s*phone|smartphone|iphone|android)\b/i,
  /\b(wallet|batua|batwa|purse|pouch)\b/i,
  /\b(cash|paisa|paise|paisay|money|rupees|rupay)\b/i,
  /\b(gold|sona|jewellery|jewelry|zewar|jewels|churiyan|bangles|earrings|kaan ki)|\b(gold ki)\b/i,
  /\b(car|gaari|gari|vehicle|bike|motorcycle|motorbike|cycle|scooter)\b/i,
  /\b(laptop|computer|pc|tablet|ipad)\b/i,
  /\b(tv|television|led|camera|watch|ghari|ghari)\b/i,
  /\b(bag|bags|thaila|thela|handbag|briefcase|suitcase)\b/i,
  /\b(cnic|id\s*card|id\s*card|shanakhti\s*card|nicop|passport|license|licence|driving\s*licence)\b/i,
  /\b(documents|dastavez|dastawezat|dastavezat|kaghazat|kaghzat|papers|files|file|degrees?|certificate)\b/i,
  /\b(keys?|chabi|chabian|chabiyan|chaabi)\b/i,
  /\b(clothes|kapray|kapre|shoes|jootay|joota)\b/i,
  /\b(goods|saaman|saman|samam|asmaan|luggage|asma)\b/i,
];

const PLACE_RE = [
  /\b(ghar|ghar mein|home|house|flat|apartment|makan)\b/i,
  /\b(market|bazaar|bazar|shop|dukaan|dukan|store|mall|plaza)\b/i,
  /\b(office|daftar|workplace|work place|factory)\b/i,
  /\b(school|skool|college|university|uni|academy|madrassa)\b/i,
  /\b(hospital|clinic|dispensary)\b/i,
  /\b(bus|bus stop|bus stand|train|railway|station|metro)\b/i,
  /\b(road|sadak|sarak|street|gali|mohalla|muhalla|neighbourhood|neighborhood|chowk|chowck|square|bridge|pul)\b/i,
  /\b(park|parking|car park|basement|staircase|stair|lift|elevator)\b/i,
  /\b(masjid|mandir|church|imambargah|shrine|dargah)\b/i,
  /\b(bank|atm|kiosk)\b/i,
  /\b(hotel|restaurant|cafe|dhaba|food street)\b/i,
  /\b(petrol pump|petrol|cng|filling station)\b/i,
  /\b(lahore|karachi|islamabad|rawalpindi|pindi|faisalabad|multan|peshawar|quetta|hyderabad|sialkot|gujranwala|bahawalpur|sargodha|abbottabad|gilgit|skardu|sukkur|larkana|mirpur|muzaffarabad|okara|kasur|sheikhupura|jhelum|sahiwal|rahim\s*yar\s*khan|murree|swat|mingora|bannu|kohat|nowshera|mardan|charsadda|swabi|dera|dg\s*khan)\b/i,
  /\b(workplace|karkhana|warehouse|godam|godown)\b/i,
];

const EVIDENCE_RE = [
  /\b(cctv|camera|cam|footage|video|recording|audio|voice\s*note)\b/i,
  /\b(screenshots?|screen\s*shots?|screen\s*recording|photos?|pictures?|pics?|foto|fotos?)\b/i,
  /\b(receipts?|bills?|invoice|slip|kachi\s*parchi|parchi)\b/i,
  /\b(messages?|msgs?|sms|whatsapp|chats?|chat\s*history|call\s*logs?|call\s*recording|emails?|mails?)\b/i,
  /\b(witness(es)?|gawah|gawahi|gawaho|onlookers?)\b/i,
  /\b(saboot|suboot|sabut|proof|evidence|dastavez|document|kaghaz|kagaz|kaghzat)\b/i,
  /\b(agreement|contract|stamp\s*paper|dastakhat|signature|signed)\b/i,
  /\b(bank\s*statement|transaction|transactions|txn|transaction\s*id|tracking\s*id|reference\s*number|ref\s*no)\b/i,
  /\b(fir\s*copy|complaint\s*copy|report|police\s*report)\b/i,
];

const WITNESS_RE = [
  /\b(witness(es)?|gawah|gawahi|gawaho|gawahon)\b/i,
  /\b(dekh\s*rahe|dekh\s*rahe\s*the|dekha|log\s*dekh|people\s*saw|saw\s*it|saw\s*the|hazir|present)\b/i,
  /\b(crowd|bhaeed|bheed|log\s*the|kai\s*log|onlookers?|log\s*jama)\b/i,
  /\b(dost\s*ne\s*dekha|dost\s*dekh|parosi\s*ne\s*dekha|colleague\s*saw)\b/i,
];

const SUSPECT_RE = [
  /\b(suspect|shak|shakhs|mulzim|mujrim|eedaan|guilty)\b/i,
  /\b(uska\s*naam|uski\s*shinakht|uski\s*shanakht|pata\s*hai\s*kaun|kaun\s*tha|kaun\s*tha)\b/i,
  /\b(know\s*(him|her|them|who)|i\s*know\s*(him|her|who))\b/i,
  /\b(parosi|parosii|neighbou?r|cousin|bhai|bhen|rishtedar|rishtay\s*dar|relative|mamu|chacha|taya|khala|phupho)\b/i,
  /\b(dost|friend|colleague|coworker|co\s*worker|employee|naukar|servant|kaam\s*wali|chowkidar|guard|chowkidar)\b/i,
  /\b(tenant|kirayedaar|kiraye\s*daar|landlord|makaan\s*maalik|shopkeeper|dukan\s*daar)\b/i,
];

/**
 * Recognise a described relationship using the multilingual normaliser.
 * Returns a human-readable string like "Husband" or "Landlord", or null.
 */
function detectRelationship(text) {
  const rel = extractRelationship(text);
  if (!rel) return null;
  return rel.label.charAt(0).toUpperCase() + rel.label.slice(1);
}

const IMEI_RE = [
  /\b(imei|imai|emai|serial|serial\s*number|sr\s*no|s\/n|imei\s*number)\b/i,
  /\b(box|packing\s*box|phone\s*box|bill|purchase\s*receipt|warranty\s*card)\b/i,
];

const PLATFORM_RE = [
  /\b(facebook|fb|instagram|insta|instgram)\b/i,
  /\b(whatsapp|whats\s*app|whatsap|watsapp|imo|viber|telegram)\b/i,
  /\b(olx|daraz|amazon|aliexpress|ebay|alibaba|tiktok|tik\s*tok|youtube|yt|snapchat|twitter|linkedin)\b/i,
  /\b(website|web\s*site|web|link|url|app|application|android|iphone|online|internet|marketplace|classified)\b/i,
  /\b(email|e-mail|gmail|yahoo|outlook|sms|text\s*message|dm|inbox|page|group)\b/i,
  /\b(google|play\s*store|app\s*store)\b/i,
  /\b(phone\s*call|call|calls|helpline|fraud\s*call)\b/i,
];

const PAYMENT_RE = [
  /\b(easypaisa|easy\s*paisa|jazzcash|jazz\s*cash|upaisa|u\s*paisa|sadapay|nayapay|naya\s*pay)\b/i,
  /\b(bank\s*transfer|online\s*transfer|ibft|raast|swift|wire\s*transfer|cheque|check)\b/i,
  /\b(debit\s*card|credit\s*card|atm\s*card|card|cod|cash\s*on\s*delivery)\b/i,
  /\b(cash|hundi|hawala)\b/i,
];

const TRANSACTION_ID_RE = [
  /\b(transaction\s*id|txn|tid|trnx|tracking\s*id|reference\s*number|ref\s*no|receipt\s*number|trnx\s*id)\b/i,
];

const SCAMMER_CONTACT_RE = [
  /\b(uska\s*number|uska\s*phone|uska\s*whatsapp|uska\s*email|uska\s*account|uski\s*id)\b/i,
  /\b(phone\s*number|contact\s*number|account\s*number|iban|wallet\s*number|profile\s*link)\b/i,
  /\b(user(name)?|profile\s*name|page\s*name|account\s*name)\b/i,
];

// ---------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------

function detectDateTime(text) {
  return detectWith(text, DATE_TIME_RE);
}

function detectAmount(text) {
  return detectWith(text, AMOUNT_RE);
}

function detectProperty(text) {
  return detectWith(text, PROPERTY_RE);
}

function detectPlace(text) {
  return detectWith(text, PLACE_RE);
}

function detectEvidence(text) {
  return detectWith(text, EVIDENCE_RE);
}

function detectWitnesses(text) {
  return detectWith(text, WITNESS_RE);
}

function detectSuspect(text) {
  const relationship = detectRelationship(text);
  if (relationship) return `Relationship: ${relationship}`;
  return detectWith(text, SUSPECT_RE);
}

function detectImei(text) {
  return detectWith(text, IMEI_RE);
}

function detectPlatform(text) {
  return detectWith(text, PLATFORM_RE);
}

function detectPaymentMethod(text) {
  return detectWith(text, PAYMENT_RE);
}

function detectTransactionId(text) {
  return detectWith(text, TRANSACTION_ID_RE);
}

function detectScammerContact(text) {
  return detectWith(text, SCAMMER_CONTACT_RE);
}

/**
 * "What happened" is satisfied by any reasonably descriptive first message.
 * Returns the first sentence of the description.
 */
function detectWhatHappened(text) {
  if (!text) return null;
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 4) return null;
  const firstSentence = text.split(/[.!?؟۔]/)[0].trim();
  const value = firstSentence.length > 200 ? firstSentence.slice(0, 197) + "..." : firstSentence;
  return value || null;
}

function detectEntrusted(text) {
  return detectWith(text, [
    /\b(amanat|amaanat|amanah|entrusted|entrust|deposited|deposit)\b/i,
    /\b(peshgi|advance|diya\s*tha|de\s*diya|de\s*diya\s*tha|handed\s*over|given\s*to|rakhwaya|rakhwaya\s*tha|rekh\s*di)\b/i,
    /\b(qarz|qarza|loan|udhaar|udhar|dastavez|documents?\s*diye)\b/i,
    /\b(sambhal|sambhalne|keep|safe\s*custody|hold)\b/i,
  ]);
}

function detectAgreement(text) {
  return detectWith(text, [
    /\b(wapas|wapas|wapis|lotana|lotana\s*tha|return|returned|returned\s*back)\b/i,
    /\b(wada|waada|waada\s*kiya|promise|promised|assured|assure)\b/i,
    /\b(muddat|deadline|time\s*pe|by\s*(next|the)\s*\w+|khatam| agreement |deal)\b/i,
    /\b(dena\s*tha|dene\s*ka\s*waada|karana\s*tha|karna\s*tha)\b/i,
  ]);
}

function detectDiscovery(text) {
  return detectWith(text, [
    /\b(pata\s*chala|pata\s*chal|mujhe\s*pata|ab\s*pata|phir\s*pata|abhi\s*pata)\b/i,
    /\b(discovered|found\s*out|realised|realized|came\s*to\s*know|got\s*to\s*know)\b/i,
  ]);
}

function detectWrittenProof(text) {
  return detectWith(text, [
    /\b(agreement|contract|kagaz|kaghaz|likha|likhi|written|stamp\s*paper|dastakhat|signature|signed)\b/i,
    /\b(receipt|parchi|promissory|cheque|hundi)\b/i,
    /\b(whatsapp|messages?|sms|email|mail)\b/i,
  ]);
}

function detectThreatNature(text) {
  return detectWith(text, [
    /\b(mar\s*dunga|mar\s*dala|marna|marne|kill|death|maut|maut\s*ki|jaan|jaan\s*ki)\b/i,
    /\b(hurt|chot|nuksan|damage|tabahi|beat|maara|mara|pitai|pitai\s*ki)\b/i,
    /\b(goli|bullet|weapon|hathiyar|gun|pistol|rifle|danda|chaku|churra|knife|acid)\b/i,
    /\b(izzat|reputation|badnami|sharminda|expose|leak|ashkara)\b/i,
    /\b(blackmail|black\s*mail|kaala\s*paisa|photo\s*leak|video\s*leak)\b/i,
    /\b(talaaq|talaq|divorce|harm\s*family|bachon)\b/i,
  ]);
}

function detectCommMethod(text) {
  return detectWith(text, [
    /\b(phone|call|calls|phone\s*call|whatsapp|message|messages|sms|text)\b/i,
    /\b(in\s*person|aamne\s*saamne|saamne\s*se|face\s*to\s*face|mil\s*ke|mila\s*tha)\b/i,
    /\b(letter|khat|email|e-mail|social\s*media|facebook|instagram|dm|voice\s*note|video\s*call)\b/i,
    /\b(kisi\s*zariye|zariye|through\s*someone|via)\b/i,
  ]);
}

function detectImmediateDanger(text) {
  return detectWith(text, [
    /\b(abhi|ab\s*tak|ab\s*bhi|still|right\s*now|current|filhaal|abhi\s*bhi)\b/i,
    /\b(follow|follows|followed|ghoom|ghoomta|idhar\s*udhar|peshan|preshan\s*kar\s*raha)\b/i,
    /\b(scared|darr|khatra|danger|unsafe|unsafe\s*mehsoos)\b/i,
  ]);
}

function detectRepeat(text) {
  return detectWith(text, [
    /\b(roz|rozz|daily|everyday|every\s*day|har\s*roz|har\s*din|har\s*baar)\b/i,
    /\b(baar\s*baar|bar\s*bar|repeated|repeatedly|again\s*and\s*again|kai\s*baar|kai\s*bar|many\s*times|several\s*times|often)\b/i,
    /\b(lagatar|continuously|ongoing|ab\s*tak|pehle\s*bhi|pehlay\s*bhi|hafte|hafton|mahinon|months|since)\b/i,
    /\b(ek\s*baar|ek\s*hi\s*baar|once|one\s*time|single|sirf\s*ek|pehli\s*baar|first\s*time)\b/i,
  ]);
}

function detectIdentityKnown(text) {
  const unknown = text.match(/\b(unknown|stranger|anjana|anjaan|pata\s*nahi|pata\s*nahi\s*kaun|nahi\s*pata|nai\s*pata)\b/i);
  if (unknown) return "Person not known / unknown";
  const known = detectWith(text, [
    /\b(pata\s*hai|pata\s*chal|jaan\s*ta|jaan\s*ti|know|known|uska\s*naam|naam\s*pata)\b/i,
    /\b(class\s*fellow|college|university|dost|friend|ex|colleague|cousin|bhai|bhen|rishtedar|relative|neighbou?r|parosi|us\s*ki\s*shinakht)\b/i,
  ]);
  return known ? `Identity known — ${known}` : null;
}

function detectLostItem(text) {
  return detectWith(text, [
    /\b(cnic|id\s*card|shanakhti\s*card|nicop|passport)\b/i,
    /\b(wallet|batua|batwa|purse|bag|thaila|thela|briefcase|luggage)\b/i,
    /\b(phone|mobile|mobail|smartphone|iphone|laptop|tablet)\b/i,
    /\b(key|keys|chabi|chabiyan|chaabi)\b/i,
    /\b(documents?|dastavez|dastawezat|kaghazat|kaghzat|papers?|files?|license|licence|driving\s*licence|degree|certificate|marksheet|result\s*card)\b/i,
    /\b(card|debit\s*card|credit\s*card|atm\s*card|bank\s*card)\b/i,
    /\b(jewellery|jewelry|zewar|watch|ghari|glasses|chashma|spectacles|umbrella|chhatri|chatri)\b/i,
  ]);
}

/**
 * The explicit loss-vs-theft check (Section 11). Returns the user's belief
 * about what happened, or null when the text does not say.
 */
function detectLostVsTaken(text) {
  const lower = (text || "").toLowerCase();
  const taken = lower.match(/\b(chori|churaya|choraya|chura|kisi\s*ne|utha\s*liya|chheena|snach|snatched|stolen|stole|theft|taken|took|chura\s*liya)\b/);
  const lost = lower.match(/\b(gum|gumshuda|kho\s*gaya|kho\s*gai|khoi|misplaced|lost|pata\s*nahi|nahi\s*mil|gira|gir\s*gaya|reh\s*gaya|chhoot|chut\s*gaya|bhool|bhool\s*gaya|shayad)\b/);
  if (taken && lost) return null; // ambiguous — engine must ask
  if (taken) return `Believes it was taken by someone (theft alleged)`;
  if (lost) return `Believes it was lost or misplaced`;
  return null;
}

/** Cyberstalking-specific: what exactly the person does online. */
function detectConduct(text) {
  return detectWith(text, [
    /\b(messages?|bhej|bhejta|bhej\s*raha|bhejti|friend\s*request(s)?|calls?)\b/i,
    /\b(stalk(s|ing|ed)?|follow(s|ing|ed)?|monitor(s|ing)?)\b/i,
    /\b(comments?|abuse|abusive|gaali|gaaliyan|galiyan|gaali\b)\b/i,
    /\b(threat(s|ening|ened)?|dhamki|blackmail(s|ing)?)\b/i,
    /\b(pictures?|photos?|images?|morph(ed|ing)?|edit(ed)?|fake\s*(account|profile|id))\b/i,
    /\b(impersonat(e|es|ing|ion)|pretend(s|ing)?|pos(es|ing)\s*as)\b/i,
    /\b(expose|leak(s|ing|ed)?|sharminda)\b/i,
  ]);
}

function detectThreatener(text) {
  return detectSuspect(text);
}

// ---------------------------------------------------------------------------
// Non-answer / greeting detection
// ---------------------------------------------------------------------------

const NON_ANSWER_RE = [
  /^(nahi|na|no|nahi hai|nahi hain|nope|nah)\b/i,
  /\b(nahi\s*pata|pata\s*nahi|nahi\s*maloom|maloom\s*nahi|idk|i\s*don'?t\s*know|dont\s*know|no\s*idea|not\s*sure|pata\s*nai|nai\s*pata)\b/i,
  /\b(kuch\s*nahi|koi\s*nahi|none|nothing|no\s*one|koi\s*nahi|mere\s*paas\s*nahi|mujhe\s*nahi)\b/i,
  /\b(nahi\s*hain|nahi\s*hai|nai\s*hain|jani\s*nahi)\b/i,
  // Confusion / "I don't understand" indicators (samajh-nahi is vague → reask, not non-answer)
  /\b(matlab\s*kya|kya\s*matlab|confused|samajh\s*na\s*aaya)\b/i,
];

/** True when a reply is an explicit "don't know / nothing" style answer. */
function isNonAnswer(text) {
  const trimmed = (text || "").trim().toLowerCase();
  if (!trimmed) return true;
  if (trimmed.length > 60) return false;
  return NON_ANSWER_RE.some((re) => re.test(trimmed));
}

const GREETING_RE = /^(hi+|hey+|hello+|salam|sal?am|ass?alam[-\s]*o[-\s]*ala?ikum|as?alam[-\s]*o[-\s]*ala?ikum|salam\s*ala?ikum|asalam\s*ala?ikum|aoa|good\s*(morning|evening|afternoon|night)|kya\s*haal|kaise\s*ho|kaisay\s*ho|how\s*are\s*you|adaab)[!.,?\s]*$/i;

/** True when a message is only a greeting, with no content. */
function isGreeting(text) {
  return GREETING_RE.test((text || "").trim());
}

// ---------------------------------------------------------------------------
// Per-category required fields (Section 8)
// ---------------------------------------------------------------------------

const CATEGORY_FIELDS = {
  theft: [
    {
      id: "datetime",
      label: "When it happened (date, approximate time)",
      question: "When was the item stolen? Even a rough date and time of day helps.",
      reask: "Even approximately — was it today, yesterday, or last week? Morning, afternoon, or night?",
      detect: detectDateTime,
    },
    {
      id: "location",
      label: "Where it happened",
      question: "Where did the theft take place — at home, in the market, on the road, or somewhere else?",
      reask: "Even the area or a nearby landmark is helpful — where were you when it happened?",
      detect: detectPlace,
    },
    {
      id: "property_stolen",
      label: "What property was stolen",
      question: "What exactly was stolen?",
      reask: "Was anything taken at all — phone, wallet, cash, jewellery, documents? Please describe it briefly.",
      detect: detectProperty,
    },
    {
      id: "approx_value",
      label: "Approximate value of the property",
      question: "Roughly how much was the stolen property worth?",
      reask: "A rough estimate is fine — for example 'about 50 thousand rupees'.",
      detect: detectAmount,
    },
    {
      id: "suspect_info",
      label: "Suspect information (if known)",
      question: "Do you know or suspect who might have done this?",
      reask: "Even a suspicion helps — for example a neighbour, servant, or someone you saw nearby?",
      detect: detectSuspect,
    },
    {
      id: "evidence",
      label: "Evidence (CCTV, receipts, screenshots)",
      question: "Do you have any evidence — CCTV footage, receipts, messages, or photos?",
      reask: "Anything at all that could serve as proof — footage, receipts, screenshots, messages?",
      detect: detectEvidence,
    },
    {
      id: "witnesses",
      label: "Witnesses (if any)",
      question: "Did anyone witness the theft?",
      reask: "Was anyone else present who saw what happened?",
      detect: detectWitnesses,
    },
    {
      id: "imei",
      label: "IMEI / serial number (if applicable)",
      question: "If a phone or device was stolen, do you have its IMEI or serial number?",
      reask: "The IMEI is printed on the phone's box or purchase receipt — do you have either?",
      detect: detectImei,
    },
  ],

  fraud: [
    {
      id: "what_happened",
      label: "What happened",
      question: "In a sentence or two, how were you deceived?",
      reask: "What did they promise or claim — how exactly were you misled?",
      detect: detectWhatHappened,
    },
    {
      id: "amount_involved",
      label: "Amount or property involved",
      question: "How much money or property was involved?",
      reask: "Even an approximate amount is useful — how much did you hand over?",
      detect: detectAmount,
    },
    {
      id: "when",
      label: "When it happened",
      question: "When did the fraud happen?",
      reask: "Roughly when did the fraud take place — last week, last month?",
      detect: detectDateTime,
    },
    {
      id: "evidence",
      label: "Evidence (messages, receipts, agreements)",
      question: "Do you have any evidence — messages, receipts, bank records, or a written agreement?",
      reask: "Anything in writing at all — chat history, receipts, or bank statements?",
      detect: detectEvidence,
    },
  ],

  criminal_breach_of_trust: [
    {
      id: "what_entrusted",
      label: "What was entrusted",
      question: "What exactly did you hand over to this person — money, documents, or property?",
      reask: "What did you give them to keep, use, or return on your behalf?",
      detect: detectEntrusted,
    },
    {
      id: "what_agreed",
      label: "What was agreed (the arrangement)",
      question: "What was the agreement — when or how were they supposed to return or use it?",
      reask: "What did they promise — to return it by a date, or to use it only for a stated purpose?",
      detect: detectAgreement,
    },
    {
      id: "when_discovered",
      label: "When the breach was discovered",
      question: "When did you discover that they had misused or not returned it?",
      reask: "When did you first realise something was wrong?",
      detect: detectDiscovery,
    },
    {
      id: "written_proof",
      label: "Written proof of the arrangement",
      question: "Is there any written proof of the arrangement — an agreement, receipt, or messages?",
      reask: "Anything in writing — a signed paper, receipt, or chat messages about the arrangement?",
      detect: detectWrittenProof,
    },
  ],

  criminal_intimidation: [
    {
      id: "threat_nature",
      label: "Exact nature of the threat",
      question: "What exactly were you threatened with — harm to you, your family, your reputation, or your property?",
      reask: "As close to their words as you remember — what did they say they would do?",
      detect: detectThreatNature,
    },
    {
      id: "datetime",
      label: "When it happened",
      question: "When did the threat take place?",
      reask: "Roughly what date or time of day was the threat made?",
      detect: detectDateTime,
    },
    {
      id: "comm_method",
      label: "Method of communication",
      question: "How was the threat made — in person, by phone, or through messages?",
      reask: "Did they threaten you face-to-face, on a call, or in writing (SMS/WhatsApp)?",
      detect: detectCommMethod,
    },
    {
      id: "who_threatened",
      label: "Who made the threat",
      question: "Do you know who is making these threats?",
      reask: "Is it someone you know — or can you describe who they are?",
      detect: detectThreatener,
    },
    {
      id: "evidence",
      label: "Evidence of the threat",
      question: "Do you have evidence — screenshots, recordings, call logs, or witnesses?",
      reask: "Anything saved — messages, recordings, or people who heard the threat?",
      detect: detectEvidence,
    },
    {
      id: "witnesses",
      label: "Witnesses (if any)",
      question: "Did anyone else hear or see the threat?",
      reask: "Was anyone else present when you were threatened?",
      detect: detectWitnesses,
    },
    {
      id: "immediate_danger",
      label: "Whether immediate danger exists",
      question: "Do you feel you are in immediate danger right now?",
      reask: "Are they still threatening or following you? If you feel unsafe, please contact the police (15) immediately.",
      detect: detectImmediateDanger,
    },
  ],

  harassment: [
    {
      id: "what_happened",
      label: "What happened",
      question: "In a sentence or two, what exactly did the person do?",
      reask: "Could you describe briefly what they said or did?",
      detect: detectWhatHappened,
    },
    {
      id: "place",
      label: "Where it happened (workplace / public / other)",
      question: "Where did this happen — at your workplace, in a public place, or somewhere else?",
      reask: "Was it at work, on the street, in transport, at an educational institution, or elsewhere?",
      detect: detectPlace,
    },
    {
      id: "when_and_repeated",
      label: "When it happened, and whether it was repeated",
      question: "When did this happen — and was it a one-time incident or has it happened repeatedly?",
      reask: "Roughly when did it happen, and has it happened more than once?",
      detect: (text) => detectDateTime(text) || detectRepeat(text),
    },
    {
      id: "evidence_or_witnesses",
      label: "Evidence or witnesses",
      question: "Do you have any evidence or witnesses — messages, recordings, or people who saw it?",
      reask: "Anything saved, or anyone who saw what happened?",
      detect: (text) => detectEvidence(text) || detectWitnesses(text),
    },
  ],

  cyberstalking: [
    {
      id: "platform",
      label: "Platform / channel",
      question: "On which platform is this happening — Facebook, Instagram, WhatsApp, or somewhere else?",
      reask: "Which app, website, or platform did they contact or harass you on?",
      detect: detectPlatform,
    },
    {
      id: "conduct",
      label: "Exact conduct (what they do)",
      question: "What exactly are they doing — sending messages, following you, posting about you, using a fake profile?",
      reask: "Could you describe what they do, in your own words?",
      detect: detectConduct,
    },
    {
      id: "identity_known",
      label: "Identity of the person (if known)",
      question: "Do you know who this person is?",
      reask: "Is it someone you know, or an unknown account?",
      detect: detectIdentityKnown,
    },
    {
      id: "evidence",
      label: "Screenshots / evidence",
      question: "Do you have screenshots or other evidence saved? Please do not delete anything.",
      reask: "Any screenshots, links, or saved messages? Please keep everything — do not delete it.",
      detect: (text) => detectEvidence(text) || detectTransactionId(text),
    },
  ],

  online_scam: [
    {
      id: "platform",
      label: "Platform / website",
      question: "On which platform or website did the scam happen?",
      reask: "Was it OLX, Daraz, Facebook, a website link, a phone call, or somewhere else?",
      detect: (text) => detectPlatform(text) || detectWith(text, [/\b(link|url|site|page|add?|ad)\b/i]),
    },
    {
      id: "amount_involved",
      label: "Amount involved",
      question: "How much money did you lose to the scam?",
      reask: "Roughly how much did you pay or transfer?",
      detect: detectAmount,
    },
    {
      id: "transaction_date",
      label: "Transaction date",
      question: "When did you make the payment?",
      reask: "Roughly what date did the transaction take place?",
      detect: detectDateTime,
    },
    {
      id: "payment_method",
      label: "Payment method",
      question: "How did you pay — bank transfer, Easypaisa/JazzCash, card, or cash?",
      reask: "Which payment method did you use?",
      detect: detectPaymentMethod,
    },
    {
      id: "evidence",
      label: "Screenshots / transaction ID",
      question: "Do you have screenshots or a transaction ID saved?",
      reask: "Any proof of payment — a receipt, transaction ID, or chat screenshots?",
      detect: (text) => detectTransactionId(text) || detectEvidence(text),
    },
    {
      id: "scammer_contact",
      label: "Scammer's contact info (if available)",
      question: "Do you have the scammer's number, account details, or profile link?",
      reask: "Anything that identifies them — phone number, account number, or profile/page name?",
      detect: detectScammerContact,
    },
  ],

  lost_property: [
    {
      id: "what_lost",
      label: "What was lost",
      question: "What exactly was lost?",
      reask: "Which item is missing — CNIC, passport, wallet, phone, documents?",
      detect: detectLostItem,
    },
    {
      id: "when_where",
      label: "When and where it was last seen",
      question: "When and where did you last have it?",
      reask: "Try to recall — around what time, and in what place, did you last see it?",
      detect: (text) => detectDateTime(text) || detectPlace(text),
    },
    {
      id: "lost_vs_taken",
      label: "Whether it was lost or taken (loss-vs-theft check)",
      question: "To be clear for the report — did someone take it, or did it go missing on its own?",
      reask: "Which is it — did someone take it, or did it go missing by itself?",
      detect: detectLostVsTaken,
    },
  ],
};

module.exports = {
  CATEGORY_FIELDS,
  isNonAnswer,
  isGreeting,
  detectRelationship,
  detectDateTime,
  detectAmount,
  detectProperty,
  detectPlace,
  detectEvidence,
  detectWitnesses,
  detectSuspect,
  detectPlatform,
  detectPaymentMethod,
  detectTransactionId,
  detectWhatHappened,
  detectLostVsTaken,
  detectLostItem,
};
