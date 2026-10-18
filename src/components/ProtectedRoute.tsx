import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getRoutePermission } from "@/lib/routePermissions";
import { podeAcessar } from "@/lib/permissoes";
import { ShieldOff, AlertTriangle, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { ProgressiveBlocksLoader } from "@/components/ui/ProgressiveBlocksLoader";

interface Props {
  children: React.ReactNode;
}

function AccessDenied() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <ShieldOff className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground">Acesso Restrito</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Voce nao tem permissao para acessar esta pagina.
        </p>
      </div>
    </div>
  );
}

function ProfileError({ retryProfile }: { retryProfile: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center max-w-md">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground">Erro ao carregar perfil</h2>
        <p className="text-muted-foreground text-sm mt-2">
          Nao foi possivel carregar as permissoes do usuario.
          Tente novamente ou contate o administrador.
        </p>
        <button
          onClick={async () => {
            setLoading(true);
            await retryProfile();
            setLoading(false);
          }}
          disabled={loading}
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Recarregando..." : "Tentar novamente"}
        </button>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children }: Props) {
  const { user, authStatus, error: authError, retryProfile } = useAuth();
  const location = useLocation();
  const [timeoutExcedido, setTimeoutExcedido] = useState(false);

  useEffect(() => {
    if (authStatus !== "loading_session" && authStatus !== "loading_profile") return;
    const timer = setTimeout(() => setTimeoutExcedido(true), 15000);
    return () => clearTimeout(timer);
  }, [authStatus]);

  if (authStatus === "loading_session") {
    if (timeoutExcedido) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground">Tempo excedido</h2>
            <p className="text-muted-foreground text-sm mt-2">
              O servidor de autenticacao esta demorando para responder.
              Tente recarregar a pagina ou fazer login novamente.
            </p>
            <a
              href="/login"
              className="inline-block mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
            >
              Ir para o login
            </a>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-screen">
        <ProgressiveBlocksLoader size="page" />
      </div>
    );
  }

  if (authStatus === "loading_profile") {
    if (timeoutExcedido) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground">Tempo excedido</h2>
            <p className="text-muted-foreground text-sm mt-2">
              O servidor de permissões esta demorando para responder.
              Tente recarregar a pagina.
            </p>
            <a
              href="/"
              className="inline-block mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
            >
              Recarregar
            </a>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-screen">
        <ProgressiveBlocksLoader size="page" />
      </div>
    );
  }

  if (authStatus === "profile_error") {
    return <ProfileError retryProfile={retryProfile} />;
  }

  if (authStatus === "unauthenticated" || !user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  try {
    const perm = getRoutePermission(location.pathname);

    if (perm.modulo && !podeAcessar(perm.modulo, "ver", user)) {
      console.log(`[ProtectedRoute] acesso negado: modulo=${perm.modulo}, role=${user.role}`);
      return <AccessDenied />;
    }

    if (perm.roles && perm.roles.length > 0 && !perm.roles.includes(user.role)) {
      console.log(`[ProtectedRoute] acesso negado: roles=${perm.roles.join(",")}, role=${user.role}`);
      return <AccessDenied />;
    }
  } catch (e) {
    console.error("[ProtectedRoute] erro ao verificar permissao:", e);
  }

  return <>{children}</>;
}
