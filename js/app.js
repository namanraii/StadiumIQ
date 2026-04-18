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
import { askGemini }                               from "./gemini.js";
import { classifyIntent }                          from "./intent.js";
import { computeRoute }                            from "./routes.js";
import { startProactiveLoop }                      from "./proactive.js";
import { updateGateOverlay, focusLocation }        from "./maps.js";
import { analyseQuery, formatAnnotationForContext } from "./nlp.js";
import { trackChatMessage, trackProactiveAlert }    from "./analytics.js";

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
  const gs = e.detail;
  const el = document.getElementById("game-status");
  if (el) el.textContent = `Q${gs.quarter} · ${gs.minutesLeft} min left · Live`;
  updateGateOverlay(getLiveContext().gates);
});

/**
 * Fires when Firebase pushes a new venue-wide alert (e.g. emergency, delay).
 * Displays the alert banner and auto-dismisses after 10 seconds.
 *
 * @listens {CustomEvent} stadium-alert
 */
window.addEventListener("stadium-alert", e => {
  const banner = document.getElementById("alert-banner");
  document.getElementById("alert-text").textContent = e.detail.message;
  banner.hidden = false;
  setTimeout(() => { banner.hidden = true; }, 10_000);
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
  const input = document.getElementById("user-input");
  const raw   = input.value.trim();
  if (!raw) return;
  input.value = "";

  const text    = sanitise(raw);
  appendMessage(text, "user");
  const thinking = appendMessage("…", "bot");

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

    const reply = await askGemini(text, ctx);
    thinking.textContent = reply;
    thinking.setAttribute("aria-label", `StadiumIQ says: ${reply}`);
  } catch (err) {
    console.error("[StadiumIQ:app] Chat error:", err.message);
    thinking.textContent = "Sorry, I couldn't get that. Please try again.";
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
  trackChatMessage(classifyIntent(q), true); // GA4: track quick action chip taps
  document.getElementById("user-input").value = q;
  handleSubmit({ preventDefault: () => {} });
};

/**
 * Dismiss the alert banner when the user clicks the close button.
 * @returns {void}
 */
window.dismissAlert = function() {
  document.getElementById("alert-banner").hidden = true;
};

window.handleSubmit = handleSubmit;

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** @constant {number} Default venue latitude (MetroArena centre) */
const DEFAULT_LAT = 12.9716;

/** @constant {number} Default venue longitude (MetroArena centre) */
const DEFAULT_LNG = 77.5946;

/**
 * Append a chat message bubble to the conversation log.
 * Scrolls to bottom after insertion to keep latest message in view.
 *
 * @param {string} text              - Message text content
 * @param {"bot"|"user"} role        - Determines bubble alignment and colour
 * @param {boolean} [isProactive=false] - If true, applies proactive alert styling
 * @returns {HTMLDivElement} The created message element (used for streaming updates)
 */
function appendMessage(text, role, isProactive = false) {
  const log = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = `msg msg--${role}${isProactive ? " msg--proactive" : ""}`;
  div.textContent = text;
  if (role === "bot") {
    div.setAttribute("role", "status");
    div.setAttribute("aria-live", "polite");
  }
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

/**
 * Strip potentially dangerous HTML characters and enforce a length limit.
 * Prevents XSS from user-supplied input before it reaches the DOM or Gemini.
 *
 * @param {string} t - Raw user input string
 * @returns {string} Sanitised string (max 300 chars, HTML chars removed)
 */
function sanitise(t) {
  return t.replace(/[<>&"'`]/g, "").substring(0, 300).trim();
}

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
