import { useState, useEffect } from "react";
import { 
  Send, Users, MessageSquare, Bell, Clock, Sparkles, 
  Calendar, CheckCircle, AlertCircle, Loader2, ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { 
  criarComunicacao, enviarComunicacao, gerarMensagemComIA, 
  buscarDestinatarios, processarVariaveis 
} from "@/services/comunicacaoLote";

const TIPOS_PARCEIRO = ["autonomo", "agregado", "fixo", "esporadico"];
const STATUS_OPCOES = ["ativo", "analise", "inativo"];
const TIPOS_VEICULO = ["Moto", "Van", "VUC", "3/4", "Toco", "Truck", "Bitrem", "Carreta"];
const REGIOES = ["Grande SP", "ABC Paulista", "Interior SP", "Litoral SP", "Rio de Janeiro", "Belo Horizonte"];
const TIPOS_MENSAGEM = [
  { value: "rotas_disponiveis", label: "Rotas disponíveis" },
  { value: "avisos_operacionais", label: "Aviso operacional" },
  { value: "informativo_financeiro", label: "Informativo financeiro" },
  { value: "documentacao_pendente", label: "Documentação pendente" },
  { value: "convocacao", label: "Convocação para operação" },
  { value: "pesquisa", label: "Pesquisa de satisfação" },
  { value: "comunicado_geral", label: "Comunicado geral" },
  { value: "comemorativo", label: "Comemorativo" }
];

export function CentralComunicacao() {
  const [step, setStep] = useState(1);
  const [filtros, setFiltros] = useState({
    tipo_parceiro: [] as string[],
    status: [] as string[],
    tipo_veiculo: [] as string[],
    regiao: [] as string[],
    comportamento: "",
    disponibilidade: ""
  });
  const [canais, setCanais] = useState({
    whatsapp: true,
    push: false,
    interno: false
  });
  const [tipoMensagem, setTipoMensagem] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [tituloPush, setTituloPush] = useState("");
  const [corpoPush, setCorpoPush] = useState("");
  const [agendamento, setAgendamento] = useState<"agora" | "agendar">("agora");
  const [dataAgenda, setDataAgenda] = useState("");
  const [horaAgenda, setHoraAgenda] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [recorrenciaTipo, setRecorrenciaTipo] = useState("");
  const [reenvio, setReenvio] = useState({
    ativo: false,
    horas1: 2,
    horas2: 6,
    maxTentativas: 2,
    horaLimite: 22
  });
  const [destinatariosCount, setDestinatariosCount] = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewMessage, setPreviewMessage] = useState("");

  useEffect(() => {
    if (Object.values(filtros).some(v => Array.isArray(v) ? v.length > 0 : v)) {
      previewDestinatarios();
    }
  }, [filtros]);

  const previewDestinatarios = async () => {
    const dest = await buscarDestinatarios(filtros);
    setDestinatariosCount(dest.length);
  };

  const toggleFiltro = (campo: string, valor: string) => {
    setFiltros((prev: any) => {
      const current = prev[campo] as string[];
      const updated = current.includes(valor)
        ? current.filter(v => v !== valor)
        : [...current, valor];
      return { ...prev, [campo]: updated };
    });
  };

  const handleGerarComIA = async () => {
    if (!tipoMensagem) {
      toast.error("Selecione o tipo de mensagem primeiro");
      return;
    }
    setLoadingPreview(true);
    try {
      const msg = await gerarMensagemComIA(tipoMensagem, filtros);
      setMensagem(msg);
    } catch (error) {
      toast.error("Erro ao gerar mensagem");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handlePreview = () => {
    const exemplo = {
      nome: "João Silva",
      primeiro_nome: "João",
      tipo_veiculo: filtros.tipo_veiculo[0] || "VAN",
      regiao: filtros.regiao[0] || "Grande SP",
      qtd_os_semana: "5",
      link_app: "https://conexaoexpress.app",
      link_disponibilidade: "https://conexaoexpress.app/disp"
    };
    setPreviewMessage(processarVariaveis(mensagem, exemplo));
  };

  const handleEnviar = async () => {
    setSending(true);
    try {
      const comunicacao = await criarComunicacao({
        titulo: tipoMensagem || "Comunicação",
        tipo: tipoMensagem,
        conteudo: mensagem,
        canal_whatsapp: canais.whatsapp,
        canal_push: canais.push,
        canal_interno: canais.interno,
        titulo_push: tituloPush,
        corpo_push: corpoPush,
        agendado_para: agendamento === "agendar" ? `${dataAgenda}T${horaAgenda}:00` : null,
        recorrente,
        recurrencia_tipo: recorrente ? recorrenciaTipo : null,
        reenviar_nao_visualizado: reenvio.ativo,
        horas_para_reenvio1: reenvio.horas1,
        horas_para_reenvio2: reenvio.horas2,
        max_tentativas: reenvio.maxTentativas,
        hora_limite: reenvio.horaLimite
      }, filtros);

      if (agendamento === "agora") {
        await enviarComunicacao(comunicacao.id);
        toast.success("Comunicação enviada com sucesso!");
      } else {
        toast.success("Comunicação agendada!");
      }

      setStep(1);
      setFiltros({ tipo_parceiro: [], status: [], tipo_veiculo: [], regiao: [], comportamento: "", disponibilidade: "" });
      setMensagem("");
      setShowConfirmDialog(false);
    } catch (error) {
      toast.error("Erro ao enviar comunicação");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Central de Comunicação</h2>
          <p className="text-muted-foreground">Crie e envie mensagens em lote para prestadores</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="flex items-center">
            <button
              onClick={() => setStep(s)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s ? "bg-primary text-primary-foreground" :
                step > s ? "bg-green-500 text-white" : "bg-muted"
              }`}
            >
              {step > s ? <CheckCircle className="w-4 h-4" /> : s}
            </button>
            {s < 5 && <ChevronRight className="w-4 h-4 mx-1 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Passo 1 — Público-Alvo</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="mb-2 block">Por tipo de parceiro</Label>
              <div className="flex flex-wrap gap-2">
                {TIPOS_PARCEIRO.map(t => (
                  <button
                    key={t}
                    onClick={() => toggleFiltro("tipo_parceiro", t)}
                    className={`px-3 py-1 rounded-full text-sm border ${
                      filtros.tipo_parceiro.includes(t) ? "bg-primary text-primary-foreground" : ""
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Por status</Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPCOES.map(s => (
                  <button
                    key={s}
                    onClick={() => toggleFiltro("status", s)}
                    className={`px-3 py-1 rounded-full text-sm border ${
                      filtros.status.includes(s) ? "bg-primary text-primary-foreground" : ""
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Por tipo de veículo</Label>
              <div className="flex flex-wrap gap-2">
                {TIPOS_VEICULO.map(v => (
                  <button
                    key={v}
                    onClick={() => toggleFiltro("tipo_veiculo", v)}
                    className={`px-3 py-1 rounded-full text-sm border ${
                      filtros.tipo_veiculo.includes(v) ? "bg-primary text-primary-foreground" : ""
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Por região</Label>
              <div className="flex flex-wrap gap-2">
                {REGIOES.map(r => (
                  <button
                    key={r}
                    onClick={() => toggleFiltro("regiao", r)}
                    className={`px-3 py-1 rounded-full text-sm border ${
                      filtros.regiao.includes(r) ? "bg-primary text-primary-foreground" : ""
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Por comportamento</Label>
              <Select value={filtros.comportamento} onValueChange={(v) => setFiltros({...filtros, comportamento: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem_os_7">Sem OS nos últimos 7 dias</SelectItem>
                  <SelectItem value="sem_os_15">Sem OS nos últimos 15 dias</SelectItem>
                  <SelectItem value="sem_os_30">Sem OS nos últimos 30 dias</SelectItem>
                  <SelectItem value="com_pagamento_pendente">Com pagamento pendente</SelectItem>
                  <SelectItem value="doc_vencendo">Com documento vencendo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <Users className="w-5 h-5 text-blue-600 mb-2" />
              <p className="font-semibold text-blue-800">{destinatariosCount} prestadores serão impactados</p>
            </div>

            <Button onClick={() => setStep(2)} disabled={destinatariosCount === 0} className="w-full">
              Continuar
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Passo 2 — Canais de Envio</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5" />
                <div>
                  <p className="font-medium">WhatsApp Business API</p>
                  <p className="text-sm text-muted-foreground">Mensagem via WhatsApp</p>
                </div>
              </div>
              <Switch checked={canais.whatsapp} onCheckedChange={(v) => setCanais({...canais, whatsapp: v})} />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5" />
                <div>
                  <p className="font-medium">Notificação Push</p>
                  <p className="text-sm text-muted-foreground">Alerta no celular</p>
                </div>
              </div>
              <Switch checked={canais.push} onCheckedChange={(v) => setCanais({...canais, push: v})} />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5" />
                <div>
                  <p className="font-medium">Notificação Interna</p>
                  <p className="text-sm text-muted-foreground">No aplicativo</p>
                </div>
              </div>
              <Switch checked={canais.interno} onCheckedChange={(v) => setCanais({...canais, interno: v})} />
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-4">
                <Label>Reenviar se não visualizado</Label>
                <Switch checked={reenvio.ativo} onCheckedChange={(v) => setReenvio({...reenvio, ativo: v})} />
              </div>
              
              {reenvio.ativo && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Horas para 1º reenvio</Label>
                    <Input type="number" value={reenvio.horas1} onChange={(e) => setReenvio({...reenvio, horas1: parseInt(e.target.value)})} />
                  </div>
                  <div>
                    <Label className="text-xs">Horas para 2º reenvio</Label>
                    <Input type="number" value={reenvio.horas2} onChange={(e) => setReenvio({...reenvio, horas2: parseInt(e.target.value)})} />
                  </div>
                  <div>
                    <Label className="text-xs">Máx tentativas</Label>
                    <Input type="number" value={reenvio.maxTentativas} onChange={(e) => setReenvio({...reenvio, maxTentativas: parseInt(e.target.value)})} />
                  </div>
                  <div>
                    <Label className="text-xs">Hora limite</Label>
                    <Input type="number" value={reenvio.horaLimite} onChange={(e) => setReenvio({...reenvio, horaLimite: parseInt(e.target.value)})} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button onClick={() => setStep(3)} className="flex-1">Continuar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Passo 3 — Conteúdo da Mensagem</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Tipo de mensagem</Label>
              <Select value={tipoMensagem} onValueChange={setTipoMensagem}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {TIPOS_MENSAGEM.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Mensagem</Label>
                <Button variant="outline" size="sm" onClick={handleGerarComIA} disabled={loadingPreview} className="gap-1">
                  <Sparkles className="w-4 h-4" />
                  {loadingPreview ? "Gerando..." : "Gerar com IA"}
                </Button>
              </div>
              <Textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Digite sua mensagem usando variáveis como variavel, primeiro_nome, tipo_veiculo, etc."
                rows={6}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Variáveis: {"{{nome}}"}, {"{{primeiro_nome}}"}, {"{{tipo_veiculo}}"}, {"{{regiao}}"}, {"{{qtd_os_semana}}"}, {"{{link_app}}"}, {"{{link_disponibilidade}}"}
              </p>
            </div>

            {canais.push && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Título Push</Label>
                  <Input value={tituloPush} onChange={(e) => setTituloPush(e.target.value)} placeholder="Máx 50 chars" maxLength={50} />
                </div>
                <div>
                  <Label>Corpo Push</Label>
                  <Input value={corpoPush} onChange={(e) => setCorpoPush(e.target.value)} placeholder="Máx 200 chars" maxLength={200} />
                </div>
              </div>
            )}

            <Button variant="outline" onClick={handlePreview} className="w-full">
              Ver Preview
            </Button>

            {previewMessage && (
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{previewMessage}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
              <Button onClick={() => setStep(4)} disabled={!mensagem} className="flex-1">Continuar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader><CardTitle>Passo 4 — Agendamento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <button
                onClick={() => setAgendamento("agora")}
                className={`flex-1 p-4 border rounded-lg ${agendamento === "agora" ? "border-primary bg-primary/5" : ""}`}
              >
                <Send className="w-5 h-5 mx-auto mb-2" />
                <p className="text-sm font-medium">Enviar agora</p>
              </button>
              <button
                onClick={() => setAgendamento("agendar")}
                className={`flex-1 p-4 border rounded-lg ${agendamento === "agendar" ? "border-primary bg-primary/5" : ""}`}
              >
                <Calendar className="w-5 h-5 mx-auto mb-2" />
                <p className="text-sm font-medium">Agendar</p>
              </button>
            </div>

            {agendamento === "agendar" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={dataAgenda} onChange={(e) => setDataAgenda(e.target.value)} />
                </div>
                <div>
                  <Label>Hora</Label>
                  <Input type="time" value={horaAgenda} onChange={(e) => setHoraAgenda(e.target.value)} />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch checked={recorrente} onCheckedChange={setRecorrente} />
              <Label>Mensagem recorrente</Label>
            </div>

            {recorrente && (
              <Select value={recorrenciaTipo} onValueChange={setRecorrenciaTipo}>
                <SelectTrigger><SelectValue placeholder="Frequência" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diario">Diário</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>Voltar</Button>
              <Button onClick={() => setShowConfirmDialog(true)} className="flex-1">Revisar e Enviar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader><CardTitle>Passo 5 — Revisão</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p><strong>Destinatários:</strong> {destinatariosCount}</p>
              <p><strong>Canais:</strong> {canais.whatsapp ? "WhatsApp " : ""}{canais.push ? "Push " : ""}{canais.interno ? "Interno" : ""}</p>
              <p><strong>Tipo:</strong> {TIPOS_MENSAGEM.find(t => t.value === tipoMensagem)?.label}</p>
              <p><strong>Agendamento:</strong> {agendamento === "agora" ? "Envio imediato" : `${dataAgenda} às ${horaAgenda}`}</p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-blue-800">Preview da mensagem:</p>
              <p className="text-sm mt-2">{mensagem.substring(0, 200)}...</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(4)}>Voltar</Button>
              <Button onClick={handleEnviar} disabled={sending} className="flex-1 gap-2">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {agendamento === "agora" ? "Enviar Comunicação" : "Agendar Comunicação"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Envio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Você está prestes a enviar uma comunicação para <strong>{destinatariosCount}</strong> prestadores.</p>
            <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p>
            <Button onClick={handleEnviar} disabled={sending} className="w-full">
              {sending ? "Enviando..." : "Confirmar Envio"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
