import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiFetch } from "./api";
import {
  clearStoredSession,
  getStoredSession,
  setStoredSession,
  type AppSession,
  type AppUser,
} from "./session";

interface AuthContextType {
  user: AppUser | null;
  session: AppSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  acceptInvite: (inviteToken: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<AppSession | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((nextSession: AppSession | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    setStoredSession(nextSession);
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const stored = getStoredSession();
      if (!stored) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const me = await apiFetch("/auth/me", {
          headers: {
            Authorization: `Bearer ${stored.access_token}`,
            "X-User-Token": stored.access_token,
          },
        });

        if (!mounted) return;
        applySession(me.session || stored);
      } catch (error) {
        console.error("Failed to restore session:", error);
        clearStoredSession();
        if (mounted) {
          setSession(null);
          setUser(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [applySession]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const result = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      applySession(result.session);
      return { error: null };
    } catch (err: any) {
      console.error("Error in signIn:", err);
      return {
        error:
          err?.message ||
          "Nao foi possivel entrar. Verifique seus dados e tente novamente.",
      };
    }
  }, [applySession]);

  const acceptInvite = useCallback(async (inviteToken: string) => {
    try {
      const result = await apiFetch("/auth/accept-invite", {
        method: "POST",
        body: JSON.stringify({
          inviteToken,
        }),
      });

      applySession(result.session);
      return { error: null };
    } catch (err: any) {
      console.error("Error in acceptInvite:", err);
      return {
        error: err?.message || "Nao foi possivel ativar o convite.",
      };
    }
  }, [applySession]);

  const signOut = useCallback(async () => {
    const currentToken = session?.access_token;

    try {
      if (currentToken) {
        await apiFetch("/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentToken}`,
            "X-User-Token": currentToken,
          },
        });
      }
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      clearStoredSession();
      setUser(null);
      setSession(null);
    }
  }, [session?.access_token]);

  const refreshUser = useCallback(async () => {
    const currentToken = session?.access_token || getStoredSession()?.access_token;

    if (!currentToken) {
      setUser(null);
      setSession(null);
      clearStoredSession();
      return;
    }

    const result = await apiFetch("/auth/me", {
      headers: {
        Authorization: `Bearer ${currentToken}`,
        "X-User-Token": currentToken,
      },
    });

    applySession(result.session);
  }, [applySession, session?.access_token]);

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signIn, acceptInvite, signOut, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    return {
      user: null,
      session: null,
      loading: true,
      signIn: async () => ({ error: "Auth nao disponivel" as string | null }),
      acceptInvite: async () => ({ error: "Auth nao disponivel" as string | null }),
      signOut: async () => {},
      refreshUser: async () => {},
    } as AuthContextType;
  }

  return ctx;
}
