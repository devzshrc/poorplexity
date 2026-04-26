import { auth, type Session } from "./index";
import { ALLOWED_ORIGINS } from "./env";

// ── CORS ──────────────────────────────────────────────────────────────────────

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]!;
  return {
    "Access-Control-Allow-Origin":      allowed,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods":     "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":     "Content-Type, Cookie",
    // Vary: Origin tells CDNs/proxies that the response varies by origin
    "Vary":                             "Origin",
  };
}

// ── Auth handler (mounts at /api/auth/*) ─────────────────────────────────────

export async function authHandler(req: Request): Promise<Response> {
  const origin = req.headers.get("Origin");
  const cors   = corsHeaders(origin);

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
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
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
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
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
