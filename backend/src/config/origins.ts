const LOCAL_DEV_ORIGIN = "http://localhost:5173";

export function normalizeOrigin(origin: string): string {
  const trimmed = origin.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    return (parsed.origin === "null" ? trimmed : parsed.origin).replace(/\/+$/, "");
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

export function parseAllowedOrigins(raw = process.env.ALLOWED_ORIGINS): string[] {
  const source = raw?.trim() ? raw : LOCAL_DEV_ORIGIN;
  const origins = source
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);

  return Array.from(new Set(origins));
}

export const ALLOWED_ORIGINS = parseAllowedOrigins();
