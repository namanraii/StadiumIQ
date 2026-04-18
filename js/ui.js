/**
 * ui.js
 * @module ui
 * @description DOM rendering and UI state management for StadiumIQ chat interface.
 * Separates all view concerns from app.js business logic.
 * All direct DOM mutations go through this module — no other module touches the DOM.
 *
 * Responsibilities:
 *  - Chat message rendering (user + bot bubbles)
 *  - Alert banner show/hide
 *  - Game status bar text update
 *  - Input field state management (read/clear)
 */

/** @constant {string} CSS class prefix for message bubbles */
const MSG_CLASS = "msg";

/**
 * Append a chat message bubble to the conversation log.
 * Automatically scrolls to the latest message after insertion.
 * Bot messages include ARIA live region attributes for screen reader support.
 *
 * @param {string}            text           - Message text content to display
 * @param {"bot"|"user"}      role           - Determines bubble alignment and colour
 * @param {boolean}           [isProactive=false] - Adds proactive styling when true
 * @returns {HTMLDivElement}  The created message element (use for streaming updates)
 *
 * @example
 * const el = appendMessage("Checking queue times…", "bot");
 * // later:
 * el.textContent = "Stadium Grill: 7 min wait.";
 */
export function appendMessage(text, role, isProactive = false) {
  const log = document.getElementById("messages");
  if (!log) return document.createElement("div"); // Safe fallback for tests

  const div = document.createElement("div");
  div.className = `${MSG_CLASS} ${MSG_CLASS}--${role}${isProactive ? ` ${MSG_CLASS}--proactive` : ""}`;
  div.textContent = text;

  if (role === "bot") {
    div.setAttribute("role", "status");
    div.setAttribute("aria-live", "polite");
    div.setAttribute("aria-label", `StadiumIQ says: ${text}`);
  }

  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

/**
 * Update the bot message content and its ARIA label simultaneously.
 * Used after Gemini returns a reply to replace the "…" placeholder.
 *
 * @param {HTMLDivElement} el   - Bot message element returned by {@link appendMessage}
 * @param {string}         text - Final reply text to display
 * @returns {void}
 */
export function updateBotMessage(el, text) {
  el.textContent = text;
  el.setAttribute("aria-label", `StadiumIQ says: ${text}`);
}

/**
 * Show the venue alert banner with a message.
 * Auto-hides after `durationMs` milliseconds.
 *
 * @param {string} message       - Alert message to display
 * @param {number} [durationMs=10000] - Auto-dismiss delay in milliseconds
 * @returns {void}
 */
export function showAlertBanner(message, durationMs = 10_000) {
  const banner = document.getElementById("alert-banner");
  const textEl = document.getElementById("alert-text");
  if (!banner || !textEl) return;
  textEl.textContent = message;
  banner.hidden = false;
  setTimeout(() => { banner.hidden = true; }, durationMs);
}

/**
 * Hide the alert banner immediately.
 * Called by the dismiss (×) button.
 * @returns {void}
 */
export function hideAlertBanner() {
  const banner = document.getElementById("alert-banner");
  if (banner) banner.hidden = true;
}

/**
 * Update the game status bar text in the header.
 *
 * @param {number} quarter     - Current game quarter
 * @param {number} minutesLeft - Minutes remaining in quarter
 * @returns {void}
 */
export function updateStatusBar(quarter, minutesLeft) {
  const el = document.getElementById("game-status");
  if (el) el.textContent = `Q${quarter} · ${minutesLeft} min left · Live`;
}

/**
 * Read and clear the user input field in one operation.
 * Returns empty string and does nothing if the element is not found.
 *
 * @returns {string} The trimmed input value before clearing
 */
export function consumeInput() {
  const input = document.getElementById("user-input");
  if (!input) return "";
  const val = input.value.trim();
  input.value = "";
  return val;
}
