/**
 * intent.js
 * @module intent
 * @description Classifies user queries into semantic intent categories.
 * Lightweight regex-based classifier runs client-side with zero latency,
 * preprocessing each query before it reaches Gemini to enable targeted
 * context enrichment (e.g. injecting route data for navigation intents).
 */

/**
 * @typedef {Object} IntentPatterns
 * @description Maps intent names to their corresponding regex patterns.
 */
const PATTERNS = {
  navigation: /route|way to|seat|where is|directions|gate|entrance|how do i get/i,
  queue:      /queue|wait|how long|crowd|busy|food|concession|snack/i,
  alert:      /update|news|announcement|delay|cancel|emergency|what.s happening/i,
  facilities: /toilet|restroom|bathroom|atm|first.?aid|medical|wheelchair/i,
  lost:       /lost|found|missing|left behind|forgot/i,
  schedule:   /time|when|kick.?off|start|half.?time|next|schedule|end/i,
  exit:       /exit|leave|go home|out|parking|car/i,
};

/**
 * Classify a sanitised user message into one of the known intent categories.
 * Patterns are evaluated in insertion order; first match wins.
 * Falls back to "general" for unrecognised queries.
 *
 * @param {string} msg - Sanitised user message (max 300 chars, HTML-stripped)
 * @returns {"navigation"|"queue"|"alert"|"facilities"|"lost"|"schedule"|"exit"|"general"}
 *          Intent category string
 *
 * @example
 * classifyIntent("Where is the nearest restroom?"); // → "facilities"
 * classifyIntent("Great game!");                    // → "general"
 */
export function classifyIntent(msg) {
  if (typeof msg !== "string" || msg.length === 0) return "general";
  for (const [intent, pattern] of Object.entries(PATTERNS)) {
    if (pattern.test(msg)) return intent;
  }
  return "general";
}

/**
 * Returns all intent categories that a message matches.
 * Useful for complex, multi-intent queries (e.g. "Food near the exit").
 *
 * @param {string} msg - Sanitised user message
 * @returns {string[]} Array of matching intent names (may be empty)
 */
export function classifyIntentAll(msg) {
  if (typeof msg !== "string") return [];
  return Object.entries(PATTERNS)
    .filter(([, pattern]) => pattern.test(msg))
    .map(([intent]) => intent);
}
