import { InfoIcon } from "./icons";
import "./Disclaimer.css";

/** The exact disclaimer wording required by the spec — do not rephrase. */
export const DISCLAIMER_TEXT =
  "Insaaf Aasan provides general legal information only. It does not constitute legal advice. Always consult a qualified lawyer for your specific situation.";

/**
 * The standing disclaimer, shown on the landing page, in the chat, on the
 * results page, and inside the complaint draft.
 *
 * variant="bar"   — bordered note with icon (pages)
 * variant="plain" — small quiet text (inside the draft card, footer)
 */
export default function Disclaimer({ variant = "bar" }) {
  if (variant === "plain") {
    return <p className="disclaimer disclaimer--plain">{DISCLAIMER_TEXT}</p>;
  }

  return (
    <aside className="disclaimer" role="note" aria-label="Disclaimer">
      <span className="disclaimer__icon" aria-hidden="true">
        <InfoIcon size={18} />
      </span>
      <p>{DISCLAIMER_TEXT}</p>
    </aside>
  );
}
