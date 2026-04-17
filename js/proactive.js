/**
 * proactive.js
 * Evaluates game state + crowd data every 30 seconds.
 * If a trigger condition is met, fires an unprompted message to the chat.
 * This is the "smart assistant" differentiator.
 */
import { getLiveContext } from "./firebase.js";
import { askGeminiProactive } from "./gemini.js";

let _lastTrigger = null;
let _intervalId  = null;

/**
 * Start the proactive monitoring loop.
 * @param {Function} onMessage - callback(text) to push message to chat UI
 */
export function startProactiveLoop(onMessage) {
  _intervalId = setInterval(() => _evaluate(onMessage), 30_000);
  _evaluate(onMessage);
}

export function stopProactiveLoop() {
  clearInterval(_intervalId);
}

/**
 * Core trigger evaluator.
 * Returns a trigger key + reason string, or null if no trigger.
 * @param {Object} ctx - live context from getLiveContext()
 * @returns {{ key: string, reason: string } | null}
 */
export function evaluateTrigger(ctx) {
  const gs   = ctx.gameState || {};
  const crowd = ctx.crowd    || {};
  const q    = gs.quarter;
  const min  = gs.minutesLeft;
  const phase = gs.phase;

  if (phase === "pre") {
    return { key: "pre-gates",
      reason: `Gates just opened. Gate D has ${ctx.gates?.D?.capacityPct ?? 0}% capacity — lowest queue.` };
  }
  if (phase === "halftime") {
    const bestRestroom = _findFastest(ctx.queues || {}, ["r1","r2"]);
    return { key: "halftime",
      reason: `It is halftime. ${bestRestroom.name} has the shortest restroom queue at ${bestRestroom.wait} min.` };
  }
  if (q === 2 && min <= 2) {
    return { key: "q2-end",
      reason: `2nd quarter ends in ${min} minutes. Concession queues will spike sharply at halftime.` };
  }
  if (q === 4 && min <= 5) {
    const exitDensity = crowd["main-exit"]?.density ?? 0;
    if (exitDensity > 0.6) {
      return { key: "q4-exit",
        reason: `4th quarter with ${min} minutes left. Main Exit is at ${Math.round(exitDensity*100)}% capacity. North Bridge is ${Math.round((crowd["north-bridge"]?.density??0)*100)}% — significantly less crowded.` };
    }
  }
  if (phase === "post") {
    return { key: "post-game",
      reason: `Full time. Post-game show starting. Exit crowd will drop in approximately 20 minutes.` };
  }
  return null;
}

async function _evaluate(onMessage) {
  const ctx = getLiveContext();
  const trigger = evaluateTrigger(ctx);
  if (!trigger || trigger.key === _lastTrigger) return;
  _lastTrigger = trigger.key;
  try {
    const msg = await askGeminiProactive(trigger.reason, ctx);
    onMessage(msg);
  } catch (e) {
    console.error("Proactive message failed:", e);
  }
}

function _findFastest(queues, ids) {
  let best = { id: ids[0], wait: Infinity };
  ids.forEach(id => {
    if ((queues[id]?.waitMinutes ?? Infinity) < best.wait) {
      best = { id, wait: queues[id].waitMinutes };
    }
  });
  return { ...best, name: best.id.toUpperCase() };
}
