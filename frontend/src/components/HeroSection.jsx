import { Link } from "react-router-dom";
import legalCategories from "../data/legalCategories";
import { ArrowRightIcon } from "./icons";
import "./HeroSection.css";

/** Decorative scales-of-justice illustration in the brand palette. */
function ScalesIllustration() {
  return (
    <svg
      className="hero-art__scales"
      viewBox="0 0 280 280"
      role="img"
      aria-label="Illustration of the scales of justice"
    >
      <circle cx="140" cy="140" r="132" fill="#E7EDF3" />
      <circle
        cx="140"
        cy="140"
        r="132"
        fill="none"
        stroke="#A9BFCF"
        strokeWidth="1.5"
        opacity="0.65"
      />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M140 74v128" stroke="#3B2A20" strokeWidth="5" />
        <path d="M70 92h140" stroke="#3B2A20" strokeWidth="5" />
        <path d="M112 198h56" stroke="#3B2A20" strokeWidth="5" />
        <path d="M96 210h88" stroke="#3B2A20" strokeWidth="5" />
        <path d="M70 92l-14 34M70 92l14 34" stroke="#4C6B8A" strokeWidth="3.5" />
        <path
          d="M42 126a28 28 0 0 0 56 0"
          stroke="#4C6B8A"
          strokeWidth="5"
          fill="#A9BFCF"
          fillOpacity="0.32"
        />
        <path d="M210 92l-14 34M210 92l14 34" stroke="#4C6B8A" strokeWidth="3.5" />
        <path
          d="M182 126a28 28 0 0 0 56 0"
          stroke="#4C6B8A"
          strokeWidth="5"
          fill="#A9BFCF"
          fillOpacity="0.32"
        />
      </g>
      <circle cx="140" cy="68" r="6.5" fill="#8A6E58" />
    </svg>
  );
}

export default function HeroSection() {
  return (
    <section className="hero">
      <div className="hero__inner container">
        <div className="hero__copy fade-up">
          <p className="hero__eyebrow">
            <span className="urdu">انصاف آسان</span>
            <span className="hero__eyebrow-sep" aria-hidden="true">
              ·
            </span>
            Justice Made Easy
          </p>

          <h1 className="hero__title">
            Justice, <em>explained</em> simply.
          </h1>

          <p className="hero__subtitle">
            Describe your legal problem in your own words — Urdu, Roman Urdu, or
            English. Insaaf Aasan asks the right follow-up questions, points to
            the relevant Pakistani laws in plain language, and prepares a
            complaint draft addressed to the correct authority.
          </p>

          <div className="hero__actions">
            <Link to="/chat" className="btn btn--primary hero__cta">
              Describe what happened
              <ArrowRightIcon size={18} />
            </Link>
          </div>

          <p className="hero__meta">Free · Private · Official government sources only</p>
        </div>

        <div className="hero-art fade-up" aria-hidden="true">
          <ScalesIllustration />
        </div>
      </div>

      <div className="hero__scope">
        <div className="container">
          <p className="hero__scope-label">What Insaaf Aasan can help with today</p>
          <ul className="hero__chips">
            {legalCategories.map((category) => (
              <li key={category.id} className="hero__chip">
                <span className="hero__chip-en">{category.label_en}</span>
                <span className="hero__chip-ur urdu">{category.label_ur}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
