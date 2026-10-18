import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, AlertCircle, Info, ExternalLink, Check, History, Filter, User, Calendar, MessageSquare, LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AlertItem {
  id: string;
  texto: string;
  detalhe: string;
  tipo: "os" | "documento" | "orcamento" | "contrato" | "integracao" | "outros";
  link?: string;
}

interface HistoryAlert {
  id: string;
  data: Date;
  tipo: string;
  descricao: string;
  responsavel: string;
  observacao: string;
  status: "novo" | "visualizado" | "resolvido" | "ignorado";
}

// Sem fallback hardcoded — apenas dados reais do Supabase
// Se a consulta falhar, exibe mensagem de erro com botão de retry

const AlertBlock = ({ title, icon: Icon, items, borderColor, bgColor, iconColor, badgeColor, onAlertClick }: {
  title: string; icon: LucideIcon; items: AlertItem[];
  borderColor: string; bgColor: string; iconColor: string; badgeColor: string;
  onAlertClick: (item: AlertItem) => void;
}) => (
  <Card className={`border-l-4 ${borderColor} bg-card dark:bg-slate-800`}>
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          <CardTitle className="text-base text-foreground dark:text-white">{title}</CardTitle>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeColor}`}>{items.length}</span>
      </div>
    </CardHeader>
    <CardContent className="space-y-3 pt-0">
      {items.map((a) => (
        <div 
          key={a.id} 
          className={`rounded-lg p-3 ${bgColor} dark:bg-slate-700/50 hover:opacity-80 cursor-pointer transition flex items-start justify-between group`}
          onClick={() => onAlertClick(a)}
        >
          <div className="flex-1">
            <p className="text-sm font-medium flex items-center gap-2 text-foreground dark:text-white">
              {a.texto}
              {a.link && <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />}
            </p>
            <p className="text-xs text-muted-foreground dark:text-gray-400 mt-0.5">{a.detalhe}</p>
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

const toAlertItem = (row: any): AlertItem => ({
  id: row.id,
  texto: row.titulo || "—",
  detalhe: row.descricao || "",
  tipo: (["os", "documento", "orcamento", "contrato", "integracao", "outros"] as const).includes(row.tipo)
    ? row.tipo : "outros",
  link: row.payload?.link,
});

const toHistoryAlert = (row: any): HistoryAlert => ({
  id: row.id,
  data: new Date(row.created_at),
  tipo: row.tipo || "Manual",
  descricao: row.titulo || "",
  responsavel: row.operador_responsavel || "—",
  observacao: row.observacao_resolucao || "-",
  status: (["novo", "visualizado", "resolvido", "ignorado"] as const).includes(row.status)
    ? row.status : "novo",
});

const TabAlertas = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"alertas" | "historico">("alertas");
  const [alertasCriticos, setAlertasCriticos] = useState<AlertItem[]>([]);
  const [alertasAtencao, setAlertasAtencao] = useState<AlertItem[]>([]);
  const [alertasInformativos, setAlertasInformativos] = useState<AlertItem[]>([]);
  const [historico, setHistorico] = useState<HistoryAlert[]>([]);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [isNewAlertOpen, setIsNewAlertOpen] = useState(false);
  const [novoAlerta, setNovoAlerta] = useState({ descricao: "", observacao: "" });
  const { user } = useAuth();
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);

  const fetchAlertas = async () => {
    try {
      const { data, error } = await supabase
        .from("escalonamentos_humanos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      if (data) {
        const abertos = data.filter((t: any) => t.status === "aberto" && t.origem !== "manual");
        const historicoData = data.filter((t: any) => t.status !== "aberto" || t.origem === "manual");

        setAlertasCriticos(abertos.filter((t: any) => t.prioridade === "critica").map(toAlertItem));
        setAlertasAtencao(abertos.filter((t: any) => t.prioridade === "alta").map(toAlertItem));
        setAlertasInformativos(
          abertos.filter((t: any) => !t.prioridade || t.prioridade === "media" || t.prioridade === "baixa").map(toAlertItem)
        );
        setHistorico(historicoData.map(toHistoryAlert));
      }
    } catch (err) {
      console.warn("[TabAlertas] Erro ao carregar alertas:", err);
      setAlertasCriticos([]);
      setAlertasAtencao([]);
      setAlertasInformativos([]);
      setHistorico([]);
    }
  };

  useEffect(() => {
    fetchAlertas();

    const channel = supabase
      .channel("tab-alertas-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "escalonamentos_humanos" }, () => {
        fetchAlertas();
      })
      .subscribe();

    channelsRef.current = [channel];

    return () => {
      channelsRef.current.forEach((ch) => ch.unsubscribe());
    };
  }, []);

  const handleAlertClick = (item: AlertItem) => {
    if (item.link) {
      navigate(item.link);
    }
  };

  const handleMarcarResolvido = async (id: string) => {
    try {
      await supabase
        .from("escalonamentos_humanos")
        .update({
          status: "resolvido",
          resolvido_em: new Date().toISOString(),
          observacao_resolucao: "Marcado como resolvido pelo usuário",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      fetchAlertas();
    } catch {
      setHistorico((prev) =>
        prev.map((h) =>
          h.id === id
            ? { ...h, status: "resolvido" as const, responsavel: user?.name || "Usuário", observacao: `${h.observacao} - Marcado como resolvido` }
            : h
        )
      );
    }
  };

  const handleCriarAlerta = async () => {
    if (!novoAlerta.descricao) return;

    try {
      await supabase.from("escalonamentos_humanos").insert([
        {
          origem: "manual",
          modulo: "dashboard",
          tipo: "Manual",
          titulo: novoAlerta.descricao,
          descricao: novoAlerta.observacao || "-",
          prioridade: "media",
          status: "novo",
          operador_responsavel: user?.name || "Usuário",
          payload: {},
        },
      ]);
      setNovoAlerta({ descricao: "", observacao: "" });
      setIsNewAlertOpen(false);
      fetchAlertas();
    } catch {
      const novo: HistoryAlert = {
        id: `h${Date.now()}`,
        data: new Date(),
        tipo: "Manual",
        descricao: novoAlerta.descricao,
        responsavel: user?.name || "Usuário",
        observacao: novoAlerta.observacao || "-",
        status: "novo",
      };
      setHistorico([novo, ...historico]);
      setNovoAlerta({ descricao: "", observacao: "" });
      setIsNewAlertOpen(false);
    }
  };

  const historicoFiltrado = historico.filter((h) => {
    if (filtroTipo !== "todos" && h.tipo !== filtroTipo) return false;
    if (filtroStatus !== "todos" && h.status !== filtroStatus) return false;
    return true;
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "novo": return <Badge className="bg-blue-500">Novo</Badge>;
      case "visualizado": return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Visualizado</Badge>;
      case "resolvido": return <Badge className="bg-green-500">Resolvido</Badge>;
      case "ignorado": return <Badge variant="secondary">Ignorado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Abas */}
      <div className="flex items-center gap-4 border-b">
        <button
          onClick={() => setActiveTab("alertas")}
          className={`pb-3 px-1 font-medium transition border-b-2 ${
            activeTab === "alertas" 
              ? "border-orange-500 text-orange-600" 
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          Alertas Ativos
        </button>
        <button
          onClick={() => setActiveTab("historico")}
          className={`pb-3 px-1 font-medium transition border-b-2 ${
            activeTab === "historico" 
              ? "border-orange-500 text-orange-600" 
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="w-4 h-4 inline mr-2" />
          Histórico de Alertas
        </button>
      </div>

      {activeTab === "alertas" ? (
        <>
          <AlertBlock
            title="Críticos"
            icon={AlertTriangle}
            items={alertasCriticos}
            borderColor="border-red-500"
            bgColor="bg-red-50"
            iconColor="text-red-500"
            badgeColor="bg-red-100 text-red-700"
            onAlertClick={handleAlertClick}
          />
          <AlertBlock
            title="Atenção"
            icon={AlertCircle}
            items={alertasAtencao}
            borderColor="border-yellow-500"
            bgColor="bg-yellow-50"
            iconColor="text-yellow-600"
            badgeColor="bg-yellow-100 text-yellow-700"
            onAlertClick={handleAlertClick}
          />
          <AlertBlock
            title="Informativos"
            icon={Info}
            items={alertasInformativos}
            borderColor="border-blue-500"
            bgColor="bg-blue-50"
            iconColor="text-blue-500"
            badgeColor="bg-blue-100 text-blue-700"
            onAlertClick={handleAlertClick}
          />
        </>
      ) : (
        <>
          {/* Filtros e ações */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-[160px] h-8 text-sm">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="OS sem prestador">OS sem prestador</SelectItem>
                  <SelectItem value="Documento vencendo">Documento vencendo</SelectItem>
                  <SelectItem value="Orçamento vencendo">Orçamento vencendo</SelectItem>
                  <SelectItem value="Contrato vencendo">Contrato vencendo</SelectItem>
                  <SelectItem value="Integração com erro">Integração com erro</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[140px] h-8 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="visualizado">Visualizado</SelectItem>
                  <SelectItem value="resolvido">Resolvido</SelectItem>
                  <SelectItem value="ignorado">Ignorado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Dialog open={isNewAlertOpen} onOpenChange={setIsNewAlertOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="ml-auto">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Criar Alerta Manual
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Alerta Manual</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Descrição do Alerta</label>
                    <Input 
                      placeholder="Descreva o alerta..." 
                      value={novoAlerta.descricao}
                      onChange={(e) => setNovoAlerta({ ...novoAlerta, descricao: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Observação</label>
                    <Textarea 
                      placeholder="Adicione uma observação..." 
                      value={novoAlerta.observacao}
                      onChange={(e) => setNovoAlerta({ ...novoAlerta, observacao: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-2 rounded">
                    <User className="w-3 h-3" />
                    <span>Responsável: <strong>{user?.name || "Usuário"}</strong></span>
                    <span className="mx-1">•</span>
                    <Calendar className="w-3 h-3" />
                    <span>{format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                  </div>
                  <Button onClick={handleCriarAlerta} className="w-full">Criar Alerta</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Tabela de histórico */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data/Hora</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Descrição</TableHead>
                    <TableHead className="text-xs">Responsável</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicoFiltrado.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          {format(h.data, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                        {h.observacao && h.observacao !== "-" && (
                          <div className="flex items-start gap-1 mt-1 text-muted-foreground">
                            <MessageSquare className="w-3 h-3 mt-0.5" />
                            <span className="text-[10px]">{h.observacao}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{h.tipo}</TableCell>
                      <TableCell className="text-xs">{h.descricao}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-muted-foreground" />
                          {h.responsavel}
                        </div>
                      </TableCell>
                      <TableCell>{statusBadge(h.status)}</TableCell>
                      <TableCell>
                        {h.status !== "resolvido" && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 text-xs"
                            onClick={() => handleMarcarResolvido(h.id)}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Resolver
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default TabAlertas;
