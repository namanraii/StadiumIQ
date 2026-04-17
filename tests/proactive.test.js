import { evaluateTrigger } from "../js/proactive.js";

const baseCtx = {
  queues: { r1: { waitMinutes: 2 }, r2: { waitMinutes: 5 } },
  gates:  { D: { capacityPct: 18 } },
  crowd:  { "main-exit": { density: 0.75 }, "north-bridge": { density: 0.2 } },
};

describe("evaluateTrigger", () => {
  test("q2-end fires when Q2 minutesLeft <= 2", () => {
    const ctx = { ...baseCtx, gameState: { quarter: 2, minutesLeft: 1, phase: "live" } };
    expect(evaluateTrigger(ctx)?.key).toBe("q2-end");
  });
  test("q4-exit fires when Q4 ends + exit crowded", () => {
    const ctx = { ...baseCtx, gameState: { quarter: 4, minutesLeft: 3, phase: "live" } };
    expect(evaluateTrigger(ctx)?.key).toBe("q4-exit");
  });
  test("halftime fires when phase = halftime", () => {
    const ctx = { ...baseCtx, gameState: { quarter: 2, minutesLeft: 0, phase: "halftime" } };
    expect(evaluateTrigger(ctx)?.key).toBe("halftime");
  });
  test("returns null when no trigger condition met", () => {
    const ctx = { ...baseCtx, gameState: { quarter: 1, minutesLeft: 14, phase: "live" } };
    expect(evaluateTrigger(ctx)).toBeNull();
  });
});
