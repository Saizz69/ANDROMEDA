# Family Misinformation Decoder

**Check before you forward.**

A browser extension that lets anyone right-click a suspicious image, screenshot, or claim on
any webpage and get a plain-language explanation of whether it's been manipulated or is a
known hoax — built for people who are usually left out of digital-literacy tooling: parents,
grandparents, and first-time internet users who get targeted by morphed images, fake health
cures, and deepfaked videos on family WhatsApp/Telegram groups.

No accounts. No jargon. No confidence scores. Just an honest, respectful answer.

---

## The problem

Existing fact-checking tools (InVID-WeVerify, professional tiplines like Meedan Check) are
built for journalists and fact-checkers — dense, technical, and assuming domain expertise.
Nobody has built the equivalent for the person actually forwarding the hoax: someone who
isn't trying to spread misinformation, just doesn't have an easy way to check it first.

## What it does

- **Right-click any image or text on any webpage** → "Check this" → plain-language verdict
- **Reverse image search** to find where an image actually came from
- **Deepfake/manipulation detection** on images and video frames
- **Curated hoax database** of recurring misinformation (health cures, fake government
  notices, recycled disaster photos) — with a "this has been circulating since [date]" timeline
- **Persuasion-technique callouts** — names *why* a message is convincing (false urgency, fake
  authority, fake social proof), not just whether it's true
- **Shareable correction card** — a clean, forwardable image so the correction spreads as
  easily as the original hoax did
- **Honest uncertainty** — when something can't be confirmed, it says so and suggests one
  concrete way to check further, rather than guessing

## What it deliberately doesn't do

- No confidence percentages or technical scores shown to the user
- No shaming or condescending language, ever
- No login, signup, or account requirement
- No voice/audio input in this version (out of scope for the current build)

---

## Architecture

Three subsystems, connected by a simple JSON handoff contract:

```
User right-clicks content
        │
        ▼
┌─────────────────────────┐
│ Subsystem 1              │   Browser extension (Manifest V3)
│ Interface & Ingestion     │   Context menu, popup, content script
└─────────────┬─────────────┘
              │ normalized payload
              ▼
┌─────────────────────────┐
│ Subsystem 2               │   Reverse image search, deepfake check,
│ Detection Engine           │   curated DB match, manipulation tagging
└─────────────┬─────────────┘
              │ verdict JSON
              ▼
┌─────────────────────────┐
│ Subsystem 3               │   Grounded LLM explanation,
│ Response Generation        │   correction-card generator
└─────────────┬─────────────┘
              │
              ▼
     Result shown in extension popup
```

**Payload contract (Subsystem 1 → 2):**
```json
{
  "content_type": "image | text",
  "raw_content": "...",
  "extracted_text": "...",
  "language": "...",
  "timestamp": "..."
}
```

**Verdict contract (Subsystem 2 → 3):**
```json
{
  "verdict": "false | unverified | true",
  "matched_claim": "... or null",
  "first_seen_date": "... or null",
  "manipulation_tags": ["..."],
  "sources": ["..."],
  "confidence_note": "plain-language, not a number"
}
```

---

## Tech stack

| Layer | Choice |
|---|---|
| Extension | Manifest V3, vanilla JS/HTML for popup |
| Backend | Python, FastAPI |
| Reverse image search | Google Cloud Vision — Web Detection API |
| Deepfake detection | [Arman176001/deepfake-detection](https://github.com/Arman176001/deepfake-detection) (XceptionNet on FaceForensics++, run as-is) |
| Claim matching | In-memory embedding similarity over the curated DB |
| LLM (explanation + tagging) | OpenAI-compatible endpoint via Featherless (or similar open-model provider) |
| Correction card rendering | HTML template rendered to image (Playwright or PIL) |

## Prior art / acknowledgments

- [meedan/check](https://github.com/meedan/check) — production fact-checking tipline platform
  used by BOOM and Alt News in India. Referenced for claim-similarity and fact-check-report
  patterns; not deployed directly (too large for this build's scope).
- [AFP-Medialab/verification-plugin](https://github.com/AFP-Medialab/verification-plugin)
  (InVID-WeVerify) — referenced for browser-extension context-menu mechanics only; built for
  professional fact-checkers, so this project intentionally uses a much simpler interface.
- [Arman176001/deepfake-detection](https://github.com/Arman176001/deepfake-detection) —
  deepfake classifier used directly as a backend microservice.

---

## Project Structure

```
├── manifest.json              → Manifest V3 browser extension configuration
├── background/                → Background Service Worker & Multi-Tier Fact Engine
│   ├── background.js          → Chrome runtime listeners, context menus, and dispatchers
│   └── fact-engine.js         → Andromeda Local API, Featherless AI LLM, Google Fact Check, offline DB
├── content/                   → Content scripts for live overlay badges & card popups
│   ├── content.js             → Live DOM scanner and mutation observer
│   ├── scanner.js             → Message and article parser
│   └── badge-ui.js            → Isolated Shadow DOM traffic-light badge controllers
├── popup/                     → Extension toolbar popup control panel
├── options/                   → Extension settings & API key management
├── web/                       → Web Companion App (FastAPI templates & static assets)
│   ├── templates/index.html   → Accessible web companion UI
│   └── static/                → Modern CSS design system and client JS
├── subsystem1_ingestion/      → Ingestion adapters (Text, OCR for images, ASR for voice)
├── subsystem2_detection/      → Detection Engine (Curated DB matching, Deepfake forensics, Tavily search)
├── subsystem3_response/       → Response Generator (Grounded LLM explanations & Pillow correction cards)
├── database/hoaxes.json       → Curated database of recurring hoaxes & persuasion patterns
├── test/                      → Interactive feed demo & playground suite
├── tests/                     → Pytest unit and end-to-end integration tests
├── main.py                    → FastAPI application entry point with CORS & demo routing
└── config.py                  → System configuration and API credentials
```

## Getting Started

### 1. Run the Backend & Web Companion
```bash
# 1. Install dependencies
pip install -r requirements.txt  # (fastapi, uvicorn, pillow, httpx, python-dotenv, etc.)

# 2. Configure environment (optional: add Featherless/Tavily keys)
cp .env.example .env

# 3. Start the FastAPI server
uvicorn main:app --reload --port 8000
```

- **Web Companion App:** Open [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive Feed Demo:** Open [http://127.0.0.1:8000/demo](http://127.0.0.1:8000/demo)
- **FastAPI Interactive Docs:** Open [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 2. Load the Browser Extension
1. Open Google Chrome, Brave, or Microsoft Edge and navigate to `chrome://extensions` (or `edge://extensions`).
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select this repository folder (`ANDROMEDA`).
4. TruthScan will now be active on web pages and chat platforms!

### 3. Run Automated Tests
```bash
pytest -v
```

---

## Demo script (suggested)

1. Right-click a known hoax image (seeded in `hoax_database.json`) → show the plain-language
   verdict, the persuasion-technique callout, and the correction card
2. Right-click an ambiguous/unmatched claim → show the honest "can't confirm, here's how to
   check" response
3. Point out what makes this different from InVID-WeVerify (built for journalists) and
   Meedan Check (backend infra for newsroom tiplines) — this is the first version aimed at
   the person about to hit "forward," not the person fact-checking for a living

## Roadmap (not built in this version)

- WhatsApp-native interface (currently browser-extension only)
- Voice-note transcription and voice-based input
- Regional-language UI beyond reply-language matching
- Firefox parity testing

## Team

_Add team member names and roles here._

## License

_Add license here (MIT recommended for hackathon submissions unless otherwise required)._