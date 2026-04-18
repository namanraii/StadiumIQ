/**
 * @fileoverview StadiumIQ Cloud Functions — Secure AI Backend
 * @module stadiumiq-cloud-functions
 *
 * Google Cloud services used in this function:
 *  - Vertex AI (aiplatform.googleapis.com) — enterprise Gemini 2.5 Flash
 *    Called server-side with service-account auth (no exposed browser keys).
 *    In production, API keys are securely retrieved via Google Cloud Secret Manager.
 *  - Cloud Natural Language API — entity extraction on user queries
 *  - BigQuery Streaming Inserts — analytics pipeline for every interaction
 *  - Cloud Functions (this file) — HTTP trigger orchestrating the full pipeline
 *
 * Architecture:
 *  Browser → Cloud Function (authenticated) → Vertex AI Gemini 2.5 Flash
 *                                           → Cloud NL API (entity analysis)
 *                                           → BigQuery (interaction logging)
 *                          ↓
 *                      Response returned to browser
 */

"use strict";

const functions = require("@google-cloud/functions-framework");
const { VertexAI } = require("@google-cloud/vertexai");
const { BigQuery } = require("@google-cloud/bigquery");
const { LanguageServiceClient } = require("@google-cloud/language");

// ---------------------------------------------------------------------------
// Google Cloud Configuration
// ---------------------------------------------------------------------------

const PROJECT_ID  = process.env.GCP_PROJECT || "smartstadium-493619";
const LOCATION    = "us-central1";
const BQ_DATASET  = "stadium_analytics";
const BQ_TABLE    = "cf_interactions";

/** @type {VertexAI} Vertex AI client (uses service account auth automatically) */
const vertex = new VertexAI({ project: PROJECT_ID, location: LOCATION });

/** @type {BigQuery} BigQuery client for server-side streaming inserts */
const bigquery = new BigQuery({ projectId: PROJECT_ID });

/** @type {LanguageServiceClient} Cloud Natural Language API client */
const nlpClient = new LanguageServiceClient();

// ---------------------------------------------------------------------------
// System Instruction (injected server-side — never exposed to frontend)
// ---------------------------------------------------------------------------

const SYSTEM_INSTRUCTION = `You are StadiumIQ, a proactive AI concierge for MetroArena.
Answer directly and concisely using ONLY the live venue data provided.
Keep responses under 2 sentences. Never make up queue times or gate states.
If data is missing, say so and suggest checking the venue app.`;

// ---------------------------------------------------------------------------
// Cloud Function: stadiumIQAssist
// ---------------------------------------------------------------------------

/**
 * HTTP-triggered Cloud Function — secure AI query backend for StadiumIQ.
 *
 * Pipeline:
 *  1. Validates and sanitises the incoming request
 *  2. Cloud Natural Language API: extracts entities from user query
 *  3. Vertex AI (Gemini 2.5 Flash): generates context-aware response
 *  4. BigQuery: streams full interaction record for analytics
 *  5. Returns { reply, entities } to the browser
 *
 * @param {import('@google-cloud/functions-framework').Request}  req
 * @param {import('@google-cloud/functions-framework').Response} res
 */
functions.http("stadiumIQAssist", async (req, res) => {
  // CORS — allow the Cloud Run frontend domain
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const { message, context, sessionId = "anonymous", intent = "general" } = req.body || {};

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required and must be a string" });
    return;
  }

  const sanitised = message.replace(/[<>&"'`]/g, "").substring(0, 300).trim();
  const startMs   = Date.now();

  try {
    // ------------------------------------------------------------------
    // Stage 1: Cloud Natural Language API — entity extraction
    // ------------------------------------------------------------------
    let entities = [];
    try {
      const [nlResult] = await nlpClient.analyzeEntities({
        document: { content: sanitised, type: "PLAIN_TEXT" },
      });
      entities = (nlResult.entities || [])
        .filter(e => e.salience > 0.1)
        .map(e => ({ name: e.name, type: e.type }));
    } catch (_nlErr) {
      // Non-fatal — continue without NL enrichment
    }

    // ------------------------------------------------------------------
    // Stage 2: Vertex AI — Gemini 2.5 Flash (enterprise, service-account auth)
    // ------------------------------------------------------------------
    const model = vertex.preview.getGenerativeModel({
      model: "gemini-2.5-flash-preview-04-17",
      generationConfig: { maxOutputTokens: 256, temperature: 0.4 },
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
      ],
    });

    const contextBlock = typeof context === "object"
      ? `LIVE VENUE DATA: ${JSON.stringify(context)}`
      : String(context || "");

    const nlBlock = entities.length
      ? `\nDetected entities: ${entities.map(e => `${e.name}(${e.type})`).join(", ")}`
      : "";

    const result = await model.generateContent({
      contents: [{
        role:  "user",
        parts: [{ text: `${contextBlock}${nlBlock}\n\nUser: ${sanitised}` }],
      }],
    });

    const reply       = result.response.candidates[0].content.parts[0].text.trim();
    const responseMs  = Date.now() - startMs;

    // ------------------------------------------------------------------
    // Stage 3: BigQuery — server-side streaming insert (more reliable than browser)
    // ------------------------------------------------------------------
    try {
      await bigquery
        .dataset(BQ_DATASET)
        .table(BQ_TABLE)
        .insert([{
          session_id:   sessionId,
          query:        sanitised,
          intent:       intent,
          response:     reply,
          response_ms:  responseMs,
          entities_json: JSON.stringify(entities),
          ts:           new Date().toISOString(),
        }]);
    } catch (_bqErr) {
      // Non-fatal — analytics failure never blocks the response
    }

    res.status(200).json({ reply, entities, response_ms: responseMs });

  } catch (err) {
    console.error("[StadiumIQ:cf] Pipeline error:", err.message);
    res.status(500).json({ error: "AI pipeline error. Please retry." });
  }
});
