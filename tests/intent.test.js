import { classifyIntent } from "../js/intent.js";

describe("classifyIntent", () => {
  test("navigation → seat query",     () => expect(classifyIntent("How do I get to seat 42?")).toBe("navigation"));
  test("queue → food query",          () => expect(classifyIntent("How long is the food queue?")).toBe("queue"));
  test("facilities → restroom",       () => expect(classifyIntent("Where is the toilet?")).toBe("facilities"));
  test("exit → leave query",          () => expect(classifyIntent("Best way to exit?")).toBe("exit"));
  test("schedule → kickoff",          () => expect(classifyIntent("When does it kick off?")).toBe("schedule"));
  test("general → unrecognised",      () => expect(classifyIntent("Great game!")).toBe("general"));
});
