import { useState } from "react";
import {
  Smartphone, Server, Bot, Zap, FileText, Loader2, CheckCircle2,
  XCircle, QrCode, Send, RefreshCw, Wifi, WifiOff, Copy, AlertTriangle
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
import { testarGroq, testarGemini, gerarRespostaIA } from "@/services/integracoes/iaService";
import { testarWebhook } from "@/services/n8nClient";

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

// ── Aba IA Genérica ────────────────────────────────────────────────────────
function AbaIA({
  provider,
  label,
  allLogs,
  setAllLogs,
}: {
  provider: "groq" | "gemini";
  label: string;
  allLogs: LogEntry[];
  setAllLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;
}) {
  const envKey = provider === "groq" ? "VITE_GROQ_API_KEY" : "VITE_GEMINI_API_KEY";
  const [apiKey, setApiKey] = useState(import.meta.env[envKey] || "");
  const [promptTeste, setPromptTeste] = useState("Qual é a capital do Brasil?");
  const [resposta, setResposta] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const log = (msg: string, ok: boolean) => addLog(setAllLogs, msg, ok);

  const testFn = provider === "groq" ? testarGroq : testarGemini;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="w-5 h-5 text-violet-600" /> {label}
            <Badge variant="secondary">{provider === "groq" ? "Principal" : "Alternativa"}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>API Key</Label>
            <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder={`Chave ${label}`} />
            <p className="text-[10px] text-muted-foreground">
              Armazenada apenas localmente. Não enviada ao Supabase.
            </p>
          </div>

          <div className="space-y-1">
            <Label>Prompt de Teste</Label>
            <Textarea value={promptTeste} onChange={e => setPromptTeste(e.target.value)}
              rows={2} className="resize-none text-sm" />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" disabled={loading === "testar"}
              onClick={async () => {
                setLoading("testar");
                const r = await testFn(apiKey);
                log(`Testar ${label}: ${r.ok ? `OK (${r.latencyMs}ms)` : r.error}`, r.ok);
                toast[r.ok ? "success" : "error"](r.ok ? `${label} conectado (${r.latencyMs}ms)!` : r.error);
                setLoading(null);
              }}>
              {loading === "testar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Testar Conexão
            </Button>

            <Button size="sm" disabled={loading === "gerar"}
              onClick={async () => {
                setLoading("gerar");
                setResposta("");
                const r = await gerarRespostaIA({ provider, apiKey, prompt: promptTeste });
                log(`Gerar resposta ${label}: ${r.ok ? "OK" : r.error}`, r.ok);
                if (r.ok) setResposta(r.data || "");
                else toast.error(r.error);
                setLoading(null);
              }}>
              {loading === "gerar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4 mr-1" />}
              Gerar Resposta
            </Button>
          </div>

          {resposta && (
            <div className="p-3 border rounded-lg bg-violet-50 text-sm text-violet-900">
              <p className="text-xs font-semibold text-violet-600 mb-1">Resposta {label}:</p>
              <p className="whitespace-pre-wrap">{resposta}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <LogBox logs={allLogs.filter((_, i) => i < 20)} />
    </div>
  );
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────────────────────
export default function IntegracoesTMS() {
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="w-7 h-7 text-orange-500" />
            Integrações TMS
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configuração e teste de WhatsApp, n8n, IA e demais integrações.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            Evolution: porta 8080
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
            n8n: porta 5678
          </div>
        </div>
      </div>

      {/* Status rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Evolution API", cor: "bg-green-100 border-green-300 text-green-800", icon: <Smartphone className="w-4 h-4" />, hint: "porta 8080" },
          { label: "n8n Opcional", cor: "bg-purple-100 border-purple-300 text-purple-800", icon: <Server className="w-4 h-4" />, hint: "porta 5678" },
          { label: "Groq IA", cor: "bg-orange-100 border-orange-300 text-orange-800", icon: <Bot className="w-4 h-4" />, hint: "llama3-8b" },
          { label: "Gemini IA", cor: "bg-blue-100 border-blue-300 text-blue-800", icon: <Bot className="w-4 h-4" />, hint: "gemini-pro" },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-2 p-3 rounded-lg border ${s.cor} text-sm`}>
            {s.icon}
            <div>
              <div className="font-semibold leading-none">{s.label}</div>
              <div className="text-[10px] opacity-70 mt-0.5">{s.hint}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="whatsapp" className="w-full">
        <TabsList className="mb-4 flex-wrap justify-start">
          <TabsTrigger value="whatsapp" className="gap-2">
            <Smartphone className="w-4 h-4" /> WhatsApp / Evolution
          </TabsTrigger>
          <TabsTrigger value="n8n" className="gap-2">
            <Server className="w-4 h-4" /> n8n
          </TabsTrigger>
          <TabsTrigger value="groq" className="gap-2">
            <Bot className="w-4 h-4" /> IA Groq
          </TabsTrigger>
          <TabsTrigger value="gemini" className="gap-2">
            <Bot className="w-4 h-4" /> IA Gemini
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <FileText className="w-4 h-4" /> Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp">
          <AbaWhatsApp allLogs={allLogs} setAllLogs={setAllLogs} />
        </TabsContent>

        <TabsContent value="n8n">
          <AbaNCN allLogs={allLogs} setAllLogs={setAllLogs} />
        </TabsContent>

        <TabsContent value="groq">
          <AbaIA provider="groq" label="Groq (Llama3)" allLogs={allLogs} setAllLogs={setAllLogs} />
        </TabsContent>

        <TabsContent value="gemini">
          <AbaIA provider="gemini" label="Google Gemini" allLogs={allLogs} setAllLogs={setAllLogs} />
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
      </Tabs>
    </div>
  );
}
