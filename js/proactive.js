/**
 * proactive.js
 * @module proactive
 * @description Game-clock and crowd-density aware proactive alert engine.
 * Runs a 30-second polling loop against Firebase live context and fires
 * unprompted Gemini-generated messages when trigger conditions are met.
 * This is the key differentiator of StadiumIQ — pushing help before it's requested.
 *
 * Trigger rules (in priority order):
 * 1. Pre-game: Gate D capacity suggestion
 * 2. Halftime: Best restroom queue recommendation
 * 3. Q2 ending (≤2 min): Halftime concession spike warning
 * 4. Q4 ending (≤5 min) + exit density > 60%: Alternate exit suggestion
 * 5. Post-game: Crowd dispersal timing
 */
import { getLiveContext }      from "./firebase.js";
import { askGeminiProactive }  from "./gemini.js";
import { trackProactiveAlert } from "./analytics.js";

/** @type {string|null} Key of the last fired trigger — prevents duplicate alerts */
let _lastTrigger = null;

/** @type {ReturnType<typeof setInterval>|null} Reference to the polling interval */
let _intervalId  = null;

/** @constant {number} Proactive check interval in milliseconds */
const POLL_INTERVAL_MS = 30_000;

/**
 * Start the proactive monitoring loop.
 * Immediately evaluates on first call, then every {@link POLL_INTERVAL_MS} ms.
 *
 * @param {function(string): void} onMessage - Callback that receives the generated alert text
 * @returns {void}
 */
export function startProactiveLoop(onMessage) {
  if (_intervalId) return; // Guard against double-start
  _intervalId = setInterval(() => _evaluate(onMessage), POLL_INTERVAL_MS);
  _evaluate(onMessage); // Trigger immediately on load
}

/**
 * Stop the proactive monitoring loop and reset state.
 * Safe to call even if the loop was never started.
 *
 * @returns {void}
 */
export function stopProactiveLoop() {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
}

/**
 * Evaluate the current live context against all trigger conditions.
 * Returns the first matching trigger or null if no conditions are met.
 * The same trigger key will not fire twice — enforced by the caller via `_lastTrigger`.
 *
 * @param {Object} ctx - Live context snapshot from {@link getLiveContext}
 * @param {Object} ctx.gameState - { quarter: number, minutesLeft: number, phase: string }
 * @param {Object} ctx.gates     - Map of gate IDs to { capacityPct: number }
 * @param {Object} ctx.queues    - Map of queue IDs to { waitMinutes: number }
 * @param {Object} ctx.crowd     - Map of zone IDs to { density: number }
 * @returns {{ key: string, reason: string } | null} Trigger descriptor or null
 */
export function evaluateTrigger(ctx) {
  const gs    = ctx.gameState || {};
  const crowd = ctx.crowd     || {};
  const q     = gs.quarter;
  const min   = gs.minutesLeft;
  const phase = gs.phase;

  if (phase === "pre") {
    const gateDCap = ctx.gates?.D?.capacityPct ?? 0;
    return {
      key: "pre-gates",
      reason: `Gates just opened. Gate D has ${gateDCap}% capacity — lowest queue.`,
    };
  }

  if (phase === "halftime") {
    const bestRestroom = _findFastest(ctx.queues || {}, ["r1", "r2"]);
    return {
      key: "halftime",
      reason: `It is halftime. ${bestRestroom.name} has the shortest restroom queue at ${bestRestroom.wait} min.`,
    };
  }

  if (q === 2 && min <= 2) {
    return {
      key: "q2-end",
      reason: `2nd quarter ends in ${min} minutes. Concession queues will spike sharply at halftime.`,
    };
  }

  if (q === 4 && min <= 5) {
    const exitDensity   = crowd["main-exit"]?.density ?? 0;
    const bridgeDensity = crowd["north-bridge"]?.density ?? 0;
    if (exitDensity > 0.6) {
      return {
        key: "q4-exit",
        reason: `4th quarter with ${min} minutes left. Main Exit is at ${Math.round(exitDensity * 100)}% capacity. North Bridge is ${Math.round(bridgeDensity * 100)}% — significantly less crowded.`,
      };
    }
  }

  if (phase === "post") {
    return {
      key: "post-game",
      reason: "Full time. Post-game show starting. Exit crowd will drop in approximately 20 minutes.",
    };
  }

  return null;
}

/**
 * Internal evaluation runner — fetches context, evaluates triggers, and calls Gemini.
 * Guards against repeat triggers using `_lastTrigger`.
 *
 * @param {function(string): void} onMessage - UI callback for the alert message
 * @returns {Promise<void>}
 * @private
 */
async function _evaluate(onMessage) {
  performance.mark("proactive-eval-start");
  const ctx = getLiveContext();
  const trigger = evaluateTrigger(ctx);
  if (!trigger || trigger.key === _lastTrigger) return;
  _lastTrigger = trigger.key;
  trackProactiveAlert(trigger.key); // GA4 event: proactive alert delivered
  try {
    const msg = await askGeminiProactive(trigger.reason, ctx);
    onMessage(msg);
  } catch (e) {
    console.error("[StadiumIQ:proactive] Message generation failed:", e.message);
  } finally {
    performance.mark("proactive-eval-end");
    performance.measure("proactive-eval", "proactive-eval-start", "proactive-eval-end");
  }
}

/**
 * Find the queue with the shortest wait time from a list of candidate IDs.
 *
 * @param {Object} queues       - Map of queue IDs to { waitMinutes: number }
 * @param {string[]} candidateIds - IDs to evaluate (e.g. ["r1", "r2"])
 * @returns {{ id: string, wait: number, name: string }} Best (shortest) queue descriptor
 * @private
 */
function _findFastest(queues, candidateIds) {
  let best = { id: candidateIds[0], wait: Infinity };
  candidateIds.forEach(id => {
    const wait = queues[id]?.waitMinutes ?? Infinity;
    if (wait < best.wait) best = { id, wait };
  });
  return { ...best, name: best.id.toUpperCase() };
}
