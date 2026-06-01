import { useState, useEffect, useCallback } from "react";
import { Bell, Search, LogOut, Radio, CheckCircle, AlertTriangle, Truck, Clock, Megaphone, Inbox, Sun, Moon, X, Command, ChevronRight, Home, FileText, BarChart3, Settings } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { getUser, logout } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/hooks/useTheme";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ROTA_TITULOS: Record<string, { titulo: string; icone: any }> = {
  "/": { titulo: "Dashboard", icone: Home },
  "/operacao": { titulo: "Operacao", icone: Truck },
  "/fiscal": { titulo: "Fiscal", icone: FileText },
  "/financeiro": { titulo: "Financeiro", icone: BarChart3 },
  "/comercial": { titulo: "Comercial", icone: FileText },
  "/recrutamento": { titulo: "Recrutamento", icone: Truck },
  "/configuracoes": { titulo: "Configuracoes", icone: Settings },
  "/torre-controle": { titulo: "Torre de Controle", icone: Radio },
};

function getBreadcrumb(path: string): { titulo: string; icone: any }[] {
  const parts = path.split("/").filter(Boolean);
  const items: { titulo: string; icone: any }[] = [{ titulo: "Home", icone: Home }];
  if (parts.length > 0) {
    const base = "/" + parts[0];
    const info = ROTA_TITULOS[base] || { titulo: parts[0], icone: FileText };
    items.push(info);
  }
  return items;
}

const AppTopbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const { theme, toggleTheme } = useTheme();
  const [notifs, setNotifs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const naoLidas = notifs.filter(n => !n.lida).length;

  const breadcrumb = getBreadcrumb(location.pathname);
  const paginaAtual = breadcrumb[breadcrumb.length - 1];

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setShowSearch(true);
    }
    if (e.key === "Escape") {
      setShowSearch(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    setNotifs([
      { id: 1, tipo: "nova_os", mensagem: "OS-1045 solicitada por Tech Solutions", tempo: "5 min", lida: false },
      { id: 2, tipo: "ocorrencia", mensagem: "Avaria registrada: OS-1040", tempo: "15 min", lida: false },
      { id: 3, tipo: "atraso", mensagem: "OS-880 atrasada em 2h", tempo: "1 hora", lida: true }
    ]);
  }, []);

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    const mockDb = [
      { tipo: "OS", titulo: "OS-9982", sub: "Cliente: Votorantim", path: "/operacao?tab=os&id=OS-9982" },
      { tipo: "OS", titulo: "OS-1240", sub: "Status: Atrasada", path: "/operacao?tab=os&id=OS-1240" },
      { tipo: "Orcamento", titulo: "ORC-5541", sub: "Logistica Alpha - R$ 15.000", path: "/comercial?tab=orcamentos&id=ORC-5541" },
      { tipo: "Cliente", titulo: "Ambev S.A (Matriz)", sub: "CNPJ: 07.526.557/0001-00", path: "/comercial?tab=clientes" },
      { tipo: "Prestador", titulo: "Diego Balbino", sub: "CPF: 123.456.789-00", path: "/cadastros?tab=prestadores" },
    ];
    setSearchResults(mockDb.filter(m => m.titulo.toLowerCase().includes(q) || m.sub.toLowerCase().includes(q)));
  }, [searchQuery]);

  const handleNav = (path: string) => { setShowSearch(false); navigate(path); };
  const handleLogout = () => { logout(); navigate("/login"); };

  const IconType = (tipo: string) => {
    switch (tipo) {
      case "nova_os": return <CheckCircle className="w-4 h-4 text-green-500"/>
      case "ocorrencia": return <AlertTriangle className="w-4 h-4 text-red-500"/>
      case "atraso": return <Clock className="w-4 h-4 text-orange-500"/>
      default: return <Truck className="w-4 h-4 text-blue-500"/>
    }
  };

  return (
    <header className="h-16 flex items-center px-6 gap-4 shrink-0 border-b border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-sm">
      {/* Breadcrumb */}
      <div className="hidden md:flex items-center gap-2 text-sm min-w-0">
        {breadcrumb.map((item, i) => (
          <div key={i} className="flex items-center gap-2 shrink-0">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
            {i === breadcrumb.length - 1 ? (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <item.icone className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="font-bold text-slate-800">{item.titulo}</span>
              </div>
            ) : (
              <span className="text-slate-400 hover:text-slate-600 cursor-pointer" onClick={() => i === 0 && navigate("/")}>{item.titulo}</span>
            )}
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md relative flex items-center gap-4 ml-auto">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowSearch(true)}
            placeholder="Buscar..."
            className="w-full pl-10 pr-16 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition text-xs"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/60">
            <Command className="w-3 h-3" />K
          </div>
        </div>

        {showSearch && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50" onClick={() => setShowSearch(false)}>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 p-4 border-b border-slate-100">
                <Search className="w-5 h-5 text-slate-400" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar OS, cliente, prestador..." className="flex-1 bg-transparent outline-none text-slate-800" autoFocus />
                <button onClick={() => setShowSearch(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-4 h-4" /></button>
              </div>
              <div className="max-h-96 overflow-y-auto p-2">
                {searchQuery.length < 2 ? (
                  <p className="p-4 text-sm text-center text-slate-400">Digite pelo menos 2 caracteres</p>
                ) : searchResults.length === 0 ? (
                  <p className="p-4 text-sm text-center text-slate-400">Nenhum resultado</p>
                ) : (
                  searchResults.map((res, idx) => (
                    <div key={idx} className="p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition" onClick={() => handleNav(res.path)}>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{res.tipo}</span>
                        <p className="text-sm font-semibold text-slate-800">{res.titulo}</p>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 truncate">{res.sub}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* Torre de Controle badge */}
        {location.pathname === "/torre-controle" && (
          <div className="hidden lg:flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-600 px-2.5 py-1 rounded-full animate-pulse whitespace-nowrap mr-2">
            <Radio className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Ao Vivo</span>
          </div>
        )}

        {/* Theme Toggle */}
        <button onClick={toggleTheme} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition" title={theme === "dark" ? "Modo claro" : "Modo escuro"}>
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Inbox */}
        <button onClick={() => navigate('/configuracoes?tab=comunicacoes-inbox')} className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition" title="Mensagens">
          <Inbox className="w-4 h-4" />
          <span className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold text-white bg-blue-500 rounded-full">3</span>
        </button>

        {/* Comunicacao */}
        <button onClick={() => navigate('/comunicacao')} className="p-2 rounded-xl hover:bg-primary/10 text-primary transition" title="Central de Comunicacao">
          <Megaphone className="w-4 h-4" />
        </button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
              <Bell className="w-4 h-4" />
              {naoLidas > 0 && <span className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold text-white bg-red-500 rounded-full">{naoLidas}</span>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 rounded-2xl border-slate-200 shadow-xl">
            <DropdownMenuLabel className="flex justify-between items-center">
              <span className="text-sm font-semibold">Notificacoes</span>
              {naoLidas > 0 && <Button variant="ghost" size="sm" onClick={() => setNotifs(notifs.map(n => ({ ...n, lida: true })))} className="h-6 text-[10px] font-medium">Marcar lidas</Button>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-[300px] overflow-y-auto">
              {notifs.map(n => (
                <DropdownMenuItem key={n.id} className={`p-3 border-b border-slate-50 cursor-pointer ${n.lida ? 'opacity-60' : 'bg-slate-50/50'}`} onClick={() => setNotifs(notifs.map(it => it.id === n.id ? { ...it, lida: true } : it))}>
                  <div className="flex items-start gap-3 w-full">
                    <div className="mt-0.5">{IconType(n.tipo)}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-tight ${n.lida ? 'font-medium' : 'font-semibold'}`}>{n.mensagem}</p>
                      <span className="text-[10px] text-slate-400 font-medium uppercase">{n.tempo}</span>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
            <div className="p-2 text-center border-t border-slate-100">
              <Button variant="ghost" className="w-full text-xs h-7 text-primary">Ver Historico</Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User */}
        {user && (
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
              {user.name?.charAt(0) ?? "U"}
            </div>
            <span className="text-sm font-medium text-slate-700 hidden md:block">{user.name || "Usuario"}</span>
          </div>
        )}

        {/* Logout */}
        <button onClick={handleLogout} className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition ml-1" title="Sair">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

export default AppTopbar;
