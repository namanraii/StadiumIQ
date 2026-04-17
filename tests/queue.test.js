import { buildQueueSummary } from "../js/firebase.js";

describe("buildQueueSummary", () => {
  const stalls = [
    { id: "c1", name: "Stadium Grill" },
    { id: "c2", name: "Snack Bar" },
    { id: "c3", name: "North Stand Cafe" },
  ];

  const queues = {
    c1: { waitMinutes: 7,  isOpen: true  },
    c2: { waitMinutes: 0,  isOpen: false },
    c3: { waitMinutes: 12, isOpen: true  },
  };

  test("only includes open stalls",        () => {
    const s = buildQueueSummary(queues, stalls);
    expect(s).toContain("Stadium Grill");
    expect(s).not.toContain("Snack Bar");
  });

  test("includes wait time in mins",       () => expect(buildQueueSummary(queues, stalls)).toContain("7 min"));
  test("includes all open stalls",         () => expect(buildQueueSummary(queues, stalls)).toContain("North Stand Cafe"));
  test("returns empty for no open stalls", () => {
    const allClosed = { c1: { waitMinutes: 7, isOpen: false } };
    expect(buildQueueSummary(allClosed, [{ id: "c1", name: "Grill" }])).toBe("");
  });
  test("handles empty queues object",      () => expect(buildQueueSummary({}, stalls)).toBe(""));
  test("handles null queues gracefully",   () => expect(buildQueueSummary(null, stalls)).toBe(""));
  test("handles empty stalls array",       () => expect(buildQueueSummary(queues, [])).toBe(""));
  test("handles non-array stalls",         () => expect(buildQueueSummary(queues, null)).toBe(""));
  test("stall with missing queue entry",   () => {
    // c4 exists in stalls but not in queues — should be filtered out safely
    const result = buildQueueSummary(queues, [...stalls, { id: "c4", name: "Mystery Bar" }]);
    expect(result).not.toContain("Mystery Bar");
  });
  test("comma-separated output format",    () => {
    const s = buildQueueSummary(queues, stalls);
    expect(s).toMatch(/Stadium Grill: 7 min, North Stand Cafe: 12 min/);
  });
});
