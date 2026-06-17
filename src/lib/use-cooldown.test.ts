import { describe, it, expect } from "vitest";
import { cooldownRemaining } from "./use-cooldown";

describe("cooldownRemaining", () => {
  it("returns 0 when no cooldown is armed", () => {
    expect(cooldownRemaining(null, 1_000)).toBe(0);
  });

  it("returns the full duration at the moment it is armed", () => {
    expect(cooldownRemaining(60_000, 0)).toBe(60);
  });

  it("rounds partial seconds up so the button stays disabled until truly elapsed", () => {
    expect(cooldownRemaining(10_000, 4_300)).toBe(6); // 5.7s left -> 6
  });

  it("clamps to 0 once the deadline has passed", () => {
    expect(cooldownRemaining(10_000, 10_001)).toBe(0);
    expect(cooldownRemaining(10_000, 50_000)).toBe(0);
  });
});
