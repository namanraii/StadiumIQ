/**
 * nlp.test.js
 * @description Unit tests for js/nlp.js
 * Covers: formatAnnotationForContext — pure function, no API calls needed
 */

import { formatAnnotationForContext } from "../js/nlp.js";

describe("formatAnnotationForContext", () => {
  test("returns empty string for null input", () => {
    expect(formatAnnotationForContext(null)).toBe("");
  });

  test("returns empty string for empty entities array", () => {
    expect(formatAnnotationForContext({ entities: [], sentiment: 0, locations: [], events: [] })).toBe("");
  });

  test("returns empty string for undefined input", () => {
    expect(formatAnnotationForContext(undefined)).toBe("");
  });

  test("includes entity name and type", () => {
    const annotation = {
      entities:  [{ name: "Gate D", type: "LOCATION", salience: 0.9 }],
      sentiment: 0,
      locations: ["Gate D"],
      events:    [],
    };
    const result = formatAnnotationForContext(annotation);
    expect(result).toContain("Gate D");
    expect(result).toContain("LOCATION");
  });

  test("includes detected locations line when locations present", () => {
    const annotation = {
      entities:  [{ name: "Gate A", type: "LOCATION", salience: 0.8 }],
      sentiment: 0.1,
      locations: ["Gate A"],
      events:    [],
    };
    const result = formatAnnotationForContext(annotation);
    expect(result).toContain("Detected locations: Gate A");
  });

  test("includes detected events line when events present", () => {
    const annotation = {
      entities:  [{ name: "halftime", type: "EVENT", salience: 0.7 }],
      sentiment: 0,
      locations: [],
      events:    ["halftime"],
    };
    const result = formatAnnotationForContext(annotation);
    expect(result).toContain("Detected events: halftime");
  });

  test("omits locations line when locations empty", () => {
    const annotation = {
      entities:  [{ name: "food", type: "OTHER", salience: 0.5 }],
      sentiment: 0,
      locations: [],
      events:    [],
    };
    const result = formatAnnotationForContext(annotation);
    expect(result).not.toContain("Detected locations");
  });

  test("reports positive sentiment correctly", () => {
    const annotation = {
      entities:  [{ name: "food", type: "OTHER", salience: 0.5 }],
      sentiment: 0.8,
      locations: [],
      events:    [],
    };
    expect(formatAnnotationForContext(annotation)).toContain("positive");
  });

  test("reports negative sentiment correctly", () => {
    const annotation = {
      entities:  [{ name: "queue", type: "OTHER", salience: 0.6 }],
      sentiment: -0.5,
      locations: [],
      events:    [],
    };
    expect(formatAnnotationForContext(annotation)).toContain("negative");
  });

  test("reports neutral sentiment for borderline scores", () => {
    const annotation = {
      entities:  [{ name: "seat", type: "OTHER", salience: 0.4 }],
      sentiment: 0.1,
      locations: [],
      events:    [],
    };
    expect(formatAnnotationForContext(annotation)).toContain("neutral");
  });

  test("caps entity output at 5 entries", () => {
    const entities = Array.from({ length: 10 }, (_, i) => ({
      name: `Entity${i}`, type: "OTHER", salience: 0.5,
    }));
    const annotation = { entities, sentiment: 0, locations: [], events: [] };
    const result = formatAnnotationForContext(annotation);
    // Only first 5 should appear
    expect(result).toContain("Entity0");
    expect(result).not.toContain("Entity5");
  });

  test("formats salience to 2 decimal places", () => {
    const annotation = {
      entities:  [{ name: "Gate B", type: "LOCATION", salience: 0.8765 }],
      sentiment: 0,
      locations: ["Gate B"],
      events:    [],
    };
    expect(formatAnnotationForContext(annotation)).toContain("0.88");
  });
});
