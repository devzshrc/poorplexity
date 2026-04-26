import { ALLOWED_ORIGINS } from "./auth/env";

const DEFAULT_ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "Cookie",
  "Accept",
  "Origin",
  "X-Requested-With",
];

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

export function getRequestOrigin(req: Request): string | null {
  const origin = req.headers.get("Origin");
  return origin ? normalizeOrigin(origin) : null;
}

export function isAllowedOrigin(origin: string | null): origin is string {
  return !!origin && ALLOWED_ORIGINS.includes(normalizeOrigin(origin));
}

export function corsHeaders(
  origin: string | null,
  options?: {
    methods?: string[];
    headers?: string[];
  }
): Headers {
  const headers = new Headers({
    "Vary": "Origin",
    "Access-Control-Allow-Methods": (options?.methods ?? ["GET", "POST", "OPTIONS"]).join(", "),
    "Access-Control-Allow-Headers": (options?.headers ?? DEFAULT_ALLOWED_HEADERS).join(", "),
    "Access-Control-Allow-Credentials": "true",
  });

  if (isAllowedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", normalizeOrigin(origin));
  }

  return headers;
}

export function mergeHeaders(base: Headers, extra: HeadersInit): Headers {
  const merged = new Headers(base);
  new Headers(extra).forEach((value, key) => merged.set(key, value));
  return merged;
}
