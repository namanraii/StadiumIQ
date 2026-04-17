/**
 * perf.js
 * @module perf
 * @description Firebase Performance Monitoring integration for StadiumIQ.
 * Instruments key user-facing interactions with custom traces to measure
 * real-world latency across Google Cloud services.
 *
 * Google Services used:
 *  - Firebase Performance Monitoring (firebaseapp.com/performance) — RUM + custom traces
 *
 * Custom traces measured:
 *  - `gemini_response`   — Time for Gemini 2.5 Flash to return a chat reply
 *  - `route_compute`     — Time for the Routes API to compute walking directions
 *  - `proactive_eval`    — Time for the proactive alert engine to evaluate + generate a message
 *  - `firebase_init`     — Time for Firebase to complete all onValue listener registrations
 *
 * @see https://firebase.google.com/docs/perf-mon/custom-code-traces?platform=web
 */
import { getPerformance, trace as perfTrace } from
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-performance.js";

/** @type {import("firebase/performance").FirebasePerformance|null} */
let _perf = null;

/**
 * Initialise Firebase Performance Monitoring.
 * Must be called after `initializeApp()` in firebase.js.
 *
 * @param {import("firebase/app").FirebaseApp} app - The initialised Firebase app instance
 * @returns {void}
 */
export function initPerformance(app) {
  try {
    _perf = getPerformance(app);
    console.info("[StadiumIQ:perf] Firebase Performance Monitoring initialised");
  } catch (e) {
    // Non-fatal — monitoring is optional for UX correctness
    console.warn("[StadiumIQ:perf] Performance Monitoring unavailable:", e.message);
  }
}

/**
 * Start a named custom performance trace.
 * Returns a stop function that records the trace duration when called.
 * Safe to call even if Performance Monitoring failed to initialise (no-op).
 *
 * @param {string} traceName - Unique trace identifier (e.g. "gemini_response")
 * @returns {function(): void} Stop function — call when the measured operation completes
 *
 * @example
 * const stop = startTrace("gemini_response");
 * const reply = await askGemini(msg, ctx);
 * stop(); // Records the Gemini latency to Firebase Performance dashboard
 */
export function startTrace(traceName) {
  if (!_perf) return () => {}; // no-op if not initialised

  try {
    const t = perfTrace(_perf, traceName);
    t.start();
    return () => {
      try { t.stop(); } catch { /* swallow stop errors silently */ }
    };
  } catch (e) {
    console.warn(`[StadiumIQ:perf] Could not start trace "${traceName}":`, e.message);
    return () => {};
  }
}

/**
 * Record a single numeric metric against a named trace.
 * Useful for capturing payload sizes or queue counts alongside latency.
 *
 * @param {string} traceName   - The trace to attach the metric to
 * @param {string} metricName  - The metric name (e.g. "response_length")
 * @param {number} value       - Numeric value to record
 * @returns {void}
 */
export function recordMetric(traceName, metricName, value) {
  if (!_perf || typeof value !== "number") return;
  try {
    const t = perfTrace(_perf, traceName);
    t.putMetric(metricName, value);
    t.record(0, 1); // Record a 1ms dummy duration — metric carrier only
  } catch { /* non-fatal */ }
}
