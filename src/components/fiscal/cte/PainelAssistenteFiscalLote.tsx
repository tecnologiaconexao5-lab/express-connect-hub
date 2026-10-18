import { useState, useEffect, useCallback } from "react";
import {
  Layers, CheckCircle2, XCircle, AlertTriangle, Send, RefreshCw,
  Download, Loader2, FileSpreadsheet, DollarSign, ArrowRight,
  ListChecks, Eye, Clock,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  diagnosticarLoteFiscalCte,
  enviarLoteCteParaFocus,
  consultarLoteCteFocus,
  baixarDocumentosLoteCteFocus,
  type CteLoteItem,
  type DiagnosticoLote,
  type DiagnosticoLoteItem,
  type LoteEnvioResultado,
} from "@/services/fiscal/focusService";

interface PainelAssistenteFiscalLoteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loteId?: string | null;
  onAtualizar?: () => void;
}

const fmtFin = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";

const statusLabel: Record<string, string> = {
  rascunho_pendente_envio: "Pendente de Envio",
  parcialmente_enviado: "Parcialmente Enviado",
  aguardando_consulta: "Aguardando Consulta",
  parcialmente_autorizado: "Parcialmente Autorizado",
  aguardando_documentos: "Aguardando XML/DACTE",
  completo: "Completo",
  com_pendencias: "Com Pendencias",
  com_rejeicoes: "Com Rejeicoes",
  erro: "Erro",
};

const statusColor: Record<string, string> = {
  rascunho_pendente_envio: "bg-blue-50 text-blue-700 border-blue-200",
  parcialmente_enviado: "bg-amber-50 text-amber-700 border-amber-200",
  aguardando_consulta: "bg-amber-50 text-amber-700 border-amber-200",
  parcialmente_autorizado: "bg-amber-50 text-amber-700 border-amber-200",
  aguardando_documentos: "bg-purple-50 text-purple-700 border-purple-200",
  completo: "bg-green-50 text-green-700 border-green-200",
  com_pendencias: "bg-red-50 text-red-700 border-red-200",
  com_rejeicoes: "bg-red-50 text-red-700 border-red-200",
  erro: "bg-red-50 text-red-700 border-red-200",
};

