# Insaaf Aasan — Frontend

React 19 + Vite SPA for the Insaaf Aasan legal complaint assistant.

- **Design system** in `src/index.css` — parchment surface (`#F7F3EC`), chambray
  primary (`#4C6B8A`), espresso headings (`#3B2A20`), sage success, terracotta
  error; Fraunces (headings), Inter (body), Noto Nastaliq Urdu (Urdu script).
- **Pages**: `HomePage` (one-viewport landing), `ChatPage` (the conversation),
  `ResultsPage` (issue → legal references → explanation → authority → next
  steps → editable draft → trusted sources).
- **Conversation state** lives in `App.jsx` via `useComplaintAnalysis`, which
  drives `POST /api/analyze` (prior messages as `conversation`, the latest
  message as `text`). The backend replays the whole intake from history.
- Urdu-script messages render RTL automatically (`ChatMessage`).

## Run

```bash
npm install
npm run dev      # Vite dev server; proxies /api → http://localhost:3001
npm run build    # production build
npm run lint     # oxlint
```

Start the backend first (see `../backend`), then open the printed dev URL.
