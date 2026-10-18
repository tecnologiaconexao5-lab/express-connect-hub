import { useEffect, useState, useRef, useCallback } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AppSidebar from "./AppSidebar";
import AppTopbar from "./AppTopbar";

const AppLayout = () => {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();

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

  if (location.pathname === "/portal-cliente" || location.pathname === "/app-prestador") {
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
