import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, AlertCircle, Info, ExternalLink, Check, X, History, Filter, User, Calendar, MessageSquare, LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getUser } from "@/lib/auth";
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

const alertasCriticosInicial: AlertItem[] = [
  { id: "ac1", texto: "OS-4818 com ocorrência aberta há 4h", detalhe: "Endereço não localizado — Shopee", tipo: "os", link: "/operacao/os?status=ocorrencia" },
  { id: "ac2", texto: "Integração CT-e com erro desde 08:00", detalhe: "Timeout na SEFAZ-SP", tipo: "integracao", link: "/monitor-api" },
  { id: "ac3", texto: "Prestador RápidoFrete bloqueado com 3 OS ativas", detalhe: "Documentação vencida", tipo: "documento", link: "/cadastros/prestadores" },
];

const alertasAtencaoInicial: AlertItem[] = [
  { id: "aa1", texto: "2 orçamentos vencem hoje", detalhe: "Magazine Luiza (ORC-421), Renner (ORC-418)", tipo: "orcamento", link: "/comercial/orcamentos" },
  { id: "aa2", texto: "5 documentos vencem em 7 dias", detalhe: "CNH de 3 parceiros, CRLV de 2 veículos", tipo: "documento", link: "/cadastros/prestadores" },
  { id: "aa3", texto: "OS-4814 sem parceiro há mais de 2h", detalhe: "Renner — RS→SC", tipo: "os", link: "/operacao/os?status=sem-parceiro" },
  { id: "aa4", texto: "Contrato Americanas vence em 28 dias", detalhe: "Contrato #CT-089", tipo: "contrato", link: "/contratos" },
  { id: "aa5", texto: "Tabela de valores vencida para 2 clientes", detalhe: "Casas Bahia, Riachuelo", tipo: "outros", link: "/comercial/tabela-valores" },
  { id: "aa6", texto: "Veículo ABC-1234 com doc vencendo", detalhe: "CRLV vence em 5 dias", tipo: "documento", link: "/frota" },
];

const alertasInformativosInicial: AlertItem[] = [
  { id: "ai1", texto: "12 OS sem comprovante de entrega", detalhe: "Últimas 48h", tipo: "os", link: "/operacao/os?status=sem-pod" },
  { id: "ai2", texto: "Prestador Sul Express com pendência documental", detalhe: "Seguro RCTR-C vencido", tipo: "documento", link: "/cadastros/prestadores" },
  { id: "ai3", texto: "3 clientes sem tabela de valores ativa", detalhe: "C&A, Riachuelo, Ponto", tipo: "orcamento", link: "/comercial/tabela-valores" },
];

const historicoInicial: HistoryAlert[] = [
  { id: "h1", data: new Date(2026, 2, 26, 14, 32), tipo: "OS sem prestador", descricao: "OS-2026-0142 sem prestador há 3 horas", responsavel: "João Silva", observacao: "Acionado prestador alternativo", status: "resolvido" },
  { id: "h2", data: new Date(2026, 2, 26, 10, 15), tipo: "Documento vencendo", descricao: "CNH do prestador João Pedro vence em 5 dias", responsavel: "Maria Santos", observacao: "Notificado o prestador", status: "visualizado" },
  { id: "h3", data: new Date(2026, 2, 25, 16, 45), tipo: "Orçamento vencendo", descricao: "ORC-419 Magazine Luiga vence amanhã", responsavel: "Carlos Oliveira", observacao: "Cliente pediu prazo até sexta", status: "ignorado" },
  { id: "h4", data: new Date(2026, 2, 25, 9, 20), tipo: "Integração com erro", descricao: "Falha na emissão de NF-e", responsavel: "Diego Balbino", observacao: "Reiniciei o serviço", status: "resolvido" },
  { id: "h5", data: new Date(2026, 2, 24, 11, 0), tipo: "Contrato vencendo", descricao: "Contrato Shopee vence em 15 dias", responsavel: "João Silva", observacao: "Renegociação em andamento", status: "visualizado" },
];

const AlertBlock = ({ title, icon: Icon, items, borderColor, bgColor, iconColor, badgeColor, onAlertClick }: {
  title: string; icon: LucideIcon; items: AlertItem[];
  borderColor: string; bgColor: string; iconColor: string; badgeColor: string;
  onAlertClick: (item: AlertItem) => void;
}) => (
  <Card className={`border-l-4 ${borderColor}`}>
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeColor}`}>{items.length}</span>
      </div>
    </CardHeader>
    <CardContent className="space-y-3 pt-0">
      {items.map((a) => (
        <div 
          key={a.id} 
          className={`rounded-lg p-3 ${bgColor} hover:opacity-80 cursor-pointer transition flex items-start justify-between group`}
          onClick={() => onAlertClick(a)}
        >
          <div className="flex-1">
            <p className="text-sm font-medium flex items-center gap-2">
              {a.texto}
              {a.link && <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{a.detalhe}</p>
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

const TabAlertas = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"alertas" | "historico">("alertas");
  const [alertasCriticos, setAlertasCriticos] = useState(alertasCriticosInicial);
  const [alertasAtencao, setAlertasAtencao] = useState(alertasAtencaoInicial);
  const [alertasInformativos, setAlertasInformativos] = useState(alertasInformativosInicial);
  const [historico, setHistorico] = useState(historicoInicial);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [isNewAlertOpen, setIsNewAlertOpen] = useState(false);
  const [novoAlerta, setNovoAlerta] = useState({ descricao: "", observacao: "" });
  const user = getUser();

  const handleAlertClick = (item: AlertItem) => {
    if (item.link) {
      navigate(item.link);
    }
  };

  const handleMarcarResolvido = (id: string) => {
    setHistorico(prev => prev.map(h => 
      h.id === id 
        ? { ...h, status: "resolvido" as const, responsavel: user?.name || "Usuário", observacao: `${h.observacao} - Marcado como resolvido` }
        : h
    ));
  };

  const handleCriarAlerta = () => {
    if (!novoAlerta.descricao) return;
    
    const novo: HistoryAlert = {
      id: `h${Date.now()}`,
      data: new Date(),
      tipo: "Manual",
      descricao: novoAlerta.descricao,
      responsavel: user?.name || "Usuário",
      observacao: novoAlerta.observacao || "-",
      status: "novo"
    };
    
    setHistorico([novo, ...historico]);
    setNovoAlerta({ descricao: "", observacao: "" });
    setIsNewAlertOpen(false);
  };

  const historicoFiltrado = historico.filter(h => {
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
