export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL";

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly expose: boolean;
  readonly details?: unknown;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    options: { expose?: boolean; details?: unknown; cause?: unknown } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.expose = options.expose ?? status < 500;
    this.details = options.details;
  }
}

export function badRequest(message: string, details?: unknown) {
  return new AppError(400, "BAD_REQUEST", message, { details });
}

export function unauthorized(message = "Unauthorized") {
  return new AppError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "Forbidden") {
  return new AppError(403, "FORBIDDEN", message);
}

export function notFound(message = "Not found") {
  return new AppError(404, "NOT_FOUND", message);
}

export function conflict(message: string, details?: unknown) {
  return new AppError(409, "CONFLICT", message, { details });
}

export function rateLimited(message: string, details?: unknown) {
  return new AppError(429, "RATE_LIMITED", message, { details });
}

export function serviceUnavailable(message: string, details?: unknown) {
  return new AppError(503, "SERVICE_UNAVAILABLE", message, { expose: true, details });
}

export function errorToResponse(error: unknown) {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: error.expose ? error.message : "Internal server error",
        code: error.code,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    };
  }

  if (error instanceof SyntaxError) {
    return {
      status: 400,
      body: {
        error: "Invalid JSON body",
        code: "BAD_REQUEST" satisfies ErrorCode,
      },
    };
  }

  return {
    status: 500,
    body: {
      error: "Internal server error",
      code: "INTERNAL" satisfies ErrorCode,
    },
  };
}
