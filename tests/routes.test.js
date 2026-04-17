/**
 * routes.test.js
 * @description Unit tests for the computeRoute Routes API integration.
 * Uses a manual fetch mock to isolate the module from network calls.
 */

// Mock window.ENV before importing the module
global.window = {
  ENV: { ROUTES_API_KEY: "TEST_KEY" }
};

// Store original fetch and restore after tests
let originalFetch;

beforeAll(() => { originalFetch = global.fetch; });
afterAll(()  => { global.fetch = originalFetch; });

import { computeRoute } from "../js/routes.js";

/** Helper to create a mock successful Routes API response */
function mockRoutesResponse(distanceMeters, duration) {
  global.fetch = async () => ({
    ok:   true,
    json: async () => ({
      routes: [{ distanceMeters, duration: String(duration) }]
    })
  });
}

describe("computeRoute — response parsing", () => {
  test("returns correct summary for short walk", async () => {
    mockRoutesResponse(120, 90); // 120m, 90 seconds
    const result = await computeRoute(
      { lat: 12.9716, lng: 77.5946 },
      { lat: 12.9720, lng: 77.5950 }
    );
    expect(result.summary).toBe("120m walk — about 2 min");
    expect(result.distanceM).toBe(120);
    expect(result.durationSec).toBe(90);
  });

  test("rounds distance and duration correctly", async () => {
    mockRoutesResponse(45.7, 55); // Should round to 46m, 1 min
    const result = await computeRoute(
      { lat: 12.9716, lng: 77.5946 },
      { lat: 12.9718, lng: 77.5948 }
    );
    expect(result.summary).toContain("46m walk");
    expect(result.summary).toContain("1 min");
  });

  test("handles zero distance gracefully", async () => {
    mockRoutesResponse(0, 0);
    const result = await computeRoute(
      { lat: 12.9716, lng: 77.5946 },
      { lat: 12.9716, lng: 77.5946 }
    );
    expect(result.distanceM).toBe(0);
    expect(result.durationSec).toBe(0);
  });

  test("throws on non-ok API response", async () => {
    global.fetch = async () => ({ ok: false, status: 403 });
    await expect(
      computeRoute({ lat: 0, lng: 0 }, { lat: 1, lng: 1 })
    ).rejects.toThrow("Routes API error 403");
  });

  test("throws when routes array is empty", async () => {
    global.fetch = async () => ({
      ok:   true,
      json: async () => ({ routes: [] })
    });
    await expect(
      computeRoute({ lat: 0, lng: 0 }, { lat: 1, lng: 1 })
    ).rejects.toThrow("no valid route");
  });

  test("throws when routes key is missing from response", async () => {
    global.fetch = async () => ({
      ok:   true,
      json: async () => ({})
    });
    await expect(
      computeRoute({ lat: 0, lng: 0 }, { lat: 1, lng: 1 })
    ).rejects.toThrow("no valid route");
  });
});
