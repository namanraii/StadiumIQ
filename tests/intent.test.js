import { classifyIntent, classifyIntentAll } from "../js/intent.js";

describe("classifyIntent — primary intent", () => {
  // Navigation
  test("navigation → seat query",        () => expect(classifyIntent("How do I get to seat 42?")).toBe("navigation"));
  test("navigation → gate query",        () => expect(classifyIntent("Where is Gate D?")).toBe("navigation"));
  test("navigation → entrance query",    () => expect(classifyIntent("Which entrance should I use?")).toBe("navigation"));
  test("navigation → route query",       () => expect(classifyIntent("Show me the route to my seat")).toBe("navigation"));

  // Queue
  test("queue → food query",             () => expect(classifyIntent("How long is the food queue?")).toBe("queue"));
  test("queue → wait time",             () => expect(classifyIntent("What's the wait time at the concession?")).toBe("queue"));
  test("queue → busy check",            () => expect(classifyIntent("Is it busy at the snack bar?")).toBe("queue"));

  // Facilities
  test("facilities → restroom",         () => expect(classifyIntent("Where is the toilet?")).toBe("facilities"));
  test("facilities → first aid",        () => expect(classifyIntent("I need first aid help")).toBe("facilities"));
  test("facilities → ATM",              () => expect(classifyIntent("Is there an ATM nearby?")).toBe("facilities"));
  test("facilities → wheelchair",       () => expect(classifyIntent("Wheelchair access please")).toBe("facilities"));

  // Exit
  test("exit → leave query",            () => expect(classifyIntent("Best way to exit?")).toBe("exit"));
  test("exit → parking",                () => expect(classifyIntent("Where is the parking?")).toBe("exit"));
  test("exit → go home",                () => expect(classifyIntent("How do I go home?")).toBe("exit"));

  // Schedule
  test("schedule → kickoff",            () => expect(classifyIntent("When does it kick off?")).toBe("schedule"));
  test("schedule → halftime",           () => expect(classifyIntent("When is half time?")).toBe("schedule"));
  test("schedule → next event",         () => expect(classifyIntent("What's next?")).toBe("schedule"));

  // Alert
  test("alert → emergency",             () => expect(classifyIntent("Is there an emergency?")).toBe("alert"));
  test("alert → announcement",          () => expect(classifyIntent("Any announcements?")).toBe("alert"));

  // Lost
  test("lost → lost item",              () => expect(classifyIntent("I lost my bag")).toBe("lost"));
  test("lost → found item",             () => expect(classifyIntent("I found something")).toBe("lost"));

  // General fallback
  test("general → unrecognised",        () => expect(classifyIntent("Great game!")).toBe("general"));
  test("general → empty string",        () => expect(classifyIntent("")).toBe("general"));
  test("general → non-string input",    () => expect(classifyIntent(null)).toBe("general"));
});

describe("classifyIntentAll — multi-intent queries", () => {
  test("food near exit → queue + exit",  () => {
    const intents = classifyIntentAll("Where is food near the exit?");
    expect(intents).toContain("queue");
    expect(intents).toContain("exit");
  });

  test("empty string → no intents",     () => expect(classifyIntentAll("")).toHaveLength(0));
  test("non-string → no intents",       () => expect(classifyIntentAll(42)).toHaveLength(0));
  test("single intent → one result",    () => expect(classifyIntentAll("Where's the toilet?")).toEqual(["facilities"]));
});
