/**
 * firebase.js
 * @module firebase
 * @description Initialises the Firebase Realtime Database connection and
 * maintains a live in-memory `_state` object via `onValue()` listeners.
 * All other modules call {@link getLiveContext} to read the current state.
 *
 * Google Services used:
 *  - Firebase Realtime Database (firebaseio.com) — zero-poll live data sync
 *
 * @see https://firebase.google.com/docs/database/web/read-and-write
 */
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getDatabase, ref, onValue } from
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";
import { initPerformance } from "./perf.js";
import { initAuth }        from "./auth.js";
import { initAnalytics }   from "./analytics.js";

/** @type {import("firebase/database").Database} */
let _db;

/**
 * Reactive state object — updated automatically by Firebase `onValue` listeners.
 * @type {{ gameState: Object, queues: Object, gates: Object, crowd: Object, alerts: Object }}
 */
let _state = { gameState: {}, queues: {}, gates: {}, crowd: {}, alerts: {} };

/** Database nodes to subscribe to on startup. */
const WATCHED_NODES = ["gameState", "queues", "gates", "crowd", "alerts"];

/**
 * Initialise Firebase and start all realtime listeners.
 * Dispatches a `gamestate-update` CustomEvent on every gameState change.
 * Should be called exactly once at app startup.
 *
 * @returns {void}
 */
export async function initFirebase() {
  const app = initializeApp({
    apiKey:      window.ENV.FIREBASE_API_KEY,
    databaseURL: window.ENV.FIREBASE_DB_URL,
    projectId:   window.ENV.FIREBASE_PROJECT_ID,
  });
  _db = getDatabase(app);
  initPerformance(app); // Firebase Performance Monitoring — 7th Google service

  // Firebase Authentication — anonymous sessions for user scoping
  const uid = await initAuth(app);

  // Google Analytics 4 via Firebase Analytics — event tracking
  initAnalytics(app, uid);

  WATCHED_NODES.forEach(node => {
    onValue(ref(_db, node), snap => {
      _state[node] = snap.val() || {};
      if (node === "alerts") _handleNewAlerts(_state.alerts);
      if (node === "gameState") {
        window.dispatchEvent(
          new CustomEvent("gamestate-update", { detail: _state.gameState })
        );
      }
    });
  });
}

/**
 * Returns a shallow copy of the current live state snapshot.
 * Safe to call from any module at any time.
 *
 * @returns {{ gameState: Object, queues: Object, gates: Object, crowd: Object, alerts: Object }}
 */
export function getLiveContext() {
  return { ..._state };
}

/**
 * Build a human-readable summary string of all currently open queue stalls.
 * Used to enrich Gemini's context for queue-related queries.
 *
 * @param {Object} queues - Map of stall IDs to { waitMinutes: number, isOpen: boolean }
 * @param {Array<{ id: string, name: string }>} stalls - Static list of stall definitions
 * @returns {string} Comma-separated summary, e.g. "Stadium Grill: 7 min, North Stand: 3 min"
 *
 * @example
 * buildQueueSummary({ c1: { waitMinutes: 7, isOpen: true } }, [{ id: "c1", name: "Grill" }]);
 * // → "Grill: 7 min"
 */
export function buildQueueSummary(queues, stalls) {
  if (!queues || !Array.isArray(stalls)) return "";
  return stalls
    .filter(stall => queues[stall.id]?.isOpen)
    .map(stall => `${stall.name}: ${queues[stall.id].waitMinutes} min`)
    .join(", ");
}

/**
 * Dispatch a `stadium-alert` event for any alerts received within the last 90 seconds.
 * Prevents re-firing stale alerts from a previous Firebase session.
 *
 * @param {Object} alerts - Map of alert objects, each with a Unix `timestamp` field
 * @returns {void}
 * @private
 */
function _handleNewAlerts(alerts) {
  if (!alerts || typeof alerts !== "object") return;
  const recent = Object.values(alerts)
    .filter(a => a?.timestamp && (Date.now() / 1000 - a.timestamp) < 90);
  if (recent.length) {
    window.dispatchEvent(
      new CustomEvent("stadium-alert", { detail: recent[0] })
    );
  }
}
