/**
 * gemini.js
 * Handles all Gemini API communication.
 * Context (gameState, queues, crowd) is injected per-request.
 */

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/" +
  "gemini-2.5-flash:generateContent";

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
 * Send a message to Gemini with full venue context injected.
 * @param {string} userMessage - raw user input (already sanitised)
 * @param {Object} ctx - live context from getLiveContext()
 * @returns {Promise<string>} assistant reply text
 */
export async function askGemini(userMessage, ctx) {
  const contextBlock = `
LIVE VENUE DATA (use this to answer):
Game: Q${ctx.gameState?.quarter}, ${ctx.gameState?.minutesLeft} min left, 
      Phase: ${ctx.gameState?.phase}
Gates: ${JSON.stringify(ctx.gates)}
Queues: ${JSON.stringify(ctx.queues)}
Crowd: ${JSON.stringify(ctx.crowd)}
Schedule: ${JSON.stringify(window.STADIUM?.schedule)}
`.trim();

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

  const res = await fetch(
    `${GEMINI_ENDPOINT}?key=${window.ENV.GEMINI_API_KEY}`,
    { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body) }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.candidates[0].content.parts[0].text.trim();
}

/**
 * Ask Gemini to compose a proactive push message.
 * @param {string} triggerReason - e.g. "Q4 ending, exit crowd at 71%"
 * @param {Object} ctx - live context
 * @returns {Promise<string>}
 */
export async function askGeminiProactive(triggerReason, ctx) {
  const msg = `The system has detected: ${triggerReason}. 
Write a short proactive alert (1-2 sentences) for the attendee. 
Use specific numbers from the venue data. Be helpful and direct.`;
  return askGemini(msg, ctx);
}
