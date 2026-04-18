/**
 * nlp.js
 * @module nlp
 * @description Google Cloud Natural Language API integration.
 * Performs entity extraction and sentiment analysis on user queries
 * to enrich the context passed to Gemini for more accurate, specific responses.
 *
 * This creates a two-stage AI pipeline:
 *  1. Natural Language API → entity extraction + sentiment (lightweight, fast)
 *  2. Gemini 2.5 Flash → context-aware response generation (enriched by NL entities)
 *
 * Google Services used:
 *  - Cloud Natural Language API (language.googleapis.com) — entity analysis & sentiment
 *
 * @see https://cloud.google.com/natural-language/docs/reference/rest/v1/documents/analyzeEntities
 */

import { fetchWithTimeout } from "./utils.js";
import { logger }           from "./logger.js";
const NL_ENDPOINT =
  "https://language.googleapis.com/v1/documents:analyzeEntities";

/** @constant {string} Sentiment analysis endpoint */
const NL_SENTIMENT_ENDPOINT =
  "https://language.googleapis.com/v1/documents:analyzeSentiment";

/** @constant {number} Request timeout in milliseconds */
const NL_TIMEOUT_MS = 5_000;

/**
 * @typedef {Object} EntityResult
 * @property {string} name     - Entity surface form (e.g. "Gate D", "food court")
 * @property {string} type     - Entity type: LOCATION, PERSON, ORGANIZATION, EVENT, etc.
 * @property {number} salience - Relevance score 0-1 (1 = most important in text)
 */

/**
 * @typedef {Object} NLPAnnotation
 * @property {EntityResult[]} entities   - Extracted entities sorted by salience
 * @property {number}         sentiment  - Aggregate document sentiment score (-1 to 1)
 * @property {string[]}       locations  - Shortlist of LOCATION entity names (gates, sections)
 * @property {string[]}       events     - Shortlist of EVENT entity names
 */

/**
 * Analyse a user query using the Cloud Natural Language API.
 * Extracts entities (locations, objects, events) and overall sentiment.
 * Results are used to enrich the Gemini context block for more precise answers.
 *
 * Gracefully degrades — returns an empty annotation if the API is unavailable
 * or the key doesn't have Natural Language API access.
 *
 * @param {string} text - Sanitised user query (max 300 chars)
 * @returns {Promise<NLPAnnotation>} Extracted entities and sentiment, or empty defaults
 *
 * @example
 * const annotation = await analyseQuery("How long is the queue at Gate D food court?");
 * // annotation.locations → ["Gate D"]
 * // annotation.entities → [{ name: "Gate D", type: "LOCATION", salience: 0.8 }, ...]
 * // annotation.sentiment → 0.1 (slightly positive)
 */
export async function analyseQuery(text) {
  if (!text || !window.ENV?.MAPS_API_KEY) return _emptyAnnotation();

  try {
    const [entitiesRes, sentimentRes] = await Promise.all([
      fetchWithTimeout(`${NL_ENDPOINT}?key=${window.ENV.MAPS_API_KEY}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ document: { type: "PLAIN_TEXT", content: text }, encodingType: "UTF8" }),
      }, NL_TIMEOUT_MS),
      fetchWithTimeout(`${NL_SENTIMENT_ENDPOINT}?key=${window.ENV.MAPS_API_KEY}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ document: { type: "PLAIN_TEXT", content: text }, encodingType: "UTF8" }),
      }, NL_TIMEOUT_MS),
    ]);

    const entitiesData  = entitiesRes.ok  ? await entitiesRes.json()  : {};
    const sentimentData = sentimentRes.ok ? await sentimentRes.json() : {};

    const entities = (entitiesData.entities || [])
      .sort((a, b) => (b.salience ?? 0) - (a.salience ?? 0))
      .map(e => ({ name: e.name, type: e.type, salience: e.salience ?? 0 }));

    const sentiment = sentimentData.documentSentiment?.score ?? 0;

    return {
      entities,
      sentiment,
      locations: entities.filter(e => e.type === "LOCATION").map(e => e.name),
      events:    entities.filter(e => e.type === "EVENT").map(e => e.name),
    };
  } catch (e) {
    // Non-fatal: NL API failure should never block the chat response
    logger.warn("nlp", "Entity analysis unavailable:", e.message);
    return _emptyAnnotation();
  }
}

/**
 * Format an NLP annotation as a compact string for Gemini context injection.
 * Only included in the prompt when meaningful entities were found.
 *
 * @param {NLPAnnotation} annotation - Result from {@link analyseQuery}
 * @returns {string} Formatted context block, or empty string if no entities
 *
 * @example
 * formatAnnotationForContext({ entities: [...], locations: ["Gate D"], events: [], sentiment: 0.1 });
 * // → "NL Entities: Gate D (LOCATION, salience: 0.80)\nDetected locations: Gate D\nQuery sentiment: neutral"
 */
export function formatAnnotationForContext(annotation) {
  if (!annotation?.entities?.length) return "";

  const topEntities = annotation.entities
    .slice(0, 5)
    .map(e => `${e.name} (${e.type}, salience: ${e.salience.toFixed(2)})`)
    .join(", ");

  const sentimentLabel =
    annotation.sentiment > 0.25  ? "positive" :
    annotation.sentiment < -0.25 ? "negative" :
                                    "neutral";

  const parts = [`NL Entities: ${topEntities}`];
  if (annotation.locations.length) parts.push(`Detected locations: ${annotation.locations.join(", ")}`);
  if (annotation.events.length)    parts.push(`Detected events: ${annotation.events.join(", ")}`);
  parts.push(`Query sentiment: ${sentimentLabel}`);

  return parts.join("\n");
}

/**
 * Return a safe empty annotation for graceful degradation.
 * @returns {NLPAnnotation}
 * @private
 */
function _emptyAnnotation() {
  return { entities: [], sentiment: 0, locations: [], events: [] };
}
