# Insaaf Aasan — انصاف آسان

**AI-powered legal guidance and complaint drafting for Pakistani citizens.**

Insaaf Aasan is a conversational legal assistant that helps users understand their rights and prepare structured complaint drafts under Pakistani law. Users can describe their problem in **Urdu, Roman Urdu, or English**; the assistant asks targeted follow-up questions, classifies the issue into the correct legal category, explains relevant laws in plain language, and generates a ready-to-use complaint draft.

> **Disclaimer:** Insaaf Aasan provides general legal information only. It does not constitute legal advice. Always consult a qualified lawyer for your specific situation.

---

## Project Description

Insaaf Aasan is a full-stack web application built for Pakistan's legal context. It combines a React frontend with an Express backend running a deterministic, rule-based conversation engine. The engine classifies user input into one of eight curated legal categories (theft, fraud, breach of trust, intimidation, harassment, cyberstalking, online scams, and lost property), collects the facts needed for a real complaint, and produces a structured draft with legal references and next steps.

---

## Features

- **Multilingual intake** — Accepts English, Roman Urdu, and Urdu-script input with auto language detection.
- **Confidence-scored classification** — 8 curated legal categories with disambiguation for ambiguous cases.
- **Guided conversation** — Asks only the facts needed for each category; vague replies are re-asked once, "I don't know" is recorded as *Not known*.
- **Structured complaint draft** — Generates a formatted draft with date, authority, subject, body, facts, evidence list, and signature placeholder.
- **Legal references & next steps** — Shows applicable PPC / PECA 2016 sections and practical next steps.
- **Trusted official sources** — Links only to verified Pakistani government sources.
- **Copy draft** — One-click copy of the final complaint text.
- **Dark walnut law-library UI** — Custom single-page design with gold accents and responsive layout.

---

## Legal Categories

| # | Category | Law Reference |
|---|----------|---------------|
| 1 | Theft | PPC §§ 378–382 |
| 2 | Fraud / Cheating | PPC §§ 415, 420 |
| 3 | Criminal Breach of Trust | PPC §§ 405–409 |
| 4 | Criminal Intimidation / Threats | PPC §§ 503, 506 |
| 5 | Harassment | PEHA Act 2010; PPC § 509 |
| 6 | Cyberstalking / Online Harassment | PECA 2016 §§ 20–24 |
| 7 | Online Scam | PECA 2016 § 14; PPC § 420 |
| 8 | Lost Property / Documents | Loss report workflow (FIR only if theft alleged) |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite |
| Styling | Vanilla CSS with custom properties (dark walnut / gold theme) |
| Backend | Node.js + Express |
| Engine | Deterministic rule-based conversation engine (provider-agnostic) |
| Tests | Node.js built-in test runner (`node --test`) |

---

## Project Structure

```
backend/
├── src/
│   ├── data/
│   │   ├── legal_categories.json    # 8 categories, laws, next steps
│   │   └── trusted_sources.json     # verified government sources
│   ├── routes/complaint.js          # /api/analyze, /api/health, /api/categories, /api/sources
│   ├── services/
│   │   ├── classification.js        # conversation engine
│   │   ├── fieldDetectors.js        # required fields + detectors per category
│   │   ├── synonyms.js              # spelling variants, letter-collapse, fuzzy matching
│   │   ├── draftBuilder.js          # structured complaint draft
│   │   ├── legalDb.js               # curated knowledge base access
│   │   ├── aiService.js             # provider selection
│   │   └── providers/
│   │       ├── mock.js              # rule-based engine (default)
│   │       ├── alibaba.js           # stub for future RAG provider
│   │       └── index.js
│   └── server.js
├── test/
│   ├── engine.test.js               # 47 engine + classification tests
│   ├── fallback.test.js             # official-source fallback tests
│   └── relationships.test.js        # relationship extraction tests
└── package.json

frontend/
├── src/
│   ├── App.jsx                      # single-page app with chat modal
│   ├── index.css                    # dark walnut theme
│   ├── main.jsx                     # React entry
│   ├── services/api.js              # API client
│   ├── assets/                      # app-logo.png, lady-justice.png, hero.png
│   ├── components/                  # old reusable components (kept for reference)
│   ├── pages/                       # old page components (kept for reference)
│   ├── hooks/                       # useComplaintAnalysis hook
│   └── data/                        # frontend mirrors of backend data
├── public/
│   ├── favicon.svg
│   └── library-bg.jpg
├── index.html
├── vite.config.js
└── package.json
```

---

## Getting Started

Requires Node.js 18+.

### Backend (port 3001)

```bash
cd backend
npm install
npm run dev        # or: npm start
```

### Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

The Vite dev server proxies `/api` requests to the backend on port 3001.

### Tests

```bash
cd backend
npm test           # 47 tests
```

---

## Environment Variables

Create `backend/.env` from `backend/.env.example`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend port |
| `AI_PROVIDER` | `mock` | `mock` (rule-based) or `alibaba` (stub) |
| `DASHSCOPE_API_KEY` | — | Reserved for future RAG provider |

---

## Deployment

Recommended production layout:

| Service | Platform | Why |
|---------|----------|-----|
| Frontend | Vercel | Fast static hosting, free tier |
| Backend | Oracle Cloud Free Tier / Render / Railway | Long-running Node.js process |
| Database | JSON files (now) → PostgreSQL/Supabase (later) | Keep it simple at first |

### Why separate frontend and backend?

The backend must stay running for the conversation engine and for future WhatsApp Business API webhooks. Vercel is ideal for the static frontend but not for a persistent backend process.

### Free, always-on backend option

**Oracle Cloud Free Tier** gives you 2 always-free Compute VMs that never sleep. This is the best free option if you want fast responses and plan to add WhatsApp integration later.

### Wiring

Set this environment variable in Vercel:

```
VITE_API_URL=https://your-backend-url/api
```

---

## Future Roadmap

- [ ] WhatsApp Business API integration (`POST /webhook`)
- [ ] User accounts and saved drafts
- [ ] Move curated JSON data to PostgreSQL/Supabase
- [ ] RAG-based AI provider (Alibaba Cloud Model Studio)
- [ ] Urdu-script complaint drafts

---

## API

### `POST /api/analyze`

One conversational turn. `conversation` contains only prior messages.

```json
{
  "text": "Mera phone chori ho gaya",
  "language": "auto",
  "conversation": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

When `needs_follow_up` becomes `false`, the response includes a structured `draft`, `next_steps`, and `sources`.

Other endpoints: `GET /api/categories`, `GET /api/sources`, `GET /api/health`.

---

## Test Suite

`backend/test/` contains 47 tests covering classification, intake flows, disambiguation, spelling variants, loss-vs-theft resolution, official-source fallback, and relationship extraction.

---

## Disclaimer

Insaaf Aasan provides general legal information only. It does not constitute legal advice. Always consult a qualified lawyer for your specific situation.

---

## License

MIT
