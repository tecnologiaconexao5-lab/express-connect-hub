import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare, Send, ArrowRight, ArrowLeft,
  AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  Bot, Zap, Activity, Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useComunicacaoRobos } from "@/services/ia/useComunicacaoRobos";
import type { ComunicacaoRobo, TipoComunicacao } from "@/services/ia/comunicacaoEntreRobosService";

const STATUS_CORES: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800 border-yellow-300",
  enviado: "bg-blue-100 text-blue-800 border-blue-300",
  respondido: "bg-green-100 text-green-800 border-green-300",
  concluido: "bg-gray-100 text-gray-600 border-gray-300",
  erro: "bg-red-100 text-red-800 border-red-300",
};

const TIPO_LABELS: Record<TipoComunicacao, string> = {
  solicitacao: "Solicitação",
  resposta: "Resposta",
  delegacao: "Delegação",
  alerta: "Alerta",
  escalonamento: "Escalonamento",
};

const TIPO_ICONES: Record<string, React.ElementType> = {
  solicitacao: ArrowRight,
  resposta: ArrowLeft,
  delegacao: Send,
  alerta: AlertTriangle,
  escalonamento: Shield,
};

const PRIORIDADE_CORES: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

function fmtData(d: string | null | undefined) {
  if (!d) return "-";
  try { return new Date(d).toLocaleString("pt-BR"); } catch { return d; }
}

