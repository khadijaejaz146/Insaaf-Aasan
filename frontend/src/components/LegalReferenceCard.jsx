import { BookIcon, InfoIcon } from "./icons";
import "./LegalReferenceCard.css";

/** Required qualifier — never present a possible_fact_dependent law as guaranteed. */
const FACT_DEPENDENT_NOTE =
  "This legal reference may apply depending on the specific facts. Please confirm with a qualified lawyer.";

/**
 * One law reference: { section, law_name, certainty: "confirmed" |
 * "possible_fact_dependent", note }. The certainty badge distinguishes
 * confirmed references from those that depend on the specific facts.
 */
export default function LegalReferenceCard({ law }) {
  if (!law) return null;

  const isConfirmed = law.certainty === "confirmed";

  return (
    <article className="legal-ref">
      <div className="legal-ref__head">
        <span className="legal-ref__icon" aria-hidden="true">
          <BookIcon size={18} />
        </span>
        <div className="legal-ref__titles">
          <h3 className="legal-ref__section">{law.section}</h3>
          <p className="legal-ref__law">{law.law_name}</p>
        </div>
        <span
          className={`legal-ref__badge ${isConfirmed ? "legal-ref__badge--confirmed" : "legal-ref__badge--possible"}`}
        >
          {isConfirmed ? "Confirmed reference" : "May apply — depends on facts"}
        </span>
      </div>

      {law.note && <p className="legal-ref__note">{law.note}</p>}

      {!isConfirmed && (
        <p className="legal-ref__qualifier">
          <InfoIcon size={15} />
          <span>{FACT_DEPENDENT_NOTE}</span>
        </p>
      )}
    </article>
  );
}
