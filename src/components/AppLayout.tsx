import { useEffect, useState, useRef, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCotacoesPublicasRealtime } from "@/hooks/useCotacoesPublicasRealtime";
import AppSidebar from "./AppSidebar";
import AppTopbar from "./AppTopbar";

const AppLayout = () => {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // MISSÃO COTACAO-EXPRESS — 2 alertas em tempo real da Torre de Controle:
  // nova cotação web (pré-cadastro) e cliente que já preencheu os detalhes.
  const abrirCotacao = useCallback(
    (cotacaoId: string, orcamentoId: string | null) => {
      navigate(
        orcamentoId
          ? `/comercial?tab=orcamentos&orcamento=${orcamentoId}`
          : `/comercial?tab=orcamentos&action=novo&cotacao=${cotacaoId}`,
      );
    },
    [navigate],
  );
  useCotacoesPublicasRealtime({ onAbrirCotacao: abrirCotacao, habilitado: Boolean(user) });

  const handleMouseEnter = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setExpanded(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoverTimeout.current = setTimeout(() => setExpanded(false), 200);
  }, []);

  useEffect(() => {
    if (location.pathname === "/torre-controle") {
      setExpanded(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    };
  }, []);

  if (!user) return null; // ProtectedRoute ja redireciona

  // Telas de campo: rodam em tela cheia, sem sidebar/topbar do desktop.
  // /os-mobile e /portal-cliente e /app-prestador mantêm o ProtectedRoute (auth) intacto.
  if (
    location.pathname === "/portal-cliente" ||
    location.pathname === "/app-prestador" ||
    location.pathname === "/os-mobile"
  ) {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="shrink-0 relative"
        style={{ width: 64 }}
      >
        <AppSidebar expanded={expanded} />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppTopbar />
        <main className="flex-1 overflow-y-auto bg-background p-6 custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
