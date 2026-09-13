import { Link, useNavigate } from "react-router-dom";
import ComplaintDraft from "../components/ComplaintDraft";
import Disclaimer from "../components/Disclaimer";
import LegalReferenceCard from "../components/LegalReferenceCard";
import NextStepsCard from "../components/NextStepsCard";
import {
  AlertIcon,
  BuildingIcon,
  CategoryIcon,
  ChatIcon,
  ExternalIcon,
  RefreshIcon,
} from "../components/icons";
import "./ResultsPage.css";

/**
 * The results page, in the exact order required by the spec:
 *   1. Detected issue (+ confidence note when not high)
 *   2. Legal references (with qualifier badges for possible_fact_dependent)
 *   3. Plain-language explanation
 *   4. Authority — where to complain
 *   5. Numbered next steps
 *   6. Editable complaint draft
 *   7. Trusted official source links
 */
export default function ResultsPage({ chat }) {
  const navigate = useNavigate();
  const analysis = chat.analysis;
  const ready = Boolean(analysis && analysis.needs_follow_up === false && analysis.draft);

  if (!ready) {
    const inProgress = Boolean(analysis);
    return (
      <div className="results-page results-page--empty">
        <div className="container">
          <div className="results-empty card fade-up">
            <h1 className="results-empty__title">
              {inProgress ? "Your complaint is still in progress" : "Nothing to show yet"}
            </h1>
            <p className="results-empty__text">
              {inProgress
                ? "The conversation needs a few more details before the draft and legal references can be prepared."
                : "Describe your problem in the chat first — the results and complaint draft will be prepared for you there."}
            </p>
            <Link to="/chat" className="btn btn--primary">
              <ChatIcon size={18} />
              {inProgress ? "Continue the conversation" : "Start describing your problem"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { category, confidence, legal_references, explanation, authority, next_steps, draft, sources } =
    analysis;
  const showConfidenceNote = confidence !== "high";

  function startNewComplaint() {
    chat.reset();
    navigate("/chat");
  }

  return (
    <div className="results-page">
      <div className="container results-page__inner">
        {/* 1 — Detected issue */}
        <header className="results-header card fade-up">
          <div className="results-header__main">
            <span className="results-header__icon" aria-hidden="true">
              <CategoryIcon name={category.icon} size={26} />
            </span>
            <div>
              <p className="results-header__eyebrow">Detected issue</p>
              <h1 className="results-header__title">
                {category.label}
                <span className="urdu results-header__title-ur">{category.label_ur}</span>
              </h1>
              <p className="results-header__roman">{category.label_roman}</p>
            </div>
          </div>

          {showConfidenceNote && (
            <p className="results-header__confidence" role="note">
              <AlertIcon size={17} />
              <span>
                We are only moderately confident about this category. Please review
                whether it matches your situation — your own words in the draft
                matter most.
              </span>
            </p>
          )}
        </header>

        <Disclaimer />

        {/* 2 — Legal references */}
        <section className="results-section" aria-labelledby="results-laws">
          <h2 id="results-laws" className="results-section__title">
            Legal references
          </h2>
          <div className="results-section__stack">
            {legal_references.map((law, index) => (
              <LegalReferenceCard key={index} law={law} />
            ))}
          </div>
        </section>

        {/* 3 — Plain-language explanation */}
        <section className="results-section" aria-labelledby="results-explanation">
          <h2 id="results-explanation" className="results-section__title">
            In plain language
          </h2>
          <p className="results-explanation card">{explanation}</p>
        </section>

        {/* 4 — Authority */}
        <section className="results-section" aria-labelledby="results-authority">
          <h2 id="results-authority" className="results-section__title">
            Where to complain
          </h2>
          <div className="results-authority card">
            <span className="results-authority__icon" aria-hidden="true">
              <BuildingIcon size={22} />
            </span>
            <p className="results-authority__text">{authority}</p>
          </div>
        </section>

        {/* 5 — Next steps */}
        <section className="results-section" aria-labelledby="results-steps">
          <h2 id="results-steps" className="results-section__title">
            Your next steps
          </h2>
          <NextStepsCard steps={next_steps} />
        </section>

        {/* 6 — Editable draft */}
        <section className="results-section" aria-labelledby="results-draft">
          <h2 id="results-draft" className="results-section__title">
            Your complaint draft
          </h2>
          {/* key=draft: a new finalized intake remounts the editor with fresh values */}
          <ComplaintDraft key={draft} draft={draft} />
        </section>

        {/* 7 — Trusted sources */}
        <section className="results-section" aria-labelledby="results-sources">
          <h2 id="results-sources" className="results-section__title">
            Trusted official sources
          </h2>
          <ul className="results-sources">
            {sources.map((source) => (
              <li key={source.id} className="results-source card">
                <div className="results-source__head">
                  <a
                    className="results-source__name"
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.name}
                    <ExternalIcon size={14} />
                  </a>
                  <span className="results-source__badge">
                    {source.source_type === "government" ? "Official government source" : source.source_type}
                  </span>
                </div>
                <p className="results-source__description">{source.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <div className="results-actions">
          <Link to="/chat" className="btn btn--ghost">
            <ChatIcon size={17} />
            Back to conversation
          </Link>
          <button type="button" className="btn btn--primary" onClick={startNewComplaint}>
            <RefreshIcon size={17} />
            Start a new complaint
          </button>
        </div>
      </div>
    </div>
  );
}
