import { createContext, useContext } from "react";
import { useSession, type AuthSession } from "@/lib/auth-client";

type AuthContextValue = {
  session:   AuthSession;
  isPending: boolean;
};

const AuthContext = createContext<AuthContextValue>({ session: null, isPending: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  return (
    <AuthContext.Provider value={{ session: session ?? null, isPending }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Consume anywhere inside <AuthProvider> — always returns stable values. */
export function useAuth() {
  return useContext(AuthContext);
}
