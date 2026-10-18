import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronDown, Truck, Search, Bug } from "lucide-react";
import { getVisibleSidebarItems, type SidebarItem } from "@/lib/sidebarData";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { confirmAction } from "@/lib/confirmDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  expanded: boolean;
}

interface SidebarItemComponentProps {
  item: SidebarItem;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
}

// TMS-LAYOUT-01 — subitem com recuo consistente, truncamento e tooltip para labels longos
const SidebarSubItemComponent = ({
  child,
  active,
  onNavigate,
}: {
  child: { title: string; path: string };
  active: boolean;
  onNavigate: (path: string) => void;
}) => (
  <button
    onClick={() => onNavigate(child.path)}
    title={child.title}
    className={cn(
      "w-full flex items-center gap-2 text-left text-xs py-1.5 pl-2 pr-2 rounded-lg transition-colors duration-150",
      active
        ? "text-white font-semibold bg-white/10 border-l-2 border-primary/60 pl-1.5"
        : "text-slate-400 hover:text-white hover:bg-white/5"
    )}
  >
    <span className="flex-1 truncate">{child.title}</span>
  </button>
);

const SidebarItemComponent = ({
  item,
  collapsed,
  open,
  onToggle,
}: SidebarItemComponentProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive =
    location.pathname === item.path ||
    (item.children?.some((c) => location.pathname + location.search === c.path) ?? false);

  const hasChildren = item.children && item.children.length > 0;
  const Icon = item.icon;

  const handleClick = () => {
    if (hasChildren) {
      if (collapsed) {
        navigate(item.path);
      } else {
        onToggle();
      }
    } else {
      navigate(item.path);
    }
  };

  const handleNavigate = useCallback((path: string) => navigate(path), [navigate]);

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors duration-150 ease-out group relative",
          isActive && !collapsed
            ? "bg-primary/20 text-white font-medium shadow-sm border border-primary/30"
            : isActive && collapsed
            ? "text-white font-medium"
            : "text-slate-300 hover:bg-white/10 hover:text-white"
        )}
        title={item.title}
      >
        {/* Pill ativa no modo recolhido — 40×40px centralizada sobre o ícone, sem afetar área clicável */}
        {collapsed && isActive && (
          <span
            aria-hidden="true"
            className="absolute rounded-xl bg-primary/20 pointer-events-none"
            style={{ width: 40, height: 40, left: 2, top: "50%", transform: "translateY(-50%)" }}
          />
        )}
        <Icon className="w-5 h-5 shrink-0" />
        <span className={cn(
          "flex-1 text-left truncate transition-all duration-200",
          collapsed ? "w-0 opacity-0 overflow-hidden pointer-events-none" : "w-auto opacity-100"
        )}>
          {item.title}
        </span>
        {hasChildren && (
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-all duration-200 opacity-60 shrink-0",
              collapsed && "hidden",
              open && "rotate-180"
            )}
          />
        )}
      </button>
      {!collapsed && hasChildren && open && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-white/[0.06] pl-2">
          {item.children!.map((child) => (
            <SidebarSubItemComponent
              key={child.path}
              child={child}
              active={location.pathname + location.search === child.path}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const AppSidebar = ({ expanded }: Props) => {
  const collapsed = !expanded;
  const [searchTerm, setSearchTerm] = useState("");
  const { user } = useAuth();
  const location = useLocation();

  const items = useMemo(() => getVisibleSidebarItems(user), [user]);

  // Grupo ativo inicial — destaca o módulo da rota atual sem perder a seleção
  const activeParentPath = useMemo(() => {
    const current = location.pathname + location.search;
    const parent = items.find(
      (item) => item.children?.some((c) => c.path === current)
    );
    return parent?.path ?? null;
  }, [items, location.pathname, location.search]);

  // TMS-LAYOUT-01 — apenas um grupo aberto por vez; limpa ao recolher a sidebar
  const [openPath, setOpenPath] = useState<string | null>(activeParentPath);

  useEffect(() => {
    if (collapsed) setOpenPath(null);
  }, [collapsed]);

  const handleToggle = useCallback((path: string) => {
    setOpenPath((prev) => (prev === path ? null : path));
  }, []);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter((item) => {
      if (item.title.toLowerCase().includes(term)) return true;
      if (item.children) {
        return item.children.some((child) => child.title.toLowerCase().includes(term));
      }
      return false;
    });
  }, [searchTerm, items]);

  return (
    <aside
      className={cn(
        "h-screen flex flex-col shrink-0 transition-all duration-300 ease-in-out z-50",
        expanded && "shadow-2xl shadow-black/30"
      )}
      style={{
        background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
        width: expanded ? 240 : 64,
        position: "absolute",
        left: 0,
        top: 0,
      }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-white/10">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
          <Truck className="w-4 h-4 text-white" />
        </div>
        <div className={cn(
          "ml-3 overflow-hidden transition-all duration-200",
          collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
        )}>
          <h2 className="text-sm font-bold text-white truncate tracking-tight">
            Conexao Express
          </h2>
          <p className="text-[10px] text-slate-400 font-medium">TMS</p>
        </div>
      </div>

      {/* Search */}
      {expanded && (
        <div className="px-3 pt-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-7 pr-2 text-xs bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-primary"
            />
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-0.5">
        {filteredItems.map((item) => (
          <SidebarItemComponent
            key={item.path}
            item={item}
            collapsed={collapsed}
            open={openPath === item.path}
            onToggle={() => handleToggle(item.path)}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className={cn(
        "p-3 border-t border-white/10 transition-all duration-200",
        collapsed ? "text-[9px] text-center" : "text-[10px]"
      )}>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">
            {collapsed ? "v1.0" : "Express Connect Hub v1.0"}
          </span>
          {!collapsed && user && (user.role === "super_admin" || user.role === "admin" || user.role === "operador") && (
            <Button
              variant="ghost"
              size="icon"
              className="w-5 h-5 text-slate-500 hover:text-amber-400 hover:bg-white/5"
              title="Diagnóstico Controle de Pátio"
              onClick={async () => {
                const path = "/controle-patio";
                const p = window.location;
                const msg = [
                  `=== DIAGNÓSTICO CONTROLE DE PÁTIO ===`,
                  `User role: ${user.role}`,
                  `User email: ${user.email}`,
                  `URL atual: ${p.pathname}`,
                  `Rota /controle-patio: ${document.querySelector('a[href="/controle-patio"]') ? "EXISTE no DOM" : "verificar"}`,
                  `Sidebar item: presente em sidebarData.ts (sub-item de Apoio Operacional)`,
                  `Permissão: ordens_servico → ${user.role} tem pode_ver: true`,
                ].join("\n");
                const confirmado = await confirmAction({
                  title: "Diagnóstico — Controle de Pátio",
                  description: `${msg}\n\nProsseguir para /controle-patio?`,
                  confirmText: "Ir para Controle de Pátio",
                  cancelText: "Fechar",
                });
                if (confirmado) {
                  window.location.href = path;
                }
              }}
            >
              <Bug className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;