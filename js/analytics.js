/**
 * analytics.js
 * @module analytics
 * @description Google Analytics 4 (GA4) event tracking for StadiumIQ.
 * Tracks key user interactions and proactive alert deliveries to measure
 * real-world engagement patterns and AI effectiveness in a stadium context.
 *
 * Uses Firebase Analytics SDK (built on GA4) for tight integration with
 * the existing Firebase project, enabling correlated analysis between
 * user events and Firebase Performance traces.
 *
 * Google Services used:
 *  - Firebase Analytics / Google Analytics 4 (firebase.google.com/products/analytics)
 *
 * Tracked events:
 *  - `chat_message_sent`     — User sends a query (includes intent category)
 *  - `quick_action_tapped`   — User taps a pre-built chip action
 *  - `proactive_alert_shown` — AI engine fires an unprompted alert
 *  - `route_computed`        — User navigates to a venue section
 *  - `gate_overlay_updated`  — Live crowd data refreshes the map
 *
 * @see https://firebase.google.com/docs/analytics/get-started?platform=web
 */
import { getAnalytics, logEvent, setUserProperties } from
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-analytics.js";

/** @type {import("firebase/analytics").Analytics|null} GA4 analytics instance */
let _analytics = null;

/**
 * Initialise Firebase Analytics.
 * Must be called after `initializeApp()`.
 * Safe to call in environments where Analytics is unavailable (e.g. ad-blockers).
 *
 * @param {import("firebase/app").FirebaseApp} app - Initialised Firebase app instance
 * @param {string|null} [uid]  - Optional anonymous UID for user scoping
 * @returns {void}
 */
export function initAnalytics(app, uid = null) {
  try {
    _analytics = getAnalytics(app);
    if (uid) {
      setUserProperties(_analytics, { session_type: "anonymous", venue: "MetroArena" });
    }
    logEvent(_analytics, "app_open", { venue: "MetroArena", platform: "web" });
    console.info("[StadiumIQ:analytics] GA4 initialised");
  } catch (e) {
    // Non-fatal — tracking failure never degrades UX
    console.warn("[StadiumIQ:analytics] Analytics unavailable:", e.message);
  }
}

/**
 * Track a chat message submission.
 * Logs the detected intent category alongside the event for funnel analysis.
 *
 * @param {string} intent - Classified intent ("navigation", "queue", "general", etc.)
 * @param {boolean} [isQuickAction=false] - True if triggered via a chip, false if typed
 * @returns {void}
 */
export function trackChatMessage(intent, isQuickAction = false) {
  _logSafe("chat_message_sent", {
    intent_category: intent,
    input_method:    isQuickAction ? "quick_action_chip" : "text_input",
    venue:           "MetroArena",
  });
}

/**
 * Track when the proactive alert engine fires an unprompted message.
 * Measures how frequently AI assistance is delivered without user initiation.
 *
 * @param {string} triggerKey - The proactive trigger key (e.g. "q4-exit", "halftime")
 * @returns {void}
 */
export function trackProactiveAlert(triggerKey) {
  _logSafe("proactive_alert_shown", { trigger_key: triggerKey, venue: "MetroArena" });
}

/**
 * Track a navigation route computation.
 * @param {string} destination - Section or gate identifier navigated to
 * @returns {void}
 */
export function trackRouteComputed(destination) {
  _logSafe("route_computed", { destination, venue: "MetroArena" });
}

/**
 * Safely log a GA4 event, swallowing any errors to prevent UX disruption.
 * @param {string} eventName - GA4 event name
 * @param {Object} params    - Event parameters
 * @returns {void}
 * @private
 */
function _logSafe(eventName, params) {
  if (!_analytics) return;
  try {
    logEvent(_analytics, eventName, params);
  } catch (e) {
    console.warn(`[StadiumIQ:analytics] Failed to log "${eventName}":`, e.message);
  }
}
