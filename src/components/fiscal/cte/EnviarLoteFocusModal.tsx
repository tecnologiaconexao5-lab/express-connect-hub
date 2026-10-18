import { useState, useEffect, useMemo } from "react";
import {
  Send, Layers, CheckCircle2, XCircle, AlertTriangle,
  Loader2, DollarSign, RefreshCw, FileSpreadsheet,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  enviarLoteCteParaFocus,
  consultarLoteCteFocus,
  type CteLoteItem,
  type LoteEnvioItem,
  type LoteEnvioResultado,
} from "@/services/fiscal/focusService";

interface EnviarLoteFocusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loteId?: string | null;
  onLoteProcessado: () => void;
}

const fmtFin = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";

export default function EnviarLoteFocusModal({ open, onOpenChange, loteId, onLoteProcessado }: EnviarLoteFocusModalProps) {
  const [ctes, setCtes] = useState<CteLoteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [resultado, setResultado] = useState<LoteEnvioResultado | null>(null);
  const [progresso, setProgresso] = useState(0);

  useEffect(() => {
    if (open && loteId) {
      fetchCtesLote();
      setResultado(null);
      setProgresso(0);
    }
  }, [open, loteId]);

  const fetchCtesLote = async () => {
    if (!loteId) return;
    setLoading(true);
    const { data } = await supabase
      .from("fiscal_ctes")
      .select("id, numero, status, valor, metadata")
      .filter("metadata->rateio->>lote_id", "eq", loteId)
      .order("created_at", { ascending: true });

    setCtes((data || []) as CteLoteItem[]);
    setLoading(false);
  };

  const itensValidados = useMemo(() => {
    return ctes.map((c) => {
      const meta = c.metadata || {};
      const bloqueios: string[] = [];
      if (c.status !== "rascunho") bloqueios.push(`Status: ${c.status}`);
      if (!meta.pronto_para_emissao) bloqueios.push("Nao pronto");
      if (meta.pendente_conferencia_endereco) bloqueios.push("Endereco pendente");
      if (!meta.payload_focus) bloqueios.push("Sem payload");
      return { cte: c, bloqueios, apto: bloqueios.length === 0 };
    });
  }, [ctes]);

  const aptos = itensValidados.filter((i) => i.apto).length;
  const bloqueados = itensValidados.filter((i) => !i.apto).length;
  const temProcessando = ctes.some((c) => c.status === "processando");
  const valorTotal = ctes.reduce((s, c) => s + (c.valor || 0), 0);

  const handleEnviarLote = async () => {
    if (!loteId) return;
    const ctesAptas = itensValidados.filter((i) => i.apto).map((i) => i.cte);
    if (ctesAptas.length === 0) {
      toast.error("Nenhum CT-e apto para envio.");
      return;
    }

    setEnviando(true);
    setProgresso(0);
    setResultado(null);
    toast.info(`Iniciando envio de ${ctesAptas.length} CT-es...`);

    try {
      const res = await enviarLoteCteParaFocus(ctesAptas);
      setResultado(res);
      setProgresso(100);

      if (res.falhas === 0 && res.bloqueados === 0) {
        toast.success(`Lote enviado com sucesso! ${res.enviadosComSucesso} CT-es processando.`);
      } else if (res.enviadosComSucesso > 0) {
        toast.warning(`Lote parcial: ${res.enviadosComSucesso} sucesso, ${res.falhas} falhas, ${res.bloqueados} bloqueados.`);
      } else {
        toast.error("Nenhum CT-e enviado com sucesso.");
      }

      onLoteProcessado();
    } catch (err: any) {
      toast.error("Erro ao enviar lote: " + err.message);
    } finally {
      setEnviando(false);
    }
  };

  const handleConsultarLote = async () => {
    const ctesConsultaveis = ctes.filter((c) =>
      ["processando", "rejeitado", "erro_emissao"].includes(c.status) && c.metadata?.focus_response
    );
    if (ctesConsultaveis.length === 0) {
      toast.error("Nenhum CT-e para consultar.");
      return;
    }

    setConsultando(true);
    setProgresso(0);
    setResultado(null);
    toast.info(`Consultando ${ctesConsultaveis.length} CT-es...`);

    try {
      const res = await consultarLoteCteFocus(ctesConsultaveis);
      setResultado(res);
      setProgresso(100);

      const autorizados = res.itens.filter((i) => i.sucesso && i.statusRetornado === "autorizado").length;
      const rejeitados = res.itens.filter((i) => i.sucesso && i.statusRetornado === "rejeitado").length;

      if (autorizados > 0) toast.success(`${autorizados} CT-es autorizados!`);
      if (rejeitados > 0) toast.warning(`${rejeitados} CT-es rejeitados.`);

      onLoteProcessado();
    } catch (err: any) {
      toast.error("Erro ao consultar lote: " + err.message);
    } finally {
      setConsultando(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "autorizado": return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Autorizado</Badge>;
      case "rejeitado": return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Rejeitado</Badge>;
      case "processando": return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Processando</Badge>;
      case "erro_emissao": return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Erro Emissao</Badge>;
      case "bloqueado": return <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">Bloqueado</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            Enviar Lote para Focus Homologação
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : !loteId ? (
          <div className="py-8 text-center text-muted-foreground">
            <Layers className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium">Nenhum lote selecionado</p>
            <p className="text-xs mt-1 max-w-[300px] mx-auto">
              Clique no botao <Send className="w-3 h-3 inline" /><Layers className="w-3 h-3 inline" /> em um CT-e da grid que possua lote_id para abrir o envio em lote.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Resumo do lote */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-700">{ctes.length}</p>
                <p className="text-xs text-blue-600">CT-es no lote</p>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-700">{aptos}</p>
                <p className="text-xs text-green-600">Aptos para envio</p>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-700">{bloqueados}</p>
                <p className="text-xs text-red-600">Bloqueados</p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <p className="text-2xl font-bold text-slate-700">{fmtFin(valorTotal)}</p>
                <p className="text-xs text-slate-600">Valor total</p>
              </div>
            </div>

            {loteId && (
              <div className="text-center">
                <Badge variant="outline" className="font-mono text-xs">Lote: {loteId}</Badge>
              </div>
            )}

            {/* Progresso */}
            {(enviando || consultando) && (
              <div className="space-y-1">
                <Progress value={progresso} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  {enviando ? "Enviando CT-es..." : "Consultando status..."}
                </p>
              </div>
            )}

            {/* Lista de CT-es */}
            <ScrollArea className="h-[300px] border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">CT-e</th>
                    <th className="p-2 text-right">Valor</th>
                    <th className="p-2 text-center">Status</th>
                    <th className="p-2 text-left">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {resultado ? (
                    resultado.itens.map((item, i) => (
                      <tr key={i} className={item.sucesso ? "hover:bg-green-50" : "hover:bg-red-50"}>
                        <td className="p-2 font-medium">{item.numero}</td>
                        <td className="p-2 text-right">
                          {ctes.find((c) => c.id === item.cteId)?.valor
                            ? fmtFin(ctes.find((c) => c.id === item.cteId)!.valor!)
                            : "-"}
                        </td>
                        <td className="p-2 text-center">{getStatusBadge(item.bloqueado ? "bloqueado" : item.statusRetornado)}</td>
                        <td className="p-2 text-[11px] max-w-[200px] truncate">
                          {item.sucesso ? (
                            <span className="text-green-600">{item.mensagem}</span>
                          ) : (
                            <span className="text-red-600">{item.mensagem}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    itensValidados.map(({ cte, bloqueios, apto }) => (
                      <tr key={cte.id} className={apto ? "hover:bg-green-50" : "hover:bg-red-50"}>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <FileSpreadsheet className="w-3 h-3 text-blue-500" />
                            <span className="font-medium">{cte.numero || "S/N"}</span>
                          </div>
                        </td>
                        <td className="p-2 text-right">{fmtFin(cte.valor || 0)}</td>
                        <td className="p-2 text-center">
                          {apto ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">
                              <CheckCircle2 className="w-3 h-3 mr-0.5" />Apto
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">
                              <XCircle className="w-3 h-3 mr-0.5" />Bloqueado
                            </Badge>
                          )}
                        </td>
                        <td className="p-2 text-[11px]">
                          {bloqueios.length > 0 ? (
                            <span className="text-red-600">{bloqueios.join("; ")}</span>
                          ) : (
                            <span className="text-green-600">Pronto para envio</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollArea>

            {/* Resumo final */}
            {resultado && (
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-green-50 border border-green-200 rounded text-center">
                  <p className="text-lg font-bold text-green-700">{resultado.enviadosComSucesso}</p>
                  <p className="text-[10px] text-green-600">Sucesso</p>
                </div>
                <div className="p-2 bg-red-50 border border-red-200 rounded text-center">
                  <p className="text-lg font-bold text-red-700">{resultado.falhas}</p>
                  <p className="text-[10px] text-red-600">Falhas</p>
                </div>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded text-center">
                  <p className="text-lg font-bold text-slate-700">{resultado.bloqueados}</p>
                  <p className="text-[10px] text-slate-600">Bloqueados</p>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {temProcessando && (
            <Button
              variant="outline"
              onClick={handleConsultarLote}
              disabled={consultando || enviando}
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              {consultando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Consultar Lote Focus
            </Button>
          )}
          {aptos > 0 && !resultado && (
            <Button
              onClick={handleEnviarLote}
              disabled={enviando || aptos === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {enviando ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Enviar {aptos} CT-es para Focus
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
