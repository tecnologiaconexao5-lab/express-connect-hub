import { useState, useEffect } from "react";
import { Radio, Building2, FileSpreadsheet, FileCheck, ShieldAlert, XCircle, CheckCircle2, AlertTriangle, Loader2, UploadCloud, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import type { ConfiguracaoFiscal } from "@/types/fiscal";

export default function FocusNfeConfig() {
  const [loading, setLoading] = useState(true);
  const [emitentes, setEmitentes] = useState<ConfiguracaoFiscal[]>([]);
  const [stats, setStats] = useState({ ctesProntos: 0, xmlsImportados: 0, regrasCfop: 0 });

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

  if (loading) {
    return <Card><CardContent className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  const checklist = [
    { label: "Emitente cadastrado", ok: emitentes.filter(function(e) { return e.ativo && e.cnpj && e.razao_social; }).length > 0 },
    { label: "CFOP configurado", ok: stats.regrasCfop > 0 },
    { label: "XML NF-e importado", ok: stats.xmlsImportados > 0 },
    { label: "CT-e pronto internamente", ok: stats.ctesProntos > 0 },
    { label: "Token Focus", ok: false, info: "pendente" },
    { label: "Certificado A1", ok: false, info: "pendente" },
    { label: "Ambiente Focus", ok: false, info: "pendente" },
  ];

  return (
    <div className="space-y-6">
      {/* Card principal — Status da Integracao */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Radio className="w-6 h-6 text-primary" />
            <div>
              <CardTitle>Focus NFe</CardTitle>
              <CardDescription>Painel de preparacao para futura integracao fiscal</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <span className="text-xs text-muted-foreground">Status da Integracao</span>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300 text-sm px-3 py-1">
                  <XCircle className="w-3 h-3 mr-1" /> Nao configurado
                </Badge>
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <span className="text-xs text-muted-foreground">Ambiente</span>
              <p className="font-semibold text-lg mt-1">Homologacao</p>
            </div>
            <div className="p-4 border rounded-lg">
              <span className="text-xs text-muted-foreground">Plano</span>
              <p className="font-semibold text-lg mt-1">Ate 3 CNPJs</p>
            </div>
          </div>

          {/* Aviso */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                A integracao Focus NFe sera ativada somente apos contratacao do plano, cadastro dos CNPJs emitentes na Focus, configuracao segura do token e certificado digital A1. Nenhuma emissao real e feita nesta tela.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emitentes */}
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

      {/* Checklist */}
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

      {/* Botoes desabilitados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acoes</CardTitle>
          <CardDescription>Disponiveis apos configuracao do ambiente Focus</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button disabled variant="outline" className="gap-2">
            <Radio className="w-4 h-4" /> Testar conexao Focus
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
