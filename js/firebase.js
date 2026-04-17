/**
 * firebase.js
 * Initialises Firebase and maintains live _state object via onValue listeners.
 * All other modules call getLiveContext() to read current state.
 */
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getDatabase, ref, onValue } from
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

let _db;
let _state = { gameState: {}, queues: {}, gates: {}, crowd: {}, alerts: {} };

/**
 * Initialise Firebase and start all realtime listeners.
 * Call once at app startup.
 */
export function initFirebase() {
  const app = initializeApp({
    apiKey:      window.ENV.FIREBASE_API_KEY,
    databaseURL: window.ENV.FIREBASE_DB_URL,
    projectId:   window.ENV.FIREBASE_PROJECT_ID,
  });
  _db = getDatabase(app);

  const nodes = ["gameState", "queues", "gates", "crowd", "alerts"];
  nodes.forEach(node => {
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
 * Returns a snapshot of the current live state.
 * @returns {Object}
 */
export function getLiveContext() {
  return { ..._state };
}

/**
 * Fire a DOM event when a new alert arrives from Firebase.
 * @param {Object} alerts
 */
function _handleNewAlerts(alerts) {
  const recent = Object.values(alerts)
    .filter(a => a?.timestamp && (Date.now() / 1000 - a.timestamp) < 90);
  if (recent.length) {
    window.dispatchEvent(
      new CustomEvent("stadium-alert", { detail: recent[0] })
    );
  }
}

/**
 * Builds a string summary of open queues
 * @param {Object} queues - The queues map
 * @param {Array} stalls - Array of stall objects with id and name
 */
export function buildQueueSummary(queues, stalls) {
  return stalls
    .filter(stall => queues[stall.id]?.isOpen)
    .map(stall => `${stall.name}: ${queues[stall.id].waitMinutes} min`)
    .join(", ");
}
