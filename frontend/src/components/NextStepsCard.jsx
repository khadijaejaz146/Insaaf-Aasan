import "./NextStepsCard.css";

/**
 * Numbered, ordered next steps — the order matters, so it is an <ol>.
 */
export default function NextStepsCard({ steps }) {
  if (!steps || steps.length === 0) return null;

  return (
    <ol className="next-steps">
      {steps.map((step, index) => (
        <li key={index} className="next-steps__item">
          <span className="next-steps__number" aria-hidden="true">
            {index + 1}
          </span>
          <p className="next-steps__text">{step}</p>
        </li>
      ))}
    </ol>
  );
}
