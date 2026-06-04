import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the supabase server client so we can drive auth + profile + list state.
// The gate queries `profiles` first, then `user_lists` only when core_profile is
// null, so the mock returns per-table data.
const state: { user: unknown; prof: unknown; list: unknown } = {
  user: null,
  prof: null,
  list: null,
};

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: null }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: table === "user_lists" ? state.list : state.prof,
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

// Import after the mock is registered.
const { proxy } = await import("./proxy");

function req(path: string) {
  return new NextRequest(new URL(`http://localhost${path}`));
}

function locationOf(res: Response): string | null {
  const loc = res.headers.get("location");
  return loc ? new URL(loc).pathname : null;
}

beforeEach(() => {
  state.user = null;
  state.prof = null;
  state.list = null;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
});

describe("proxy core-profile gate", () => {
  it("redirects an authed student with null core_profile to /onboarding", async () => {
    state.user = { id: "u1" };
    state.prof = { role: "student", core_profile: null };
    const res = await proxy(req("/tracker"));
    expect(res.status).toBe(307);
    expect(locationOf(res)).toBe("/onboarding");
  });

  it("does NOT redirect a student with null core_profile who already did the full quiz", async () => {
    state.user = { id: "u1" };
    state.prof = { role: "student", core_profile: null };
    state.list = { colleges: { quiz_answers: { state: "CA", gpa: 3.5, major: "CS" } } };
    const res = await proxy(req("/tracker"));
    expect(locationOf(res)).toBeNull(); // has quiz data → not re-asked
  });

  it("redirects a student with null core_profile and an empty list (no quiz)", async () => {
    state.user = { id: "u1" };
    state.prof = { role: "student", core_profile: null };
    state.list = { colleges: { list: [] } }; // list row exists but no quiz_answers
    const res = await proxy(req("/tracker"));
    expect(locationOf(res)).toBe("/onboarding");
  });

  it("lets a student WITH a core_profile through", async () => {
    state.user = { id: "u1" };
    state.prof = { role: "student", core_profile: { state: "CA", gpa: 3.5, major: "CS" } };
    const res = await proxy(req("/tracker"));
    expect(locationOf(res)).toBeNull(); // no redirect
  });

  it("does NOT gate counselors (no core_profile expected)", async () => {
    state.user = { id: "u2" };
    state.prof = { role: "counselor", core_profile: null };
    const res = await proxy(req("/tracker"));
    expect(locationOf(res)).toBeNull();
  });

  it("does not run the gate on a non-protected path", async () => {
    state.user = { id: "u1" };
    state.prof = { role: "student", core_profile: null };
    // /privacy is not in PROTECTED and not matched, but proxy is path-agnostic
    // for the gate (guarded by isProtected); a non-protected path passes through.
    const res = await proxy(req("/privacy"));
    expect(locationOf(res)).toBeNull();
  });

  it("redirects an unauthenticated user on a protected path to /auth (existing behavior)", async () => {
    state.user = null;
    const res = await proxy(req("/tracker"));
    expect(res.status).toBe(307);
    expect(locationOf(res)).toBe("/auth");
  });

  it("redirects an authed user away from /auth (existing behavior)", async () => {
    state.user = { id: "u1" };
    state.prof = { role: "student", core_profile: { state: "CA", gpa: 3.5, major: "CS" } };
    const res = await proxy(req("/auth"));
    expect(res.status).toBe(307);
    expect(locationOf(res)).toBe("/tracker");
  });
});
