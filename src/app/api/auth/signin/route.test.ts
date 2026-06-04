import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Drive the rate-limit count and the server-side auth result. The route uses
// @supabase/supabase-js createClient twice: with the service key (rate-limit
// admin client) and with the anon key (auth). The mock branches on the key.
const state = {
  count: 0,
  authResult: {
    data: { session: null as null | { access_token: string; refresh_token: string } },
    error: null as null | { message: string },
  },
  recorded: [] as unknown[],
  deleted: false,
};

vi.mock("@supabase/supabase-js", () => {
  function adminBuilder() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select: () => b,
      eq: () => b,
      gte: () => b,
      delete: () => {
        state.deleted = true;
        return b;
      },
      insert: (row: unknown) => {
        state.recorded.push(row);
        return Promise.resolve({ error: null });
      },
      // Make the builder awaitable: select chains resolve to { count }, delete
      // chains read { error }.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      then: (resolve: any) => resolve({ count: state.count, error: null }),
    };
    return b;
  }
  return {
    createClient: (_url: string, key: string) =>
      key === "service"
        ? { from: () => adminBuilder() }
        : { auth: { signInWithPassword: async () => state.authResult } },
  };
});

const { POST } = await import("./route");

function post(body: unknown) {
  return new NextRequest("http://localhost/api/auth/signin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const creds = { email: "user@example.com", password: "hunter2pw" };

beforeEach(() => {
  state.count = 0;
  state.authResult = { data: { session: null }, error: null };
  state.recorded = [];
  state.deleted = false;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
});

describe("auth-signin rate limit (count only failed attempts)", () => {
  it("blocks with 429 once the failure count reaches the max, without attempting auth", async () => {
    state.count = 5; // already at the limit
    const res = await POST(post(creds));
    expect(res.status).toBe(429);
    expect(state.recorded).toHaveLength(0); // no new attempt recorded
  });

  it("records a hit and returns 401 when credentials are wrong", async () => {
    state.authResult = { data: { session: null }, error: { message: "Invalid login credentials" } };
    const res = await POST(post(creds));
    expect(res.status).toBe(401);
    expect(state.recorded).toHaveLength(1); // failure counted
    expect(state.deleted).toBe(false);
  });

  it("does NOT record a hit and clears the counter on a successful sign-in", async () => {
    state.authResult = {
      data: { session: { access_token: "acc", refresh_token: "ref" } },
      error: null,
    };
    const res = await POST(post(creds));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.access_token).toBe("acc");
    expect(json.refresh_token).toBe("ref");
    expect(state.recorded).toHaveLength(0); // success is not counted
    expect(state.deleted).toBe(true); // counter reset
  });

  it("rejects a malformed body with 400 before touching auth", async () => {
    const res = await POST(post({ email: "not-an-email", password: "" }));
    expect(res.status).toBe(400);
    expect(state.recorded).toHaveLength(0);
  });
});
