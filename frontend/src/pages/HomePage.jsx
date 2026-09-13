import { Link } from "react-router-dom";
import { ChatIcon, ArrowRightIcon } from "../components/icons";
import BrandLogo from "../components/BrandLogo";
import justiceImg from "../assets/lady-justice.png";
import "./HomePage.css";

/* ------------------------------------------------------------------ */
/* Inline SVG icons (scoped to the splash page — icons.jsx untouched)  */
/* ------------------------------------------------------------------ */

function DocShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M12 18v-4" />
      <path d="M12 10a2 2 0 1 0 0 4" />
    </svg>
  );
}

function StepsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-4h6v4" />
      <path d="M9 10h.01M15 10h.01M9 14h.01M15 14h.01" />
    </svg>
  );
}

function PenDocIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8M16 17H8M10 9H8" />
      <path d="M20.5 16.5l-3 3-1.5.5.5-1.5 3-3 1 1z" />
    </svg>
  );
}

function LangBubbleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 9h2M9 9v5M13 14h2" />
      <path d="M12 9c.5 1.5 1 3 2 5" />
    </svg>
  );
}

function ShieldTickIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CrescentIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
      <path d="M17 8l1.5 1-1.5 1M19 12l-1.5 1 1.5 1" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Feature and trust data                                              */
/* ------------------------------------------------------------------ */

const FEATURES = [
  { Icon: DocShieldIcon, title: "Know Your Rights", desc: "Understand relevant laws for your situation." },
  { Icon: StepsIcon, title: "Step-by-Step Guidance", desc: "Learn the right legal steps to take." },
  { Icon: PenDocIcon, title: "Prepare Complaints", desc: "Get help drafting a clear and effective complaint." },
  { Icon: LangBubbleIcon, title: "In Your Language", desc: "Urdu, Roman Urdu, or English — your choice." },
];

const TRUST = [
  { Icon: ShieldTickIcon, title: "Trusted Guidance", desc: "Reliable legal information" },
  { Icon: LockIcon, title: "Private & Secure", desc: "Your information is safe" },
  { Icon: UsersIcon, title: "For Everyone", desc: "Simple. Accessible. Helpful." },
  { Icon: CrescentIcon, title: "Made for Pakistan", desc: "Understanding our laws" },
];

/* ------------------------------------------------------------------ */
/* Splash page                                                         */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  return (
    <div className="splash">
      {/* ---- Header ---- */}
      <header className="splash__header fade-up">
        <div className="splash__brand">
          <BrandLogo className="splash__logo" />
          <div>
            <p className="splash__brand-name">
              <span>INSA<span className="splash__af">AF</span></span>
              <span>AASAN</span>
            </p>
            <p className="splash__brand-urdu">
              <span className="urdu">انصاف آسان</span>
              <span className="splash__brand-tagline">Aapka Haq, Aapki Awaz</span>
            </p>
          </div>
        </div>

        <button type="button" className="splash__lang" aria-label="Select language">
          <span aria-hidden="true">🌐</span> <span className="urdu">اردو</span> <span aria-hidden="true">⌄</span>
        </button>
      </header>

      {/* ---- Hero body ---- */}
      <div className="splash__body">
        <div className="splash__hero">
          <div className="splash__label fade-up" style={{ animationDelay: "0.08s" }}>
            <span className="splash__label-line" aria-hidden="true" />
            <span>⚖&ensp;AI LEGAL ASSISTANT</span>
            <span className="splash__label-line" aria-hidden="true" />
          </div>

          <h1 className="splash__heading fade-up" style={{ animationDelay: "0.18s" }}>
            Your Right.
            <br />
            Your Voice.
            <br />
            <span className="splash__heading-accent">Our Guidance.</span>
          </h1>

          <p className="splash__subtitle fade-up" style={{ animationDelay: "0.28s" }}>
            Get simple legal guidance, know your rights,
            <br className="splash__subtitle-br" />
            and prepare your complaint with ease.
          </p>

          <div className="splash__cta-wrap fade-up" style={{ animationDelay: "0.38s" }}>
            <Link to="/chat" className="splash__cta">
              <ChatIcon size={18} />
              <span>Start Your Legal Assistant</span>
              <ArrowRightIcon size={18} className="splash__cta-arrow" />
            </Link>
            <p className="splash__cta-sub">Let's solve your legal problem together.</p>
          </div>
        </div>

        <div className="splash__visual fade-up" style={{ animationDelay: "0.2s" }}>
          <div className="splash__visual-frame">
            <img
              src={justiceImg}
              alt="Lady Justice holding scales of justice in a traditional law office"
              className="splash__visual-img"
              width={520}
              height={520}
            />
          </div>
        </div>
      </div>

      {/* ---- Feature cards ---- */}
      <section className="splash__features" aria-label="What Insaaf Aasan offers">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className="splash__card fade-up"
            style={{ animationDelay: `${0.42 + i * 0.07}s` }}
          >
            <span className="splash__card-icon" aria-hidden="true">
              <f.Icon />
            </span>
            <div className="splash__card-content">
              <h3 className="splash__card-title">{f.title}</h3>
              <p className="splash__card-desc">{f.desc}</p>
            </div>
            <div className="splash__card-accent" aria-hidden="true" />
          </div>
        ))}
      </section>

      {/* ---- Trust strip ---- */}
      <div className="splash__trust">
        {TRUST.map((t) => (
          <div key={t.title} className="splash__trust-item">
            <span className="splash__trust-icon" aria-hidden="true">
              <t.Icon />
            </span>
            <div>
              <strong className="splash__trust-title">{t.title}</strong>
              <span className="splash__trust-desc">{t.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
