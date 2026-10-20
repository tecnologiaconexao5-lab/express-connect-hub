import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertTriangle, ExternalLink, ArrowRight } from "lucide-react";

/**
 * Backend OAuth do Zoho. Deve ser uma URL pública (nuvem) configurada em
 * VITE_ZOHO_CONNECT_URL. Nunca usamos localhost/IP local como fallback.
 */
const SERVER_URL = (import.meta.env.VITE_ZOHO_CONNECT_URL || import.meta.env.VITE_BACKEND_URL || "")
  .trim()
  .replace(/\/+$/, "");

export default function ZohoCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"processando" | "sucesso" | "erro">("processando");
  const [mensagem, setMensagem] = useState("Verificando servidor...");
  const [detalhe, setDetalhe] = useState("");
  const [dados, setDados] = useState<{ email?: string; accountId?: string } | null>(null);

  const code = searchParams.get("code");
  const erroZoho = searchParams.get("error");
  const clientId = import.meta.env.VITE_ZOHO_CLIENT_ID as string || "";

  useEffect(() => {
    if (erroZoho) {
      setStatus("erro");
      setMensagem("Autorização cancelada no Zoho.");
      setDetalhe(`${searchParams.get("error_description") || ""}`);
      return;
    }

    if (!code) {
      setStatus("erro");
      setMensagem("Nenhum código de autorização recebido.");
      setDetalhe("Inicie a conexão pelo botão \"Conectar Zoho\" na Central IA.");
      return;
    }

    executar();
  }, []);

  async function executar() {
    if (!SERVER_URL) {
      setStatus("erro");
      setMensagem("Backend do Zoho não configurado.");
      setDetalhe(
        "Defina VITE_ZOHO_CONNECT_URL apontando para o backend público (nuvem) que expõe /api/integracoes/zoho.",
      );
      return;
    }

    try {
      setMensagem("Conectando ao backend do Zoho...");
      const statusRes = await fetch(`${SERVER_URL}/api/integracoes/zoho/status`, {
        signal: AbortSignal.timeout(5000),
      });
      const statusData = await statusRes.json();

      if (!statusData.configurado) {
        setStatus("erro");
        setMensagem("Zoho não configurado.");
        setDetalhe("Defina ZOHO_CLIENT_ID e ZOHO_CLIENT_SECRET no backend (Edge Function Secrets) e reinicie o servidor.");
        return;
      }

      const redirectUri = `${window.location.origin}/zoho/callback`;
      setMensagem("Trocando código por tokens...");
      const exchangeRes = await fetch(`${SERVER_URL}/api/integracoes/zoho/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, redirect_uri: redirectUri }),
        signal: AbortSignal.timeout(30000),
      });

      const exchangeData = await exchangeRes.json();

      if (!exchangeRes.ok) {
        throw new Error(exchangeData.erro || "Erro ao trocar código");
      }

      setDados({ email: exchangeData.email, accountId: exchangeData.accountId });
      setMensagem("Zoho Mail conectado com sucesso!");
      setStatus("sucesso");

      // Auto-redirect to Central IA after 3 seconds
      setTimeout(() => navigate("/central-ia?tab=conectores&zoho=conectado"), 3000);
    } catch (err: any) {
      setStatus("erro");
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        setMensagem("Backend do Zoho não respondeu.");
        setDetalhe(`Verifique se o backend público configurado em VITE_ZOHO_CONNECT_URL está no ar (${SERVER_URL}).`);
      } else {
        setMensagem(err.message || "Erro desconhecido");
        setDetalhe("");
      }
    }
  }

  function irParaCentralIA() {
    navigate("/central-ia?tab=conectores");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-lg bg-slate-900/80 border-slate-700 text-slate-100">
        <CardHeader className="border-b border-slate-700 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
              <ExternalLink className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl text-white">Zoho Mail — OAuth2</CardTitle>
              <CardDescription className="text-slate-400">Callback de autorização</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">
          {status === "processando" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              <p className="text-slate-300">{mensagem}</p>
            </div>
          )}

          {status === "erro" && (
            <>
              <Alert variant="destructive" className="bg-red-900/30 border-red-800 text-red-200">
                <AlertTriangle className="w-4 h-4" />
                <AlertTitle>{mensagem}</AlertTitle>
                {detalhe && <AlertDescription className="text-red-300 text-sm mt-1">{detalhe}</AlertDescription>}
              </Alert>

              {!code && (
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={irParaCentralIA}>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Ir para Central IA
                </Button>
              )}

              {code && (
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={executar}>
                  Tentar novamente
                </Button>
              )}
            </>
          )}

          {status === "sucesso" && (
            <>
              <Alert className="bg-emerald-900/30 border-emerald-800 text-emerald-200">
                <CheckCircle2 className="w-4 h-4" />
                <AlertTitle>{mensagem}</AlertTitle>
                <AlertDescription className="text-emerald-300 text-sm mt-1">
                  {dados?.email && <>{dados.email} &mdash; </>}
                  Account ID: {dados?.accountId}
                </AlertDescription>
              </Alert>

              <p className="text-sm text-slate-400 text-center">
                Redirecionando para Central IA...
              </p>

              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={irParaCentralIA}>
                <ArrowRight className="w-4 h-4 mr-2" />
                Ir para Central IA
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
