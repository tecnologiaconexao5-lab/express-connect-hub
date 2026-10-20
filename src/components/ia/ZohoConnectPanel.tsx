import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertTriangle, ExternalLink, ServerOff, Mail, RefreshCw, Plug, Unplug, Shield, LogOut, Send, XCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * Backend OAuth do Zoho. Configurado em VITE_ZOHO_CONNECT_URL (nuvem).
 * Não há fallback para localhost/IP local — o painel falha de forma
 * explícita quando o backend público não está configurado.
 */
const SERVER_URL = (import.meta.env.VITE_ZOHO_CONNECT_URL || import.meta.env.VITE_BACKEND_URL || "")
  .trim()
  .replace(/\/+$/, "");
const BACKEND_CONFIGURADO = Boolean(SERVER_URL);
const MENSAGEM_BACKEND_AUSENTE =
  "Backend do Zoho não configurado. Defina VITE_ZOHO_CONNECT_URL no ambiente de produção.";

interface StatusConexao {
  conectado: boolean;
  credencial: {
    id: string;
    account_id: string;
    data_center: string;
    email: string | null;
    status: string;
    criado_em: string;
    atualizado_em: string;
  } | null;
  configurado: boolean;
}

type EstadoTeste = "ocioso" | "solicitando" | "aguardando_aprovacao" | "aprovado" | "enviando" | "enviado" | "erro";

