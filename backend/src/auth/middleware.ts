import { auth, type Session } from "./index";
import { corsHeaders, getRequestOrigin, isAllowedOrigin, mergeHeaders } from "../http";

// ── Auth handler (mounts at /api/auth/*) ─────────────────────────────────────

export async function authHandler(req: Request): Promise<Response> {
  const origin = getRequestOrigin(req);
  const cors = corsHeaders(origin);

  if (origin && !isAllowedOrigin(origin)) {
    return new Response(
      JSON.stringify({ error: "Origin not allowed" }),
      { status: 403, headers: mergeHeaders(cors, { "Content-Type": "application/json" }) }
    );
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  let res: Response;
  try {
    res = await auth.handler(req);
  } catch (e) {
    console.error("[auth] unhandled error:", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: mergeHeaders(cors, { "Content-Type": "application/json" }) }
    );
  }

  if (res.status >= 500) {
    // Clone to read body for logging without consuming the original
    const clone = res.clone();
    clone.text().then((t) =>
      console.error(`[auth] ${req.method} ${new URL(req.url).pathname} → ${res.status}\n`, t)
    );
  }

  const headers = new Headers(res.headers);
  cors.forEach((value, key) => headers.set(key, value));
  return new Response(res.body, { status: res.status, headers });
}

// ── Session guard (use in protected routes) ───────────────────────────────────

export async function getSession(req: Request): Promise<Session | null> {
  try {
    return await auth.api.getSession({ headers: req.headers });
  } catch (e) {
    console.error("[auth] getSession failed:", e);
    return null;
  }
}
