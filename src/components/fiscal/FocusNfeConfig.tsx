import { useState, useEffect, useCallback } from "react";
import { Radio, Building2, FileSpreadsheet, FileCheck, ShieldAlert, XCircle, CheckCircle2, AlertTriangle, Loader2, UploadCloud, FileText, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { ConfiguracaoFiscal } from "@/types/fiscal";
import { ProgressiveBlocksLoader } from "@/components/ui/ProgressiveBlocksLoader";

interface FocusHealthCheck {
  ok: boolean;
  modo: string;
  mensagem: string;
  ambiente: string;
  secrets: {
    focus_token_homologacao: boolean;
    focus_token_producao: boolean;
    focus_real_enabled: boolean;
  };
}

export default function FocusNfeConfig() {
  const [loading, setLoading] = useState(true);
  const [emitentes, setEmitentes] = useState<ConfiguracaoFiscal[]>([]);
  const [stats, setStats] = useState({ ctesProntos: 0, xmlsImportados: 0, regrasCfop: 0 });
  const [testando, setTestando] = useState(false);
  const [focusHealth, setFocusHealth] = useState<FocusHealthCheck | null>(null);
  const [focusErro, setFocusErro] = useState<string | null>(null);

  useEffect(function() {
    carregarDados();
  }, []);

  const carregarDados = async function() {
    setLoading(true);
    const [emitsRes, ctesRes, xmlsRes, regrasRes] = await Promise.all([
      supabase.from("configuracoes_fiscais").select("*").order("created_at", { ascending: false }),
      supabase.from("fiscal_ctes").select("metadata").eq("status", "rascunho"),
      supabase.from("fiscal_documentos_vinculados").select("id").eq("status", "vinculado"),
      supabase.from("regras_fiscais_cte").select("id").eq("ativo", true),
    ]);

    setEmitentes((emitsRes.data || []) as ConfiguracaoFiscal[]);
    const ctesProntos = (ctesRes.data || []).filter(function(c) { return c.metadata?.pronto_para_emissao; }).length;
    setStats({
      ctesProntos,
      xmlsImportados: (xmlsRes.data || []).length,
      regrasCfop: (regrasRes.data || []).length,
    });
    setLoading(false);
  };

  const testarConexaoFocus = useCallback(async function() {
    setTestando(true);
    setFocusErro(null);
    setFocusHealth(null);

    try {
      const { data, error } = await supabase.functions.invoke("focus-emissao", {
        body: { action: "ping" },
      });

      if (error) {
        setFocusErro(error.message || "Erro ao chamar Edge Function");
        toast.error("Falha ao testar conexao Focus: " + (error.message || "Erro desconhecido"));
        return;
      }

      const parsed = data as FocusHealthCheck;

      if (!parsed || !parsed.ok) {
        setFocusErro(parsed?.mensagem || "Resposta inesperada da Edge Function");
        toast.error("Edge Function Focus respondeu com erro");
        return;
      }

      setFocusHealth(parsed);

      const tokenOk = parsed.secrets.focus_token_homologacao;
      const enabledOk = parsed.secrets.focus_real_enabled;
      const ambiente = parsed.ambiente;

      if (tokenOk && enabledOk) {
        toast.success("Conexao Focus OK — ambiente " + ambiente + ". Token configurado e Edge Function ativa.");
      } else if (tokenOk && !enabledOk) {
        toast.warning("Token Focus configurado, mas FOCUS_REAL_ENABLED esta desligado. Ambiente: " + ambiente);
      } else {
        toast.warning("Token Focus nao configurado. Verifique os Supabase Secrets da Edge Function.");
      }
    } catch (e: any) {
      setFocusErro(e.message || "Erro de rede");
      toast.error("Erro ao chamar Edge Function: " + (e.message || "Rede"));
    } finally {
      setTestando(false);
    }
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <ProgressiveBlocksLoader size="normal" />
        </CardContent>
      </Card>
    );
  }

  const tokenFocusOk = focusHealth?.secrets?.focus_token_homologacao ?? false;
  const realEnabledOk = focusHealth?.secrets?.focus_real_enabled ?? false;
  const ambienteFocus = focusHealth?.ambiente || "homologacao";
  const integracaoOk = tokenFocusOk && realEnabledOk;

  const checklist = [
    { label: "Emitente cadastrado", ok: emitentes.filter(function(e) { return e.ativo && e.cnpj && e.razao_social; }).length > 0 },
    { label: "CFOP configurado", ok: stats.regrasCfop > 0 },
    { label: "XML NF-e importado", ok: stats.xmlsImportados > 0 },
    { label: "CT-e pronto internamente", ok: stats.ctesProntos > 0 },
    { label: "Token Focus", ok: tokenFocusOk, info: tokenFocusOk ? undefined : "pendente" },
    { label: "Certificado A1", ok: false, info: "pendente" },
    { label: "Ambiente Focus", ok: realEnabledOk, info: realEnabledOk ? ambienteFocus : "pendente" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Radio className="w-6 h-6 text-primary" />
            <div>
              <CardTitle>Focus NFe</CardTitle>
              <CardDescription>Painel de integracao fiscal — Focus NFe API v2</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <span className="text-xs text-muted-foreground">Status da Integracao</span>
              <div className="flex items-center gap-2 mt-1">
                {focusHealth ? (
                  integracaoOk ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-sm px-3 py-1">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Conectado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-sm px-3 py-1">
                      <AlertTriangle className="w-3 h-3 mr-1" /> Parcial
                    </Badge>
                  )
                ) : focusErro ? (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 text-sm px-3 py-1">
                    <XCircle className="w-3 h-3 mr-1" /> Erro
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300 text-sm px-3 py-1">
                    <XCircle className="w-3 h-3 mr-1" /> Nao verificado
                  </Badge>
                )}
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <span className="text-xs text-muted-foreground">Ambiente</span>
              <p className="font-semibold text-lg mt-1 capitalize">{focusHealth ? ambienteFocus : "Homologacao"}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <span className="text-xs text-muted-foreground">Plano</span>
              <p className="font-semibold text-lg mt-1">Ate 3 CNPJs</p>
            </div>
          </div>

          {focusErro && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-800">
                  Erro ao testar conexao: {focusErro}. Verifique se a Edge Function focus-emissao esta deployada e se os secrets FOCUS_TOKEN e FOCUS_REAL_ENABLED estao configurados no Supabase Dashboard.
                </p>
              </div>
            </div>
          )}

          {!focusHealth && !focusErro && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  Clique em "Testar conexao Focus" para verificar a configuracao dos Supabase Secrets. Nenhum token ou certificado trafega pelo navegador.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Emitentes Cadastrados ({emitentes.filter(function(e) { return e.ativo; }).length}/3)</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {emitentes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum emitente cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {emitentes.map(function(emit) {
                return (
                  <div key={emit.id} className={"flex items-center justify-between p-3 border rounded-lg " + (emit.padrao ? "border-primary bg-primary/5" : "border-border")}>
                    <div className="flex items-center gap-3 min-w-0">
                      <Building2 className={"w-4 h-4 flex-shrink-0 " + (emit.ativo ? "text-primary" : "text-muted-foreground")} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{emit.apelido || emit.nome_fantasia || emit.razao_social}</span>
                          {emit.padrao && <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Padrao</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{emit.cnpj}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className={emit.ambiente_fiscal === "producao" ? "bg-red-50 text-red-700 border-red-200 text-xs" : "bg-amber-50 text-amber-700 border-amber-200 text-xs"}>
                        {emit.ambiente_fiscal === "producao" ? "Producao" : "Homologacao"}
                      </Badge>
                      <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-xs">
                        Focus: {emit.focus_token_configurado ? "Ok" : "Pendente"}
                      </Badge>
                      <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-xs">
                        Cert: {emit.certificado_configurado ? "Ok" : "Pendente"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Checklist de Preparacao</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {checklist.map(function(item, i) {
              return (
                <div key={i} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    {item.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : item.info ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm">{item.label}</span>
                  </div>
                  <Badge variant="outline" className={item.ok ? "bg-green-50 text-green-700 border-green-200 text-xs" : item.info ? "bg-amber-50 text-amber-700 border-amber-200 text-xs" : "bg-red-50 text-red-700 border-red-200 text-xs"}>
                    {item.ok ? "OK" : item.info || "Pendente"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acoes</CardTitle>
          <CardDescription>Teste a conexao com a API Focus NFe via Edge Function segura</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="gap-2"
            onClick={testarConexaoFocus}
            disabled={testando}
          >
            {testando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : focusHealth ? (
              <RefreshCw className="w-4 h-4" />
            ) : (
              <Radio className="w-4 h-4" />
            )}
            {testando ? "Testando..." : focusHealth ? "Testar novamente" : "Testar conexao Focus"}
          </Button>
          <Button disabled variant="outline" className="gap-2">
            <ShieldAlert className="w-4 h-4" /> Configurar token
          </Button>
          <Button disabled variant="outline" className="gap-2">
            <FileText className="w-4 h-4" /> Configurar certificado
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
