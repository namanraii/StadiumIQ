/**
 * app.js
 * @module app
 * @description Main application entry point for StadiumIQ.
 * Bootstraps all modules, wires DOM event listeners, and exposes global
 * functions used by the HTML (handleSubmit, quickAsk, dismissAlert).
 *
 * Startup sequence:
 * 1. Fetch static venue data (stadium.json)
 * 2. Initialise Firebase Realtime DB listeners
 * 3. Display welcome message and start proactive monitoring loop
 * 4. Register event listeners for Firebase gamestate changes and alerts
 */
import { initFirebase, getLiveContext }            from "./firebase.js";
import { routeAIQuery }                            from "./ai.js";
import { classifyIntent }                          from "./intent.js";
import { computeRoute }                            from "./routes.js";
import { startProactiveLoop }                      from "./proactive.js";
import { updateGateOverlay, focusLocation }        from "./maps.js";
import { analyseQuery, formatAnnotationForContext } from "./nlp.js";
import { trackChatMessage }                        from "./analytics.js";
import { streamInteraction, streamVenueSnapshot }  from "./bigquery.js";
import { appendMessage, updateBotMessage,
         showAlertBanner, hideAlertBanner,
         updateStatusBar, consumeInput }           from "./ui.js";
import { sanitise }                                from "./utils.js";
import { logger }                                  from "./logger.js";

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

/**
 * Static venue layout loaded from data/stadium.json.
 * Made globally available so maps.js and gemini.js can access it.
 * @type {Object}
 */
window.STADIUM = await fetch("data/stadium.json").then(r => r.json());

initFirebase();

window.addEventListener("DOMContentLoaded", () => {
  appendMessage(
    "Hi! I'm StadiumIQ, your MetroArena concierge. " +
    "Ask me anything or tap a quick action below.",
    "bot"
  );
  startProactiveLoop(msg => appendMessage(msg, "bot", true));
});

// ---------------------------------------------------------------------------
// Firebase event listeners
// ---------------------------------------------------------------------------

/**
 * Fires whenever Firebase pushes a gameState update.
 * Updates the status bar and refreshes gate overlay colours.
 *
 * @listens {CustomEvent} gamestate-update
 */
window.addEventListener("gamestate-update", e => {
  const gs  = e.detail;
  const ctx = getLiveContext();
  updateStatusBar(gs.quarter, gs.minutesLeft);
  updateGateOverlay(ctx.gates);
  streamVenueSnapshot(ctx.gates, ctx.crowd, gs);
});

/**
 * Fires when Firebase pushes a new venue-wide alert.
 * @listens {CustomEvent} stadium-alert
 */
window.addEventListener("stadium-alert", e => {
  showAlertBanner(e.detail.message);
});

// ---------------------------------------------------------------------------
// Chat handlers — exported for global use from HTML onclick attributes
// ---------------------------------------------------------------------------

/**
 * Handle chat form submission. Sanitises input, classifies intent, optionally
 * fetches a walking route via the Routes API, then queries Gemini with enriched context.
 *
 * @param {Event} e - DOM submit event (or mock with preventDefault: () => {})
 * @returns {Promise<void>}
 */
export async function handleSubmit(e) {
  e.preventDefault();
  const raw = consumeInput(); // ui.js — reads + clears input atomically
  if (!raw) return;

  const text      = sanitise(raw); // utils.js — centralised sanitisation
  const startTime = performance.now();
  appendMessage(text, "user");
  const thinking  = appendMessage("…", "bot");

  try {
    const intent = classifyIntent(text);
    const ctx    = getLiveContext();

    // Track chat interaction in Google Analytics 4
    trackChatMessage(intent, false);

    // Stage 1: Cloud Natural Language API — entity extraction + sentiment
    // Enriches Gemini context with detected locations, events, and query intent signals
    const nlAnnotation = await analyseQuery(text);
    const nlContext    = formatAnnotationForContext(nlAnnotation);
    if (nlContext) ctx.nlEntities = nlContext;

    // Stage 2: Route computation for navigation/exit intents
    if (intent === "navigation" || intent === "exit") {
      const destSection = _extractSection(text, ctx);
      if (destSection) {
        const route = await computeRoute(
          { lat: DEFAULT_LAT, lng: DEFAULT_LNG },
          { lat: destSection.lat, lng: destSection.lng }
        );
        ctx.routeInfo = route.summary;
        focusLocation(destSection.lat, destSection.lng);
      }
    }

    // Stage 3: Cloud Function (Vertex AI) / fallback direct Gemini
    const reply = await routeAIQuery(text, ctx, intent);
    updateBotMessage(thinking, reply);

    // BigQuery Streaming Insert — log full interaction for post-event analytics
    // Fields: query, intent, response, latency, game state at time of query
    streamInteraction({
      session_id:    window._uid || "anonymous",
      query:         text,
      intent:        intent,
      response:      reply,
      response_ms:   Math.round(performance.now() - startTime),
      game_quarter:  ctx.gameState?.quarter  ?? 0,
      minutes_left:  ctx.gameState?.minutesLeft ?? 0,
      game_phase:    ctx.gameState?.phase      ?? "unknown",
      ts:            Date.now(),
    }); // Fire-and-forget — does not await to avoid blocking UI
  } catch (err) {
    logger.error("app", "Chat error:", err.message);
    updateBotMessage(thinking, "Sorry, I couldn't get that. Please try again.");
  }
}

/**
 * Programmatically submit a quick-action chip query.
 * Populates the input field and triggers handleSubmit.
 *
 * @param {string} q - Pre-filled query string from a chip button
 * @returns {void}
 */
window.quickAsk = function(q) {
  trackChatMessage(classifyIntent(q), true);
  document.getElementById("user-input").value = q;
  handleSubmit({ preventDefault: () => {} });
};

/** Dismiss the alert banner. @returns {void} */
window.dismissAlert = function() { hideAlertBanner(); };

window.handleSubmit = handleSubmit;

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** @constant {number} Default venue latitude (MetroArena centre) */
const DEFAULT_LAT = 12.9716;

/** @constant {number} Default venue longitude (MetroArena centre) */
const DEFAULT_LNG = 77.5946;


/**
 * Extract a stadium section from the user's query and match it to venue data.
 * Used to determine the routing destination for navigation intents.
 *
 * @param {string} text - Sanitised user message
 * @param {Object} ctx  - Live context (unused here but available for future enrichment)
 * @returns {{ lat: number, lng: number, id: string } | null}
 *          Matching section object or null if no section number found
 * @private
 */
function _extractSection(text, ctx) {
  const m = text.match(/section\s*(\w+)/i);
  if (m) {
    return window.STADIUM?.sections?.find(
      s => s.id === m[1].toUpperCase()
    ) || null;
  }
  return null;
}
