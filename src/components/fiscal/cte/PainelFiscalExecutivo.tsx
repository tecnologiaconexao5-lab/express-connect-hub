import { useState, useEffect } from "react";
import {
  BarChart3, CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw,
  FileSpreadsheet, DollarSign, Layers, ListChecks, ShieldAlert, ArrowRight,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  obterIndicadoresFiscaisCte,
  auditarProntidaoProducaoFiscal,
  type IndicadoresFiscais,
  type AuditoriaProntidaoResult,
  type ItemChecklistProducao,
} from "@/services/fiscal/focusService";

interface PainelFiscalExecutivoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAbrirAssistenteLote?: (loteId: string) => void;
}

const fmtFin = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";

const statusBadge = (s: string) => {
  const m: Record<string, string> = { ok: "bg-green-100 text-green-700 border-green-200", atencao: "bg-amber-100 text-amber-700 border-amber-200", bloqueado: "bg-red-100 text-red-700 border-red-200", nao_validado: "bg-slate-100 text-slate-500 border-slate-200" };
  return <Badge className={(m[s] || "") + " text-[10px]"}>{s === "ok" ? "OK" : s === "atencao" ? "Atencao" : s === "bloqueado" ? "Bloqueado" : "Nao validado"}</Badge>;
};

export default function PainelFiscalExecutivo({ open, onOpenChange, onAbrirAssistenteLote }: PainelFiscalExecutivoProps) {
  const [loading, setLoading] = useState(false);
  const [indicadores, setIndicadores] = useState<IndicadoresFiscais | null>(null);
  const [auditoria, setAuditoria] = useState<AuditoriaProntidaoResult | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<"indicadores" | "checklist">("indicadores");

  const carregar = async () => {
    setLoading(true);
    try {
      const [ind, aud] = await Promise.all([obterIndicadoresFiscaisCte(), auditarProntidaoProducaoFiscal()]);
      setIndicadores(ind); setAuditoria(aud);
    } catch (e: any) { toast.error("Erro ao carregar: " + e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) carregar(); }, [open]);

  const totalCtes = indicadores?.total || 0;
  const maxStatus = Math.max(...Object.values(indicadores?.porStatus || {}), 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Painel Fiscal Executivo
            <Badge variant="outline" className="ml-2 text-xs">Homologacao</Badge>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Abas */}
            <div className="flex gap-2 border-b pb-2">
              <Button variant={abaAtiva === "indicadores" ? "default" : "ghost"} size="sm" onClick={() => setAbaAtiva("indicadores")}><BarChart3 className="w-4 h-4 mr-1" />Indicadores</Button>
              <Button variant={abaAtiva === "checklist" ? "default" : "ghost"} size="sm" onClick={() => setAbaAtiva("checklist")}><ShieldAlert className="w-4 h-4 mr-1" />Checklist Producao</Button>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={carregar}><RefreshCw className="w-4 h-4 mr-1" />Atualizar</Button>
            </div>

            {abaAtiva === "indicadores" && indicadores && (
              <>
                {/* Alertas */}
                {(indicadores.pendencias.rejeitados > 0 || indicadores.pendencias.autorizadosSemDocumentos > 0 || indicadores.pendencias.enderecoPendente > 0) && (
                  <div className="space-y-1">
                    {indicadores.pendencias.rejeitados > 0 && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
                        <XCircle className="w-4 h-4" />{indicadores.pendencias.rejeitados} CT-es rejeitados precisam de correcao.
                      </div>
                    )}
                    {indicadores.pendencias.autorizadosSemDocumentos > 0 && (
                      <div className="p-2 bg-purple-50 border border-purple-200 rounded text-xs text-purple-700 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />{indicadores.pendencias.autorizadosSemDocumentos} CT-es autorizados sem XML/DACTE salvo.
                      </div>
                    )}
                    {indicadores.pendencias.enderecoPendente > 0 && (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />{indicadores.pendencias.enderecoPendente} CT-es com endereco pendente.
                      </div>
                    )}
                  </div>
                )}

                {/* Cards principais */}
                <div className="grid grid-cols-4 gap-2">
                  <MiniCard label="Total CT-es" value={indicadores.total} color="text-blue-600" bg="bg-blue-50" />
                  <MiniCard label="Valor Total" value={fmtFin(indicadores.valorTotal)} color="text-green-600" bg="bg-green-50" />
                  <MiniCard label="Autorizados" value={indicadores.porStatus.autorizado} color="text-green-600" bg="bg-green-50" />
                  <MiniCard label="Rejeitados" value={indicadores.porStatus.rejeitado} color="text-red-600" bg="bg-red-50" />
                  <MiniCard label="Processando" value={indicadores.porStatus.processando} color="text-amber-600" bg="bg-amber-50" />
                  <MiniCard label="Rascunho" value={indicadores.porStatus.rascunho} color="text-slate-600" bg="bg-slate-50" />
                  <MiniCard label="XML Pendente" value={indicadores.documentos.pendentesXml} color="text-purple-600" bg="bg-purple-50" />
                  <MiniCard label="Lotes Completos" value={indicadores.lotes.completos} color="text-blue-600" bg="bg-blue-50" />
                </div>

                {/* Barras de status */}
                <div className="p-3 bg-slate-50 border rounded-lg">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Distribuicao por Status</p>
                  <div className="space-y-1.5">
                    {[{ k: "rascunho", l: "Rascunho", c: "bg-slate-400" }, { k: "processando", l: "Processando", c: "bg-amber-400" }, { k: "autorizado", l: "Autorizado", c: "bg-green-500" }, { k: "rejeitado", l: "Rejeitado", c: "bg-red-500" }, { k: "erro_emissao", l: "Erro", c: "bg-red-700" }].map(({ k, l, c }) => {
                      const v = (indicadores.porStatus as any)[k] || 0;
                      const pct = totalCtes > 0 ? (v / totalCtes) * 100 : 0;
                      return v > 0 ? (
                        <div key={k} className="flex items-center gap-2">
                          <span className="text-[10px] w-16 text-slate-500">{l}</span>
                          <div className="flex-1 h-4 bg-slate-200 rounded-full overflow-hidden">
                            <div className={`h-full ${c} rounded-full transition-all`} style={{ width: `${Math.max(pct, 2)}%` }} />
                          </div>
                          <span className="text-[10px] font-semibold w-8 text-right">{v}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>

                {/* Tabela de lotes */}
                {indicadores.lotes.totalLotes > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-1">Lotes Fiscais ({indicadores.lotes.totalLotes})</p>
                    <ScrollArea className="h-[200px] border rounded-md">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100 sticky top-0"><tr><th className="p-2 text-left">Lote</th><th className="p-2 text-left">Cliente</th><th className="p-2 text-right">CT-es</th><th className="p-2 text-right">Valor</th><th className="p-2 text-center">Status</th><th className="p-2 text-center">Acao</th></tr></thead>
                        <tbody className="divide-y">
                          {indicadores.clientes.slice(0, 10).map((cli) => (
                            <tr key={cli.clienteId} className="hover:bg-slate-50">
                              <td className="p-2 font-mono text-[10px]">{cli.clienteId.substring(0, 8)}</td>
                              <td className="p-2">{cli.nome}</td>
                              <td className="p-2 text-right">{cli.total}</td>
                              <td className="p-2 text-right">{fmtFin(cli.valorTotal)}</td>
                              <td className="p-2 text-center">{cli.rejeitados > 0 ? <Badge className="bg-red-100 text-red-700 text-[10px]">Com rejeicoes</Badge> : <Badge className="bg-green-100 text-green-700 text-[10px]">Ativo</Badge>}</td>
                              <td className="p-2 text-center">
                                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => onOpenChange(false)}><Eye className="w-3 h-3 mr-0.5" />Abrir</Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  </div>
                )}
              </>
            )}

            {abaAtiva === "checklist" && auditoria && (
              <div className="space-y-3">
                <div className={`p-3 border rounded-lg flex items-center gap-3 ${auditoria.statusGeral === "candidato_producao" ? "bg-green-50 border-green-200" : auditoria.statusGeral === "parcial" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
                  <ShieldAlert className={`w-6 h-6 ${auditoria.statusGeral === "candidato_producao" ? "text-green-600" : "text-red-600"}`} />
                  <div>
                    <p className="font-semibold text-sm">{auditoria.statusGeral === "candidato_producao" ? "Modulo fiscal pronto para homologacao" : auditoria.statusGeral === "parcial" ? "Modulo parcialmente pronto" : "Modulo NAO pronto para producao"}</p>
                    <p className="text-xs text-slate-600">{auditoria.bloqueios.length} bloqueio(s) ativo(s)</p>
                  </div>
                </div>

                {auditoria.bloqueios.length > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs space-y-1">
                    <p className="font-semibold text-red-800">Bloqueios para producao:</p>
                    {auditoria.bloqueios.map((b, i) => <div key={i} className="flex items-center gap-1 text-red-700"><XCircle className="w-3 h-3" />{b}</div>)}
                  </div>
                )}

                {auditoria.recomendacoes.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1">
                    <p className="font-semibold text-amber-800">Recomendacoes:</p>
                    {auditoria.recomendacoes.map((r, i) => <div key={i} className="flex items-start gap-1 text-amber-700"><ArrowRight className="w-3 h-3 mt-0.5 flex-shrink-0" />{r}</div>)}
                  </div>
                )}

                <ScrollArea className="h-[350px] border rounded-md">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 sticky top-0"><tr><th className="p-2 text-left">Item</th><th className="p-2 text-center">Status</th><th className="p-2 text-left">Detalhe</th></tr></thead>
                    <tbody className="divide-y">
                      {auditoria.itens.map((item) => (
                        <tr key={item.chave} className="hover:bg-slate-50">
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              {item.bloqueiaProducao && <ShieldAlert className="w-3 h-3 text-red-400" />}
                              <span className="font-medium">{item.titulo}</span>
                            </div>
                          </td>
                          <td className="p-2 text-center">{statusBadge(item.status)}</td>
                          <td className="p-2 text-[10px] text-slate-600">{(item.evidencia ? item.evidencia + " — " : "") + item.descricao}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MiniCard({ label, value, color, bg }: { label: string; value: any; color: string; bg: string }) {
  return (
    <div className={`p-3 rounded-lg border ${bg}`}>
      <p className={`text-lg font-bold ${color}`}>{typeof value === "number" ? value : value}</p>
      <p className={`text-[10px] ${color} opacity-70`}>{label}</p>
    </div>
  );
}
