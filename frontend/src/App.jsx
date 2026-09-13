import { useState, useEffect, useRef } from "react";
import { analyzeMessage } from "./services/api";
import appLogo from "./assets/app-logo.png";
import ladyJustice from "./assets/lady-justice.png";

const PRESETS = [
  { label: "Filing Police FIR (PPC 379)", ask: "How do I file an FIR for property theft in Pakistan?" },
  { label: "Illegal Detention Rights (Art 10)", ask: "What are my rights if police detain me without warrant under Constitution Art 10?" },
  { label: "FIA Cyber Crime Complaint", ask: "How to file a cyber harassment complaint with FIA Cyber Crime Wing?" },
  { label: "Consumer Court Application", ask: "What is the legal process for consumer court fraud?" },
];

const FEATURE_PROMPTS = {
  rights: "What are fundamental rights under Article 8-28 of Pakistan Constitution?",
  steps: "What are the exact steps to register a Police FIR under PPC Section 154?",
  draft: "Draft an official application to the SHO for property theft under PPC 379.",
  language: null, // cycles language, not a chat prompt
};

export default function App() {
  /* ── Logo intro ── */
  const [showIntro, setShowIntro] = useState(true);
  useEffect(() => {
    const t1 = setTimeout(() => setShowIntro(false), 1350);
    return () => clearTimeout(t1);
  }, []);

  /* ── Chat state ── */
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]); // {role:"user"|"assistant", content:string}
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [input, setInput] = useState("");
  const [copiedDraft, setCopiedDraft] = useState(false);
  const bodyRef = useRef(null);

  /* Auto-scroll on new messages */
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, sending]);

  /* ── Send a message to the backend ── */
  const doSend = async (text, currentMessages) => {
    const trimmed = (text || "").trim();
    if (!trimmed || sending) return;

    const priorConversation = (currentMessages || messages).map(
      ({ role, content }) => ({ role, content })
    );

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setError(null);
    setSending(true);

    try {
      const result = await analyzeMessage({
        text: trimmed,
        language: "auto",
        conversation: priorConversation,
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.message, result },
      ]);
    } catch (err) {
      // Remove the optimistic user message
      setMessages((prev) => prev.slice(0, -1));
      setError(
        err && err.message
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSending(false);
    }
  };

  /* ── Open / close chat ── */
  const openChat = (initialQuery) => {
    setChatOpen(true);
    setError(null);
    if (initialQuery) {
      doSend(initialQuery, []);
    }
  };

  const closeChat = () => {
    setChatOpen(false);
  };

  /* ── Form submit ── */
  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    doSend(text);
  };

  /* ── Convert structured draft to plain text ── */
  const draftToText = (draft) => {
    if (!draft) return "";
    if (typeof draft === "string") return draft;
    const lines = [
      `Date: ${draft.date || ""}`,
      `To: ${draft.to || ""}`,
      `Subject: ${draft.subject || ""}`,
      "",
      draft.body || "",
      "",
    ];
    if (draft.facts && draft.facts.length > 0) {
      lines.push("RELEVANT FACTS:");
      draft.facts.forEach((f, i) => lines.push(`${i + 1}. ${f.label}: ${f.value}`));
      lines.push("");
    }
    if (draft.evidence && draft.evidence.length > 0) {
      lines.push("EVIDENCE / ATTACHMENTS:");
      draft.evidence.forEach((e, i) => lines.push(`${i + 1}. ${e}`));
      lines.push("");
    }
    lines.push("Yours sincerely,");
    lines.push(draft.signature || "");
    if (draft.disclaimer) {
      lines.push("");
      lines.push(`— ${draft.disclaimer}`);
    }
    return lines.join("\n");
  };

  /* ── Copy draft to clipboard ── */
  const handleCopyDraft = async (draft) => {
    try {
      await navigator.clipboard.writeText(draftToText(draft));
      setCopiedDraft(true);
      setTimeout(() => setCopiedDraft(false), 2000);
    } catch {
      /* clipboard API not available */
    }
  };

  /* ── Start new complaint ── */
  const handleReset = () => {
    setMessages([]);
    setError(null);
  };

  /* ── Feature-card click ── */
  const handleFeatureClick = (topic) => {
    const prompt = FEATURE_PROMPTS[topic];
    if (prompt) {
      if (!chatOpen) {
        openChat(prompt);
      } else {
        doSend(prompt);
      }
    }
  };

  return (
    <>
      {/* ══════ Logo Splash Intro ══════ */}
      {showIntro && (
        <div className="logo-intro active" aria-hidden="true">
          <div className="logo-intro__content">
            <div className="logo-intro__icon">
              <img src={appLogo} alt="INSAAF AASAN Logo" className="logo-intro__img" />
            </div>
            <div className="logo-intro__title">INSAAF AASAN</div>
            <div className="logo-intro__tagline">Aapka Haq, Aapki Awaz</div>
          </div>
        </div>
      )}

      {/* ══════ Landing Page ══════ */}
      <div className="landing" id="landing">
        {/* NAVBAR */}
        <header className="navbar" id="navbar">
          <div className="navbar__brand">
            <div className="navbar__logo" aria-label="INSAAF AASAN Logo">
              <img
                src={appLogo}
                alt="INSAAF AASAN Logo — Golden Scales of Justice with Laurel Wreath"
                className="navbar__logo-img"
              />
            </div>
            <div className="navbar__titles">
              <div className="navbar__name">
                <span className="navbar__name-insaaf">INSAAF</span>
                <span className="navbar__name-aasan">AASAN</span>
              </div>
              <span className="navbar__tagline">Aapka Haq, Aapki Awaz</span>
            </div>
          </div>
        </header>

        {/* HERO SECTION */}
        <main className="hero-section">
          <div className="hero-container">
            {/* LEFT COLUMN */}
            <div className="hero-left">
              <div className="hero-label anim-fade-up anim-d1">
                <span className="hero-label__icon">⚖</span>
                <span className="hero-label__line" />
                <span className="hero-label__text">AI LEGAL ASSISTANT</span>
                <span className="hero-label__line" />
              </div>

              <h1 className="hero-heading anim-fade-up anim-d2">
                <span className="hero-heading__line">YOUR RIGHT.</span>
                <span className="hero-heading__line">YOUR VOICE.</span>
                <span className="hero-heading__line hero-heading__line--bold">
                  OUR GUIDANCE.
                </span>
              </h1>

              <p className="hero-description anim-fade-up anim-d3">
                Get simple legal guidance, know your rights, and prepare your
                complaint with ease.
              </p>

              {/* PRIMARY CTA BUTTON */}
              <div className="hero-cta anim-fade-up anim-d4">
                <button className="cta-btn" onClick={() => openChat()}>
                  <span className="cta-btn__icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </span>
                  <span className="cta-btn__content">
                    <span className="cta-btn__title">Start Your Legal Assistant</span>
                    <span className="cta-btn__sub">
                      Let's solve your legal problem together.
                    </span>
                  </span>
                  <span className="cta-btn__arrow">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </span>
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: LEGAL VISUAL CARD */}
            <div className="hero-right anim-fade-in anim-d3">
              <div className="visual-card">
                <img
                  src={ladyJustice}
                  alt="Lady Justice artwork with scales, sword, Constitution of Pakistan, PPC, and gavel on a wooden desk"
                  className="visual-card__image"
                />
                <div className="visual-card__overlay" />
                <div className="visual-card__badge">
                  <span className="badge-urdu" lang="ur">انصاف آسان</span>
                  <span className="badge-en">Aapka Haq, Aapki Awaz</span>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* FEATURE CARDS */}
        <section className="features-section" aria-label="Key features">
          <div className="features-grid">
            <div
              className="feature-card anim-fade-up anim-d4"
              data-topic="rights"
              onClick={() => handleFeatureClick("rights")}
            >
              <div className="feature-card__icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.8">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M9 15l2 2 4-4" />
                </svg>
              </div>
              <div className="feature-card__content">
                <span className="feature-card__number">01</span>
                <h3 className="feature-card__title">KNOW YOUR RIGHTS</h3>
                <p className="feature-card__desc">
                  Understand relevant laws for your situation.
                </p>
              </div>
            </div>

            <div
              className="feature-card anim-fade-up anim-d5"
              data-topic="steps"
              onClick={() => handleFeatureClick("steps")}
            >
              <div className="feature-card__icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.8">
                  <path d="M3 21h18" />
                  <path d="M5 21V7l7-4 7 4v14" />
                  <path d="M9 21v-6h6v6" />
                </svg>
              </div>
              <div className="feature-card__content">
                <span className="feature-card__number">02</span>
                <h3 className="feature-card__title">STEP-BY-STEP GUIDANCE</h3>
                <p className="feature-card__desc">
                  Learn the right legal steps to take.
                </p>
              </div>
            </div>

            <div
              className="feature-card anim-fade-up anim-d6"
              data-topic="draft"
              onClick={() => handleFeatureClick("draft")}
            >
              <div className="feature-card__icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.8">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <div className="feature-card__content">
                <span className="feature-card__number">03</span>
                <h3 className="feature-card__title">PREPARE COMPLAINTS</h3>
                <p className="feature-card__desc">
                  Get help drafting a clear and effective complaint.
                </p>
              </div>
            </div>

            <div className="feature-card anim-fade-up anim-d7" data-topic="language">
              <div className="feature-card__icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.8">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </div>
              <div className="feature-card__content">
                <span className="feature-card__number">04</span>
                <h3 className="feature-card__title">IN YOUR LANGUAGE</h3>
                <p className="feature-card__desc">
                  Urdu, Roman Urdu, or English — your choice.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* BOTTOM TRUST BAR */}
        <footer className="trust-bar">
          <div className="trust-bar__inner">
            <div className="trust-item">
              <span className="trust-item__icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </span>
              <div className="trust-item__text">
                <strong>Trusted Guidance</strong>
                <span>Reliable legal information</span>
              </div>
            </div>
            <div className="trust-divider" />
            <div className="trust-item">
              <span className="trust-item__icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <div className="trust-item__text">
                <strong>Private &amp; Secure</strong>
                <span>Your information is safe</span>
              </div>
            </div>
            <div className="trust-divider" />
            <div className="trust-item">
              <span className="trust-item__icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
              <div className="trust-item__text">
                <strong>For Everyone</strong>
                <span>Simple. Accessible. Helpful.</span>
              </div>
            </div>
            <div className="trust-divider" />
            <div className="trust-item">
              <span className="trust-item__icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
              </span>
              <div className="trust-item__text">
                <strong>Made for Pakistan</strong>
                <span>Understanding our laws</span>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* ══════ Chatbot Modal ══════ */}
      <div
        className={`chat-modal${chatOpen ? " open" : ""}`}
        aria-hidden={!chatOpen}
      >
        <div className="chat-modal__backdrop" onClick={closeChat} />
        <div className="chat-modal__content">
          <header className="chat-modal__header">
            <div className="chat-modal__title">
              <span className="chat-header-icon">⚖️</span>
              <div>
                <h3>INSAAF AASAN Legal Assistant</h3>
                <span className="chat-header-sub">
                  Pakistan Penal Code &amp; Constitution Guidance
                </span>
              </div>
            </div>
            <button
              className="chat-modal__close"
              onClick={closeChat}
              aria-label="Close Chat"
            >
              &times;
            </button>
          </header>

          <div className="chat-modal__body" ref={bodyRef}>
            {/* Welcome message — shown when no conversation yet */}
            {messages.length === 0 && !sending && (
              <div className="chat-msg chat-msg--bot">
                <div className="chat-avatar">⚖️</div>
                <div className="chat-bubble">
                  <p><strong>Assalam-o-Alaikum! / Welcome.</strong></p>
                  <p>
                    I am your AI Legal Assistant. How can I help you understand
                    your rights or draft a complaint today?
                  </p>
                  <div className="chat-presets">
                    {PRESETS.map((p) => (
                      <button
                        key={p.label}
                        className="preset-btn"
                        onClick={() => doSend(p.ask)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Conversation messages */}
            {messages.map((msg, i) => (
              <div key={i}>
                <div
                  className={`chat-msg chat-msg--${msg.role === "user" ? "user" : "bot"}`}
                >
                  <div className="chat-avatar">
                    {msg.role === "user" ? "👤" : "⚖️"}
                  </div>
                  <div className="chat-bubble">{msg.content}</div>
                </div>
                {/* Results panel — shown when intake is complete */}
                {msg.role === "assistant" && msg.result && msg.result.needs_follow_up === false && (
                  <div className="results-panel">
                    {msg.result.draft && (
                      <div className="results-section">
                        <div className="results-section__header">
                          <span className="results-section__icon">📝</span>
                          <h4>Complaint Draft</h4>
                        </div>
                        <div className="results-draft">
                          {msg.result.draft.date && <p className="draft-line"><strong>Date:</strong> {msg.result.draft.date}</p>}
                          {msg.result.draft.to && <p className="draft-line"><strong>To:</strong> {msg.result.draft.to}</p>}
                          {msg.result.draft.subject && <p className="draft-line"><strong>Subject:</strong> {msg.result.draft.subject}</p>}
                          {msg.result.draft.body && <p className="draft-body">{msg.result.draft.body}</p>}
                          {msg.result.draft.facts && msg.result.draft.facts.length > 0 && (
                            <div className="draft-facts">
                              <strong>Relevant Facts:</strong>
                              <ol>{msg.result.draft.facts.map((f, j) => (
                                <li key={j}><strong>{f.label}:</strong> {f.value}</li>
                              ))}</ol>
                            </div>
                          )}
                          {msg.result.draft.evidence && msg.result.draft.evidence.length > 0 && (
                            <div className="draft-facts">
                              <strong>Evidence / Attachments:</strong>
                              <ol>{msg.result.draft.evidence.map((e, j) => (
                                <li key={j}>{e}</li>
                              ))}</ol>
                            </div>
                          )}
                          {msg.result.draft.signature && <p className="draft-signature">{msg.result.draft.signature}</p>}
                          {msg.result.draft.disclaimer && <p className="draft-disclaimer">{msg.result.draft.disclaimer}</p>}
                        </div>
                      </div>
                    )}
                    {msg.result.legal_references && msg.result.legal_references.length > 0 && (
                      <div className="results-section">
                        <div className="results-section__header">
                          <span className="results-section__icon">📜</span>
                          <h4>Legal References</h4>
                        </div>
                        <ul className="results-list">
                          {msg.result.legal_references.map((ref, j) => (
                            <li key={j}>{typeof ref === "string" ? ref : `${ref.section} — ${ref.law_name}`}{ref.note ? ` (${ref.note})` : ""}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {msg.result.next_steps && msg.result.next_steps.length > 0 && (
                      <div className="results-section">
                        <div className="results-section__header">
                          <span className="results-section__icon">✅</span>
                          <h4>Next Steps</h4>
                        </div>
                        <ol className="results-list results-list--ordered">
                          {msg.result.next_steps.map((step, j) => (
                            <li key={j}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {msg.result.sources && msg.result.sources.length > 0 && (
                      <div className="results-section">
                        <div className="results-section__header">
                          <span className="results-section__icon">🔗</span>
                          <h4>Official Sources</h4>
                        </div>
                        <ul className="results-list">
                          {msg.result.sources.map((src, j) => (
                            <li key={j}>
                              {src.url ? (
                                <a href={src.url} target="_blank" rel="noopener noreferrer" className="results-source-link">{src.name}</a>
                              ) : src.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* Action buttons */}
                    <div className="results-actions">
                      {msg.result.draft && (
                        <button className="results-btn" onClick={() => handleCopyDraft(msg.result.draft)}>
                          {copiedDraft ? "✓ Copied!" : "📋 Copy Draft"}
                        </button>
                      )}
                      <button className="results-btn" onClick={handleReset}>
                        🔄 Start New Complaint
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {sending && (
              <div className="chat-msg chat-msg--bot">
                <div className="chat-avatar">⚖️</div>
                <div className="chat-bubble">
                  <div className="typing-indicator">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}

            {/* Error banner */}
            {error && <div className="chat-error">{error}</div>}
          </div>

          <footer className="chat-modal__footer">
            <form className="chat-form" onSubmit={handleSubmit}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask your legal question in English, Urdu, or Roman Urdu..."
                disabled={sending}
              />
              <button type="submit" className="chat-send-btn" disabled={sending || !input.trim()}>
                <span>Send</span>
                <span className="btn-arrow">→</span>
              </button>
            </form>
          </footer>
        </div>
      </div>
    </>
  );
}
