import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "http://localhost:3598",
  fetchOptions: { credentials: "include" },
});

export const { useSession, signIn, signOut } = authClient;

// Infer the session type from the client
export type AuthSession = ReturnType<typeof authClient.useSession>["data"];
