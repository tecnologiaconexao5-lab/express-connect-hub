// ═══════════════════════════════════════════════════════════════════════════════
// MISSÃO 46 — CENTRAL DE COMUNICAÇÃO INTELIGENTE
// Página TMS: visualização de templates, eventos e histórico de comunicação
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { MessageSquare, Send, Eye, History, Filter, RefreshCw, Radio, Users, UserCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listarTemplates,
  listarTodosEventos,
  getCommunicationMode,
  CommunicationTemplate,
  CommunicationEvent,
} from "@/services/communicationHubService";

const publicoIcon: Record<string, React.ReactNode> = {
  destinatario: <Users className="h-4 w-4" />,
  cliente: <Eye className="h-4 w-4" />,
  prestador: <Truck className="h-4 w-4" />,
};

const publicoLabel: Record<string, string> = {
  destinatario: "Destinatário",
  cliente: "Cliente",
  prestador: "Prestador",
};

const statusColor: Record<string, string> = {
  simulado: "bg-slate-100 text-slate-700 border-slate-300",
  pendente: "bg-yellow-100 text-yellow-700 border-yellow-300",
  enviado: "bg-green-100 text-green-700 border-green-300",
  falhou: "bg-red-100 text-red-700 border-red-300",
  cancelado: "bg-gray-100 text-gray-500 border-gray-300",
};

export default function CentralComunicacao() {
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [eventos, setEventos] = useState<CommunicationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroPublico, setFiltroPublico] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  const mode = getCommunicationMode();

  const carregarDados = async () => {
    setLoading(true);
    const [tpl, evt] = await Promise.all([
      listarTemplates(),
      listarTodosEventos({ limit: 200 }),
    ]);
    setTemplates(tpl);
    setEventos(evt);
    setLoading(false);
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const eventosFiltrados = eventos.filter(e => {
    if (filtroPublico !== "todos" && e.publico !== filtroPublico) return false;
    if (filtroStatus !== "todos" && e.status_envio !== filtroStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Central de Comunicação Inteligente
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Modo: <Badge variant="outline" className={mode === "simulation" ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-green-50 border-green-300 text-green-700"}>{mode === "simulation" ? "SIMULAÇÃO" : "PRODUÇÃO"}</Badge>
            {" "}— Mensagens registradas no banco, envio real desabilitado.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={carregarDados} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Tabs defaultValue="eventos">
        <TabsList>
          <TabsTrigger value="eventos" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico ({eventosFiltrados.length})
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Radio className="h-4 w-4" />
            Templates ({templates.length})
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Preferências
          </TabsTrigger>
        </TabsList>

        {/* ABA: HISTÓRICO DE EVENTOS */}
        <TabsContent value="eventos" className="space-y-4">
          {/* Filtros */}
          <div className="flex gap-3 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filtroPublico} onValueChange={setFiltroPublico}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Público" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os públicos</SelectItem>
                <SelectItem value="destinatario">Destinatário</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="prestador">Prestador</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="simulado">Simulado</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="falhou">Falhou</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lista de eventos */}
          <div className="space-y-2">
            {eventosFiltrados.length === 0 && !loading && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum evento de comunicação registrado.
                </CardContent>
              </Card>
            )}
            {eventosFiltrados.map((evt) => (
              <Card key={evt.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="flex items-center gap-1">
                          {publicoIcon[evt.publico]}
                          {publicoLabel[evt.publico] || evt.publico}
                        </Badge>
                        <Badge className={statusColor[evt.status_envio] || ""}>
                          {evt.status_envio}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {evt.canal}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{evt.evento}</p>
                      {evt.assunto && (
                        <p className="text-xs text-muted-foreground mt-0.5">Assunto: {evt.assunto}</p>
                      )}
                      {evt.mensagem && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                          "{evt.mensagem.slice(0, 200)}{evt.mensagem.length > 200 ? "..." : ""}"
                        </p>
                      )}
                      {evt.destinatario_nome && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Para: {evt.destinatario_nome}{evt.destinatario_contato ? ` (${evt.destinatario_contato})` : ""}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0">
                      {evt.os_id && <p>OS: {evt.os_id.slice(0, 8)}</p>}
                      <p>{new Date(evt.created_at || "").toLocaleString("pt-BR")}</p>
                      {evt.erro && <p className="text-red-500 mt-1">{evt.erro}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ABA: TEMPLATES */}
        <TabsContent value="templates">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((tpl) => (
              <Card key={tpl.id} className="hover:shadow-sm transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="flex items-center gap-1">
                      {publicoIcon[tpl.publico]}
                      {publicoLabel[tpl.publico] || tpl.publico}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">{tpl.canal}</Badge>
                  </div>
                  <CardTitle className="text-sm mt-1">{tpl.nome}</CardTitle>
                  <p className="text-xs text-muted-foreground">Evento: {tpl.evento}</p>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground line-clamp-3 italic">
                    "{tpl.corpo.slice(0, 250)}{tpl.corpo.length > 250 ? "..." : ""}"
                  </p>
                  {tpl.variaveis && Array.isArray(tpl.variaveis) && tpl.variaveis.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tpl.variaveis.map((v: any) => (
                        <Badge key={v.var} variant="outline" className="text-[10px]">
                          {`{{${v.var}}}`}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {templates.length === 0 && !loading && (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum template cadastrado.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ABA: PREFERÊNCIAS */}
        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuração de Comunicação</CardTitle>
              <p className="text-sm text-muted-foreground">
                O modo de comunicação atual é <strong>{mode.toUpperCase()}</strong>.
                {mode === "simulation" && " Mensagens são registradas no banco mas não enviadas para canais reais."}
              </p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Para alterar o modo, configure a variável de ambiente:</p>
              <code className="bg-muted px-2 py-1 rounded text-xs">
                VITE_COMMUNICATIONS_MODE=production
              </code>
              <p className="mt-2">Canais suportados (quando em produção):</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>WhatsApp (Evolution API)</li>
                <li>E-mail (Zoho Mail)</li>
                <li>SMS (provedor a configurar)</li>
                <li>Push Notification (Firebase/OneSignal)</li>
                <li>Painel Cliente (in-app)</li>
              </ul>
              <p className="mt-4 text-xs">
                Branding padrão: <strong>Conexão Express</strong> — cores #1a365d / #2b6cb0
              </p>
              <p className="text-xs">
                Assinatura: "Entrega acompanhada por Conexão Express — tecnologia logística inteligente."
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
