import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithOtp: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error("Session error:", error.message);
          setSession(null);
          setUser(null);
        } else {
          setSession(data.session ?? null);
          setUser(data.session?.user ?? null);
        }
      } catch (err) {
        if (!mounted) return;
        console.error("Failed to get session:", err);
        setSession(null);
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithOtp = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: "https://app.snyper.com.br/auth/confirm",
        },
      });

      if (error) {
        const message = error.message || "";

        if (message.includes("Signups not allowed") || message.includes("user not found")) {
          return { error: "Este e-mail não está autorizado. Solicite acesso ao administrador." };
        }

        if (message.toLowerCase().includes("rate limit") || message.includes("Muitas tentativas")) {
          return { error: "Muitas tentativas. Aguarde um pouco e tente novamente." };
        }

        return { error: message || "Falha ao enviar link de acesso" };
      }

      return { error: null };
    } catch (err: any) {
      console.error("Error in signInWithOtp:", err);

      if (err?.name === "AbortError" || err?.message === "Failed to fetch") {
        return { error: "Erro de conexão. Verifique sua internet e tente novamente." };
      }

      return { error: err?.message || "Erro desconhecido durante o login" };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    setUser(data.user ?? null);
    setSession((current) =>
      current && data.user ? { ...current, user: data.user } : current,
    );
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithOtp, signOut, refreshUser }}>
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
      signInWithOtp: async () => ({ error: "Auth não disponível" as string | null }),
      signOut: async () => {},
      refreshUser: async () => {},
    } as AuthContextType;
  }

  return ctx;
}
