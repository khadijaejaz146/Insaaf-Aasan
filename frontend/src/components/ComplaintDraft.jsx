import { useState } from "react";
import Disclaimer from "./Disclaimer";
import { CheckIcon, CopyIcon, DownloadIcon } from "./icons";
import "./ComplaintDraft.css";

/** Serialize the (possibly edited) draft into plain complaint text. */
function serializeDraft(draft) {
  return [
    `Date: ${draft.date}`,
    `To: ${draft.to}`,
    `Subject: ${draft.subject}`,
    "",
    draft.body,
    "",
    "RELEVANT FACTS:",
    ...draft.facts.map((fact, i) => `${i + 1}. ${fact.label}: ${fact.value}`),
    "",
    "EVIDENCE / ATTACHMENTS:",
    ...draft.evidence.map((item, i) => `${i + 1}. ${item}`),
    "",
    "Yours sincerely,",
    draft.signature,
    "",
    `— ${draft.disclaimer}`,
  ].join("\n");
}

/**
 * The structured, fully editable complaint draft:
 * { date, to, subject, body, facts: [{label, value}], evidence: [string],
 *   signature, disclaimer }.
 */
export default function ComplaintDraft({ draft }) {
  const [form, setForm] = useState(draft);
  const [copied, setCopied] = useState(false);

  if (!form) return null;

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function setFactValue(index, value) {
    setForm((prev) => {
      const facts = prev.facts.map((fact, i) =>
        i === index ? { ...fact, value } : fact
      );
      return { ...prev, facts };
    });
  }

  async function copyDraft() {
    const text = serializeDraft(form);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for non-secure contexts.
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  function downloadDraft() {
    const blob = new Blob([serializeDraft(form)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "insaaf-aasan-complaint.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="draft">
      <div className="draft__toolbar">
        <p className="draft__toolbar-hint">
          Every field below is editable — review and adjust before submitting.
        </p>
        <div className="draft__actions">
          <button type="button" className="btn btn--ghost btn--small" onClick={downloadDraft}>
            <DownloadIcon size={16} />
            Download
          </button>
          <button type="button" className="btn btn--primary btn--small" onClick={copyDraft}>
            {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
            {copied ? "Copied" : "Copy draft"}
          </button>
        </div>
      </div>

      <div className="draft__grid">
        <label className="draft__field">
          <span className="draft__label">Date</span>
          <input
            type="text"
            value={form.date}
            onChange={(event) => setField("date", event.target.value)}
          />
        </label>

        <label className="draft__field draft__field--wide">
          <span className="draft__label">To (authority)</span>
          <input
            type="text"
            value={form.to}
            onChange={(event) => setField("to", event.target.value)}
          />
        </label>

        <label className="draft__field draft__field--wide">
          <span className="draft__label">Subject</span>
          <input
            type="text"
            value={form.subject}
            onChange={(event) => setField("subject", event.target.value)}
          />
        </label>

        <label className="draft__field draft__field--wide">
          <span className="draft__label">Body</span>
          <textarea
            rows={9}
            value={form.body}
            onChange={(event) => setField("body", event.target.value)}
          />
        </label>
      </div>

      <fieldset className="draft__section">
        <legend className="draft__section-title">Relevant facts</legend>
        <div className="draft__facts">
          {form.facts.map((fact, index) => (
            <label key={index} className="draft__fact">
              <span className="draft__label">{fact.label}</span>
              <input
                type="text"
                value={fact.value}
                onChange={(event) => setFactValue(index, event.target.value)}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="draft__section">
        <legend className="draft__section-title">Evidence / attachments</legend>
        <p className="draft__section-hint">One item per line.</p>
        <textarea
          className="draft__evidence"
          rows={Math.max(3, form.evidence.length + 1)}
          value={form.evidence.join("\n")}
          onChange={(event) =>
            setField(
              "evidence",
              event.target.value.split("\n").filter((line) => line.trim().length > 0)
            )
          }
        />
      </fieldset>

      <fieldset className="draft__section">
        <legend className="draft__section-title">Signature</legend>
        <textarea
          className="draft__signature"
          rows={4}
          value={form.signature}
          onChange={(event) => setField("signature", event.target.value)}
        />
      </fieldset>

      <Disclaimer variant="plain" />
    </div>
  );
}
