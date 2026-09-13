import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ChatInput from "./ChatInput";
import ChatMessage from "./ChatMessage";
import { AlertIcon, ArrowRightIcon, CheckIcon } from "./icons";
import "./ChatInterface.css";

const WELCOME_MESSAGE =
  "Assalam-o-Alaikum. I am Insaaf Aasan — tell me what happened, in Urdu, Roman Urdu, or English. I will ask a few short questions and then prepare a complaint draft with the relevant laws and next steps.";

/**
 * The conversation surface: message log, composer, live progress, and the
 * completion card that leads to the results page.
 */
export default function ChatInterface({ chat }) {
  const { messages, analysis, status, error, sendMessage, isComplete } = chat;
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const sending = status === "sending";

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const category = analysis && analysis.category ? analysis.category : null;
  const matchedCount = analysis ? analysis.matched_fields.length : 0;
  const totalCount =
    analysis ? analysis.matched_fields.length + analysis.missing_fields.length : 0;
  const showProgress = Boolean(
    category && !isComplete && totalCount > 0 && messages.length > 0
  );

  return (
    <div className="chat-interface">
      <div className="chat-interface__status" aria-live="polite">
        {category && (
          <span className="chat-interface__category">
            Detected issue:{" "}
            <strong>
              {category.label}
              <span className="urdu chat-interface__category-ur">{category.label_ur}</span>
            </strong>
          </span>
        )}
        {showProgress && (
          <span className="chat-interface__progress">
            {matchedCount} of {totalCount} details collected
          </span>
        )}
      </div>

      <div className="chat-interface__log" ref={scrollRef}>
        <div className="chat-interface__stream">
          {messages.length === 0 && !sending && (
            <ChatMessage role="assistant" content={WELCOME_MESSAGE} />
          )}

          {messages.map((message, index) => (
            <ChatMessage key={index} role={message.role} content={message.content} />
          ))}

          {sending && (
            <div className="chat-interface__typing">
              <span className="chat-interface__typing-dot" />
              <span className="chat-interface__typing-dot" />
              <span className="chat-interface__typing-dot" />
            </div>
          )}

          {isComplete && (
            <div className="chat-interface__done fade-up">
              <span className="chat-interface__done-icon" aria-hidden="true">
                <CheckIcon size={20} />
              </span>
              <div className="chat-interface__done-text">
                <strong>All details collected.</strong> Your complaint draft,
                legal references, and next steps are ready.
              </div>
              <button
                type="button"
                className="btn btn--primary btn--small"
                onClick={() => navigate("/results")}
              >
                View results &amp; draft
                <ArrowRightIcon size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="chat-interface__error" role="alert">
          <AlertIcon size={18} />
          <span>{error}</span>
        </div>
      )}

      <ChatInput onSend={sendMessage} disabled={sending || isComplete} />
    </div>
  );
}
