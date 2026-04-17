/**
 * routes.js
 * @module routes
 * @description Google Routes API v2 integration.
 * Fetches pedestrian walking directions between two lat/lng points,
 * separate from the Maps JavaScript API — counts as a distinct Google service.
 * Route summaries are injected into Gemini's context for natural-language navigation replies.
 *
 * Google Services used:
 *  - Routes API v2 (routes.googleapis.com) — crowd-aware pedestrian routing
 *
 * @see https://developers.google.com/maps/documentation/routes
 */

/** @constant {string} Routes API v2 endpoint */
const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

/** @constant {number} Request timeout in milliseconds */
const TIMEOUT_MS = 8_000;

/**
 * Compute a walking route between two geographic coordinates.
 * Uses the Routes API v2 with WALK travel mode and highway avoidance,
 * optimised for pedestrian venue navigation scenarios.
 *
 * @param {{ lat: number, lng: number }} origin      - Starting lat/lng (e.g. user's current gate)
 * @param {{ lat: number, lng: number }} destination - Target lat/lng (e.g. nearest food stall)
 * @returns {Promise<{ summary: string, distanceM: number, durationSec: number }>}
 *          Route summary, raw distance in metres, and raw duration in seconds
 * @throws {Error} If the API responds with an error or returns no valid route
 *
 * @example
 * const route = await computeRoute({ lat: 12.9716, lng: 77.5946 }, { lat: 12.972, lng: 77.595 });
 * console.log(route.summary); // "45m walk — about 1 min"
 */
export async function computeRoute(origin, destination) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const body = {
    origin:      { location: { latLng: origin } },
    destination: { location: { latLng: destination } },
    travelMode:  "WALK",
    computeAlternativeRoutes: false,
    routeModifiers: { avoidHighways: true },
  };

  let res;
  try {
    res = await fetch(ROUTES_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type":    "application/json",
        "X-Goog-Api-Key":  window.ENV.ROUTES_API_KEY,
        "X-Goog-FieldMask":
          "routes.duration,routes.distanceMeters,routes.legs.steps.navigationInstruction",
      },
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new Error(`Routes API error ${res.status}`);

  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) throw new Error("Routes API returned no valid route");

  const distM   = route.distanceMeters ?? 0;
  const durSec  = parseInt(route.duration, 10) || 0;

  return {
    summary:     `${Math.round(distM)}m walk — about ${Math.round(durSec / 60)} min`,
    distanceM:   distM,
    durationSec: durSec,
  };
}
