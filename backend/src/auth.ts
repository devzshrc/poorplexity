import { createClerkClient } from "@clerk/backend";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((value) => value.trim().replace(/\/+$/, ""))
  .filter(Boolean);

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const clerkClient = createClerkClient({
  secretKey: requireEnv("CLERK_SECRET_KEY"),
  publishableKey: requireEnv("CLERK_PUBLISHABLE_KEY"),
});

export type AuthContext = {
  userId: string;
  sessionId: string | null;
};

export async function authenticateRequest(request: Request): Promise<AuthContext> {
  const requestState = await clerkClient.authenticateRequest(request, {
    authorizedParties: ALLOWED_ORIGINS,
  });

  if (!requestState.isAuthenticated) {
    throw new Error("Unauthorized");
  }

  const auth = requestState.toAuth();
  if (!auth.userId) {
    throw new Error("Unauthorized");
  }

  return {
    userId: auth.userId,
    sessionId: auth.sessionId ?? null,
  };
}

export async function getClerkUser(userId: string) {
  return clerkClient.users.getUser(userId);
}
