import { useState, useEffect } from "react";
import { Bell, Search, LogOut, Radio, CheckCircle, AlertTriangle, Truck, Clock, Megaphone, Inbox } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { getUser, logout } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const AppTopbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const [notifs, setNotifs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const naoLidas = notifs.filter(n => !n.lida).length;

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
    <header className="h-16 bg-tms-topbar flex items-center px-6 gap-4 shrink-0">
      {/* Search */}
      <div className="flex-1 max-w-md relative flex items-center gap-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tms-topbar-fg/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowSearch(true)}
            placeholder="Buscar motorista, cliente ou pedido (Ex: OS-998)"
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary/80 border-0 text-sm text-tms-topbar-fg placeholder:text-tms-topbar-fg/40 focus:outline-none focus:ring-2 focus:ring-primary/50 transition z-20 relative relative-focused"
          />
          {showSearch && searchQuery.length > 1 && (
             <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-2 overflow-y-auto max-h-80">
                {searchResults.length === 0 ? (
                  <p className="p-3 text-xs text-center text-slate-500">Nenhum resultado encontrado.</p>
                ) : (
                  searchResults.map((res: any, idx) => (
                    <div 
                      key={idx} 
                      className="p-3 border-b last:border-0 hover:bg-slate-50 cursor-pointer rounded transition"
                      onClick={() => handleNav(res.path)}
                    >
                       <div className="flex items-center gap-2">
                         <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm ${res.tipo === 'Cliente' ? 'bg-blue-100 text-blue-700' : res.tipo === 'Ordem de Serviço' ? 'bg-green-100 text-green-700' : res.tipo === 'Orçamento' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>{res.tipo}</span>
                         <p className="text-sm font-bold text-slate-800 shrink-0">{res.titulo}</p>
                       </div>
                       <p className="text-xs text-muted-foreground mt-1 truncate">{res.sub}</p>
                    </div>
                  ))
                )}
             </div>
          )}
          {showSearch && <div className="fixed inset-0 z-10" onClick={() => setShowSearch(false)} />}
        </div>
        
        {location.pathname === "/torre-controle" && (
          <div className="hidden lg:flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-600 px-3 py-1.5 rounded-full animate-pulse whitespace-nowrap">
            <Radio className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Torre de Controle — Ao Vivo</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Inbox Comunicacoes */}
        <button 
          onClick={() => navigate('/configuracoes?tab=comunicacoes-inbox')}
          className="relative p-2 rounded-lg hover:bg-secondary/50 text-tms-topbar-fg transition"
          title="Inbox de Mensagens"
        >
          <Inbox className="w-5 h-5" />
          <span className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold text-white bg-blue-600 rounded-full">3</span>
        </button>

        {/* Central de Comunicacao */}
        <button 
          onClick={() => navigate('/comunicacao')}
          className="p-2 rounded-lg hover:bg-secondary/50 text-tms-topbar-fg transition text-orange-500 bg-orange-500/10 hover:bg-orange-500/20"
          title="Central de Comunicação"
        >
          <Megaphone className="w-5 h-5" />
        </button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative p-2 rounded-lg hover:bg-secondary/50 text-tms-topbar-fg transition">
              <Bell className="w-5 h-5" />
              {naoLidas > 0 && <span className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold text-white bg-red-600 rounded-full">{naoLidas}</span>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex justify-between items-center">
              <span>Notificações</span>
              {naoLidas > 0 && <Button variant="ghost" size="sm" onClick={markAllRead} className="h-6 text-[10px] text-muted-foreground p-0 px-2 uppercase hover:bg-muted font-bold">Marcar Todas c/ Lidas</Button>}
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
                          <p className={`text-sm leading-tight ${n.lida ? 'font-medium' : 'font-bold'}`}>{n.mensagem}</p>
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase">{n.tempo}</span>
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
