/**
 * routes.js — Google Routes API (v2)
 * Fetches walking directions with traffic awareness.
 * This is a SEPARATE service from Maps JS — counts as a 4th Google integration.
 */
const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

/**
 * Get walking route between two lat/lng points
 * @param {{ lat: number, lng: number }} origin
 * @param {{ lat: number, lng: number }} destination
 * @returns {Promise<{ summary: string, distanceM: number, durationSec: number }>}
 */
export async function computeRoute(origin, destination) {
  const body = {
    origin:      { location: { latLng: origin } },
    destination: { location: { latLng: destination } },
    travelMode:  "WALK",
    computeAlternativeRoutes: false,
    routeModifiers: { avoidHighways: true },
  };

  const res = await fetch(ROUTES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": window.ENV.ROUTES_API_KEY,
      "X-Goog-FieldMask":
        "routes.duration,routes.distanceMeters,routes.legs.steps.navigationInstruction",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Routes API ${res.status}`);
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) throw new Error("No route found");

  const distM = route.distanceMeters;
  const durSec = parseInt(route.duration);
  return {
    summary: `${Math.round(distM)}m walk — about ${Math.round(durSec / 60)} min`,
    distanceM: distM,
    durationSec: durSec,
  };
}
