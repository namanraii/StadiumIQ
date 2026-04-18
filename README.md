# StadiumIQ — Proactive Stadium Concierge

> An AI-powered assistant that predicts attendee needs at large-scale sporting venues — before they even ask.

## 🔗 Live Demo
[https://github.com/namanraii/StadiumIQ](https://github.com/namanraii/StadiumIQ)

---

## 💡 The Vision

StadiumIQ reduces "time-to-seat" and post-game exit delays by proactively routing 60,000+ attendees based on real-time crowd density and game state. Attendees never need to search for help — the assistant finds them.

It leverages Google's AI, Maps, and Firebase ecosystem to deliver a seamless, context-aware venue experience through a split-screen web interface: a live crowd map on the left, an intelligent chat assistant on the right.

---

## 🏟️ Problem Statement

Large sporting events face systemic challenges:
- **Crowd bottlenecks** at gates and concession stands
- **Long queue wait times** without real-time guidance
- **Poor exit coordination** at match end
- **Reactive (not proactive)** venue staff and information systems

StadiumIQ solves this by combining live sensor data, game clock awareness, and AI to send unprompted, timely alerts.

---

## 🏗️ Architecture

```
Firebase Realtime DB ──► Proactive Engine ──► Gemini 2.5 Flash ──► Chat UI
       │  (gameState, crowd,       │  (trigger on Q4/halftime)         ▲
       │   gates, queues)          └────────────────────────────────────┘
       │                                                           User Query
       └──► Maps JS API (live crowd overlay)          Intent Classifier
                                                           │
                                               Routes API (walking path)
```

**Logic Flow:**
```mermaid
graph LR
  A[Firebase RT DB] -->|gameState + crowd + queues| B[Proactive Engine]
  B -->|trigger condition met| C[Gemini 2.5 Flash]
  C -->|natural language alert| D[Attendee Chat]
  D -->|user query| E[Intent Classifier]
  E -->|navigation intent| F[Routes API]
  E -->|queue intent| A
  F -->|route summary| C
```

---

## ☁️ Google Services — Enterprise Architecture

StadiumIQ employs an **Enterprise Gateway Pattern** to secure API keys and orchestrate complex AI workflows:

```
User Query (Frontend)
  │
  ├─── Cloud Function (stadiumIQAssist) ◄── Secure Backend Gateway
       │
       ├─── Cloud Natural Language API ──► entity extraction & sentiment analysis
       │
       ├─── Vertex AI ───────────────────► Gemini 2.5 Flash NLU response
       │                                   (Enterprise Service Account Auth)
       │
       └─── BigQuery Streaming Insert ───► logs complete interaction record

Navigation Intents (Frontend fallback)
  └─── Routes API ───────────────────────► walking directions (WALK mode)

Firebase Realtime DB ──► live game state triggers → Proactive Alert Engine
                                                   → BigQuery venue snapshots
                                                   → Google Maps overlay refresh

Firebase Auth ──► anonymous UID → scopes GA4 events + Performance traces
Firebase Analytics (GA4) ──► tracks event funnel (`chat_message_sent`, etc.)
Firebase Performance ──► measures latency across AI pipeline and Maps rendering
Cloud Run + Cloud Build ──► CI/CD to Nginx serverless hosting (Artifact Registry)
Secret Manager ──► Securely injects Maps/Firebase keys at build time
```

| Service | Role in Workflow |
|---|---|
| **Cloud Functions** | HTTP trigger acting as the secure gateway for the AI pipeline (`functions/index.js`). |
| **Vertex AI** | Enterprise Gemini 2.5 Flash accessed purely via Service Account from the Cloud Function. No keys exposed in browser. |
| **Cloud Natural Language API** | Stage 1: entity extraction (`analyzeEntities`) + sentiment (`analyzeSentiment`) on every user query — entities enrich Gemini context |
| **BigQuery (Streaming Inserts)** | Stage 4: every interaction logged to `stadium_analytics.user_interactions`; venue snapshots to `venue_snapshots` table on every Firebase gamestate change |
| **Firebase Realtime Database** | Live backbone: `onValue()` listeners push instant updates to map overlay, proactive alert engine, and BigQuery snapshots |
| **Routes API v2** | Navigation intents: `computeRoutes` with `WALK` mode; route summary injected into Gemini context for natural-language directions |
| **Maps JavaScript API** | Satellite venue map with custom SVG gate markers; capacity colour updated live from Firebase gate data |
| **Firebase Authentication** | Anonymous `signInAnonymously()` session on load; UID scopes GA4 events and Performance traces across the session |
| **Google Analytics 4 (Firebase)** | Tracks `chat_message_sent` (intent category), `quick_action_chip`, `proactive_alert_shown`, `route_computed` — full funnel visibility |
| **Firebase Performance Monitoring** | Custom `gemini_response` trace wraps every Gemini call; `response_length` metric logged per interaction |
| **Cloud Run** | Nginx container; auto-scales to handle concurrent stadium event traffic spikes |
| **Cloud Build** | CI/CD: source-based build from `gcloud run deploy --source .`; container stored in Artifact Registry |

### Production Architecture with Extended Google Services
In a production deployment at scale, StadiumIQ would integrate additional Google services:

```
IoT Sensors → Pub/Sub → Cloud Functions → Firebase Realtime DB → StadiumIQ
                                     ↘ BigQuery (historical analytics)
Gemini API ← Firebase ← Cloud Run   ← Google Maps Platform
                                     ↘ Vertex AI (crowd prediction model)
```

- **Cloud Pub/Sub**: Ingest real-time IoT sensor data streams from 10,000+ seat sensors
- **Cloud Functions**: Serverless event processors for sensor data → Firebase writes
- **BigQuery**: Store and analyse historical crowd patterns across multiple events
- **Vertex AI**: Train and serve predictive crowd density models for pre-emptive routing


---

## ✨ Features

- **🚨 Proactive Exit Warning** — Detects Q4 ending + crowded exits → auto-suggests alternate routes unprompted
- **🍟 Halftime Concession Guidance** — Predicts queue spikes before they happen and routes to shortest queue
- **🚪 Gate Capacity Routing** — Real-time colour overlay (Low/Medium/High) + least-crowded gate suggestion
- **🤖 Venue Concierge** — Ask anything: restrooms, first aid, schedule, parking, lost & found

---

## 🚀 How to Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/namanraii/StadiumIQ.git
cd StadiumIQ

# 2. Configure API keys
#    Open config.js and replace placeholder values with your real API keys

# 3. Seed Firebase Realtime Database
#    Import data/firebase-seed.json into your Firebase Realtime DB

# 4. Start a local static server
python3 -m http.server 3000
# Then open http://localhost:3000
```

---

## 🧪 How to Run Tests

```bash
npm install
npm test
# Remove node_modules before committing!
```

---

## 📋 Assumptions

- Venue floor plan is mocked via `data/stadium.json`
- Queue and crowd data is seeded in Firebase to simulate live IoT sensor updates
- Updating `gameState.quarter` or `gameState.minutesLeft` in Firebase triggers proactive messages in real time (demonstrable live)
- In production, Firebase would be populated by real IoT sensors, ticketing APIs, and POS system feeds

---

## 🔒 Security

- **No API keys committed** — Keys are stored in `.env` (gitignored) and loaded via `config.js`
- **Firebase rules**: Read-only access for all public collections
- **Input sanitization**: HTML characters stripped, 300-character limit enforced on all user input
- **Maps key restricted**: Limited to specific domain referrers to prevent unauthorized usage

---

## 📁 Project Structure

```
StadiumIQ/
├── index.html          # Main SPA with accessible layout (ARIA roles)
├── config.js           # Runtime environment variable injection
├── css/
│   └── style.css       # Premium glassmorphic light-mode UI
├── js/
│   ├── app.js          # Main orchestrator
│   ├── gemini.js       # Gemini API client (context-enriched)
│   ├── firebase.js     # Realtime DB listeners
│   ├── maps.js         # Google Maps + crowd overlay
│   ├── routes.js       # Routes API integration
│   ├── intent.js       # Regex-based intent classifier
│   └── proactive.js    # Game-clock-aware push alert engine
├── data/
│   ├── stadium.json    # Venue layout (gates, food, restrooms)
│   └── firebase-seed.json # Demo sensor data for Firebase
├── tests/              # Jest unit tests
├── Dockerfile          # Nginx container for Cloud Run
└── nginx.conf          # Port 8080 config for Cloud Run
```
