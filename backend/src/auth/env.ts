const REQUIRED = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const;

type EnvKey = (typeof REQUIRED)[number];

const missing = REQUIRED.filter((k) => !process.env[k]);

if (missing.length > 0) {
  console.error(
    `\n[startup] Missing required environment variables:\n` +
    missing.map((k) => `  • ${k}`).join("\n") +
    `\n\nAdd them to backend/.env and restart.\n`
  );
  process.exit(1);
}

export const env = Object.fromEntries(
  REQUIRED.map((k) => [k, process.env[k]!])
) as Record<EnvKey, string>;

export const IS_PROD =
  process.env.NODE_ENV === "production" ||
  env.BETTER_AUTH_URL.startsWith("https://");
export const COOKIE_SAME_SITE = (
  process.env.COOKIE_SAME_SITE ?? (IS_PROD ? "none" : "lax")
) as "lax" | "strict" | "none";
export const USE_SECURE_COOKIES =
  process.env.USE_SECURE_COOKIES === "true" ||
  env.BETTER_AUTH_URL.startsWith("https://") ||
  COOKIE_SAME_SITE === "none";

// Comma-separated list of allowed frontend origins
export const ALLOWED_ORIGINS: string[] = (
  process.env.ALLOWED_ORIGINS ?? "http://localhost:5173"
)
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

export const PRIMARY_FRONTEND_ORIGIN = ALLOWED_ORIGINS[0] ?? "http://localhost:5173";