export function ComunicacaoRobosTab() {
  const {
    workerStatus, mensagens, fila, estatisticas,
    iniciarWorker, enviarMensagem, responder, escalar, recarregar,
  } = useComunicacaoRobos();

  const [filtroTipo, setFiltroTipo] = useState("todas");
  const [respondendoId, setRespondendoId] = useState<string | null>(null);
  const [respostaTexto, setRespostaTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    iniciarWorker(10000);
  }, [iniciarWorker]);

  const mensagensFiltradas = filtroTipo === "todas"
    ? mensagens
    : mensagens.filter((m) => m.tipo === filtroTipo);

  const handleResponder = useCallback(async (comunicacaoId: string) => {
    if (!respostaTexto.trim()) {
      toast.warning("Digite uma resposta");
      return;
    }
    setEnviando(true);
    try {
      const msg = mensagens.find((m) => m.id === comunicacaoId);
      if (!msg) return;
      const ok = await responder(comunicacaoId, respostaTexto, msg.destino_robo_id);
      if (ok) {
        toast.success("Resposta enviada");
        setRespondendoId(null);
        setRespostaTexto("");
        recarregar();
      } else {
        toast.error("Erro ao responder");
      }
    } finally {
      setEnviando(false);
    }
  }, [respostaTexto, responder, mensagens, recarregar]);

  const handleEscalar = useCallback(async (msg: ComunicacaoRobo) => {
    const result = await escalar(
      msg.origem_robo_id,
      `Escalonamento: ${msg.assunto}`,
      `Mensagem original: ${msg.mensagem}\n\nContexto: ${JSON.stringify(msg.contexto)}`,
      { comunicacao_original_id: msg.id },
    );
    if (result) {
      toast.success("Escalonado ao Diretor Virtual");
      recarregar();
    } else {
      toast.error("Erro ao escalonar");
    }
  }, [escalar, recarregar]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            Comunicação entre Robôs
          </h2>
          <Badge variant="outline" className={`flex items-center gap-1 ${
            workerStatus.estado === "ativo" ? "bg-green-100 text-green-800" :
            workerStatus.estado === "erro" ? "bg-red-100 text-red-800" :
            "bg-gray-100 text-gray-600"
          }`}>
            <span className={`h-2 w-2 rounded-full ${
              workerStatus.estado === "ativo" ? "bg-green-500" :
              workerStatus.estado === "erro" ? "bg-red-500" : "bg-gray-400"
            }`} />
            Fila: {workerStatus.filaPendente}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Filtrar tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="solicitacao">Solicitações</SelectItem>
              <SelectItem value="resposta">Respostas</SelectItem>
              <SelectItem value="delegacao">Delegações</SelectItem>
              <SelectItem value="alerta">Alertas</SelectItem>
              <SelectItem value="escalonamento">Escalonamentos</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8" onClick={recarregar}>
            <RefreshCw className="mr-1 h-3 w-3" />Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{estatisticas.total || 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Pendentes</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-yellow-600">{estatisticas.pendentes || 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Respondidas</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{estatisticas.respondidos || 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Delegações</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{estatisticas.delegacoes || 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Escalonamentos</CardTitle></CardHeader><CardContent><p className={`text-2xl font-bold ${(estatisticas.escalonamentos || 0) > 0 ? "text-red-600" : ""}`}>{estatisticas.escalonamentos || 0}</p></CardContent></Card>
      </div>

      {fila.length > 0 && (
        <Card className="border-amber-300">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
              <Activity className="h-4 w-4" />Fila de Processamento ({fila.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-32 overflow-y-auto">
            {fila.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-xs p-1 bg-amber-50 rounded">
                <Badge variant="outline" className="text-[9px]">{item.tipo_evento}</Badge>
                <span className="text-muted-foreground">{fmtData(item.created_at)}</span>
                <Badge className="text-[9px]">Robô: {item.robo_id.substring(0, 8)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />Mensagens
          </CardTitle>
        </CardHeader>
        <CardContent className="max-h-[600px] overflow-y-auto">
          {mensagensFiltradas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma mensagem entre robôs</p>
          ) : (
            <div className="space-y-3">
              {mensagensFiltradas.map((msg) => {
                const Icone = TIPO_ICONES[msg.tipo] || MessageSquare;
                return (
                  <div key={msg.id} className="p-3 bg-muted rounded-lg text-xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Icone className="h-3.5 w-3.5 text-blue-600" />
                        <span className="font-semibold">{msg.assunto}</span>
                        <Badge className={`text-[9px] ${STATUS_CORES[msg.status] || ""}`}>{msg.status}</Badge>
                        <Badge variant="outline" className="text-[9px]">{TIPO_LABELS[msg.tipo] || msg.tipo}</Badge>
                        {msg.prioridade !== "medium" && (
                          <Badge className={`text-[9px] ${PRIORIDADE_CORES[msg.prioridade] || ""}`}>{msg.prioridade}</Badge>
                        )}
                      </div>
                      <span className="text-muted-foreground shrink-0">{fmtData(msg.created_at)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Bot className="h-3 w-3" />
                      <span className="font-medium text-foreground">{msg.origem_nome || msg.origem_robo_id.substring(0, 8)}</span>
                      <ArrowRight className="h-3 w-3" />
                      <Bot className="h-3 w-3" />
                      <span className="font-medium text-foreground">{msg.destino_nome || msg.destino_robo_id.substring(0, 8)}</span>
                    </div>

                    <p className="text-muted-foreground">{msg.mensagem}</p>

                    {msg.resposta_texto && (
                      <div className="ml-4 pl-3 border-l-2 border-green-400 bg-green-50/50 p-2 rounded">
                        <p className="text-xs font-medium text-green-700">Resposta:</p>
                        <p className="text-xs text-green-600">{msg.resposta_texto}</p>
                        {msg.resposta_robo_id && (
                          <p className="text-[10px] text-green-500 mt-1">
                            Por: {msg.destino_nome || msg.resposta_robo_id.substring(0, 8)} em {fmtData(msg.updated_at)}
                          </p>
                        )}
                      </div>
                    )}

                    {msg.tarefa_id && (
                      <div className="text-[10px] text-muted-foreground">Tarefa: {msg.tarefa_id.substring(0, 8)}</div>
                    )}

                    <div className="flex gap-1 pt-1">
                      {msg.status === "enviado" && msg.tipo !== "escalonamento" && (
                        <>
                          <Button variant="default" size="sm" className="h-7 text-[10px]"
                            onClick={() => setRespondendoId(respondendoId === msg.id ? null : msg.id)}>
                            Responder
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-[10px] text-red-600"
                            onClick={() => handleEscalar(msg)}>
                            Escalar
                          </Button>
                        </>
                      )}
                      {msg.tipo === "escalonamento" && msg.status === "pendente" && (
                        <Badge className="bg-red-100 text-red-800 text-[9px]">Aguardando Diretor Virtual</Badge>
                      )}
                    </div>

                    {respondendoId === msg.id && (
                      <div className="space-y-2 pt-2 border-t">
                        <Textarea
                          placeholder="Digite a resposta..."
                          value={respostaTexto}
                          onChange={(e) => setRespostaTexto(e.target.value)}
                          className="min-h-[60px] text-xs"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-xs" onClick={() => handleResponder(msg.id)} disabled={enviando}>
                            <Send className="mr-1 h-3 w-3" />{enviando ? "Enviando..." : "Enviar Resposta"}
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setRespondendoId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
