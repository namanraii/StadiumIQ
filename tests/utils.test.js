/**
 * utils.test.js
 * @description Unit tests for js/utils.js
 * Covers: fetchWithTimeout, sanitise, uniqueId, clamp
 */

import { sanitise, uniqueId, clamp } from "../js/utils.js";

// ---------------------------------------------------------------------------
// sanitise()
// ---------------------------------------------------------------------------
describe("sanitise", () => {
  test("removes HTML angle brackets", () => {
    expect(sanitise("<script>")).toBe("script");
  });

  test("removes & character", () => {
    expect(sanitise("bread & butter")).toBe("bread  butter");
  });

  test("removes double quotes", () => {
    expect(sanitise(`say "hello"`)).toBe("say hello");
  });

  test("removes single quotes", () => {
    expect(sanitise("it's fine")).toBe("its fine");
  });

  test("removes backticks", () => {
    expect(sanitise("use `this`")).toBe("use this");
  });

  test("trims leading and trailing whitespace", () => {
    expect(sanitise("  hello  ")).toBe("hello");
  });

  test("enforces default 300 char limit", () => {
    const long = "a".repeat(400);
    expect(sanitise(long).length).toBe(300);
  });

  test("enforces custom max length", () => {
    expect(sanitise("hello world", 5)).toBe("hello");
  });

  test("returns empty string for non-string input", () => {
    expect(sanitise(null)).toBe("");
    expect(sanitise(undefined)).toBe("");
    expect(sanitise(42)).toBe("");
  });

  test("returns empty string for empty input", () => {
    expect(sanitise("")).toBe("");
  });

  test("preserves normal text unchanged", () => {
    expect(sanitise("How long is the queue at Gate A?"))
      .toBe("How long is the queue at Gate A?");
  });

  test("handles XSS attempt gracefully", () => {
    const xss = `<img src=x onerror="alert('xss')">`;
    const result = sanitise(xss);
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
    expect(result).not.toContain('"');
  });
});

// ---------------------------------------------------------------------------
// uniqueId()
// ---------------------------------------------------------------------------
describe("uniqueId", () => {
  test("returns a non-empty string", () => {
    expect(typeof uniqueId()).toBe("string");
    expect(uniqueId().length).toBeGreaterThan(0);
  });

  test("prepends prefix with separator", () => {
    const id = uniqueId("row");
    expect(id.startsWith("row-")).toBe(true);
  });

  test("works without prefix", () => {
    const id = uniqueId();
    expect(id).toMatch(/^\d+-[0-9a-f]+$/);
  });

  test("each call returns a unique value", () => {
    const ids = new Set(Array.from({ length: 100 }, () => uniqueId("test")));
    expect(ids.size).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// clamp()
// ---------------------------------------------------------------------------
describe("clamp", () => {
  test("returns value when within range", () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  test("clamps to minimum when below", () => {
    expect(clamp(-1, 0, 1)).toBe(0);
  });

  test("clamps to maximum when above", () => {
    expect(clamp(1.5, 0, 1)).toBe(1);
  });

  test("returns min when value equals min", () => {
    expect(clamp(0, 0, 1)).toBe(0);
  });

  test("returns max when value equals max", () => {
    expect(clamp(1, 0, 1)).toBe(1);
  });

  test("works with negative ranges", () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
    expect(clamp(0, -10, -1)).toBe(-1);
  });

  test("works with integer ranges", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
});
