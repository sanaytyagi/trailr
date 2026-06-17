import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Drive the server-side verifyOtp result and capture the args it was called
// with. The route uses the SSR server client from @/lib/supabase/server.
const state = {
  verifyResult: { error: null as null | { message: string } },
  verifyArgs: null as null | { token_hash: string; type: string },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      verifyOtp: async (args: { token_hash: string; type: string }) => {
        state.verifyArgs = args;
        return state.verifyResult;
      },
    },
  }),
}));

const { GET } = await import("./route");

function get(url: string) {
  return new NextRequest(url);
}

beforeEach(() => {
  state.verifyResult = { error: null };
  state.verifyArgs = null;
});

describe("auth/confirm email link verification", () => {
  it("sends a verified recovery link to the set-new-password screen", async () => {
    const res = await GET(
      get("http://localhost/auth/confirm?token_hash=abc&type=recovery")
    );
    expect(res.headers.get("location")).toBe(
      "http://localhost/auth/update-password"
    );
    expect(state.verifyArgs).toEqual({ token_hash: "abc", type: "recovery" });
  });

  it("ignores a stray next param on recovery links", async () => {
    const res = await GET(
      get(
        "http://localhost/auth/confirm?token_hash=abc&type=recovery&next=/onboarding"
      )
    );
    // Recovery is forced to update-password regardless of the template's next.
    expect(res.headers.get("location")).toBe(
      "http://localhost/auth/update-password"
    );
  });

  it("sends a verified signup link to onboarding by default", async () => {
    const res = await GET(
      get("http://localhost/auth/confirm?token_hash=abc&type=signup")
    );
    expect(res.headers.get("location")).toBe("http://localhost/onboarding");
  });

  it("redirects to the auth error page when verifyOtp fails", async () => {
    state.verifyResult = { error: { message: "Token has expired" } };
    const res = await GET(
      get("http://localhost/auth/confirm?token_hash=abc&type=recovery")
    );
    expect(res.headers.get("location")).toBe(
      "http://localhost/auth?error=invalid_link"
    );
  });

  it("redirects to the auth error page when the link is missing params", async () => {
    const res = await GET(get("http://localhost/auth/confirm"));
    expect(res.headers.get("location")).toBe(
      "http://localhost/auth?error=invalid_link"
    );
    expect(state.verifyArgs).toBeNull();
  });
});
