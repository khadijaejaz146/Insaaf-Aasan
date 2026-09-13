import { Link, useNavigate } from "react-router-dom";
import ChatInterface from "../components/ChatInterface";
import Disclaimer from "../components/Disclaimer";
import { RefreshIcon } from "../components/icons";
import "./ChatPage.css";

/**
 * The conversation page — its own full-height layout, not a section under a
 * long landing. The user describes the problem in free text; no category
 * pre-selection happens here.
 */
export default function ChatPage({ chat }) {
  const navigate = useNavigate();

  function startOver() {
    chat.reset();
    navigate("/");
  }

  return (
    <div className="chat-page">
      <div className="chat-page__header">
        <div className="chat-page__header-inner container">
          <div>
            <h1 className="chat-page__title">Tell me what happened</h1>
            <p className="chat-page__subtitle">
              Answer the questions in any language — every answer shapes your complaint.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={startOver}
            disabled={chat.messages.length === 0 && !chat.isComplete}
          >
            <RefreshIcon size={15} />
            Start over
          </button>
        </div>
      </div>

      <ChatInterface chat={chat} />

      <div className="chat-page__footer container">
        <Disclaimer />
        <p className="chat-page__home-link">
          <Link to="/">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
