import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { User, UserRole } from "@/lib/auth";
import { mapPapelToUserRole } from "@/lib/auth";

function comTimeout<T>(promise: Promise<T>, ms: number, rotulo: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[Auth] Timeout: ${rotulo} apos ${ms}ms`)), ms)
    ),
  ]);
}

export type AuthStatus = "loading_session" | "loading_profile" | "authenticated" | "unauthenticated" | "profile_error";

interface AuthContextType {
  user: User | null;
  authStatus: AuthStatus;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ ok: boolean; error?: string }>;
  retryProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  authStatus: "loading_session",
  isLoading: true,
  error: null,
  login: async () => null,
  logout: async () => {},
  resetPassword: async () => ({ ok: false }),
  retryProfile: async () => {},
});

async function registrarAuditoriaAuth(
  tipo: string,
  email: string,
  userId?: string,
  perfil?: string,
  metadata?: Record<string, unknown>
) {
  try {
    const promessa = supabase.from("auth_eventos_auditoria").insert({
      user_id: userId || null,
      email,
      tipo_evento: tipo,
      perfil: perfil || null,
      ip_origem: null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      metadata: metadata || {},
    });
    await Promise.race([
      promessa,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout auditoria")), 5000)),
    ]);
  } catch {
    // Auditoria eh melhor-esforco; nunca quebra o fluxo de auth
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading_session");
  const [error, setError] = useState<string | null>(null);
  const userRef = useRef(user);
  userRef.current = user;
  const generationRef = useRef(0);
  const profilePromiseRef = useRef<Map<string, Promise<User | null>>>(new Map());
  const loginResolveRef = useRef<((u: User | null) => void) | null>(null);

  const buildUserFromSession = useCallback(async (
    sessionUserId: string, email: string, sessionUserName?: string
  ): Promise<User | null> => {
    const myGen = ++generationRef.current;
    let role: UserRole = "operador";
    let unit = "Portal";
    let name = sessionUserName || "";

    if (myGen !== generationRef.current) return null;

    try {
      const { data: vinculos, error: vinculoErr } = await comTimeout(
        supabase
          .from("tenant_usuarios")
          .select("papel, tenants!inner(nome)")
          .eq("user_id", sessionUserId)
          .eq("status", "ativo")
          .limit(1),
        20000,
        "tenant_usuarios_select"
      );

      if (myGen !== generationRef.current) return null;

      if (vinculoErr) {
        console.warn("[Auth] tenant_usuarios query error:", vinculoErr.message);
        return null;
      }

      if (vinculos && vinculos.length > 0) {
        role = mapPapelToUserRole(vinculos[0].papel);
        unit = vinculos[0].tenants?.nome || "Portal";
      } else {
        console.warn(`[Auth] usuario nao encontrado em tenant_usuarios`);
        return null;
      }
    } catch (e) {
      console.warn("[Auth] erro ao consultar tenant_usuarios:", e);
      return null;
    }

    if (myGen !== generationRef.current) return null;

    if (!name && email) {
      const localPart = email.split("@")[0];
      name = localPart.charAt(0).toUpperCase() + localPart.slice(1);
    }

    const builtUser: User = { email, name, role, unit };
    return builtUser;
  }, []);

  const onProfileResolved = useCallback((u: User | null) => {
    if (u) {
      setUser(u);
      userRef.current = u;
      setAuthStatus("authenticated");
    } else {
      setUser(null);
      userRef.current = null;
      setAuthStatus("profile_error");
    }
    if (loginResolveRef.current) {
      loginResolveRef.current(u);
      loginResolveRef.current = null;
    }
  }, []);

  const resolveProfile = useCallback(async (sessionUserId: string, email: string, name?: string) => {
    const existing = profilePromiseRef.current.get(sessionUserId);
    if (existing) {
      const u = await existing;
      onProfileResolved(u);
      return;
    }

    const promise = buildUserFromSession(sessionUserId, email, name);
    profilePromiseRef.current.set(sessionUserId, promise);
    promise.finally(() => {
      setTimeout(() => profilePromiseRef.current.delete(sessionUserId), 2000);
    });

    const u = await promise;
    onProfileResolved(u);
  }, [buildUserFromSession, onProfileResolved]);

  const retryProfile = useCallback(async () => {
    if (authStatus !== "profile_error") return;
    setError(null);
    setAuthStatus("loading_profile");
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      profilePromiseRef.current.delete(session.user.id);
      await resolveProfile(session.user.id, session.user.email || "", session.user.user_metadata?.name);
    } else {
      setAuthStatus("unauthenticated");
    }
  }, [authStatus, resolveProfile]);

  const handleSessionFound = useCallback(async (
    event: string, sessionUserId: string, email: string, name?: string
  ) => {
    sessionStorage.removeItem("session_expired");
    setAuthStatus("loading_profile");
    await resolveProfile(sessionUserId, email, name);
  }, [resolveProfile]);

  // Single initialization effect — deduplicado
  useEffect(() => {
    let cancelled = false;
    let initialEventReceived = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return;

        if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session?.user) {
          initialEventReceived = true;
          handleSessionFound(event, session.user.id, session.user.email || "", session.user.user_metadata?.name);
        } else if (event === "INITIAL_SESSION" && !session?.user) {
          initialEventReceived = true;
          if (!cancelled) setAuthStatus("unauthenticated");
        } else if (event === "SIGNED_OUT") {
          const tinhaUser = !!userRef.current;
          setUser(null);
          userRef.current = null;
          setError(null);
          if (tinhaUser) sessionStorage.setItem("session_expired", "true");
          if (!cancelled) setAuthStatus("unauthenticated");
        } else if (event === "TOKEN_REFRESH_FAILED") {
          setUser(null);
          userRef.current = null;
          setError(null);
          sessionStorage.setItem("session_expired", "true");
          if (!cancelled) setAuthStatus("unauthenticated");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user && !initialEventReceived) {
        handleSessionFound("getSession_fallback", session.user.id, session.user.email || "", session.user.user_metadata?.name);
      } else if (!session?.user && !initialEventReceived) {
        setAuthStatus("unauthenticated");
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [handleSessionFound]);

  const login = useCallback(async (email: string, password: string): Promise<User | null> => {
    setError(null);

    if (!email?.trim() || !password) {
      setError("Informe e-mail e senha.");
      return null;
    }

    try {
      const { data, error: authError } = await comTimeout(
        supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(), password,
        }),
        20000, "signInWithPassword"
      );

      if (authError || !data?.user) {
        const msg = authError?.message || "Falha na autenticacao";
        setError(msg);
        await registrarAuditoriaAuth("login_falha", email.trim().toLowerCase());
        return null;
      }

      // SIGNED_IN deve ter disparado e handleSessionFound iniciou resolveProfile.
      // Aguarda a resolucao do perfil.
      const u = await new Promise<User | null>((resolve) => {
        loginResolveRef.current = resolve;
        // Timeout de seguranca: se SIGNED_IN nao disparar em 10s
        setTimeout(() => {
          if (loginResolveRef.current === resolve) {
            loginResolveRef.current = null;
            resolve(null);
          }
        }, 10000);
      });

      if (u) {
        localStorage.setItem("tms_user", JSON.stringify(u));
        await comTimeout(
          registrarAuditoriaAuth("login_sucesso", data.user.email || email, data.user.id, u.role, { unit: u.unit }),
          5000, "auditoria_login"
        ).catch(() => {});
        return u;
      }

      setError("Nao foi possivel carregar o perfil do usuario.");
      await registrarAuditoriaAuth("login_falha", email.trim().toLowerCase(), data.user.id, undefined, { motivo: "perfil_nao_resolvido" });
      return null;
    } catch (e: any) {
      const msg = e?.message || "Erro ao autenticar";
      setError(msg);
      await registrarAuditoriaAuth("login_falha", email.trim().toLowerCase(), undefined, undefined, { motivo: msg, exception: true });
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    const email = user?.email;
    const role = user?.role;
    setUser(null);
    setAuthStatus("loading_session");
    try {
      await supabase.auth.signOut();
      if (email) registrarAuditoriaAuth("logout", email, undefined, role);
    } catch (e) {
      console.warn("Auth: logout ignorou erro:", e);
    }
  }, [user]);

  const resetPassword = useCallback(async (email: string) => {
    if (!email?.trim()) {
      return { ok: false, error: "Informe um e-mail valido." };
    }
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) {
        await registrarAuditoriaAuth("reset_senha_falha", email.trim().toLowerCase(), undefined, undefined, {
          motivo: err.message,
        });
        return { ok: false, error: err.message };
      }
      await registrarAuditoriaAuth("reset_senha_solicitado", email.trim().toLowerCase());
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Erro ao solicitar reset." };
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user, authStatus,
      isLoading: authStatus === "loading_session" || authStatus === "loading_profile",
      error, login, logout, resetPassword, retryProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
