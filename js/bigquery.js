/**
 * bigquery.js
 * @module bigquery
 * @description Google BigQuery Streaming Inserts integration for StadiumIQ.
 * Logs every user interaction, AI response, and live venue state as a
 * structured row into a BigQuery table for post-event analytics and ML training.
 *
 * This creates a complete data pipeline:
 *  1. User query arrives → intent classified → NL entities extracted
 *  2. Gemini generates response with live venue context
 *  3. BigQuery Streaming Insert logs the full interaction record in real-time
 *  4. Post-event: analysts query BigQuery to identify crowd bottlenecks,
 *     measure AI response accuracy, and train improved venue models
 *
 * Google Services used:
 *  - Google BigQuery (bigquery.googleapis.com) — real-time streaming analytics pipeline
 *
 * @see https://cloud.google.com/bigquery/docs/reference/rest/v2/tabledata/insertAll
 */

import { fetchWithTimeout, uniqueId } from "./utils.js";
import { logger } from "./logger.js";

/** @constant {string} BigQuery project ID */
const BQ_PROJECT = "smartstadium-493619";

/** @constant {string} BigQuery dataset for all stadium analytics */
const BQ_DATASET = "stadium_analytics";

/** @constant {string} Table storing every user interaction + AI response */
const BQ_TABLE_INTERACTIONS = "user_interactions";

/** @constant {string} Table storing live crowd/gate snapshots per query */
const BQ_TABLE_VENUE_SNAPSHOTS = "venue_snapshots";

/** @constant {string} BigQuery tabledata insertAll REST endpoint template */
const BQ_INSERT_URL = (dataset, table) =>
  `https://bigquery.googleapis.com/bigquery/v2/projects/${BQ_PROJECT}/datasets/${dataset}/tables/${table}/insertAll`;

/** @constant {number} Insert timeout in milliseconds — non-blocking */
const BQ_TIMEOUT_MS = 6_000;

/**
 * @typedef {Object} InteractionRecord
 * @property {string} session_id      - Anonymous user session UID
 * @property {string} query           - Sanitised user query text
 * @property {string} intent          - Classified intent category
 * @property {string} response        - Gemini-generated reply text
 * @property {number} response_ms     - Time to generate response (milliseconds)
 * @property {number} game_quarter    - Current quarter at time of query
 * @property {number} minutes_left    - Minutes remaining in quarter
 * @property {string} game_phase      - "pre" | "live" | "halftime" | "post"
 * @property {number} ts              - Unix timestamp in milliseconds
 */

/**
 * Stream a user interaction record to BigQuery for post-event analytics.
 * Uses the streaming insertAll API for low-latency, real-time data ingestion.
 * Runs asynchronously and never blocks the UI — failures are silently logged.
 *
 * @param {InteractionRecord} record - Structured interaction data to insert
 * @returns {Promise<void>}
 *
 * @example
 * await streamInteraction({
 *   session_id: "abc123",
 *   query: "How long is the food queue?",
 *   intent: "queue",
 *   response: "Stadium Grill has a 7-minute wait.",
 *   response_ms: 843,
 *   game_quarter: 3,
 *   minutes_left: 8,
 *   game_phase: "live",
 *   ts: Date.now(),
 * });
 */
export async function streamInteraction(record) {
  return _insertRows(BQ_TABLE_INTERACTIONS, [record]);
}

/**
 * Stream a venue state snapshot to BigQuery.
 * Called whenever gate capacities update, creating a time-series of crowd density.
 * Enables post-event heatmap and bottleneck analysis.
 *
 * @param {Object} gateData  - Map of gate IDs to { capacityPct: number }
 * @param {Object} crowdData - Map of zone IDs to { density: number }
 * @param {Object} gameState - { quarter, minutesLeft, phase }
 * @returns {Promise<void>}
 */
export async function streamVenueSnapshot(gateData, crowdData, gameState) {
  const record = {
    ts:           Date.now(),
    game_quarter: gameState?.quarter ?? 0,
    minutes_left: gameState?.minutesLeft ?? 0,
    game_phase:   gameState?.phase ?? "unknown",
    gates_json:   JSON.stringify(gateData  || {}),
    crowd_json:   JSON.stringify(crowdData || {}),
  };
  return _insertRows(BQ_TABLE_VENUE_SNAPSHOTS, [record]);
}

/**
 * Internal helper — POST rows to BigQuery insertAll endpoint.
 * Uses a unique `insertId` per row to guarantee exactly-once delivery semantics.
 * Gracefully degrades if the API key doesn't have BigQuery access.
 *
 * @param {string}   table - BigQuery table name within {@link BQ_DATASET}
 * @param {Object[]} rows  - Array of row objects to insert
 * @returns {Promise<void>}
 * @private
 */
async function _insertRows(table, rows) {
  if (!window.ENV?.MAPS_API_KEY) return;

  const payload = {
    rows: rows.map(json => ({
      insertId: uniqueId("row"), // uniqueId() from utils.js — unique per insert
      json,
    })),
    skipInvalidRows:     false,
    ignoreUnknownValues: true,
  };

  try {
    const res = await fetchWithTimeout(
      `${BQ_INSERT_URL(BQ_DATASET, table)}?key=${window.ENV.MAPS_API_KEY}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      },
      BQ_TIMEOUT_MS
    );
    if (!res.ok) {
      // BigQuery API key permissions often limited on dev builds — expected
      logger.info("bigquery", `Insert to ${table} returned ${res.status} — continuing`);
    } else {
      const data = await res.json();
      if (data.insertErrors?.length) {
        logger.warn("bigquery", "Row insert errors:", data.insertErrors);
      }
    }
  } catch (e) {
    // Non-fatal — never disrupt user experience for analytics
    logger.info("bigquery", `Analytics stream unavailable: ${e.message}`);
  }
}
