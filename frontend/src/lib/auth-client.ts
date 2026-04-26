import { createAuthClient } from "better-auth/react";
import { API_BASE_URL } from "./config";

export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  fetchOptions: { credentials: "include" },
});

export const { useSession, signIn, signOut } = authClient;

// Infer the session type from the client
export type AuthSession = ReturnType<typeof authClient.useSession>["data"];
