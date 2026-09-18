import { describe, it, expect } from "vitest";
import { WP_CHALLENGES } from "./wpChallenges";

describe("desafios wp-cli", () => {
  it.each(WP_CHALLENGES.map((c) => [c.id, c] as const))(
    "%s começa não resolvido (goal(setup()) é false)",
    (_id, challenge) => {
      expect(challenge.goal(challenge.setup())).toBe(false);
    }
  );

  it("todos os ids são únicos", () => {
    const ids = WP_CHALLENGES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
