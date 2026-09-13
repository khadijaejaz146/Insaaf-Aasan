/**
 * draftBuilder.js — builds the structured, editable complaint draft from the
 * confirmed category and the facts collected by the conversation engine.
 *
 * The draft is a structured object (not a flat string) so the frontend can
 * present every part as an editable field: date, authority, subject, body,
 * relevant facts, evidence list, and a signature placeholder.
 */

const DISCLAIMER =
  "Insaaf Aasan provides general legal information only. It does not constitute legal advice. Always consult a qualified lawyer for your specific situation.";

/** Fields that belong in the evidence attachment list rather than the facts. */
const EVIDENCE_FIELD_IDS = new Set([
  "evidence",
  "evidence_or_witnesses",
  "witnesses",
  "imei",
  "written_proof",
  "scammer_contact",
]);

function todayLabel() {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildDraft(category, facts, description, fieldDefs) {
  const defs = fieldDefs || [];
  const factEntries = [];
  const evidenceEntries = [];

  for (const field of defs) {
    const value = facts[field.id] || "Not known";
    if (EVIDENCE_FIELD_IDS.has(field.id)) {
      evidenceEntries.push(`${field.label}: ${value}`);
    } else {
      factEntries.push({ label: field.label, value });
    }
  }
  if (evidenceEntries.length === 0) {
    evidenceEntries.push("To be attached");
  }

  const isLossReport = category.workflow_type === "loss_report";
  const subject = isLossReport
    ? `Request for Loss Report — ${category.label_en} (${category.label_ur})`
    : `Complaint regarding ${category.label_en} (${category.label_ur})`;

  const descriptionText = (description || "").trim();
  const body = isLossReport
    ? [
        "Respected Sir/Madam,",
        "",
        `I, the undersigned, wish to report that the following item(s) were lost: ${category.label_en.toLowerCase()}. The details known to me are given below.`,
        "",
        descriptionText ? `Description of the incident: ${descriptionText}` : "",
        "",
        "I request that a loss report be registered so that I may obtain a replacement and be protected in case the item is misused. I understand that an ordinary loss is not a criminal matter, and I have not alleged theft.",
        "",
        "I am prepared to provide any additional information or documents as may be required.",
      ]
        .filter((p) => p !== "")
        .join("\n\n")
    : [
        "Respected Sir/Madam,",
        "",
        "I, the undersigned, wish to file a formal complaint regarding the incident described below, and request that appropriate action be taken in accordance with the law.",
        "",
        descriptionText ? `Description of the incident: ${descriptionText}` : "",
        "",
        "The relevant facts, as known to me, are listed below. I am prepared to provide any additional evidence or testimony as may be required.",
        "",
        "I request that my complaint be registered and appropriate action be taken under the relevant provisions of the law.",
      ]
        .filter((p) => p !== "")
        .join("\n\n");

  return {
    date: todayLabel(),
    to: category.complaint_authority,
    subject,
    body,
    facts: factEntries,
    evidence: evidenceEntries,
    signature: "[Your Name]\n[CNIC / ID number]\n[Contact number]\n[Address]",
    disclaimer: DISCLAIMER,
  };
}

/** Flatten the structured draft into copy-paste text. */
function draftToText(draft) {
  return [
    `Date: ${draft.date}`,
    `To: ${draft.to}`,
    `Subject: ${draft.subject}`,
    "",
    draft.body,
    "",
    "RELEVANT FACTS:",
    ...draft.facts.map((f, i) => `${i + 1}. ${f.label}: ${f.value}`),
    "",
    "EVIDENCE / ATTACHMENTS:",
    ...draft.evidence.map((e, i) => `${i + 1}. ${e}`),
    "",
    "Yours sincerely,",
    draft.signature,
    "",
    `— ${draft.disclaimer}`,
  ].join("\n");
}

module.exports = { buildDraft, draftToText, DISCLAIMER };
