import { useState, useEffect, useRef } from "react";
import {
  Bot, User, UserCheck, Send, RefreshCw, Smartphone, Zap,
  Settings, Save, ToggleLeft, ToggleRight, Plus, Phone,
  ShieldAlert, MessageSquare, ChevronRight, Loader2,
  AlertTriangle, CheckCircle2, XCircle, Wifi, WifiOff,
  QrCode, Unplug, Link, Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Conversa, Mensagem, IAConfig, StatusPrestador,
  listarConversas, listarMensagens, salvarMensagem,
  carregarConfigIA, salvarConfigIA, assumirConversa,
  voltarParaIA, enviarRespostaHumano, processarMensagemPrestador,
  buscarOuCriarConversa, carregarConfigWhatsApp, salvarConfigWhatsApp,
  WhatsAppConfig, StatusConexao
} from "@/services/integracoes/recrutamentoWhatsappIAService";

// ── Status helpers ──────────────────────────────────────────
const STATUS_LABEL: Record<StatusPrestador, string> = {
  novo: "Novo",
  em_analise: "Em Análise",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  bloqueado: "Bloqueado",
};
const STATUS_COLOR: Record<StatusPrestador, string> = {
  novo: "bg-blue-100 text-blue-700 border-blue-200",
  em_analise: "bg-yellow-100 text-yellow-700 border-yellow-200",
  aprovado: "bg-green-100 text-green-700 border-green-200",
  reprovado: "bg-red-100 text-red-700 border-red-200",
  bloqueado: "bg-gray-100 text-gray-600 border-gray-300",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// ── Simulação dialog ────────────────────────────────────────
function SimularDialog({
  onSimular,
  onClose,
}: {
  onSimular: (tel: string, nome: string, msg: string) => void;
  onClose: () => void;
}) {
  const [tel, setTel] = useState("11999990001");
  const [nome, setNome] = useState("João Prestador");
  const [msg, setMsg] = useState("Olá, quero me cadastrar para trabalhar com vocês!");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-green-600" /> Simular Mensagem WhatsApp
        </h3>
        <div className="space-y-3">
          <div>
            <Label>Telefone</Label>
            <Input value={tel} onChange={e => setTel(e.target.value)} placeholder="11999990000" />
          </div>
          <div>
            <Label>Nome (opcional)</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do prestador" />
          </div>
          <div>
            <Label>Mensagem</Label>
            <Textarea value={msg} onChange={e => setMsg(e.target.value)} rows={3} />
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => { onSimular(tel, nome, msg); onClose(); }}>
            <Send className="w-4 h-4 mr-2" /> Simular
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Config IA Panel ─────────────────────────────────────────
function ConfigIAPanel() {
  const [config, setConfig] = useState<IAConfig>({
    id: "", manual_empresa: "", regras_permitidas: "", regras_bloqueadas: "", ia_ativa: true, updated_at: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => { carregarConfigIA().then(setConfig); }, []);

  const handleSalvar = async () => {
    setSalvando(true);
    await salvarConfigIA(config);
    setSalvando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${config.ia_ativa ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
          <span className="font-semibold">{config.ia_ativa ? "IA Global Ativa" : "IA Global Pausada"}</span>
        </div>
        <button
          onClick={() => setConfig(c => ({ ...c, ia_ativa: !c.ia_ativa }))}
          className="transition-colors"
        >
          {config.ia_ativa
            ? <ToggleRight className="w-10 h-10 text-green-500" />
            : <ToggleLeft className="w-10 h-10 text-gray-400" />}
        </button>
      </div>

      <div className="grid gap-4">
        <div>
          <Label className="font-semibold mb-1 block">📖 Manual da Empresa</Label>
          <p className="text-xs text-muted-foreground mb-2">Contexto geral que a IA usará para responder.</p>
          <Textarea
            value={config.manual_empresa || ""}
            onChange={e => setConfig(c => ({ ...c, manual_empresa: e.target.value }))}
            rows={5}
            placeholder="Descreva a empresa, serviços, horários, requisitos..."
            className="resize-none font-mono text-sm"
          />
        </div>
        <div>
          <Label className="font-semibold mb-1 block text-green-700">✅ Regras Permitidas</Label>
          <p className="text-xs text-muted-foreground mb-2">O que a IA PODE responder.</p>
          <Textarea
            value={config.regras_permitidas || ""}
            onChange={e => setConfig(c => ({ ...c, regras_permitidas: e.target.value }))}
            rows={4}
            placeholder="Cadastro, documentação, tipos de veículos, pagamento genérico..."
            className="resize-none border-green-200 focus-visible:ring-green-400 text-sm"
          />
        </div>
        <div>
          <Label className="font-semibold mb-1 block text-red-700">🚫 Regras Bloqueadas</Label>
          <p className="text-xs text-muted-foreground mb-2">O que a IA NUNCA deve revelar.</p>
          <Textarea
            value={config.regras_bloqueadas || ""}
            onChange={e => setConfig(c => ({ ...c, regras_bloqueadas: e.target.value }))}
            rows={4}
            placeholder="Dados de clientes, rotas, valores específicos, dados internos..."
            className="resize-none border-red-200 focus-visible:ring-red-400 text-sm"
          />
        </div>
      </div>

      <Button onClick={handleSalvar} disabled={salvando} className="w-full">
        {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : salvo ? <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" /> : <Save className="w-4 h-4 mr-2" />}
        {salvo ? "Salvo com Sucesso!" : "Salvar Configurações"}
      </Button>

      {/* Resumo das regras de segurança fixas */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-4">
          <p className="font-semibold text-amber-800 flex items-center gap-2 mb-2">
            <ShieldAlert className="w-4 h-4" /> Segurança Fixa (não editável)
          </p>
          <div className="text-xs text-amber-700 space-y-1">
            <p>• <strong>Não Aprovado:</strong> Bloqueado automaticamente: nomes de clientes, endereços, rotas, valores específicos</p>
            <p>• <strong>Aprovado:</strong> Apenas dados vinculados ao próprio prestador, nunca dados de terceiros</p>
            <p>• <strong>Bloqueado/Reprovado:</strong> Resposta de encerramento sem detalhes operacionais</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


// Removidos carregarConfigLocal, salvarConfigLocal e salvarConfigSupabase (movidos/substituídos pelo service)

// ── Painel de Conexão WhatsApp ───────────────────────────────
function ConexaoWhatsAppPanel() {
  const [cfg, setCfg] = useState<WhatsAppConfig>({
    evolution_api_url: "",
    instance_name: "recrutamento-conexao-express",
    n8n_webhook_url: "",
    numero_operacional: "",
    status: "desconectado",
    ia_ativa: true,
  });
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [testando, setTestando] = useState(false);
  const [testeResult, setTesteResult] = useState<string | null>(null);
  const [supabaseOk, setSupabaseOk] = useState<boolean | null>(null);

  // Carrega configuração do Supabase ao montar
  useEffect(() => {
    carregarConfigWhatsApp().then(data => {
      setCfg(data);
      setSupabaseOk(true);
    }).catch(() => {
      setSupabaseOk(false);
    });
  }, []);

  const handleSalvar = async () => {
    setSalvando(true);
    const ok = await salvarConfigWhatsApp(cfg);
    setSalvando(false);
    setSalvo(true);
    setSupabaseOk(ok);
    setTimeout(() => setSalvo(false), 2500);
  };

  const handleTestarConexao = async () => {
    if (!cfg.n8n_webhook_url && !cfg.evolution_api_url) {
      setTesteResult("❌ Preencha a URL do N8N ou da Evolution API antes de testar.");
      return;
    }
    setTestando(true);
    setTesteResult(null);
    try {
      // Testa via N8N (proxy seguro — nunca direto à Evolution no frontend)
      if (cfg.n8n_webhook_url) {
        const res = await fetch(cfg.n8n_webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "ping", source: "tms-recrutamento" }),
        });
        if (res.ok) {
          setTesteResult("✅ N8N respondeu com sucesso! Webhook ativo.");
        } else {
          setTesteResult(`⚠️ N8N retornou status ${res.status}. Verifique o workflow.`);
        }
      } else {
        setTesteResult("⚠️ URL do N8N não configurada. Configure o webhook N8N para usar como ponte segura.");
      }
    } catch {
      setTesteResult("❌ Falha na conexão. Verifique a URL e se o N8N está rodando.");
    } finally {
      setTestando(false);
    }
  };

  const handleGerarQR = () => {
    setCfg(c => ({ ...c, status: "aguardando_qr" }));
    setTesteResult("📱 QR Code será gerado via N8N/Evolution API quando conectado. Configure o webhook e clique em Testar Conexão primeiro.");
  };

  const handleDesconectar = () => {
    const novaCfg = { ...cfg, status: "desconectado" as StatusConexao, qr_code: "" };
    setCfg(novaCfg);
    salvarConfigWhatsApp(novaCfg); // Persiste a desconexão
    setTesteResult(null);
  };

  const statusInfo: Record<StatusConexao, { label: string; color: string; icon: JSX.Element }> = {
    desconectado: {
      label: "Desconectado",
      color: "bg-red-100 text-red-700 border-red-200",
      icon: <WifiOff className="w-4 h-4" />,
    },
    aguardando_qr: {
      label: "Aguardando QR Code",
      color: "bg-yellow-100 text-yellow-700 border-yellow-200",
      icon: <QrCode className="w-4 h-4" />,
    },
    conectado: {
      label: "Conectado",
      color: "bg-green-100 text-green-700 border-green-200",
      icon: <Wifi className="w-4 h-4" />,
    },
  };

  const si = statusInfo[cfg.status];

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Aviso de segurança */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 space-y-1">
          <p className="font-semibold">⚠️ Use um número exclusivo operacional</p>
          <p>Evite usar número pessoal. O número conectado receberá todas as mensagens dos prestadores e ficará vinculado à IA.</p>
          <p className="text-xs text-amber-700 mt-1">🔒 <strong>Segurança:</strong> Tokens e chaves da Evolution API devem ficar no backend (N8N). O frontend usa apenas o webhook N8N como ponte segura.</p>
        </div>
      </div>

      {/* Aviso Supabase */}
      {supabaseOk === false && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-700">
          <Info className="w-4 h-4 shrink-0" />
          Configuração ainda não sincronizada com Supabase — usando fallback local. Execute o SQL <code className="bg-blue-100 px-1 rounded">sql/recrutamento_whatsapp_ia.sql</code> para ativar a persistência.
        </div>
      )}

      {/* Status da conexão */}
      <Card className="border shadow-sm">
        <CardHeader className="border-b bg-muted/20 py-3 px-5">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-green-600" />
              Status da Conexão WhatsApp
            </span>
            <span className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-semibold ${si.color}`}>
              {si.icon} {si.label}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {/* Número operacional */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold mb-1 block">📱 Número Operacional</Label>
              <p className="text-xs text-muted-foreground mb-1.5">Número WhatsApp conectado (com DDI, ex: 5511999990000)</p>
              <Input
                value={cfg.numero_operacional}
                onChange={e => setCfg(c => ({ ...c, numero_operacional: e.target.value }))}
                placeholder="5511999990000"
                className="font-mono"
              />
            </div>
            <div>
              <Label className="font-semibold mb-1 block">🏷️ Nome da Instância Evolution</Label>
              <p className="text-xs text-muted-foreground mb-1.5">Identificador da instância na Evolution API</p>
              <Input
                value={cfg.instance_name}
                onChange={e => setCfg(c => ({ ...c, instance_name: e.target.value }))}
                placeholder="recrutamento-conexao-express"
                className="font-mono"
              />
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="outline"
              className="gap-2 border-yellow-300 text-yellow-700 hover:bg-yellow-50"
              onClick={handleGerarQR}
              disabled={cfg.status === "conectado"}
            >
              <QrCode className="w-4 h-4" /> Gerar QR Code
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={handleTestarConexao}
              disabled={testando}
            >
              {testando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
              Testar Conexão
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
              onClick={handleDesconectar}
              disabled={cfg.status === "desconectado"}
            >
              <Unplug className="w-4 h-4" /> Desconectar
            </Button>
          </div>

          {/* Área do QR Code */}
          {cfg.status === "aguardando_qr" && (
            <div className="border-2 border-dashed border-yellow-300 rounded-xl p-8 flex flex-col items-center gap-3 bg-yellow-50/50">
              <QrCode className="w-12 h-12 text-yellow-500 opacity-60" />
              <p className="font-semibold text-yellow-700 text-sm">Aguardando QR Code</p>
              <p className="text-xs text-yellow-600 text-center max-w-sm">
                O QR Code será exibido aqui após o N8N/Evolution API processar a solicitação. Configure o webhook abaixo e clique em "Testar Conexão".
              </p>
            </div>
          )}

          {cfg.status === "conectado" && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <div>
                <p className="font-semibold text-green-700">WhatsApp Conectado!</p>
                <p className="text-xs text-green-600">Instância: <strong>{cfg.instance_name}</strong> | Número: <strong>{cfg.numero_operacional || "não informado"}</strong></p>
              </div>
            </div>
          )}

          {/* Resultado do teste */}
          {testeResult && (
            <div className="p-3 rounded-lg bg-muted border text-sm font-mono">
              {testeResult}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configurações de integração */}
      <Card className="border shadow-sm">
        <CardHeader className="border-b bg-muted/20 py-3 px-5">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            Configurações de Integração
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">

          {/* N8N Webhook */}
          <div>
            <Label className="font-semibold mb-1 block text-blue-700">🔗 N8N Webhook URL</Label>
            <p className="text-xs text-muted-foreground mb-1.5">
              URL do webhook N8N que recebe as mensagens do WhatsApp e as encaminha para o TMS.
              <strong className="text-blue-700"> Recomendado: use o N8N como ponte segura em vez de acessar a Evolution API diretamente.</strong>
            </p>
            <Input
              value={cfg.n8n_webhook_url}
              onChange={e => setCfg(c => ({ ...c, n8n_webhook_url: e.target.value }))}
              placeholder="https://seu-n8n.com/webhook/recrutamento-whatsapp"
              className="font-mono text-sm"
            />
          </div>

          {/* Evolution API URL */}
          <div>
            <Label className="font-semibold mb-1 block">⚡ Evolution API URL</Label>
            <p className="text-xs text-muted-foreground mb-1.5">
              URL base da Evolution API. <strong>Não insira tokens aqui</strong> — mantenha as chaves exclusivamente no N8N/backend.
            </p>
            <Input
              value={cfg.evolution_api_url}
              onChange={e => setCfg(c => ({ ...c, evolution_api_url: e.target.value }))}
              placeholder="https://sua-evolution-api.com"
              className="font-mono text-sm"
            />
          </div>

          {/* Diagrama de fluxo resumido */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Fluxo de Integração</p>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full border border-green-200 font-medium">📱 Prestador (WhatsApp)</span>
              <span className="text-muted-foreground">→</span>
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full border border-blue-200 font-medium">⚡ Evolution API</span>
              <span className="text-muted-foreground">→</span>
              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full border border-purple-200 font-medium">🔗 N8N Webhook</span>
              <span className="text-muted-foreground">→</span>
              <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full border border-orange-200 font-medium">🤖 TMS IA</span>
              <span className="text-muted-foreground">→</span>
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full border border-green-200 font-medium">💬 Resposta</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botão salvar */}
      <Button onClick={handleSalvar} disabled={salvando} className="w-full">
        {salvando
          ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          : salvo
          ? <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
          : <Save className="w-4 h-4 mr-2" />}
        {salvo ? "Configuração Salva!" : "Salvar Configuração"}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        🔒 Tokens e chaves de API devem ser configurados exclusivamente no N8N/backend. O TMS armazena apenas URLs e identificadores de instância.
      </p>
    </div>
  );
}

// ── COMPONENTE PRINCIPAL ─────────────────────────────────────

export function WhatsAppIAPrestadores() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaSelecionada, setConversaSelecionada] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [respostaManual, setRespostaManual] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [processandoIA, setProcessandoIA] = useState(false);
  const [showSimular, setShowSimular] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState("chat");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Carrega conversas
  useEffect(() => {
    carregarConversas();
  }, []);

  // Scroll automático
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  async function carregarConversas() {
    setCarregando(true);
    const data = await listarConversas();
    setConversas(data);
    setCarregando(false);
  }

  async function selecionarConversa(c: Conversa) {
    setConversaSelecionada(c);
    const msgs = await listarMensagens(c.id);
    setMensagens(msgs);
  }

async function handleSimular(tel: string, nome: string, msg: string) {
  setProcessandoIA(true);
  try {
    const payload = {
      telefone: tel,
      nome: nome || "Motorista Teste",
      mensagem: msg,
      origem: "simulador_tms"
    };
    
    fetch("http://localhost:5678/webhook/recrutamento-whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(response => {
        if (response.ok) {
          console.log("[Simular] ✅ Enviado para n8n webhook");
        } else {
          console.warn("[Simular] Erro ao enviar para n8n:", response.status);
        }
      })
      .catch(err => {
        console.warn("[Simular] Erro ao conectar com n8n:", err);
      });

    const resultado = await processarMensagemPrestador(tel, msg, nome);
    await carregarConversas();

    if (conversaSelecionada?.id === resultado.conversa.id || !conversaSelecionada) {
      setConversaSelecionada(resultado.conversa);
      const msgs = await listarMensagens(resultado.conversa.id);
      setMensagens(msgs);
    }
  } finally {
    setProcessandoIA(false);
  }
}

  async function handleAssumirConversa() {
    if (!conversaSelecionada) return;
    await assumirConversa(conversaSelecionada.id);
    setConversaSelecionada(prev => prev ? { ...prev, humano_assumiu: true, ia_ativa: false } : null);
    const msgs = await listarMensagens(conversaSelecionada.id);
    setMensagens(msgs);
    await carregarConversas();
  }

  async function handleVoltarIA() {
    if (!conversaSelecionada) return;
    await voltarParaIA(conversaSelecionada.id);
    setConversaSelecionada(prev => prev ? { ...prev, humano_assumiu: false, ia_ativa: true } : null);
    const msgs = await listarMensagens(conversaSelecionada.id);
    setMensagens(msgs);
    await carregarConversas();
  }

  async function handleEnviarHumano() {
    if (!conversaSelecionada || !respostaManual.trim()) return;
    await enviarRespostaHumano(conversaSelecionada.id, respostaManual.trim());
    setRespostaManual("");
    const msgs = await listarMensagens(conversaSelecionada.id);
    setMensagens(msgs);
    await carregarConversas();
  }

  const podeDigitar = conversaSelecionada?.humano_assumiu;

  return (
    <div className="flex flex-col gap-4 h-full">
      {showSimular && (
        <SimularDialog
          onSimular={handleSimular}
          onClose={() => setShowSimular(false)}
        />
      )}

      {/* Topo */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-600/10 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">WhatsApp IA Prestadores</h2>
            <p className="text-xs text-muted-foreground">Atendimento automatizado com IA controlada</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-700 border-green-200 gap-1.5 py-1">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            IA Ativa
          </Badge>
          <Button size="sm" variant="outline" onClick={carregarConversas} disabled={carregando}>
            <RefreshCw className={`w-4 h-4 mr-1 ${carregando ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white gap-2"
            onClick={() => setShowSimular(true)}
            disabled={processandoIA}
          >
            {processandoIA ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Simular Mensagem
          </Button>
        </div>
      </div>

      <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
        <TabsList className="bg-muted/40 border">
          <TabsTrigger value="chat" className="gap-2">
            <MessageSquare className="w-4 h-4" /> Chat
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="w-4 h-4" /> Instruções da IA
          </TabsTrigger>
          <TabsTrigger value="conexao" className="gap-2">
            <Wifi className="w-4 h-4" /> Conexão WhatsApp
          </TabsTrigger>
        </TabsList>

        {/* ABA CHAT */}
        <TabsContent value="chat" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4" style={{ minHeight: 580 }}>

            {/* ── LISTA DE CONVERSAS ── */}
            <Card className="flex flex-col overflow-hidden border-0 shadow-sm">
              <CardHeader className="py-3 px-4 border-b bg-muted/30 shrink-0">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Phone className="w-4 h-4 text-green-600" />
                  Conversas ({conversas.length})
                </CardTitle>
              </CardHeader>
              <div className="flex-1 overflow-y-auto divide-y">
                {conversas.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
                    <MessageSquare className="w-8 h-8 opacity-30" />
                    <p>Nenhuma conversa ainda</p>
                    <p className="text-xs">Use "Simular Mensagem" para começar</p>
                  </div>
                )}
                {conversas.map(c => (
                  <button
                    key={c.id}
                    onClick={() => selecionarConversa(c)}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex gap-3 items-start ${conversaSelecionada?.id === c.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm shrink-0 mt-0.5">
                      {(c.nome || c.telefone).substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-sm truncate">{c.nome || c.telefone}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(c.updated_at)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{c.ultima_mensagem || "..."}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${STATUS_COLOR[c.status]}`}>
                          {STATUS_LABEL[c.status]}
                        </span>
                        {c.humano_assumiu && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                            Humano
                          </span>
                        )}
                        {!c.humano_assumiu && c.ia_ativa && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                            IA
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-2" />
                  </button>
                ))}
              </div>
            </Card>

            {/* ── CHAT ── */}
            <Card className="flex flex-col overflow-hidden border-0 shadow-sm">
              {!conversaSelecionada ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <MessageSquare className="w-12 h-12 opacity-20" />
                  <p className="font-medium">Selecione uma conversa</p>
                  <p className="text-sm">ou simule uma nova mensagem</p>
                </div>
              ) : (
                <>
                  {/* Header do chat */}
                  <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm">
                        {(conversaSelecionada.nome || conversaSelecionada.telefone).substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{conversaSelecionada.nome || "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground">{conversaSelecionada.telefone}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[conversaSelecionada.status]}`}>
                        {STATUS_LABEL[conversaSelecionada.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Indicador */}
                      {conversaSelecionada.humano_assumiu ? (
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200 gap-1">
                          <UserCheck className="w-3 h-3" /> Humano Ativo
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
                          <Bot className="w-3 h-3" /> IA Ativa
                        </Badge>
                      )}
                      {!conversaSelecionada.humano_assumiu ? (
                        <Button size="sm" variant="outline" className="gap-1 text-blue-600 border-blue-200" onClick={handleAssumirConversa}>
                          <User className="w-3.5 h-3.5" /> Assumir
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="gap-1 text-green-600 border-green-200" onClick={handleVoltarIA}>
                          <Bot className="w-3.5 h-3.5" /> Voltar para IA
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Mensagens */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-muted/10 to-transparent">
                    {mensagens.map(m => {
                      const isBot = m.origem === "ia";
                      const isHumano = m.origem === "humano";
                      const isPrestador = m.origem === "prestador";
                      const isSistema = m.origem === "sistema";

                      if (isSistema) {
                        return (
                          <div key={m.id} className="flex justify-center">
                            <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground">
                              {m.mensagem}
                            </span>
                          </div>
                        );
                      }

                      const payload = m.payload as Record<string, unknown> | undefined;

                      return (
                        <div key={m.id} className={`flex ${isPrestador ? "justify-start" : "justify-end"}`}>
                          <div className={`max-w-[75%] ${isPrestador ? "order-2" : ""}`}>
                            {/* Origem label */}
                            <p className={`text-[10px] mb-1 ${isPrestador ? "text-left text-muted-foreground" : "text-right text-muted-foreground"}`}>
                              {isPrestador ? "Prestador" : isBot ? "IA" : "Humano"} • {formatTime(m.created_at)}
                            </p>
                            <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                              isPrestador
                                ? "bg-white border shadow-sm rounded-tl-sm text-foreground"
                                : isBot
                                ? "bg-green-600 text-white rounded-tr-sm shadow-md"
                                : "bg-blue-600 text-white rounded-tr-sm shadow-md"
                            }`}>
                              {m.mensagem}
                            </div>
                            {/* Payload info (bloqueios) */}
                            {isBot && payload?.bloqueios_aplicados && (payload.bloqueios_aplicados as string[]).length > 0 && (
                              <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-600">
                                <AlertTriangle className="w-3 h-3" />
                                {(payload.bloqueios_aplicados as string[]).length} bloqueio(s) aplicado(s)
                              </div>
                            )}
                            {isBot && payload?.fallback_usado && (
                              <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                                <Zap className="w-3 h-3" />
                                via {String(payload.fallback_usado).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input resposta */}
                  <div className="p-3 border-t bg-background shrink-0">
                    {!podeDigitar ? (
                      <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                        <Bot className="w-4 h-4 text-green-600" />
                        IA respondendo automaticamente — clique em "Assumir" para responder manualmente
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Textarea
                          value={respostaManual}
                          onChange={e => setRespostaManual(e.target.value)}
                          placeholder="Digite sua resposta manual..."
                          rows={2}
                          className="resize-none text-sm"
                          onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleEnviarHumano();
                            }
                          }}
                        />
                        <Button
                          onClick={handleEnviarHumano}
                          disabled={!respostaManual.trim()}
                          className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* ABA CONFIG */}
        <TabsContent value="config" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" /> Instruções da IA
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <ConfigIAPanel />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA CONEXÃO WHATSAPP */}
        <TabsContent value="conexao" className="mt-4">
          <ConexaoWhatsAppPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
