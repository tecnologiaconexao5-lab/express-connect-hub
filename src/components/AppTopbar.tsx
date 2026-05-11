import { useState, useEffect, useCallback } from "react";
import { Bell, Search, LogOut, Radio, CheckCircle, AlertTriangle, Truck, Clock, Megaphone, Inbox, Sun, Moon, X, Command } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { getUser, logout } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/hooks/useTheme";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
    // Mock notificacoes
    setNotifs([
      { id: 1, tipo: "nova_os", mensagem: "OS-1045 solicitada por Tech Solutions", tempo: "5 min", lida: false },
      { id: 2, tipo: "ocorrencia", mensagem: "Avaria registrada: OS-1040", tempo: "15 min", lida: false },
      { id: 3, tipo: "atraso", mensagem: "OS-880 está atrasada em 2h", tempo: "1 hora", lida: true }
    ]);
  }, []);

  useEffect(() => {
    if (searchQuery.length < 2) {
       setSearchResults([]);
       return;
    }
    const q = searchQuery.toLowerCase();
    const mockDb = [
      { tipo: "Ordem de Serviço", titulo: "OS-9982", sub: "Cliente: Votorantim", path: "/operacao?tab=os&id=OS-9982" },
      { tipo: "Ordem de Serviço", titulo: "OS-1240", sub: "Status: Atrasada", path: "/operacao?tab=os&id=OS-1240" },
      { tipo: "Orçamento", titulo: "ORC-5541", sub: "Logística Alpha - R$ 15.000", path: "/comercial?tab=orcamentos&id=ORC-5541" },
      { tipo: "Cliente", titulo: "Ambev S.A (Matriz)", sub: "CNPJ: 07.526.557/0001-00", path: "/comercial?tab=clientes" },
      { tipo: "Prestador", titulo: "Diego Balbino", sub: "CPF: 123.456.789-00 / HR Seco", path: "/cadastros?tab=prestadores" },
      { tipo: "Prestador", titulo: "Ailton Transportes LTDA", sub: "CNPJ: 14.526.557/0001-00 / Cavalo LS", path: "/cadastros?tab=prestadores" }
    ];
    setSearchResults(mockDb.filter(m => m.titulo.toLowerCase().includes(q) || m.sub.toLowerCase().includes(q)));
  }, [searchQuery]);

  const handleNav = (path: string) => {
    setShowSearch(false);
    navigate(path);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const IconType = (tipo: string) => {
    switch (tipo) {
      case "nova_os": return <CheckCircle className="w-4 h-4 text-green-500"/>
      case "ocorrencia": return <AlertTriangle className="w-4 h-4 text-red-500"/>
      case "atraso": return <Clock className="w-4 h-4 text-orange-500"/>
      default: return <Truck className="w-4 h-4 text-blue-500"/>
    }
  };

  const markAllRead = () => setNotifs(notifs.map(n => ({ ...n, lida: true })));

  return (
    <header className="h-16 bg-tms-topbar flex items-center px-6 gap-4 shrink-0 border-b border-tms-topbar-border">
      {/* Search */}
      <div className="flex-1 max-w-md relative flex items-center gap-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowSearch(true)}
            placeholder="Buscar OS, cliente, prestador..."
            className="w-full pl-10 pr-16 py-2 rounded-lg bg-muted border-0 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 transition z-20 relative"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded border border-border/50">
            <Command className="w-3 h-3" />K
          </div>
          {showSearch && (
             <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50" onClick={() => setShowSearch(false)}>
               <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                 <div className="flex items-center gap-3 p-4 border-b border-border">
                   <Search className="w-5 h-5 text-muted-foreground" />
                   <input
                     type="text"
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     placeholder="Buscar OS, cliente, prestador, orçamento..."
                     className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                     autoFocus
                   />
                   <button onClick={() => setShowSearch(false)} className="p-1 hover:bg-muted rounded">
                     <X className="w-4 h-4" />
                   </button>
                 </div>
                 <div className="max-h-96 overflow-y-auto p-2">
                   {searchQuery.length < 2 ? (
                     <p className="p-4 text-sm text-center text-muted-foreground">Digite pelo menos 2 caracteres para buscar</p>
                   ) : searchResults.length === 0 ? (
                     <p className="p-4 text-sm text-center text-muted-foreground">Nenhum resultado encontrado</p>
                   ) : (
                     searchResults.map((res: any, idx) => (
                       <div 
                         key={idx} 
                         className="p-3 hover:bg-muted rounded-lg cursor-pointer transition"
                         onClick={() => handleNav(res.path)}
                       >
                         <div className="flex items-center gap-2">
                           <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${res.tipo === 'Cliente' ? 'bg-blue-500/20 text-blue-400' : res.tipo === 'Ordem de Serviço' ? 'bg-green-500/20 text-green-400' : res.tipo === 'Orçamento' ? 'bg-orange-500/20 text-orange-400' : 'bg-purple-500/20 text-purple-400'}`}>{res.tipo}</span>
                           <p className="text-sm font-semibold text-foreground">{res.titulo}</p>
                         </div>
                         <p className="text-xs text-muted-foreground mt-1 truncate">{res.sub}</p>
                       </div>
                     ))
                   )}
                 </div>
               </div>
             </div>
          )}
        </div>
        
        {location.pathname === "/torre-controle" && (
          <div className="hidden lg:flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-600 px-3 py-1.5 rounded-full animate-pulse whitespace-nowrap">
            <Radio className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Torre de Controle — Ao Vivo</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
          title={theme === "dark" ? "Modo claro" : "Modo escuro"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Inbox */}
        <button
          onClick={() => navigate('/configuracoes?tab=comunicacoes-inbox')}
          className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
          title="Inbox de Mensagens"
        >
          <Inbox className="w-4 h-4" />
          <span className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold text-white bg-blue-500 rounded-full">3</span>
        </button>

        {/* Central de Comunicacao */}
        <button
          onClick={() => navigate('/comunicacao')}
          className="p-2 rounded-lg hover:bg-primary/10 text-primary transition"
          title="Central de Comunicação"
        >
          <Megaphone className="w-4 h-4" />
        </button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition">
              <Bell className="w-4 h-4" />
              {naoLidas > 0 && <span className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold text-white bg-destructive rounded-full">{naoLidas}</span>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex justify-between items-center">
              <span className="text-sm font-semibold">Notificações</span>
              {naoLidas > 0 && <Button variant="ghost" size="sm" onClick={markAllRead} className="h-6 text-[10px] text-muted-foreground p-0 px-2 font-medium">Marcar Todas c/ Lidas</Button>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-[300px] overflow-y-auto">
               {notifs.map(n => (
                 <DropdownMenuItem key={n.id} className={`p-3 border-b border-border/50 cursor-pointer ${n.lida ? 'opacity-60' : 'bg-muted/30'}`} onClick={() => setNotifs(notifs.map(it => it.id === n.id ? { ...it, lida: true } : it))}>
                    <div className="flex items-start gap-3 w-full">
                       <div className="mt-0.5">
                         {IconType(n.tipo)}
                       </div>
                       <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                          <p className={`text-sm leading-tight ${n.lida ? 'font-medium' : 'font-semibold'}`}>{n.mensagem}</p>
                          <span className="text-[10px] text-muted-foreground font-medium uppercase">{n.tempo}</span>
                       </div>
                    </div>
                 </DropdownMenuItem>
               ))}
               {notifs.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">Sino vazio. Nada acontecendo!</div>}
            </div>
            <div className="p-2 text-center border-t border-border">
              <Button variant="ghost" className="w-full text-xs h-7 text-primary hover:bg-primary/10">Ver Histórico Central</Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Unit */}
        {user && (
          <span className="text-xs text-muted-foreground/70 hidden md:block ml-2">
            {user.unit}
          </span>
        )}

        {/* Avatar */}
        <div className="flex items-center gap-2 ml-1">
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-sm font-semibold text-primary">
            {user?.name?.charAt(0) ?? "U"}
          </div>
          {user && (
            <span className="text-sm text-foreground font-medium hidden md:block">
              {user.name}
            </span>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition ml-1"
          title="Sair"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

export default AppTopbar;
