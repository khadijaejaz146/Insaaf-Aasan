import { useEffect, useRef, useState } from "react";
import { SendIcon } from "./icons";
import "./ChatInput.css";

const MAX_LENGTH = 1200;

/**
 * The message composer. Placeholder is "Describe what happened..." — no
 * category pre-selection, no language selector: the engine detects language
 * automatically. The textarea direction follows the text being typed.
 */
export default function ChatInput({ onSend, disabled = false }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);

  // Auto-grow the textarea up to a comfortable maximum.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <form
      className="chat-input"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="chat-input__row">
        <label htmlFor="chat-input__field" className="visually-hidden">
          Describe what happened
        </label>
        <textarea
          id="chat-input__field"
          ref={textareaRef}
          className="chat-input__field"
          dir="auto"
          rows={1}
          maxLength={MAX_LENGTH}
          placeholder="Describe what happened..."
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <button
          type="submit"
          className="chat-input__send"
          disabled={!canSend}
          aria-label="Send message"
        >
          {disabled ? <span className="chat-input__spinner" aria-hidden="true" /> : <SendIcon size={18} />}
        </button>
      </div>
      <p className="chat-input__hint">
        Enter to send · Shift + Enter for a new line · Urdu, Roman Urdu, or English
      </p>
    </form>
  );
}
