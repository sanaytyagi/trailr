import { NextResponse } from "next/server";

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/**
 * Read a JSON request body with a hard byte cap. Returns a 413 response if
 * Content-Length advertises (or the actual body exceeds) the cap, and a 400
 * response if the body is not valid JSON.
 *
 * @param maxBytes Defaults to 100 KB — enough for any normal API payload.
 *   Override to 256 KB for routes that legitimately receive chat history.
 */
export async function parseJsonBody<T = unknown>(
  req: Request,
  maxBytes = 100 * 1024
): Promise<ParseResult<T>> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Request body too large" },
        { status: 413 }
      ),
    };
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Failed to read request body" },
        { status: 400 }
      ),
    };
  }

  if (raw.length > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Request body too large" },
        { status: 413 }
      ),
    };
  }

  if (!raw) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Empty request body" },
        { status: 400 }
      ),
    };
  }

  try {
    return { ok: true, data: JSON.parse(raw) as T };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      ),
    };
  }
}
