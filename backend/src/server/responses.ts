import { errorToResponse, forbidden } from "../errors";
import { mergeHeaders } from "../http";

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: mergeHeaders(new Headers(headers), { "Content-Type": "application/json" }),
  });
}

export function text(data: string | null, status = 200, headers?: HeadersInit): Response {
  return new Response(data, {
    status,
    headers: mergeHeaders(new Headers(headers), { "Content-Type": "text/plain; charset=utf-8" }),
  });
}

export function noContent(headers?: HeadersInit, status = 204): Response {
  return new Response(null, { status, headers });
}

export function originForbidden(headers: Headers) {
  const error = forbidden("Origin not allowed");
  return json({ error: error.message, code: error.code }, error.status, headers);
}

export function toPublicError(error: unknown) {
  const appError = errorToResponse(error);
  if (appError.status !== 500 || appError.body.code !== "INTERNAL") {
    return {
      status: appError.status,
      message: appError.body.error,
      code: appError.body.code,
      details: "details" in appError.body ? appError.body.details : undefined,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes("unauthorized")) {
    return { status: 401, message: "Unauthorized", code: "UNAUTHORIZED" };
  }
  if (normalized.includes("not found")) {
    return { status: 404, message, code: "NOT_FOUND" };
  }
  if (normalized.includes("origin not allowed")) {
    return { status: 403, message, code: "FORBIDDEN" };
  }
  if (normalized.includes("limit")) {
    return { status: 429, message, code: "RATE_LIMITED" };
  }
  if (normalized.includes("billing is not configured")) {
    return { status: 503, message, code: "SERVICE_UNAVAILABLE" };
  }
  if (
    error instanceof SyntaxError
    || normalized.includes("json")
    || normalized.includes("unexpected token")
    || normalized.includes("unexpected end of json")
  ) {
    return { status: 400, message: "Invalid JSON body", code: "BAD_REQUEST" };
  }
  if (
    normalized.includes("invalid")
    || normalized.includes("required")
    || normalized.includes("too long")
    || normalized.includes("unsupported")
    || normalized.includes("must ")
    || normalized.includes("cannot")
    || normalized.includes("taken")
    || normalized.includes("mismatch")
  ) {
    return { status: 400, message, code: "BAD_REQUEST" };
  }

  return { status: 500, message: "Internal server error", code: "INTERNAL" };
}