export default function PainelAssistenteFiscalLote({ open, onOpenChange, loteId, onAtualizar }: PainelAssistenteFiscalLoteProps) {
  const [ctes, setCtes] = useState<CteLoteItem[]>([]);
  const [diagnostico, setDiagnostico] = useState<DiagnosticoLote | null>(null);
  const [loading, setLoading] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState<LoteEnvioResultado | null>(null);
  const [progresso, setProgresso] = useState(0);

  const carregar = useCallback(async () => {
    if (!loteId) return;
    setLoading(true);
    setResultado(null);
    const { data } = await supabase
      .from("fiscal_ctes")
      .select("id, numero, status, valor, metadata, chave_acesso")
      .filter("metadata->rateio->>lote_id", "eq", loteId)
      .order("created_at", { ascending: true });

    const docs = (data || []) as CteLoteItem[];
    setCtes(docs);
    setDiagnostico(diagnosticarLoteFiscalCte(docs));
    setLoading(false);
  }, [loteId]);

  useEffect(() => {
    if (open) carregar();
  }, [open, carregar]);

  const handleEnviar = async () => {
    if (!diagnostico?.podeEnviar) return;
    const aptos = ctes.filter((c) => c.status === "rascunho" && c.metadata?.pronto_para_emissao && !c.metadata?.pendente_conferencia_endereco && c.metadata?.payload_focus);
    if (aptos.length === 0) { toast.error("Nenhum CT-e apto."); return; }
    setExecutando(true); setProgresso(0); setResultado(null);
    toast.info(`Enviando ${aptos.length} CT-es...`);
    try {
      const res = await enviarLoteCteParaFocus(aptos);
      setResultado(res); setProgresso(100);
      if (res.falhas === 0 && res.bloqueados === 0) toast.success(`${res.enviadosComSucesso} CT-es enviados!`);
      else toast.warning(`Parcial: ${res.enviadosComSucesso} ok, ${res.falhas} falhas.`);
      await carregar(); onAtualizar?.();
    } catch (e: any) { toast.error(e.message); }
    finally { setExecutando(false); }
  };

  const handleConsultar = async () => {
    if (!diagnostico?.podeConsultar) return;
    const consultaveis = ctes.filter((c) => c.status === "processando" && c.metadata?.focus_response);
    if (consultaveis.length === 0) { toast.error("Nenhum CT-e para consultar."); return; }
    setExecutando(true); setProgresso(0); setResultado(null);
    toast.info(`Consultando ${consultaveis.length} CT-es...`);
    try {
      const res = await consultarLoteCteFocus(consultaveis);
      setResultado(res); setProgresso(100);
      const auths = res.itens.filter((i) => i.sucesso && i.statusRetornado === "autorizado").length;
      if (auths > 0) toast.success(`${auths} CT-es autorizados!`);
      await carregar(); onAtualizar?.();
    } catch (e: any) { toast.error(e.message); }
    finally { setExecutando(false); }
  };

  const handleBaixarDocs = async (force = false) => {
    const autorizados = ctes.filter((c) => c.status === "autorizado");
    if (autorizados.length === 0) { toast.error("Nenhum CT-e autorizado."); return; }
    setExecutando(true); setProgresso(0); setResultado(null);
    toast.info(`${force ? "Reprocessando" : "Baixando"} documentos de ${autorizados.length} CT-es...`);
    try {
      const res = await baixarDocumentosLoteCteFocus(autorizados, force);
      setResultado(res as any); setProgresso(100);
      toast.success(`${res.enviadosComSucesso} CT-es processados.`);
      await carregar(); onAtualizar?.();
    } catch (e: any) { toast.error(e.message); }
    finally { setExecutando(false); }
  };

  const getProximoBadge = (acao: string) => {
    const map: Record<string, { label: string; color: string }> = {
      enviar_focus: { label: "Enviar para Focus", color: "bg-blue-100 text-blue-700 border-blue-200" },
      consultar_focus: { label: "Consultar Focus", color: "bg-amber-100 text-amber-700 border-amber-200" },
      baixar_documentos: { label: "Baixar XML/DACTE", color: "bg-purple-100 text-purple-700 border-purple-200" },
      corrigir_rejeicoes: { label: "Corrigir Rejeicoes", color: "bg-red-100 text-red-700 border-red-200" },
      corrigir_pendencias: { label: "Corrigir Pendencias", color: "bg-red-100 text-red-700 border-red-200" },
      concluido: { label: "Concluido", color: "bg-green-100 text-green-700 border-green-200" },
      reenviar: { label: "Reenviar", color: "bg-amber-100 text-amber-700 border-amber-200" },
    };
    return map[acao] || { label: acao, color: "bg-slate-100 text-slate-700" };
  };

  const etapas = [
    { key: "gerado", label: "Gerado", ok: ctes.length > 0 },
    { key: "enviado", label: "Enviado", ok: (diagnostico?.rascunhoProntos || 0) === 0 },
    { key: "consultado", label: "Consultado", ok: (diagnostico?.processando || 0) === 0 && ctes.some((c) => c.status !== "rascunho") },
    { key: "autorizado", label: "Autorizado", ok: (diagnostico?.autorizadosComDocumentos || 0) + (diagnostico?.autorizadosSemDocumentos || 0) === ctes.filter((c) => c.status !== "rascunho" && c.status !== "processando" && c.status !== "rascunho").length },
    { key: "documentos", label: "XML/DACTE", ok: (diagnostico?.autorizadosSemDocumentos || 0) === 0 && (diagnostico?.autorizadosComDocumentos || 0) > 0 },
    { key: "completo", label: "Completo", ok: diagnostico?.statusLote === "completo" },
  ];

  const etapaAtiva = etapas.findIndex((e) => !e.ok);
  const progressoPct = Math.round((etapas.filter((e) => e.ok).length / etapas.length) * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-blue-600" />
            Assistente Fiscal por Lote
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : !loteId ? (
          <div className="py-8 text-center text-muted-foreground">
            <Layers className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p>Selecione um CT-e com lote_id na grid.</p>
          </div>
        ) : diagnostico ? (
          <div className="space-y-4 py-2">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <Badge variant="outline" className="font-mono text-sm">{diagnostico.loteId}</Badge>
                <span className="text-sm text-muted-foreground ml-2">{diagnostico.total} CT-es</span>
                <span className="text-sm font-semibold ml-2">{fmtFin(diagnostico.valorTotal)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={statusColor[diagnostico.statusLote] || ""}>{statusLabel[diagnostico.statusLote] || diagnostico.statusLote}</Badge>
                <Badge className={getProximoBadge(diagnostico.proximaAcao).color}>
                  <ArrowRight className="w-3 h-3 mr-1" />{getProximoBadge(diagnostico.proximaAcao).label}
                </Badge>
              </div>
            </div>

            {/* Etapas */}
            <div className="p-3 bg-slate-50 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600">Progresso</span>
                <span className="text-xs text-slate-500">{progressoPct}%</span>
              </div>
              <Progress value={progressoPct} className="h-2" />
              <div className="flex justify-between mt-2 text-[10px]">
                {etapas.map((e, i) => (
                  <div key={e.key} className={`flex items-center gap-1 ${e.ok ? "text-green-600" : i === etapaAtiva ? "text-blue-600 font-semibold" : "text-slate-400"}`}>
                    {e.ok ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {e.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Progresso da ação atual */}
            {executando && (
              <Progress value={progresso} className="h-2" />
            )}

            {/* Cards de resumo */}
            <div className="grid grid-cols-4 gap-2">
              <Mini label="Aptos" value={diagnostico.rascunhoProntos} color="text-blue-600" bg="bg-blue-50" />
              <Mini label="Bloqueados" value={diagnostico.rascunhoBloqueados} color="text-slate-600" bg="bg-slate-50" />
              <Mini label="Processando" value={diagnostico.processando} color="text-amber-600" bg="bg-amber-50" />
              <Mini label="Autorizados" value={diagnostico.autorizadosComDocumentos + diagnostico.autorizadosSemDocumentos} color="text-green-600" bg="bg-green-50" />
              <Mini label="XML Pendente" value={diagnostico.autorizadosSemDocumentos} color="text-purple-600" bg="bg-purple-50" />
              <Mini label="Rejeitados" value={diagnostico.rejeitados} color="text-red-600" bg="bg-red-50" />
              <Mini label="Erro Emissao" value={diagnostico.erroEmissao} color="text-red-600" bg="bg-red-50" />
              <Mini label="Completos" value={diagnostico.completos} color="text-green-600" bg="bg-green-50" />
            </div>

            {/* Ações assistidas */}
            <div className="flex flex-wrap gap-2">
              {diagnostico.podeEnviar && (
                <Button onClick={() => { if (confirm(`Enviar ${diagnostico.rascunhoProntos} CT-es aptos para Focus?`)) handleEnviar(); }} disabled={executando} className="bg-blue-600 hover:bg-blue-700">
                  <Send className="w-4 h-4 mr-2" />Enviar CT-es Aptos ({diagnostico.rascunhoProntos})
                </Button>
              )}
              {diagnostico.podeConsultar && (
                <Button onClick={() => { if (confirm(`Consultar ${diagnostico.processando} CT-es processando?`)) handleConsultar(); }} disabled={executando} variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                  <RefreshCw className="w-4 h-4 mr-2" />Consultar ({diagnostico.processando})
                </Button>
              )}
              {diagnostico.podeBaixarDocumentos && (
                <Button onClick={() => { if (confirm(`Baixar XML/DACTE de ${diagnostico.autorizadosSemDocumentos} CT-es autorizados?`)) handleBaixarDocs(); }} disabled={executando} variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-50">
                  <Download className="w-4 h-4 mr-2" />Baixar Docs ({diagnostico.autorizadosSemDocumentos})
                </Button>
              )}
              {diagnostico.autorizadosComDocumentos > 0 && (
                <Button onClick={() => { if (confirm("Reprocessar XML/DACTE de todos os CT-es autorizados? Isso sobrescrevera os arquivos no Storage.")) handleBaixarDocs(true); }} disabled={executando} variant="outline" size="sm" className="text-amber-600">
                  <RefreshCw className="w-3 h-3 mr-1" />Reprocessar Docs
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={carregar} disabled={executando || loading}>
                <RefreshCw className="w-3 h-3 mr-1" />Atualizar
              </Button>
            </div>

            {/* Resultado */}
            {resultado && !executando && (
              <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 border rounded-lg">
                <div className="text-center"><span className="text-green-600 font-bold">{resultado.enviadosComSucesso}</span><p className="text-[10px] text-slate-500">Sucesso</p></div>
                <div className="text-center"><span className="text-red-600 font-bold">{resultado.falhas}</span><p className="text-[10px] text-slate-500">Falhas</p></div>
                <div className="text-center"><span className="text-slate-600 font-bold">{resultado.bloqueados || 0}</span><p className="text-[10px] text-slate-500">Bloqueados</p></div>
              </div>
            )}

            {/* Tabela CT-es */}
            <ScrollArea className="h-[200px] border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">CT-e</th>
                    <th className="p-2 text-left">NF-e</th>
                    <th className="p-2 text-right">Valor</th>
                    <th className="p-2 text-center">Status</th>
                    <th className="p-2 text-left">Acao</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {diagnostico.itens.map((item) => (
                    <tr key={item.cteId} className="hover:bg-slate-50">
                      <td className="p-2 font-medium">{item.numero || "S/N"}</td>
                      <td className="p-2 text-[10px]">{item.chave_nfe || "-"}</td>
                      <td className="p-2 text-right">{item.valor ? fmtFin(item.valor) : "-"}</td>
                      <td className="p-2 text-center">
                        {item.status === "autorizado" ? <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Autorizado</Badge>
                          : item.status === "processando" ? <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Processando</Badge>
                          : item.status === "rejeitado" ? <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Rejeitado</Badge>
                          : item.bloqueios.length > 0 ? <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">Bloqueado</Badge>
                          : <Badge variant="outline" className="text-[10px]">{item.status}</Badge>}
                      </td>
                      <td className="p-2 text-[10px]">
                        {item.proximaAcao === "concluido" ? <span className="text-green-600">OK</span>
                          : item.proximaAcao === "enviar_focus" ? <span className="text-blue-600">Aguardando envio</span>
                          : item.proximaAcao === "consultar_focus" ? <span className="text-amber-600">Aguardando consulta</span>
                          : item.proximaAcao === "baixar_documentos" ? <span className="text-purple-600">Aguardando docs</span>
                          : <span className="text-red-600">{item.bloqueios.join("; ") || item.proximaAcao}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>

            {/* Pendencias */}
            {diagnostico.rascunhoBloqueados + diagnostico.rejeitados + diagnostico.erroEmissao > 0 && (
              <div className="border rounded-lg">
                <div className="p-3 border-b bg-red-50 font-semibold text-sm text-red-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />Pendencias do Lote
                </div>
                <div className="p-3 space-y-2 text-xs">
                  {diagnostico.itens.filter((i) => i.bloqueios.length > 0).map((i) => (
                    <div key={i.cteId} className="flex items-start gap-2 p-2 bg-red-50 border border-red-100 rounded">
                      <XCircle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">CT-e {i.numero || "S/N"}:</span>{" "}
                        <span className="text-red-600">{i.bloqueios.join("; ")}</span>
                      </div>
                    </div>
                  ))}
                  {diagnostico.itens.filter((i) => i.status === "rejeitado").map((i) => {
                    const cte = ctes.find((c) => c.id === i.cteId);
                    return (
                      <div key={i.cteId} className="flex items-start gap-2 p-2 bg-red-50 border border-red-100 rounded">
                        <XCircle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium">CT-e {i.numero}:</span>{" "}
                          <span className="text-red-600">Rejeitado — {cte?.motivo_rejeicao || cte?.metadata?.focus_consulta?.motivo || "Motivo nao informado"}</span>
                        </div>
                      </div>
                    );
                  })}
                  {diagnostico.itens.filter((i) => i.status === "erro_emissao").map((i) => {
                    const cte = ctes.find((c) => c.id === i.cteId);
                    return (
                      <div key={i.cteId} className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-100 rounded">
                        <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium">CT-e {i.numero}:</span>{" "}
                          <span className="text-amber-600">Erro emissao — {cte?.metadata?.focus_erro?.error || cte?.motivo_rejeicao || "Reenviar"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Mini({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`p-2 rounded-lg border ${bg}`}>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className={`text-[10px] ${color} opacity-70`}>{label}</p>
    </div>
  );
}
