import { evaluateTrigger, stopProactiveLoop } from "../js/proactive.js";

afterAll(() => stopProactiveLoop());

const baseCtx = {
  queues:    { r1: { waitMinutes: 2 }, r2: { waitMinutes: 5 } },
  gates:     { D: { capacityPct: 18 } },
  crowd:     { "main-exit": { density: 0.75 }, "north-bridge": { density: 0.2 } },
};

describe("evaluateTrigger — game phases", () => {
  test("pre-game fires with least-crowded gate info", () => {
    const ctx = { ...baseCtx, gameState: { quarter: 0, minutesLeft: 30, phase: "pre" } };
    const trigger = evaluateTrigger(ctx);
    expect(trigger?.key).toBe("pre-gates");
    expect(trigger?.reason).toContain("Gate D");
  });

  test("halftime fires with restroom suggestion", () => {
    const ctx = { ...baseCtx, gameState: { quarter: 2, minutesLeft: 0, phase: "halftime" } };
    const trigger = evaluateTrigger(ctx);
    expect(trigger?.key).toBe("halftime");
    expect(trigger?.reason).toContain("R1");
  });

  test("post-game fires at full time", () => {
    const ctx = { ...baseCtx, gameState: { quarter: 4, minutesLeft: 0, phase: "post" } };
    expect(evaluateTrigger(ctx)?.key).toBe("post-game");
  });
});

describe("evaluateTrigger — quarter triggers", () => {
  test("q2-end fires when Q2 minutesLeft ≤ 2", () => {
    const ctx = { ...baseCtx, gameState: { quarter: 2, minutesLeft: 1, phase: "live" } };
    expect(evaluateTrigger(ctx)?.key).toBe("q2-end");
  });

  test("q2-end fires at exactly minutesLeft = 2", () => {
    const ctx = { ...baseCtx, gameState: { quarter: 2, minutesLeft: 2, phase: "live" } };
    expect(evaluateTrigger(ctx)?.key).toBe("q2-end");
  });

  test("q2-end does NOT fire when minutesLeft = 3", () => {
    const ctx = { ...baseCtx, gameState: { quarter: 2, minutesLeft: 3, phase: "live" } };
    expect(evaluateTrigger(ctx)).toBeNull();
  });

  test("q4-exit fires when Q4 ends + exit crowded", () => {
    const ctx = { ...baseCtx, gameState: { quarter: 4, minutesLeft: 3, phase: "live" } };
    expect(evaluateTrigger(ctx)?.key).toBe("q4-exit");
  });

  test("q4-exit does NOT fire when exit density ≤ 0.6", () => {
    const lowDensityCtx = {
      ...baseCtx,
      crowd: { "main-exit": { density: 0.5 }, "north-bridge": { density: 0.2 } },
      gameState: { quarter: 4, minutesLeft: 3, phase: "live" },
    };
    expect(evaluateTrigger(lowDensityCtx)).toBeNull();
  });

  test("q4-exit does NOT fire beyond 5 minutes left", () => {
    const ctx = { ...baseCtx, gameState: { quarter: 4, minutesLeft: 6, phase: "live" } };
    expect(evaluateTrigger(ctx)).toBeNull();
  });

  test("returns null when Q1 — no trigger condition", () => {
    const ctx = { ...baseCtx, gameState: { quarter: 1, minutesLeft: 14, phase: "live" } };
    expect(evaluateTrigger(ctx)).toBeNull();
  });
});

describe("evaluateTrigger — edge cases", () => {
  test("returns null for empty context", () => {
    expect(evaluateTrigger({})).toBeNull();
  });

  test("trigger reason includes density percentage", () => {
    const ctx = { ...baseCtx, gameState: { quarter: 4, minutesLeft: 3, phase: "live" } };
    expect(evaluateTrigger(ctx)?.reason).toContain("75%");
  });

  test("trigger reason includes alternate route info", () => {
    const ctx = { ...baseCtx, gameState: { quarter: 4, minutesLeft: 3, phase: "live" } };
    expect(evaluateTrigger(ctx)?.reason).toContain("North Bridge");
  });
});
