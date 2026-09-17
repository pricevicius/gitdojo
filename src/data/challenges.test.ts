import { describe, it, expect } from "vitest";
import { CHALLENGES } from "./challenges";

describe("desafios", () => {
  it.each(CHALLENGES.map((c) => [c.id, c] as const))(
    "%s começa não resolvido (goal(setup()) é false)",
    (_id, challenge) => {
      expect(challenge.goal(challenge.setup())).toBe(false);
    }
  );

  it("todos os ids são únicos", () => {
    const ids = CHALLENGES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
