import { useState, useEffect } from "react";
import {
  Smartphone, Server, Bot, Zap, FileText, Loader2, CheckCircle2,
  XCircle, QrCode, Send, RefreshCw, Wifi, WifiOff, Copy, AlertTriangle,
  Play, Pause, ListTodo, Activity, Network, Clock, BrainCircuit, RefreshCcw, Headset, Check, RefreshCcwDot
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  testarConexaoEvolution,
  criarInstancia,
  conectarInstancia,
  configurarWebhook,
  statusInstancia,
  enviarMensagemTexto,
} from "@/services/evolutionApiService";
import { testarWebhook } from "@/services/n8nClient";
import { supabase } from "@/lib/supabase";
import { aiProviderManager, AIProviderConfig } from "@/services/ia/aiProviderManager";

// ── Tipos ──────────────────────────────────────────────────────────────────
interface LogEntry { ts: string; msg: string; ok: boolean }

function addLog(setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>, msg: string, ok: boolean) {
  const ts = new Date().toLocaleTimeString("pt-BR");
  setLogs(prev => [{ ts, msg, ok }, ...prev].slice(0, 80));
}

// ── Sub-componentes ────────────────────────────────────────────────────────
function LogBox({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0) return (
    <div className="text-xs text-muted-foreground text-center py-6 border rounded-lg bg-muted/10">
      Nenhum log ainda. Execute uma ação acima.
    </div>
  );
  return (
    <div className="border rounded-lg bg-slate-950 text-slate-100 p-3 space-y-1 max-h-64 overflow-y-auto font-mono text-[11px]">
      {logs.map((l, i) => (
        <div key={i} className="flex gap-2 items-start">
          <span className="text-slate-500 shrink-0">[{l.ts}]</span>
          <span className={l.ok ? "text-green-400" : "text-red-400"}>{l.ok ? "✓" : "✗"}</span>
          <span className="text-slate-200 break-all">{l.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ── Aba WhatsApp / Evolution API ───────────────────────────────────────────
function AbaWhatsApp({ allLogs, setAllLogs }: { allLogs: LogEntry[]; setAllLogs: React.Dispatch<React.SetStateAction<LogEntry[]>> }) {
  const [serverUrl, setServerUrl] = useState(
    import.meta.env.VITE_EVOLUTION_SERVER_URL || "http://127.0.0.1:8080"
  );
  const [apiKey, setApiKey] = useState("");
  const [instancia, setInstancia] = useState(
    import.meta.env.VITE_EVOLUTION_INSTANCE || "recrutamento-conexao-express"
  );
  const [webhookUrl, setWebhookUrl] = useState(
    import.meta.env.VITE_N8N_WEBHOOK_URL || "http://localhost:5678/webhook/recrutamento-whatsapp"
  );
  const [telTeste, setTelTeste] = useState("5511999999999");
  const [msgTeste, setMsgTeste] = useState("Teste TMS Conexão Express 🚚");
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const log = (msg: string, ok: boolean) => addLog(setAllLogs, msg, ok);

  async function run(label: string, fn: () => Promise<void>) {
    setLoading(label);
    try { await fn(); } finally { setLoading(null); }
  }

  const suggestedWebhook = `${serverUrl.replace(/\/$/, "")}/webhook/recrutamento-whatsapp`;

  return (
    <div className="space-y-6">
      {/* Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-green-600" /> Configuração Evolution API
          </CardTitle>
          <CardDescription>Evolution API rodando em Docker na porta 8080</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Server URL</Label>
              <Input value={serverUrl} onChange={e => setServerUrl(e.target.value)}
                placeholder="http://127.0.0.1:8080" />
            </div>
            <div className="space-y-1">
              <Label>API Key (Global)</Label>
              <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder="Chave global do Evolution API" />
            </div>
            <div className="space-y-1">
              <Label>Nome da Instância</Label>
              <Input value={instancia} onChange={e => setInstancia(e.target.value)}
                placeholder="recrutamento-conexao-express" />
            </div>
            <div className="space-y-1">
              <Label>Webhook URL</Label>
              <Input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
                placeholder={suggestedWebhook} />
              <p className="text-[10px] text-muted-foreground">
                Sugerido: <code className="bg-muted px-1 rounded">{suggestedWebhook}</code>
              </p>
            </div>
          </div>

          {/* Ações principais */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" disabled={loading === "testar"}
              onClick={() => run("testar", async () => {
                const r = await testarConexaoEvolution(serverUrl, apiKey);
                log(`Testar API: ${r.ok ? "Conectado!" : r.error}`, r.ok);
                toast[r.ok ? "success" : "error"](r.ok ? "Evolution API respondeu!" : r.error);
              })}>
              {loading === "testar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
              <span className="ml-1">Testar API</span>
            </Button>

            <Button variant="outline" size="sm" disabled={loading === "criar"}
              onClick={() => run("criar", async () => {
                const r = await criarInstancia(instancia, serverUrl, apiKey);
                log(`Criar Instância [${instancia}]: ${r.ok ? "Criada!" : r.error}`, r.ok);
                toast[r.ok ? "success" : "error"](r.ok ? "Instância criada!" : r.error);
              })}>
              {loading === "criar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              <span className="ml-1">Criar Instância</span>
            </Button>

            <Button variant="outline" size="sm" disabled={loading === "qr"}
              onClick={() => run("qr", async () => {
                const r = await conectarInstancia(instancia, serverUrl, apiKey);
                log(`Gerar QR [${instancia}]: ${r.ok ? "QR gerado" : r.error}`, r.ok);
                if (r.ok && r.data) {
                  const d = r.data as Record<string, unknown>;
                  const base64 =
                    (d?.qrcode as Record<string, unknown>)?.base64 as string ||
                    (d?.base64 as string) || null;
                  if (base64) setQrBase64(base64);
                  toast.success("QR Code gerado!");
                } else {
                  toast.error(r.error);
                }
              })}>
              {loading === "qr" ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
              <span className="ml-1">Gerar QR Code</span>
            </Button>

            <Button variant="outline" size="sm" disabled={loading === "status"}
              onClick={() => run("status", async () => {
                const r = await statusInstancia(instancia, serverUrl, apiKey);
                const state = (r.data as Record<string, string>)?.state || (r.data as Record<string, string>)?.connectionStatus || "?";
                log(`Status [${instancia}]: ${r.ok ? state : r.error}`, r.ok);
                toast[r.ok ? "success" : "error"](r.ok ? `Status: ${state}` : r.error);
              })}>
              {loading === "status" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-1">Ver Status</span>
            </Button>

            <Button variant="outline" size="sm" disabled={loading === "webhook"}
              onClick={() => run("webhook", async () => {
                const r = await configurarWebhook(instancia, serverUrl, apiKey, webhookUrl);
                log(`Webhook configurado: ${r.ok ? webhookUrl : r.error}`, r.ok);
                toast[r.ok ? "success" : "error"](r.ok ? "Webhook configurado!" : r.error);
              })}>
              {loading === "webhook" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
              <span className="ml-1">Configurar Webhook</span>
            </Button>
          </div>

          {/* QR Code display */}
          {qrBase64 && (
            <div className="flex flex-col items-center gap-2 p-4 border rounded-xl bg-white">
              <p className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                <QrCode className="w-4 h-4" /> Escaneie com o WhatsApp
              </p>
              <img
                src={qrBase64.startsWith("data:") ? qrBase64 : `data:image/png;base64,${qrBase64}`}
                alt="QR Code WhatsApp"
                className="w-48 h-48 border rounded"
              />
              <Button variant="ghost" size="sm" onClick={() => setQrBase64(null)}>Fechar</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enviar mensagem teste */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="w-4 h-4" /> Enviar Mensagem Teste
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Telefone (com DDI)</Label>
              <Input value={telTeste} onChange={e => setTelTeste(e.target.value)}
                placeholder="5511999999999" />
            </div>
            <div className="space-y-1">
              <Label>Mensagem</Label>
              <Input value={msgTeste} onChange={e => setMsgTeste(e.target.value)} />
            </div>
          </div>
          <Button size="sm" disabled={loading === "enviar"}
            onClick={() => run("enviar", async () => {
              const r = await enviarMensagemTexto(instancia, serverUrl, apiKey, telTeste, msgTeste);
              log(`Mensagem enviada para ${telTeste}: ${r.ok ? "OK" : r.error}`, r.ok);
              toast[r.ok ? "success" : "error"](r.ok ? "Mensagem enviada!" : r.error);
            })}>
            {loading === "enviar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
            Enviar Mensagem Teste
          </Button>
        </CardContent>
      </Card>

      <LogBox logs={allLogs.filter((_, i) => i < 20)} />
    </div>
  );
}

// ── Aba n8n ────────────────────────────────────────────────────────────────
function AbaNCN({ allLogs, setAllLogs }: { allLogs: LogEntry[]; setAllLogs: React.Dispatch<React.SetStateAction<LogEntry[]>> }) {
  const [n8nUrl, setN8nUrl] = useState(import.meta.env.VITE_N8N_WEBHOOK_URL || "http://localhost:5678/webhook/recrutamento-whatsapp");
  const [loading, setLoading] = useState(false);
  const log = (msg: string, ok: boolean) => addLog(setAllLogs, msg, ok);

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-4 flex gap-2 text-sm text-amber-800">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <strong>n8n é opcional neste momento.</strong> O TMS funciona sem ele. O n8n serve como
            middleware para receber webhooks do Evolution e inserir no Supabase.
            Consulte <code className="bg-amber-100 px-1 rounded">docs/WEBHOOK_WHATSAPP_N8N_TMS.md</code> para detalhes.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="w-5 h-5 text-purple-600" /> Configuração n8n
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>URL do Webhook Recrutamento</Label>
            <Input value={n8nUrl} onChange={e => setN8nUrl(e.target.value)}
              placeholder="http://localhost:5678/webhook/recrutamento-whatsapp" />
          </div>

          <Button variant="outline" size="sm" disabled={loading}
            onClick={async () => {
              setLoading(true);
              const r = await testarWebhook(n8nUrl);
              log(`n8n webhook [${n8nUrl}]: ${r.ok ? "Respondeu!" : r.error}`, r.ok);
              toast[r.ok ? "success" : "error"](r.ok ? "n8n respondeu!" : `n8n não respondeu: ${r.error}`);
              setLoading(false);
            }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
            Testar Webhook n8n
          </Button>

          <div className="space-y-2 pt-2 border-t text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Fluxo esperado no n8n:</p>
            <ol className="list-decimal pl-5 space-y-1 text-xs">
              <li>Evolution API dispara POST para o webhook n8n</li>
              <li>n8n trata o payload e faz upsert em <code className="bg-muted px-1 rounded">whatsapp_conversas</code></li>
              <li>n8n insere em <code className="bg-muted px-1 rounded">whatsapp_mensagens</code></li>
              <li>n8n responde HTTP 200 para o Evolution</li>
              <li>TMS lê as mensagens direto do Supabase</li>
            </ol>
            <Button variant="link" size="sm" className="p-0 h-auto text-xs"
              onClick={() => {
                navigator.clipboard.writeText(n8nUrl);
                toast.success("URL copiada!");
              }}>
              <Copy className="w-3 h-3 mr-1" /> Copiar URL do webhook
            </Button>
          </div>
        </CardContent>
      </Card>

      <LogBox logs={allLogs.filter((_, i) => i < 20)} />
    </div>
  );
}

// ── Aba Provedores de IA ────────────────────────────────────────────────────────
function AbaProvedoresIA({ allLogs, setAllLogs }: { allLogs: LogEntry[]; setAllLogs: React.Dispatch<React.SetStateAction<LogEntry[]>> }) {
  const [providers, setProviders] = useState<AIProviderConfig[]>([]);
  const [loadingTest, setLoadingTest] = useState<string | null>(null);
  const log = (msg: string, ok: boolean) => addLog(setAllLogs, msg, ok);

  const carregarProviders = async () => {
    const data = await aiProviderManager.listarProviders();
    setProviders(data);
  };

  useEffect(() => {
    carregarProviders();
  }, []);

  const handleTestar = async (p: AIProviderConfig) => {
    setLoadingTest(p.id);
    const res = await aiProviderManager.testarProvider(p);
    log(`Teste ${p.provider}: ${res.success ? "OK" : res.message}`, res.success);
    toast[res.success ? "success" : "error"](res.message);
    setLoadingTest(null);
  };

  const handleToggleAtivo = async (p: AIProviderConfig) => {
    await aiProviderManager.atualizarProvider(p.id, { ativo: !p.ativo });
    toast.success(`Provider ${p.provider} ${!p.ativo ? 'ativado' : 'desativado'}`);
    carregarProviders();
  };

  const handleSetDefault = async (p: AIProviderConfig) => {
    // Definir prioridade 1 e is_default true. O ideal seria fazer uma transaction ou RPC.
    // Aqui fazemos simplificado para a UI
    for (const prov of providers) {
      if (prov.id === p.id) {
        await aiProviderManager.atualizarProvider(prov.id, { is_default: true, prioridade: 1 });
      } else if (prov.is_default) {
        await aiProviderManager.atualizarProvider(prov.id, { is_default: false, prioridade: prov.prioridade + 1 });
      }
    }
    toast.success(`${p.provider} definido como principal!`);
    carregarProviders();
  };

  const keys = aiProviderManager.getKeys();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="w-5 h-5 text-violet-600" /> Provedores de Inteligência Artificial
          </CardTitle>
          <CardDescription>Gerencie os modelos e provedores que alimentam as respostas da Central Inteligente.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Modelo</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Chave Configurada</th>
                  <th className="p-3">Prioridade</th>
                  <th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {providers.map(p => {
                  const hasKey = !!keys[p.provider as keyof typeof keys];
                  return (
                    <tr key={p.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 font-semibold uppercase flex items-center gap-2">
                        {p.is_default && <span className="text-[10px] bg-amber-100 text-amber-800 px-1 rounded font-bold">DEFAULT</span>}
                        {p.provider}
                      </td>
                      <td className="p-3 font-mono text-xs">{p.model}</td>
                      <td className="p-3">
                        <Badge variant={p.ativo ? "default" : "secondary"} className="cursor-pointer" onClick={() => handleToggleAtivo(p)}>
                          {p.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {hasKey ? <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Sim</Badge> : <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">Não</Badge>}
                      </td>
                      <td className="p-3">{p.prioridade}</td>
                      <td className="p-3 flex gap-2">
                        <Button size="sm" variant="outline" disabled={loadingTest === p.id} onClick={() => handleTestar(p)}>
                          {loadingTest === p.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin"/> : <Wifi className="w-3 h-3 mr-1"/>} Testar
                        </Button>
                        {!p.is_default && (
                          <Button size="sm" variant="ghost" onClick={() => handleSetDefault(p)}>
                            Tornar Principal
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
            <strong>Como configurar as chaves?</strong><br/>
            As chaves de API não são expostas na interface por segurança. Adicione-as ao seu arquivo <code>.env</code> local:<br/>
            <code>VITE_GROQ_API_KEY=sua_chave</code><br/>
            <code>VITE_GEMINI_API_KEY=sua_chave</code><br/>
            <code>VITE_OPENROUTER_API_KEY=sua_chave</code><br/>
            <code>VITE_OPENAI_API_KEY=sua_chave</code>
          </div>
        </CardContent>
      </Card>
      <LogBox logs={allLogs.filter((_, i) => i < 20)} />
    </div>
  );
}

// ── Novas Abas: Automações, Filas, IA, Webhooks ────────────────────────────
function AbaStatusGeral() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-green-700"><CheckCircle2 className="w-4 h-4" /> WhatsApp / Evolution</CardTitle>
        </CardHeader>
        <CardContent><p className="text-2xl font-bold">Online</p><p className="text-xs text-muted-foreground">Instância conectada</p></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-purple-700"><Activity className="w-4 h-4" /> n8n Middleware</CardTitle>
        </CardHeader>
        <CardContent><p className="text-2xl font-bold">Online</p><p className="text-xs text-muted-foreground">Webhook ativo</p></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-orange-700"><BrainCircuit className="w-4 h-4" /> IA (Groq/Gemini)</CardTitle>
        </CardHeader>
        <CardContent><p className="text-2xl font-bold">Pronto</p><p className="text-xs text-muted-foreground">Modelos Llama3/Gemini</p></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-blue-700"><Network className="w-4 h-4" /> Automações</CardTitle>
        </CardHeader>
        <CardContent><p className="text-2xl font-bold">4 Ativas</p><p className="text-xs text-muted-foreground">Motor operando</p></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-700"><ListTodo className="w-4 h-4" /> Fila Pendente</CardTitle>
        </CardHeader>
        <CardContent><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Mensagens aguardando</p></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-indigo-700"><Send className="w-4 h-4" /> Mensagens Hoje</CardTitle>
        </CardHeader>
        <CardContent><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Enviadas / Recebidas</p></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-red-700"><AlertTriangle className="w-4 h-4" /> Erros Hoje</CardTitle>
        </CardHeader>
        <CardContent><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Falhas em integrações</p></CardContent>
      </Card>
    </div>
  );
}

function AbaAutomacoes() {
  const [regras, setRegras] = useState<any[]>([]);

  useEffect(() => {
    carregarRegras();
    
    // Realtime
    const sub = supabase.channel('realtime_regras')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'automacoes_regras' }, () => {
        carregarRegras();
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  const carregarRegras = async () => {
    const { data } = await supabase.from('automacoes_regras').select('*').order('prioridade', { ascending: true });
    if (data) setRegras(data);
  };

  const handleToggle = async (id: string, atual: boolean) => {
    await supabase.from('automacoes_regras').update({ ativa: !atual }).eq('id', id);
    toast.success(!atual ? "Automação Ativada" : "Automação Desativada");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="w-5 h-5 text-blue-600"/> Regras de Automação
        </CardTitle>
        <CardDescription>Gerencie as regras do motor inteligente (Realtime)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-3">Nome / Módulo</th>
                <th className="p-3">Gatilho (Trigger)</th>
                <th className="p-3">Canal</th>
                <th className="p-3">Status</th>
                <th className="p-3">Execuções</th>
                <th className="p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {regras.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhuma regra cadastrada.</td></tr>}
              {regras.map(r => (
                <tr key={r.id} className="border-b hover:bg-slate-50">
                  <td className="p-3">
                    <p className="font-semibold">{r.nome}</p>
                    <p className="text-xs text-slate-500 uppercase">{r.modulo}</p>
                  </td>
                  <td className="p-3"><Badge variant="outline">{r.evento_trigger}</Badge></td>
                  <td className="p-3 uppercase text-xs">{r.canal}</td>
                  <td className="p-3">
                    <Badge variant={r.ativa ? "default" : "secondary"} className="cursor-pointer" onClick={() => handleToggle(r.id, r.ativa)}>
                      {r.ativa ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <p className="text-xs">Tot: <b>{r.total_execucoes}</b></p>
                    <p className="text-[10px] text-red-500">Erros: {r.total_erros}</p>
                  </td>
                  <td className="p-3 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => toast.info("Disparando teste manually...")}><Play className="w-3 h-3 mr-1" /> Testar</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function AbaFilas() {
  const [fila, setFila] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const carregarFila = async () => {
    setLoading(true);
    const { data } = await supabase.from('automacoes_fila')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setFila(data);
    setLoading(false);
  };

  useEffect(() => {
    carregarFila();
    
    // Realtime Fila
    const sub = supabase.channel('realtime_fila')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'automacoes_fila' }, () => {
        carregarFila();
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  const totalProcessando = fila.filter(f => f.status === 'processando').length;
  const totalErros = fila.filter(f => f.status === 'erro').length;
  const totalPendente = fila.filter(f => f.status === 'pendente').length;

  return (
    <div className="space-y-4">
      <div className="flex gap-4 mb-2">
        <Badge variant="outline" className="bg-slate-50">Pendentes: {totalPendente}</Badge>
        <Badge variant="outline" className="bg-blue-50 text-blue-700">Processando: {totalProcessando}</Badge>
        <Badge variant="outline" className="bg-red-50 text-red-700">Erros: {totalErros}</Badge>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><ListTodo className="w-5 h-5 text-amber-600"/> Fila de Processamento (Assíncrona)</CardTitle>
            <CardDescription>Mensagens aguardando Worker (n8n ou Cron)</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={carregarFila} disabled={loading}><RefreshCcw className={`w-4 h-4 ${loading?'animate-spin':''}`}/></Button>
        </CardHeader>
        <CardContent>
          {fila.length === 0 ? (
            <div className="text-center py-8 text-slate-500 border rounded-lg bg-slate-50">
              <ListTodo className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p>A fila está vazia no momento.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-3">Destino / Tipo</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Prioridade</th>
                    <th className="p-3">Tentativas</th>
                    <th className="p-3">Agendado Para</th>
                  </tr>
                </thead>
                <tbody>
                  {fila.map(f => (
                    <tr key={f.id} className="border-b hover:bg-slate-50">
                      <td className="p-3">
                        <p className="font-semibold">{f.destino || 'N/A'}</p>
                        <p className="text-xs text-slate-500 uppercase">{f.tipo}</p>
                      </td>
                      <td className="p-3">
                        <Badge variant={f.status === 'concluido' ? 'default' : f.status === 'erro' ? 'destructive' : 'secondary'}>
                          {f.status}
                        </Badge>
                        {f.ultimo_erro && <p className="text-[10px] text-red-500 mt-1 truncate max-w-[150px]">{f.ultimo_erro}</p>}
                      </td>
                      <td className="p-3 uppercase text-xs">{f.prioridade}</td>
                      <td className="p-3">{f.tentativas} / {f.max_tentativas}</td>
                      <td className="p-3 text-xs text-slate-500">{new Date(f.executar_em).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AbaIaOperacional({ allLogs, setAllLogs }: { allLogs: LogEntry[]; setAllLogs: React.Dispatch<React.SetStateAction<LogEntry[]>> }) {
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const log = (msg: string, ok: boolean) => addLog(setAllLogs, msg, ok);

  const simular = async () => {
    if (!mensagem.trim()) return;
    setLoading(true);
    setResultado(null);
    log(`Simulando mensagem: "${mensagem}"`, true);
    
    // Classifica
    const classificacao = await aiProviderManager.classificarMensagem(mensagem);
    // Sugere resposta
    const sugestao = await aiProviderManager.sugerirResposta(mensagem);
    
    setResultado({ classificacao, sugestao });
    log(`Classificado como: ${classificacao.intencao} (${classificacao.confianca}%) - Precisa Humano: ${classificacao.precisa_humano}`, true);
    setLoading(false);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Simulador de Intenção (IA)</CardTitle>
          <CardDescription>Teste como a IA classifica as mensagens dos clientes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Mensagem do Cliente / Motorista</Label>
            <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Ex: A carga tombou na rodovia e tem vazamento!" />
            <Button size="sm" onClick={simular} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <BrainCircuit className="w-4 h-4 mr-2"/>}
              Classificar e Sugerir
            </Button>
          </div>
          
          {resultado && (
            <div className={`p-4 border rounded-lg space-y-3 ${resultado.classificacao?.precisa_humano ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
              <p className="text-sm font-semibold text-slate-700">Resultado do Processamento:</p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="bg-blue-50">Intenção: {resultado.classificacao?.intencao}</Badge>
                <Badge variant="outline" className="bg-green-50">Confiança: {resultado.classificacao?.confianca}%</Badge>
                {resultado.classificacao?.precisa_humano && (
                  <Badge variant="destructive">⚠️ ESCALONAR PARA HUMANO</Badge>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-2"><strong>Sugestão da IA:</strong><br/>{resultado.sugestao}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logs Recentes de IA</CardTitle>
          <CardDescription>Histórico de classificações simuladas nesta sessão</CardDescription>
        </CardHeader>
        <CardContent>
          <LogBox logs={allLogs.filter((_, i) => i < 20)} />
        </CardContent>
      </Card>
    </div>
  );
}

function AbaEscalaOperacional() {
  const [escalas, setEscalas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const carregarEscalas = async () => {
    setLoading(true);
    const { data } = await supabase.from('escala_operacional')
      .select('*')
      .order('data_operacao', { ascending: true });
    if (data) setEscalas(data);
    setLoading(false);
  };

  useEffect(() => {
    carregarEscalas();
    const sub = supabase.channel('realtime_escala')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escala_operacional' }, () => {
        carregarEscalas();
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  // KPI calculations
  const hoje = new Date().toISOString().split('T')[0];
  const totalHoje = escalas.filter(e => e.data_operacao === hoje).length;
  const totalAtrasadas = escalas.filter(e => e.status === 'atrasado').length;
  const totalEmRota = escalas.filter(e => e.status === 'em_rota').length;
  const totalFinalizadas = escalas.filter(e => e.status === 'finalizado').length;
  const totalConflitos = escalas.filter(e => e.status === 'conflito').length;

  const excluirEscala = async (id: string) => {
    await supabase.from('escala_operacional').delete().eq('id', id);
    toast.success('Escala removida');
  };

  const copiarInfo = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success('Informação copiada');
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-slate-700">{totalHoje}</span>
            <span className="text-xs text-slate-500 uppercase font-semibold">Operações Hoje</span>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-yellow-700">{totalAtrasadas}</span>
            <span className="text-xs text-yellow-600 uppercase font-semibold">Atrasadas</span>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-blue-700">{totalEmRota}</span>
            <span className="text-xs text-blue-600 uppercase font-semibold">Em Rota</span>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-green-700">{totalFinalizadas}</span>
            <span className="text-xs text-green-600 uppercase font-semibold">Finalizadas</span>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-red-700">{totalConflitos}</span>
            <span className="text-xs text-red-600 uppercase font-semibold">Conflitos IA</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5 text-indigo-600"/> Escala Operacional</CardTitle>
            <CardDescription>Operações de campo, motoristas e veículos</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={carregarEscalas} disabled={loading}>
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {escalas.length === 0 ? (
            <div className="text-center py-10 text-slate-500 border rounded-lg bg-slate-50">
              <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p>Nenhuma escala cadastrada.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-3">Data</th>
                    <th className="p-3">Motorista</th>
                    <th className="p-3">Veículo (Placa)</th>
                    <th className="p-3">Status / Prioridade</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {escalas.map(e => (
                    <tr key={e.id} className="border-b hover:bg-slate-50">
                      <td className="p-3">{new Date(e.data_operacao).toLocaleDateString()}</td>
                      <td className="p-3">{e.motorista_nome}</td>
                      <td className="p-3">{e.placa}</td>
                      <td className="p-3">
                        <Badge variant={e.status === 'finalizado' ? 'default' : e.status === 'em_rota' ? 'secondary' : e.status === 'atrasado' ? 'destructive' : 'outline'}>
                          {e.status}
                        </Badge>
                        <p className="text-[10px] mt-1 uppercase text-slate-400">{e.prioridade}</p>
                      </td>
                      <td className="p-3 flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => copiarInfo(`${e.motorista_nome} - ${e.placa}`)} title="Copiar Info">
                          <Copy className="w-4 h-4 text-slate-500" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => excluirEscala(e.id)}>
                          <Trash2 className="w-4 h-4 mr-1"/> Remover
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AbaTorreControle() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const carregarTickets = async () => {
    setLoading(true);
    const { data } = await supabase.from('escalonamentos_humanos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setTickets(data);
    setLoading(false);
  };

  useEffect(() => {
    carregarTickets();
    const sub = supabase.channel('realtime_torre')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escalonamentos_humanos' }, () => {
        carregarTickets();
      }).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const totalAbertos = tickets.filter(t => t.status === 'aberto').length;
  const totalCriticos = tickets.filter(t => t.status === 'aberto' && t.prioridade === 'critica').length;
  const totalAtendimento = tickets.filter(t => t.status === 'em_atendimento').length;
  const totalResolvidos = tickets.filter(t => t.status === 'resolvido').length;

  const alterarStatus = async (id: string, novoStatus: string, operador?: string) => {
    const payload: any = { status: novoStatus, updated_at: new Date() };
    if (novoStatus === 'em_atendimento') { payload.assumido_em = new Date(); payload.operador_responsavel = operador || 'Operador Atual'; }
    if (novoStatus === 'resolvido') { payload.resolvido_em = new Date(); }
    
    await supabase.from('escalonamentos_humanos').update(payload).eq('id', id);
    toast.success(`Ticket alterado para: ${novoStatus}`);
  };

  const copiarTexto = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success("Mensagem copiada para transferência.");
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-slate-700">{totalAbertos}</span>
            <span className="text-xs text-slate-500 uppercase font-semibold">Abertos</span>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-red-700">{totalCriticos}</span>
            <span className="text-xs text-red-600 uppercase font-semibold">Críticos (IA)</span>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-blue-700">{totalAtendimento}</span>
            <span className="text-xs text-blue-600 uppercase font-semibold">Em Atendimento</span>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-green-700">{totalResolvidos}</span>
            <span className="text-xs text-green-600 uppercase font-semibold">Resolvidos Hoje</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Headset className="w-5 h-5 text-indigo-600"/> Triage e Escalonamento</CardTitle>
            <CardDescription>Tratativa humana para eventos bloqueados ou classificados como críticos pela IA</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={carregarTickets} disabled={loading}><RefreshCcw className={`w-4 h-4 ${loading?'animate-spin':''}`}/></Button>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="text-center py-10 text-slate-500 border rounded-lg bg-slate-50">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-300 mb-3" />
              <p>Nenhum evento aguardando escalonamento humano no momento.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-3">Status / Prioridade</th>
                    <th className="p-3">Título / Origem</th>
                    <th className="p-3 max-w-xs">Mensagem (IA)</th>
                    <th className="p-3">Operador</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(t => (
                    <tr key={t.id} className={`border-b hover:bg-slate-50 ${t.status==='aberto' && t.prioridade==='critica' ? 'bg-red-50/30' : ''}`}>
                      <td className="p-3">
                        <Badge variant={t.status === 'resolvido' ? 'default' : t.status === 'em_atendimento' ? 'secondary' : 'outline'} 
                               className={t.status === 'aberto' ? 'bg-yellow-50 text-yellow-700' : ''}>
                          {t.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <p className="text-[10px] mt-1 font-bold uppercase text-slate-400">{t.prioridade}</p>
                      </td>
                      <td className="p-3">
                        <p className="font-semibold">{t.titulo}</p>
                        <p className="text-xs text-slate-500 uppercase">{t.modulo} - {new Date(t.created_at).toLocaleString('pt-BR')}</p>
                      </td>
                      <td className="p-3 max-w-xs truncate" title={t.mensagem_original}>
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-600 truncate">{t.mensagem_original || 'N/A'}</span>
                          {t.intencao && <Badge variant="outline" className="w-fit text-[10px]">{t.intencao} ({t.confianca}%)</Badge>}
                        </div>
                      </td>
                      <td className="p-3">
                        {t.operador_responsavel ? (
                          <div className="text-xs">
                            <p className="font-semibold text-slate-700">{t.operador_responsavel}</p>
                            <p className="text-slate-500">{new Date(t.assumido_em).toLocaleTimeString()}</p>
                          </div>
                        ) : <span className="text-xs text-slate-400">Não atribuído</span>}
                      </td>
                      <td className="p-3 flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => copiarTexto(t.mensagem_original)} title="Copiar Mensagem">
                          <Copy className="w-4 h-4 text-slate-500"/>
                        </Button>
                        {t.status === 'aberto' && (
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => alterarStatus(t.id, 'em_atendimento', 'João (Logística)')}>
                            <Headset className="w-4 h-4 mr-2"/> Assumir
                          </Button>
                        )}
                        {t.status === 'em_atendimento' && (
                          <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => alterarStatus(t.id, 'resolvido')}>
                            <Check className="w-4 h-4 mr-2"/> Resolver
                          </Button>
                        )}
                        {t.status === 'resolvido' && (
                          <Button size="sm" variant="outline" onClick={() => alterarStatus(t.id, 'aberto')}>
                            Reabrir
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AbaWebhooks() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhooks Recebidos</CardTitle>
        <CardDescription>Histórico de eventos externos (Evolution, N8N, Tracking)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-slate-500 border rounded-lg bg-slate-50">
          <Network className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p>Nenhum webhook recebido recentemente.</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────────────────────
export default function IntegracoesTMS() {
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BrainCircuit className="w-7 h-7 text-indigo-600" />
            Central Inteligente de Automações
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Motor de regras, filas, inteligência artificial e conectividade TMS.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            Evolution: Ativo
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            IA Groq: Ativa
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="status_geral" className="w-full">
        <TabsList className="mb-4 flex-wrap justify-start border-b w-full rounded-none bg-transparent h-auto p-0 space-x-1">
          <TabsTrigger value="status_geral" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none border-b-2 border-transparent px-4 py-2">
            Status Geral
          </TabsTrigger>
          <TabsTrigger value="automacoes" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none border-b-2 border-transparent px-4 py-2">
            Regras de Automação
          </TabsTrigger>
          <TabsTrigger value="filas" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none border-b-2 border-transparent px-4 py-2">
            Fila de Eventos
          </TabsTrigger>
          <TabsTrigger value="ia_operacional" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none border-b-2 border-transparent px-4 py-2">
            IA Operacional
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none border-b-2 border-transparent px-4 py-2">
            Webhooks Inbound
          </TabsTrigger>
          <TabsTrigger value="torre_operacional" className="data-[state=active]:border-b-2 data-[state=active]:border-rose-600 rounded-none border-b-2 border-transparent px-4 py-2 text-rose-600 font-semibold">
            Torre Operacional
          </TabsTrigger>
          <div className="w-px h-6 bg-slate-200 mx-2 self-center" />
          <TabsTrigger value="whatsapp" className="data-[state=active]:border-b-2 data-[state=active]:border-green-600 rounded-none border-b-2 border-transparent px-4 py-2 text-slate-500">
            Evolution API
          </TabsTrigger>
          <TabsTrigger value="n8n" className="data-[state=active]:border-b-2 data-[state=active]:border-purple-600 rounded-none border-b-2 border-transparent px-4 py-2 text-slate-500">
            n8n
          </TabsTrigger>
          <TabsTrigger value="provedores_ia" className="data-[state=active]:border-b-2 data-[state=active]:border-orange-600 rounded-none border-b-2 border-transparent px-4 py-2 text-slate-500">
            Provedores de IA
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:border-b-2 data-[state=active]:border-slate-600 rounded-none border-b-2 border-transparent px-4 py-2 text-slate-500">
            Logs API
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="status_geral">
            <AbaStatusGeral />
          </TabsContent>

          <TabsContent value="automacoes">
            <AbaAutomacoes />
          </TabsContent>

          <TabsContent value="filas">
            <AbaFilas />
          </TabsContent>

          <TabsContent value="ia_operacional">
            <AbaIaOperacional allLogs={allLogs} setAllLogs={setAllLogs} />
          </TabsContent>

          <TabsContent value="webhooks">
            <AbaWebhooks />
          </TabsContent>

          <TabsContent value="torre_operacional">
            <AbaTorreControle />
          </TabsContent>

          {/* Configurações legadas */}
          <TabsContent value="whatsapp">
            <AbaWhatsApp allLogs={allLogs} setAllLogs={setAllLogs} />
          </TabsContent>

          <TabsContent value="n8n">
            <AbaNCN allLogs={allLogs} setAllLogs={setAllLogs} />
          </TabsContent>

          <TabsContent value="provedores_ia">
            <AbaProvedoresIA allLogs={allLogs} setAllLogs={setAllLogs} />
          </TabsContent>

          <TabsContent value="escala_operacional">
            <AbaEscalaOperacional />
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="w-5 h-5" /> Log Geral de Todas as Integrações
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setAllLogs([])}>
                    Limpar
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LogBox logs={allLogs} />
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
