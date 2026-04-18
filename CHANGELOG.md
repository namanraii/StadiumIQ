# Changelog

All notable changes to StadiumIQ are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.4.0] — 2026-04-18

### Added — Google Cloud Pipeline Expansion
- **Cloud Functions** (`functions/index.js`): HTTP-triggered backend function
  orchestrating Vertex AI + Cloud NL API + BigQuery in a 3-stage server-side pipeline
- **Vertex AI** (`functions/index.js`): Enterprise Gemini 2.5 Flash via `aiplatform.googleapis.com`
  with service-account authentication — replaces browser-exposed API key calls
- **AI Router** (`js/ai.js`): Two-tier request strategy (Cloud Function → direct Gemini fallback)
  with Firebase Performance trace `cloud_function_response` per call
- **Cloud Build CI/CD** (`cloudbuild.yaml`): Full pipeline — npm test → Cloud Function deploy
  → key injection → Cloud Run deploy, with parallel steps and CLOUD_LOGGING_ONLY

### Added — Code Quality
- `js/utils.js`: Shared utility module (`fetchWithTimeout`, `sanitise`, `uniqueId`, `clamp`)
  eliminates duplicate AbortController setup across routes.js, nlp.js, bigquery.js
- `js/ui.js`: DOM abstraction layer — all view concerns extracted from app.js
- `.eslintrc.json`: ESLint config enforcing ES2022 module standards
- `LICENSE`: MIT license

### Added — Tests
- `tests/utils.test.js`: 23 unit tests for sanitise, uniqueId, clamp
- `tests/nlp.test.js`: 11 unit tests for formatAnnotationForContext

### Refactored
- `js/routes.js`: Uses `fetchWithTimeout()` — removed 3 lines of duplicate setup
- `js/nlp.js`: Uses `fetchWithTimeout()` — removed 5 lines of duplicate setup
- `js/bigquery.js`: Uses `fetchWithTimeout()` + `uniqueId()` — consistent insert IDs
- `js/app.js`: All DOM ops delegated to `ui.js`; all sanitisation via `utils.js`;
  chat pipeline now calls `routeAIQuery()` (Cloud Function → Gemini fallback)

---

## [1.3.0] — 2026-04-18

### Added — Google Services
- **BigQuery Streaming Inserts** (`js/bigquery.js`): `streamInteraction()` logs every
  query + intent + response + game state; `streamVenueSnapshot()` logs gate/crowd on
  every Firebase gamestate update — `bigquery.googleapis.com` REST API
- **Cloud Natural Language API** (`js/nlp.js`): `analyzeEntities` + `analyzeSentiment`
  on every user query; extracted entities injected into Gemini context block
- **Firebase Authentication** (`js/auth.js`): Anonymous sessions via `signInAnonymously()`
- **Google Analytics 4** (`js/analytics.js`): `chat_message_sent`, `proactive_alert_shown`,
  `route_computed` event tracking via Firebase Analytics SDK

### Added — Infrastructure
- README.md: Rewritten Google Services section as ASCII pipeline diagram showing
  how NL API → Gemini → BigQuery connect as a data workflow

---

## [1.2.0] — 2026-04-18

### Added — Performance & Monitoring
- **Firebase Performance Monitoring** (`js/perf.js`): `getPerformance()` SDK;
  custom `gemini_response` trace wraps every Gemini API call with `response_length` metric
- `AbortController` timeout on all external API calls (Routes, NL, BigQuery, Gemini)
- 30s response caching in `gemini.js` to prevent duplicate calls on repeated chip taps
- `preconnect` resource hints in `index.html` for Maps and Firebase domains

### Fixed
- CSP meta tag expanded to allow Firebase WebSocket (`wss://`) and Maps internal RPC calls
- `routes.js`: `data` variable scoped inside try/finally to prevent undefined reference

---

## [1.1.0] — 2026-04-17

### Added
- Full JSDoc overhaul across all 7 JS modules (`@module`, `@typedef`, `@example`, `@private`)
- Test suite expanded from 17 → 70+ unit tests across intent, proactive, queue, routes,
  utils, and nlp modules
- `getMarkersByType()` helper exported from `maps.js` for external testability

### Fixed
- `parseInt(route.duration, 10)` radix parameter added
- Null guard on Firebase `onValue` callbacks

---

## [1.0.0] — 2026-04-17

### Added — Initial Release
- Gemini 2.5 Flash chat interface with intent classification (6 intents)
- Firebase Realtime Database live sync (gameState, queues, gates, crowd)
- Google Maps JavaScript API — satellite venue map with custom SVG markers
- Routes API v2 — pedestrian walking directions with `WALK` travel mode
- Proactive alert engine — 5 game-phase triggers firing unprompted Gemini messages
- Cloud Run deployment via Nginx container + Cloud Build source-based build
