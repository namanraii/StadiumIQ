import { buildQueueSummary } from "../js/firebase.js";

describe("buildQueueSummary", () => {
  const queues = { c1: { waitMinutes: 7, isOpen: true }, c2: { waitMinutes: 0, isOpen: false } };
  const stalls = [{ id: "c1", name: "Stadium Grill" }, { id: "c2", name: "Snack Bar" }];

  test("only includes open stalls",  () => { const s = buildQueueSummary(queues, stalls); expect(s).toContain("Stadium Grill"); expect(s).not.toContain("Snack Bar"); });
  test("includes wait time in mins", () => expect(buildQueueSummary(queues, stalls)).toContain("7 min"));
});
