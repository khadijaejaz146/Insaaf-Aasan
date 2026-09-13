import { ScaleIcon } from "./icons";
import "./ChatMessage.css";

const URDU_SCRIPT_RE = /[\u0600-\u06FF]/;

/**
 * One bubble in the conversation.
 * Urdu-script content automatically renders RTL in Noto Nastaliq Urdu.
 */
export default function ChatMessage({ role, content }) {
  const isUser = role === "user";
  const isUrdu = URDU_SCRIPT_RE.test(content || "");

  return (
    <div className={`chat-message chat-message--${isUser ? "user" : "assistant"}`}>
      {!isUser && (
        <span className="chat-message__avatar" aria-hidden="true">
          <ScaleIcon size={16} />
        </span>
      )}
      <div
        className={`chat-message__bubble${isUrdu ? " urdu" : ""}`}
        dir={isUrdu ? "rtl" : "auto"}
        lang={isUrdu ? "ur" : undefined}
      >
        {content}
      </div>
    </div>
  );
}
