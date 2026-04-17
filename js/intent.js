/**
 * intent.js — classify user query into action category
 * Intent determines which context fields get enriched before Gemini call
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

/** @param {string} msg @returns {string} */
export function classifyIntent(msg) {
  for (const [intent, pattern] of Object.entries(PATTERNS)) {
    if (pattern.test(msg)) return intent;
  }
  return "general";
}
