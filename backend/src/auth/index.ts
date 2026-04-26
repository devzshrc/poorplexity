import { betterAuth } from "better-auth";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { env, IS_PROD, ALLOWED_ORIGINS } from "./env";

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,                    // connection pool
  idleTimeoutMillis: 30_000,  // drop idle connections after 30s
  connectionTimeoutMillis: 10_000, // fail fast if DB is unreachable
});

const db = new Kysely({
  dialect: new PostgresDialect({ pool }),
});

export const auth = betterAuth({
  database: { db, type: "postgres" },

  baseURL: env.BETTER_AUTH_URL,
  secret:  env.BETTER_AUTH_SECRET,

  // ── Session ──────────────────────────────────────────────────────────────
  session: {
    expiresIn:  60 * 60 * 24 * 7,  // 7-day session lifetime
    updateAge:  60 * 60 * 24,       // extend if used within last day
    cookieCache: {
      enabled: true,
      maxAge:  60 * 5,              // cache session in signed cookie for 5 min → fewer DB reads
    },
  },

  account: {
    storeStateStrategy: "cookie",
  },

  // ── Cookie security ───────────────────────────────────────────────────────
  advanced: {
    cookiePrefix: "pp",             // "pp.session" etc.
    useSecureCookies: IS_PROD,      // Secure flag only in production (requires HTTPS)
    defaultCookieAttributes: {
      httpOnly: true,               // JS cannot access session cookies
      sameSite: IS_PROD ? "strict" : "lax",
      secure:   IS_PROD,
    },
  },

  // ── Rate limiting ─────────────────────────────────────────────────────────
  rateLimit: {
    enabled:        true,
    window:         60,   // 60-second sliding window
    max:            10,   // 10 auth requests per window per IP
    customRules: {
      "/sign-in/social": { window: 60, max: 5 },  // stricter on sign-in
    },
  },

  // ── Social providers ──────────────────────────────────────────────────────
  socialProviders: {
    google: {
      clientId:     env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },

  // Validates OAuth callbackURL and redirect targets against this list
  trustedOrigins: ALLOWED_ORIGINS,
});

export type Session = typeof auth.$Infer.Session;
export type User    = typeof auth.$Infer.Session.user;