export function ZohoConnectPanel() {
  const [status, setStatus] = useState<StatusConexao | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverOnline, setServerOnline] = useState(true);
  const [testando, setTestando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [estadoTeste, setEstadoTeste] = useState<EstadoTeste>("ocioso");
  const [tarefaId, setTarefaId] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const verificarStatus = async () => {
    if (!BACKEND_CONFIGURADO) {
      setServerOnline(false);
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/integracoes/zoho/status`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      setStatus(data);
      setServerOnline(true);
    } catch {
      setServerOnline(false);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { verificarStatus(); }, []);

  const conectarZoho = () => {
    const clientId = import.meta.env.VITE_ZOHO_CLIENT_ID;
    if (!clientId) {
      toast.error("VITE_ZOHO_CLIENT_ID não configurado no .env");
      return;
    }
    const redirectUri = `${window.location.origin}/zoho/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: "ZohoMail.messages.CREATE,ZohoMail.accounts.READ",
    });
    window.location.href = `https://accounts.zoho.com/oauth/v2/auth?${params.toString()}`;
  };

  const testarEnvio = async () => {
    if (!BACKEND_CONFIGURADO) {
      setEstadoTeste("erro");
      setResultado(MENSAGEM_BACKEND_AUSENTE);
      toast.error(MENSAGEM_BACKEND_AUSENTE);
      return;
    }
    setTestando(true);
    setEstadoTeste("solicitando");
    setResultado(null);
    try {
      const res = await fetch(`${SERVER_URL}/api/integracoes/zoho/test`, {
        method: "POST",
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || "Erro ao solicitar teste");
      setTarefaId(data.tarefa_id);
      setEstadoTeste("aguardando_aprovacao");
      toast.success(data.mensagem);
    } catch (err: any) {
      setEstadoTeste("erro");
      setResultado(err.message);
      toast.error(err.message || "Erro ao conectar com servidor");
    } finally {
      setTestando(false);
    }
  };

  const executarTeste = async () => {
    if (!tarefaId) return;
    if (!BACKEND_CONFIGURADO) {
      setEstadoTeste("erro");
      setResultado(MENSAGEM_BACKEND_AUSENTE);
      toast.error(MENSAGEM_BACKEND_AUSENTE);
      return;
    }
    setEstadoTeste("enviando");
    setResultado(null);
    try {
      const res = await fetch(`${SERVER_URL}/api/integracoes/zoho/executar-teste`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tarefa_id: tarefaId }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || "Erro ao executar teste");
      setEstadoTeste("enviado");
      setResultado(data.mensagem);
      toast.success(data.mensagem);
    } catch (err: any) {
      setEstadoTeste("erro");
      setResultado(err.message);
      toast.error(err.message || "Erro ao enviar email");
    }
  };

  const limparTeste = () => {
    setEstadoTeste("ocioso");
    setTarefaId(null);
    setResultado(null);
  };

  // Polling: when aguardando_aprovacao, check every 5s if approved
  useEffect(() => {
    if (estadoTeste === "aguardando_aprovacao" && tarefaId && BACKEND_CONFIGURADO) {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${SERVER_URL}/api/integracoes/zoho/test-status?tarefa_id=${tarefaId}`, {
            signal: AbortSignal.timeout(5000),
          });
          const data = await res.json();
          if (data.status_aprovacao === "aprovado") {
            setEstadoTeste("aprovado");
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            toast.success("Teste aprovado! Clique em 'Executar envio' para enviar o email.");
          } else if (data.status_aprovacao === "rejeitado" || data.status_aprovacao === "editado") {
            setEstadoTeste("ocioso");
            setResultado(`Solicitação ${data.status_aprovacao}${data.observacao ? ": " + data.observacao : ""}`);
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            toast.info(`Teste ${data.status_aprovacao}`);
          }
        } catch {
          // polling silently
        }
      }, 5000);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [estadoTeste, tarefaId]);

  const desconectar = async () => {
    if (!BACKEND_CONFIGURADO) {
      toast.error(MENSAGEM_BACKEND_AUSENTE);
      return;
    }
    setDesconectando(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/integracoes/zoho/disconnect`, {
        method: "POST",
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || "Erro ao desconectar");
      toast.success("Zoho Mail desconectado");
      await verificarStatus();
    } catch (err: any) {
      toast.error(err.message || "Erro ao desconectar");
    } finally {
      setDesconectando(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-slate-700 bg-slate-900/50">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400 mr-3" />
          <span className="text-slate-400">Verificando servidor de conexão...</span>
        </CardContent>
      </Card>
    );
  }

  if (!serverOnline) {
    return (
      <Card className="border-slate-700 bg-slate-900/50">
        <CardContent className="py-6 space-y-4">
          <Alert className="bg-amber-900/30 border-amber-800 text-amber-200">
            <ServerOff className="w-4 h-4" />
            <AlertTitle>Servidor Zoho Connect offline</AlertTitle>
            <AlertDescription className="text-amber-300 text-sm mt-1">
              Inicie o servidor com <code className="text-amber-200">npx tsx scripts/zoho_connect_server.ts</code>
            </AlertDescription>
          </Alert>
          <Button variant="outline" className="w-full border-slate-600 text-slate-300" onClick={verificarStatus}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Verificar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!status?.configurado) {
    return (
      <Card className="border-slate-700 bg-slate-900/50">
        <CardContent className="py-6 space-y-4">
          <Alert className="bg-red-900/30 border-red-800 text-red-200">
            <AlertTriangle className="w-4 h-4" />
            <AlertTitle>Zoho não configurado</AlertTitle>
            <AlertDescription className="text-red-300 text-sm mt-1">
              Defina VITE_ZOHO_CLIENT_ID e VITE_ZOHO_CLIENT_SECRET no .env e reinicie o servidor.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-700 bg-slate-900/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-400" />
            <CardTitle className="text-lg text-white">Zoho Mail</CardTitle>
          </div>
          <Badge className={status.conectado ? "bg-emerald-600 text-white" : "bg-slate-600 text-slate-300"}>
            {status.conectado ? "Conectado" : "Desconectado"}
          </Badge>
        </div>
        <CardDescription className="text-slate-400">
          Integração de email corporativo
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {status.conectado && status.credencial ? (
          <>
            <div className="rounded bg-slate-800/50 border border-slate-700 p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="text-emerald-400 font-medium">Conectado</span>
              </div>
              {status.credencial.email && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Conta:</span>
                  <span className="text-slate-200">{status.credencial.email}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Account ID:</span>
                <code className="text-slate-200 text-xs">{status.credencial.account_id}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Data Center:</span>
                <span className="text-slate-200">{status.credencial.data_center}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Conectado em:</span>
                <span className="text-slate-200">{new Date(status.credencial.criado_em).toLocaleString("pt-BR")}</span>
              </div>
            </div>

            <div className="flex gap-2">
              {estadoTeste === "ocioso" && (
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={testarEnvio}
                  disabled={testando}
                >
                  {testando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                  Testar envio
                </Button>
              )}
              {estadoTeste === "aprovado" && (
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={executarTeste}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Executar envio
                </Button>
              )}
              {estadoTeste === "enviado" && (
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={limparTeste}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Novo teste
                </Button>
              )}
              {estadoTeste === "erro" && (
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={limparTeste}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Tentar novamente
                </Button>
              )}
              <Button
                variant="outline"
                className="border-red-800 text-red-400 hover:bg-red-950 hover:text-red-300"
                onClick={desconectar}
                disabled={desconectando}
              >
                {desconectando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
                Desconectar
              </Button>
            </div>

            {estadoTeste === "aguardando_aprovacao" && (
              <Alert className="bg-blue-900/20 border-blue-800/50 text-blue-200">
                <Shield className="w-4 h-4" />
                <AlertTitle>Aguardando aprovação da diretoria</AlertTitle>
                <AlertDescription className="text-blue-300 text-sm mt-1">
                  A solicitação foi registrada. Vá para <strong>Central IA → Aprovações</strong> para aprovar ou rejeitar.
                  O status será verificado automaticamente a cada 5 segundos.
                </AlertDescription>
              </Alert>
            )}

            {estadoTeste === "aprovado" && (
              <Alert className="bg-emerald-900/20 border-emerald-800/50 text-emerald-200">
                <CheckCircle2 className="w-4 h-4" />
                <AlertTitle>Teste aprovado!</AlertTitle>
                <AlertDescription className="text-emerald-300 text-sm mt-1">
                  Clique em <strong>"Executar envio"</strong> para enviar o email de homologação via Zoho Mail.
                </AlertDescription>
              </Alert>
            )}

            {estadoTeste === "enviando" && (
              <Alert className="bg-blue-900/20 border-blue-800/50 text-blue-200">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <AlertTitle>Enviando email...</AlertTitle>
                <AlertDescription className="text-blue-300 text-sm mt-1">
                  Aguarde enquanto o email é enviado através da API do Zoho Mail.
                </AlertDescription>
              </Alert>
            )}

            {estadoTeste === "enviado" && resultado && (
              <Alert className="bg-emerald-900/20 border-emerald-800/50 text-emerald-200">
                <CheckCircle2 className="w-4 h-4" />
                <AlertTitle>Email enviado com sucesso!</AlertTitle>
                <AlertDescription className="text-emerald-300 text-sm mt-1">
                  {resultado}
                </AlertDescription>
              </Alert>
            )}

            {estadoTeste === "erro" && resultado && (
              <Alert className="bg-red-900/20 border-red-800/50 text-red-200">
                <XCircle className="w-4 h-4" />
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription className="text-red-300 text-sm mt-1">
                  {resultado}
                </AlertDescription>
              </Alert>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Conecte sua conta Zoho Mail para enviar emails corporativos através dos funcionários digitais.
              O Client Secret permanece no servidor e não é exposto ao navegador.
            </p>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={conectarZoho}>
              <Plug className="w-4 h-4 mr-2" />
              Conectar Zoho
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-800">
          <span>Backend: {SERVER_URL || "não configurado"}</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs text-slate-500 hover:text-slate-300" onClick={verificarStatus}>
            <RefreshCw className="w-3 h-3 mr-1" />
            Atualizar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
