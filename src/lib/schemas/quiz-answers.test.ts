import { describe, it, expect } from "vitest";
import { coreProfileSchema } from "./quiz-answers";

describe("coreProfileSchema", () => {
  it("accepts a valid core profile", () => {
    const r = coreProfileSchema.safeParse({ state: "Texas", gpa: 3.9, major: "History" });
    expect(r.success).toBe(true);
  });

  it("trims string fields", () => {
    const r = coreProfileSchema.parse({ state: "  Ohio  ", gpa: 3.0, major: "  Art  " });
    expect(r.state).toBe("Ohio");
    expect(r.major).toBe("Art");
  });

  it("rejects an empty state", () => {
    expect(coreProfileSchema.safeParse({ state: "", gpa: 3.0, major: "Math" }).success).toBe(false);
  });

  it("rejects an empty major", () => {
    expect(coreProfileSchema.safeParse({ state: "Iowa", gpa: 3.0, major: "" }).success).toBe(false);
  });

  it("rejects a non-numeric / out-of-range gpa", () => {
    expect(coreProfileSchema.safeParse({ state: "Iowa", gpa: NaN, major: "Math" }).success).toBe(false);
    expect(coreProfileSchema.safeParse({ state: "Iowa", gpa: 6, major: "Math" }).success).toBe(false);
    expect(coreProfileSchema.safeParse({ state: "Iowa", gpa: -1, major: "Math" }).success).toBe(false);
  });

  it("uses the same field names as the full quiz (key-aligned merge)", () => {
    const keys = Object.keys(coreProfileSchema.shape);
    expect(keys.sort()).toEqual(["gpa", "major", "state"]);
  });
});
