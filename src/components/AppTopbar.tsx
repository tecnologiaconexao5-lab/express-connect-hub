import { Bell, Search, LogOut, Radio } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { getUser, logout } from "@/lib/auth";

const AppTopbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="h-16 bg-tms-topbar flex items-center px-6 gap-4 shrink-0">
      {/* Search */}
      <div className="flex-1 max-w-md relative flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tms-topbar-fg/50" />
          <input
            type="text"
            placeholder="Buscar módulos, pedidos, clientes..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary/80 border-0 text-sm text-tms-topbar-fg placeholder:text-tms-topbar-fg/40 focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
          />
        </div>
        
        {location.pathname === "/torre-controle" && (
          <div className="hidden md:flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-600 px-3 py-1.5 rounded-full animate-pulse">
            <Radio className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Torre de Controle — Ao Vivo</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-secondary/50 text-tms-topbar-fg transition">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
        </button>

        {/* Unit */}
        {user && (
          <span className="text-xs text-tms-topbar-fg/70 hidden md:block">
            {user.unit}
          </span>
        )}

        {/* Avatar */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
            {user?.name?.charAt(0) ?? "U"}
          </div>
          {user && (
            <span className="text-sm text-tms-topbar-fg font-medium hidden md:block">
              {user.name}
            </span>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="p-2 rounded-lg hover:bg-destructive/20 text-tms-topbar-fg transition"
          title="Sair"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

export default AppTopbar;
