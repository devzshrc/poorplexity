type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

function redact(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
      if (/token|secret|password|signature|authorization|api[-_]?key/i.test(key)) {
        return [key, "[redacted]"];
      }
      return [key, redact(nested)];
    })
  );
}

function write(level: LogLevel, message: string, context: LogContext = {}) {
  const payload = {
    level,
    message,
    at: new Date().toISOString(),
    ...redact(context) as LogContext,
  };

  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: LogContext) => write("debug", message, context),
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context),
};

export function requestId() {
  return crypto.randomUUID();
}
