# Security Strategy: StadiumIQ

This document outlines the defensive engineering practices implemented in StadiumIQ to protect user data, secure API keys, and maintain system integrity.

## 1. Content Security Policy (CSP)

A strict CSP is enforced in `index.html` to prevent Cross-Site Scripting (XSS) and govern the loading of external resources.

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://www.googletagmanager.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://www.google-analytics.com;
  connect-src 'self' wss://*.firebaseio.com https://*.googleapis.com https://*.cloudfunctions.net https://www.google-analytics.com;
">
```
- **Constraint**: Only explicitly allowed Google Cloud domains (Firebase, Vertex AI Cloud Function, BigQuery, Analytics) can be accessed via `fetch` or WebSocket (`wss://`).
- **No `unsafe-eval`**: JavaScript `eval()` is fundamentally blocked.

## 2. Input Sanitisation Lifecycle

Every user input follows a strict validation and sanitisation path before it hits the DOM or any external API.

1. **Capture**: Input is consumed via `ui.js` (`consumeInput()`), which atomically reads and clears the input field.
2. **Trim & Truncate**: Max length is artificially clamped to 300 characters to prevent denial-of-service via massive payload sizes.
3. **Strip**: `utils.js` -> `sanitise()` removes sensitive HTML angle brackets (`<`, `>`), quotes, and backticks.

```javascript
// js/utils.js
export function sanitise(raw, maxLen = 300) {
  if (typeof raw !== "string") return "";
  return raw.replace(/[<>&"'`]/g, "").substring(0, maxLen).trim();
}
```

## 3. Secret Management & Enterprise AI Pattern

To achieve an Enterprise-grade security posture, StadiumIQ employs a two-tier architecture:

### The Problem with Browser API Keys
Direct client-to-API calls expose API keys to end-users. While Firebase and Maps keys can be restricted by HTTP referer, Gemini/Vertex API keys are highly privileged.

### The Solution: Cloud Function Backend
StadiumIQ routes all AI inference through a secure backend (Google Cloud Functions):
1. **Frontend App** calls `https://...cloudfunctions.net/stadiumIQAssist`.
2. **Cloud Function** is bound to a locked-down **Google Cloud Service Account**.
3. **Vertex AI API** is called directly via the SDK, authenticated transparently by the Service Account. **No API key is ever embedded or transported.**

For remaining frontend services (Maps, Firebase), Keys are held as Environment Variables in Google Cloud Build and injected via `sed` at deployment time. `config.js` in source control uses placeholder strings (e.g., `__MAPS_API_KEY__`).

## 4. Threat Models Addressed

| Threat | Mitigation |
|---|---|
| **XSS (Stored)** | Zero inputs are stored in readable Firebase tables. |
| **XSS (Reflected)** | Input `sanitise()` strips HTML; CSP blocks external script injection. |
| **API Key Theft** | Vertex AI calls routed through Service-Account authenticated Cloud Function. Maps/Firebase keys restricted by domain. |
| **DDoS (L7)** | Input length clamped. Chat interface UI rate-limits via UI locking during inference. |
| **PII Leakage** | `auth.js` enforces strictly Anonymous Firebase Auth sessions. No PII is collected or stored. |
