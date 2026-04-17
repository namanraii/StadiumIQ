/**
 * gemini.js
 * @module gemini
 * @description Handles all Gemini 2.5 Flash API communication.
 * Context (gameState, queues, crowd) is injected into every request
 * to ground responses in real-time venue data from Firebase.
 *
 * Google Services used:
 *  - Gemini 2.5 Flash (generativelanguage.googleapis.com) — NLU + generation
 */

import { startTrace, recordMetric } from "./perf.js";

/** @constant {string} Base endpoint for Gemini 2.5 Flash generateContent */
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/" +
  "gemini-2.5-flash:generateContent";

/** Response cache: avoid duplicate API calls for identical context+query pairs */
const _responseCache = new Map();

/** @constant {string} System-level persona and behavioural rules for Gemini */
const SYSTEM_PROMPT = `You are StadiumIQ, the AI concierge for MetroArena.
You have access to real-time data: gate capacity, queue times, crowd density,
and the live game state. Use this data to give specific, actionable answers.

Rules:
- Be concise (2-3 sentences max for most answers)
- Always use actual numbers from the context (e.g. "Gate D has 18% capacity")
- For routing, prefer least-crowded paths
- If outside your venue knowledge, politely redirect
- Tone: friendly, confident, helpful`;

/**
 * Send a message to Gemini 2.5 Flash with full venue context injected.
 * Implements a simple LRU-style cache keyed on (message, quarter, minutesLeft)
 * to reduce redundant API calls for repeated quick-action taps.
 *
 * @param {string} userMessage - Raw user input (already sanitised by app.js)
 * @param {Object} ctx          - Live context snapshot from getLiveContext()
 * @param {Object} ctx.gameState - Current quarter, minutesLeft, phase
 * @param {Object} ctx.gates     - Gate IDs mapped to {capacityPct}
 * @param {Object} ctx.queues    - Queue IDs mapped to {waitMinutes}
 * @param {Object} ctx.crowd     - Zone IDs mapped to {density}
 * @returns {Promise<string>} Gemini assistant reply text (trimmed)
 * @throws {Error} If the API responds with a non-2xx status
 */
export async function askGemini(userMessage, ctx) {
  // Cache key: question + game state snapshot
  const cacheKey = `${userMessage}|Q${ctx.gameState?.quarter}|${ctx.gameState?.minutesLeft}`;
  if (_responseCache.has(cacheKey)) return _responseCache.get(cacheKey);

  const contextBlock = _buildContextBlock(ctx);

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{
      role: "user",
      parts: [{ text: `${contextBlock}\n\nAttendee: ${userMessage}` }]
    }],
    generationConfig: {
      maxOutputTokens: 256,
      temperature: 0.35,
      topP: 0.9
    }
  };

  const stopTrace = startTrace("gemini_response");

  const res = await fetch(
    `${GEMINI_ENDPOINT}?key=${window.ENV.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  if (!res.ok) {
    stopTrace();
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const reply = data.candidates[0].content.parts[0].text.trim();
  stopTrace();
  recordMetric("gemini_response", "response_length", reply.length);

  // Cache for 30 s to prevent duplicate calls on repeated chip taps
  _responseCache.set(cacheKey, reply);
  setTimeout(() => _responseCache.delete(cacheKey), 30_000);

  return reply;
}

/**
 * Ask Gemini to compose a proactive push message for the proactive engine.
 * This is distinct from user-initiated queries — it generates unprompted alerts.
 *
 * @param {string} triggerReason - Human-readable trigger, e.g. "Q4 ending, exit density 71%"
 * @param {Object} ctx           - Live context from Firebase Realtime DB listener
 * @returns {Promise<string>} Short proactive alert string (1-2 sentences)
 */
export async function askGeminiProactive(triggerReason, ctx) {
  const msg = `The system has detected: ${triggerReason}.
Write a short proactive alert (1-2 sentences) for the attendee.
Use specific numbers from the venue data. Be helpful and direct.`;
  return askGemini(msg, ctx);
}

/**
 * Build a structured context block to inject into every Gemini prompt.
 * Separating this keeps the prompt deterministic and testable.
 *
 * @param {Object} ctx - Live context snapshot
 * @returns {string}   Formatted multi-line context string
 * @private
 */
function _buildContextBlock(ctx) {
  return `LIVE VENUE DATA (use this to answer):
Game: Q${ctx.gameState?.quarter}, ${ctx.gameState?.minutesLeft} min left, Phase: ${ctx.gameState?.phase}
Gates: ${JSON.stringify(ctx.gates)}
Queues: ${JSON.stringify(ctx.queues)}
Crowd: ${JSON.stringify(ctx.crowd)}
Schedule: ${JSON.stringify(window.STADIUM?.schedule)}`.trim();
}
