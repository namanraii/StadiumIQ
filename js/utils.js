/**
 * utils.js
 * @module utils
 * @description Shared utility functions used across StadiumIQ modules.
 * Centralises cross-cutting concerns to enforce DRY principles and ensure
 * consistent behaviour (timeouts, sanitisation, ID generation) app-wide.
 */

/**
 * Perform a `fetch` request with an automatic AbortController timeout.
 * Replaces the duplicate `AbortController + setTimeout + fetch` pattern
 * previously repeated in routes.js, nlp.js, and bigquery.js.
 *
 * @param {string}        url       - The request URL
 * @param {RequestInit}   options   - Standard fetch options (method, headers, body, etc.)
 * @param {number}        [timeoutMs=8000] - Abort timeout in milliseconds
 * @returns {Promise<Response>} Resolves with the fetch Response
 * @throws {Error} DOMException (AbortError) on timeout, or network errors
 *
 * @example
 * const res = await fetchWithTimeout("https://api.example.com/data", {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({ key: "value" }),
 * }, 5000);
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Strip potentially dangerous HTML characters and enforce a character limit.
 * Used to sanitise user input before it reaches the DOM or external APIs.
 * Centralised here to ensure consistent sanitisation across all input paths.
 *
 * @param {string} raw    - Raw user input string
 * @param {number} [maxLen=300] - Maximum allowed character length
 * @returns {string} Sanitised string (HTML chars removed, length enforced, trimmed)
 *
 * @example
 * sanitise("<script>alert('xss')</script>"); // → "scriptalert('xss')/script"
 * sanitise("How long is the queue?");         // → "How long is the queue?"
 */
export function sanitise(raw, maxLen = 300) {
  if (typeof raw !== "string") return "";
  return raw.replace(/[<>&"'`]/g, "").substring(0, maxLen).trim();
}

/**
 * Generate a compact unique ID for BigQuery insertId and similar uses.
 * Combines millisecond timestamp with a 4-char random hex suffix.
 *
 * @param {string} [prefix=""] - Optional string prefix (e.g. "row-", "evt-")
 * @returns {string} Unique ID string of the form `prefix-<timestamp>-<random>`
 *
 * @example
 * uniqueId("row"); // → "row-1713421234567-a3f1"
 */
export function uniqueId(prefix = "") {
  const rand = Math.random().toString(16).slice(2, 6);
  return `${prefix}${prefix ? "-" : ""}${Date.now()}-${rand}`;
}

/**
 * Clamp a number between a minimum and maximum value (inclusive).
 *
 * @param {number} value - Input value
 * @param {number} min   - Lower bound
 * @param {number} max   - Upper bound
 * @returns {number} Value clamped to [min, max]
 *
 * @example
 * clamp(1.5, 0, 1); // → 1
 * clamp(-0.5, 0, 1); // → 0
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
