import { useState, useEffect, useMemo } from "react";
import {
  FileText, Calculator, CheckCircle2, XCircle, AlertTriangle,
  Layers, Loader2, ArrowRight, ListFilter, DollarSign,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  calcularRateio,
  type DocumentoParaRateio,
  type RateioItem,
  type RateioLoteConfig,
} from "@/services/fiscal/rateioFreteCteService";
import {
  gerarRascunhoCteLote,
  validarDocumentosParaLote,
} from "@/services/fiscal/cteLoteService";
import type { FiscalDocumentoVinculado, EnderecoRealEntrega } from "@/types/fiscal";

interface GerarLoteCteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoteGerado: () => void;
}

const fmtFin = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";

function gerarLoteId(): string {
  return `LOTE-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export default function GerarLoteCteModal({ open, onOpenChange, onLoteGerado }: GerarLoteCteModalProps) {
  const [docs, setDocs] = useState<FiscalDocumentoVinculado[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [valorTotal, setValorTotal] = useState("");
  const [regra, setRegra] = useState<"quantidade" | "peso" | "valor_nf">("quantidade");
  const [step, setStep] = useState<1 | 2>(1);
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState<{
    loteId: string; total: number; gerados: number; falhas: number; erros: string[];
  } | null>(null);

  useEffect(() => {
    if (open) {
      fetchDocs();
      setStep(1);
      setResultado(null);
      setSelectedIds(new Set());
      setValorTotal("");
    }
  }, [open]);

  const fetchDocs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fiscal_documentos_vinculados")
      .select("*")
      .in("tipo_documento", ["NFE", "nfe"])
      .order("created_at", { ascending: false })
      .limit(50);
    setDocs((data || []) as FiscalDocumentoVinculado[]);
    setLoading(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTodos = () => {
    if (selectedIds.size === docs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(docs.map((d) => d.id)));
    }
  };

  const selectedDocs = useMemo(
    () => docs.filter((d) => selectedIds.has(d.id)),
    [docs, selectedIds]
  );

  const documentosParaRateio: DocumentoParaRateio[] = useMemo(
    () =>
      selectedDocs.map((d) => {
        const meta = d.metadata || {};
        return {
          id: d.id,
          numero_nfe: d.numero || null,
          destinatario_nome: d.destinatario_nome || null,
          peso_bruto: meta.romaneio_peso ? parseFloat(meta.romaneio_peso) : (d.peso_bruto ?? null),
          valor_total: d.valor_total ?? null,
          municipio_destino: d.municipio_destino || null,
          uf_destino: d.uf_destino || null,
        };
      }),
    [selectedDocs]
  );

  const valorTotalNum = parseFloat(valorTotal) || 0;

  const rateiosCalculados = useMemo(() => {
    if (!valorTotalNum || documentosParaRateio.length === 0 || valorTotalNum <= 0) return null;
    const config: RateioLoteConfig = { regra, valorTotal: valorTotalNum };
    const { rateios, erros } = calcularRateio(documentosParaRateio, config);
    return { rateios, erros };
  }, [documentosParaRateio, valorTotalNum, regra]);

  const validacoes = useMemo(() => {
    if (selectedDocs.length === 0) return [];
    return validarDocumentosParaLote(selectedDocs);
  }, [selectedDocs]);

  const somaRateio = useMemo(() => {
    if (!rateiosCalculados?.rateios) return 0;
    return rateiosCalculados.rateios.reduce((s, r) => s + r.valorRateado, 0);
  }, [rateiosCalculados]);

  const handleAvancar = () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione pelo menos um XML/NF-e.");
      return;
    }
    if (!valorTotalNum || valorTotalNum <= 0) {
      toast.error("Informe o valor total do frete da rota.");
      return;
    }
    if (rateiosCalculados?.erros?.length) {
      toast.error(rateiosCalculados.erros[0]);
      return;
    }
    setStep(2);
  };

  const handleGerar = async () => {
    if (!rateiosCalculados?.rateios || rateiosCalculados.rateios.length === 0) {
      toast.error("Nenhum rateio calculado.");
      return;
    }

    // Bloqueios Calvo: validar antes de gerar
    // OS nao e obrigatoria se documento tem romaneio completo
    const semOrigem = selectedDocs.filter(d => {
      const meta = d.metadata || {};
      const temOs = !!d.ordem_servico_id;
      const temRomaneio = !!meta.romaneio_numero;
      const real = meta.endereco_real_entrega;
      const fonte = meta.fonte_endereco_entrega || "xml";
      const pendente = meta.pendente_conferencia_endereco !== false;
      const temEndereco = !!real?.municipio && !!real?.uf && fonte !== "xml" && !pendente;
      const temRateio = typeof meta.valor_rateio_cte === "number" && meta.valor_rateio_cte > 0;
      const romaneioCompleto = temRomaneio && temEndereco && temRateio && typeof meta.romaneio_valor_total === "number";
      return !temOs && !romaneioCompleto;
    });
    if (semOrigem.length > 0) {
      toast.error(`${semOrigem.length} NF-e(s) sem origem operacional. Vincule a uma OS ou complete os dados do romaneio.`);
      return;
    }

    const semEndereco = selectedDocs.filter(d => {
      const meta = d.metadata || {};
      const real = meta.endereco_real_entrega;
      const fonte = meta.fonte_endereco_entrega || "xml";
      const pendente = meta.pendente_conferencia_endereco !== false;
      return fonte === "xml" || pendente || !real?.municipio;
    });
    if (semEndereco.length > 0) {
      toast.error(`${semEndereco.length} NF-e(s) sem endereco real completo.`);
      return;
    }

    const invalidDocs = validacoes.filter(v => !v.valido);
    if (invalidDocs.length > 0) {
      toast.error(`${invalidDocs.length} documento(s) com pendencias. Corrija antes de gerar.`);
      return;
    }

    // Verificar soma do rateio
    if (Math.abs(somaRateio - valorTotalNum) > 0.01) {
      toast.error(`Soma do rateio (${fmtFin(somaRateio)}) difere do valor total (${fmtFin(valorTotalNum)}).`);
      return;
    }

    const loteId = gerarLoteId();
    setGerando(true);

    try {
      const res = await gerarRascunhoCteLote({
        documentosIds: selectedDocs.map((d) => d.id),
        rateios: rateiosCalculados.rateios,
        osId: selectedDocs[0]?.ordem_servico_id || null,
        valorTotalRota: valorTotalNum,
        regraRateio: regra,
        loteId,
      });

      setResultado({
        loteId: res.loteId,
        total: res.total,
        gerados: res.gerados,
        falhas: res.falhas,
        erros: res.erros,
      });

      if (res.gerados > 0) {
        toast.success(`${res.gerados} CT-es rascunho gerados com sucesso no lote ${res.loteId}!`);
        onLoteGerado();
      }
      if (res.falhas > 0) {
        toast.warning(`${res.falhas} falhas na geracao.`);
      }
    } catch (err: any) {
      toast.error("Erro ao gerar lote: " + err.message);
    } finally {
      setGerando(false);
    }
  };

  const getEnderecoEntrega = (doc: FiscalDocumentoVinculado): string => {
    const meta = doc.metadata || {};
    const real = meta.endereco_real_entrega as EnderecoRealEntrega | undefined;
    const fonte = meta.fonte_endereco_entrega || "xml";
    const pendente = meta.pendente_conferencia_endereco !== false;
    const origemValida = fonte === "romaneio" || fonte === "manual" || fonte === "romaneio_manual";

    if (real?.municipio && real?.uf && origemValida && !pendente) {
      const completo = meta.endereco_completo || real.enderecoCompleto || real.endereco_completo;
      if (completo && completo.trim().length > 10) return completo.trim();
      const partes = [
        real.logradouro,
        real.numero ? `, ${real.numero}` : "",
      ];
      if (real.bairro) partes.push(` - ${real.bairro}`);
      if (real.municipio) partes.push(` - ${real.municipio}/${real.uf}`);
      if (real.cep) partes.push(` - CEP ${real.cep}`);
      return partes.join("");
    }
    if (doc.municipio_destino && doc.uf_destino) {
      return `${doc.municipio_destino}/${doc.uf_destino} (XML)`;
    }
    return "-";
  };

  const getMunicipioDestino = (doc: FiscalDocumentoVinculado): string => {
    const meta = doc.metadata || {};
    const real = meta.endereco_real_entrega as EnderecoRealEntrega | undefined;
    const fonte = meta.fonte_endereco_entrega || "xml";
    const pendente = meta.pendente_conferencia_endereco !== false;
    const origemValida = fonte === "romaneio" || fonte === "manual" || fonte === "romaneio_manual";

    if (real?.municipio && real?.uf && origemValida && !pendente) {
      return `${real.municipio}/${real.uf}`;
    }
    if (doc.municipio_destino && doc.uf_destino) {
      return `${doc.municipio_destino}/${doc.uf_destino} (XML)`;
    }
    return "-";
  };

  const getValorRateioCte = (doc: FiscalDocumentoVinculado): number | null => {
    const meta = doc.metadata || {};
    if (typeof meta.valor_rateio_cte === "number") return meta.valor_rateio_cte;
    return null;
  };

  const getFonteBadge = (doc: FiscalDocumentoVinculado) => {
    const fonte = doc.metadata?.fonte_endereco_entrega || "xml";
    if (fonte === "romaneio") return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Romaneio</Badge>;
    if (fonte === "manual") return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">Manual</Badge>;
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">XML (fiscal)</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            Gerar CT-es em Lote — Rateio de Frete
          </DialogTitle>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-700">{resultado.total}</p>
                <p className="text-xs text-blue-600">Total XMLs</p>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-700">{resultado.gerados}</p>
                <p className="text-xs text-green-600">CT-es Gerados</p>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-700">{resultado.falhas}</p>
                <p className="text-xs text-red-600">Falhas</p>
              </div>
            </div>
            <div className="text-center">
              <Badge className="font-mono text-xs">Lote: {resultado.loteId}</Badge>
            </div>
            {resultado.erros.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 space-y-1">
                {resultado.erros.map((e, i) => (
                  <div key={i} className="flex items-start gap-1">
                    <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span>{e}</span>
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : step === 1 ? (
          <>
            <div className="space-y-4 py-2">
              {/* Selecao de XMLs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold">Selecionar XMLs/NF-es ({selectedIds.size})</Label>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={toggleTodos}>
                    {selectedIds.size === docs.length ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                </div>
                <ScrollArea className="h-[200px] border rounded-md">
                  {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                  ) : docs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">Nenhum XML importado.</div>
                  ) : (
                    <div className="divide-y">
                      {docs.map((doc) => (
                        <label
                          key={doc.id}
                          className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 transition-colors ${selectedIds.has(doc.id) ? "bg-blue-50" : ""}`}
                        >
                          <Checkbox
                            checked={selectedIds.has(doc.id)}
                            onCheckedChange={() => toggleSelect(doc.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-orange-500 flex-shrink-0" />
                              <span className="font-medium text-sm truncate">
                                NF-e {doc.numero || "S/N"}
                              </span>
                              {getFonteBadge(doc)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {doc.destinatario_nome || "Sem destinatario"} — {getEnderecoEntrega(doc)}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Configuracao Rateio */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Valor Total do Frete da Rota *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={valorTotal}
                      onChange={(e) => setValorTotal(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm">Regra de Rateio</Label>
                  <Select value={regra} onValueChange={(v) => setRegra(v as typeof regra)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quantidade">Por Quantidade (igual)</SelectItem>
                      <SelectItem value="peso">Por Peso</SelectItem>
                      <SelectItem value="valor_nf">Por Valor da NF-e</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {rateiosCalculados && rateiosCalculados.rateios.length > 0 && (
                <div className="p-3 bg-slate-50 border rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Valor por entrega (aprox.):</span>
                    <span className="font-semibold">{fmtFin(valorTotalNum / selectedIds.size)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Soma conferida:</span>
                    <span className={`font-semibold ${Math.abs(somaRateio - valorTotalNum) > 0.01 ? "text-red-600" : "text-green-600"}`}>
                      {fmtFin(somaRateio)}
                    </span>
                  </div>
                </div>
              )}

              {validacoes.some((v) => !v.valido) && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-semibold text-red-700">Pendencias detectadas</span>
                  </div>
                  {validacoes.filter((v) => !v.valido).map((v) => (
                    <div key={v.docId} className="text-xs text-red-600 ml-6">
                      <span className="font-medium">NF-e {v.numeroNfe || "S/N"}:</span>{" "}
                      {v.erros.join("; ")}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleAvancar} disabled={selectedIds.size === 0 || !valorTotalNum}>
                Avancar para Previa <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-4 flex-wrap">
                <Badge variant="outline" className="text-sm py-1.5">
                  <Layers className="w-4 h-4 mr-1" /> {selectedDocs.length} XMLs
                </Badge>
                <Badge variant="outline" className="text-sm py-1.5">
                  <DollarSign className="w-4 h-4 mr-1" /> {fmtFin(valorTotalNum)}
                </Badge>
                <Badge className="bg-blue-100 text-blue-700 text-sm py-1.5">
                  <Calculator className="w-4 h-4 mr-1" /> Rateio: {regra === "quantidade" ? "Quantidade" : regra === "peso" ? "Peso" : "Valor NF"}
                </Badge>
                <Badge variant="outline" className={`text-sm py-1.5 ${Math.abs(somaRateio - valorTotalNum) > 0.01 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                  Soma: {fmtFin(somaRateio)}
                </Badge>
              </div>

              <ScrollArea className="h-[350px] border rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr>
                      <th className="p-2 text-left font-semibold">NF-e</th>
                      <th className="p-2 text-left font-semibold">End. Real (Observacao)</th>
                      <th className="p-2 text-left font-semibold">Destino</th>
                      <th className="p-2 text-left font-semibold">Fonte</th>
                      <th className="p-2 text-right font-semibold">Valor CT-e</th>
                      <th className="p-2 text-center font-semibold">OK</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedDocs.map((doc, idx) => {
                      const rateio = rateiosCalculados?.rateios?.find((r) => r.documentoId === doc.id);
                      const val = validacoes.find((v) => v.docId === doc.id);
                      const meta = doc.metadata || {};
                      const valorMeta = getValorRateioCte(doc);
                      const valorExibicao = valorMeta ?? rateio?.valorRateado;
                      const enderecoCompleto = getEnderecoEntrega(doc);
                      const municipioDestino = getMunicipioDestino(doc);
                      const temOs = !!doc.ordem_servico_id;
                      const temRomaneio = !!meta.romaneio_numero;
                      const romaneioCompleto = temRomaneio && temEndereco && valorMeta !== null && typeof meta.romaneio_valor_total === "number";
                      const origemOk = temOs || romaneioCompleto;
                      const bloqueios: string[] = [];
                      if (!origemOk) {
                        if (temRomaneio && !romaneioCompleto) {
                          bloqueios.push("romaneio incompleto");
                        } else {
                          bloqueios.push("sem origem");
                        }
                      }
                      if (!temEndereco) bloqueios.push("sem endereco real");
                      if (valorMeta === null && !rateio) bloqueios.push("sem rateio");
                      const docOk = val?.valido && origemOk && temEndereco && bloqueios.length === 0;
                      return (
                        <tr key={doc.id} className={`hover:bg-slate-50 ${!docOk ? "bg-red-50/50" : ""}`}>
                          <td className="p-2 font-medium">
                            {doc.numero || "S/N"}
                            {!origemOk && <span className="text-[10px] text-red-500 block">sem origem</span>}
                            {!temOs && romaneioCompleto && <span className="text-[10px] text-blue-500 block">romaneio</span>}
                          </td>
                          <td className="p-2 max-w-[250px] truncate text-[11px]">
                            {temEndereco ? (
                              <span className="text-green-700">{enderecoCompleto}</span>
                            ) : (
                              <span className="text-red-400">{enderecoCompleto}</span>
                            )}
                          </td>
                          <td className="p-2">{municipioDestino}</td>
                          <td className="p-2">{getFonteBadge(doc)}</td>
                          <td className="p-2 text-right font-semibold">
                            {valorExibicao != null ? (
                              <>
                                {fmtFin(valorExibicao)}
                                {valorMeta !== null && (
                                  <span className="text-[10px] text-green-600 block">(romaneio)</span>
                                )}
                              </>
                            ) : (
                              <span className="text-red-400">-</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {docOk ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                            ) : (
                              <div className="flex flex-col items-center gap-0.5">
                                <XCircle className="w-4 h-4 text-red-500" />
                                {bloqueios.map((b, bi) => (
                                  <span key={bi} className="text-[9px] text-red-500">{b}</span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollArea>

              {/* Bloqueios resumidos */}
              {(() => {
                const semOrigem = selectedDocs.filter(d => {
                  const meta = d.metadata || {};
                  const temOs = !!d.ordem_servico_id;
                  const temRomaneio = !!meta.romaneio_numero;
                  const real = meta.endereco_real_entrega;
                  const fonte = meta.fonte_endereco_entrega || "xml";
                  const pendente = meta.pendente_conferencia_endereco !== false;
                  const temEndereco = !!real?.municipio && !!real?.uf && fonte !== "xml" && !pendente;
                  const temRateio = typeof meta.valor_rateio_cte === "number" && meta.valor_rateio_cte > 0;
                  const romaneioCompleto = temRomaneio && temEndereco && temRateio && typeof meta.romaneio_valor_total === "number";
                  return !temOs && !romaneioCompleto;
                }).length;
                const porRomaneio = selectedDocs.filter(d => {
                  const meta = d.metadata || {};
                  const temOs = !!d.ordem_servico_id;
                  const temRomaneio = !!meta.romaneio_numero;
                  const real = meta.endereco_real_entrega;
                  const fonte = meta.fonte_endereco_entrega || "xml";
                  const pendente = meta.pendente_conferencia_endereco !== false;
                  const temEndereco = !!real?.municipio && !!real?.uf && fonte !== "xml" && !pendente;
                  const temRateio = typeof meta.valor_rateio_cte === "number" && meta.valor_rateio_cte > 0;
                  const romaneioCompleto = temRomaneio && temEndereco && temRateio && typeof meta.romaneio_valor_total === "number";
                  return !temOs && romaneioCompleto;
                }).length;
                const semEndereco = selectedDocs.filter(d => {
                  const meta = d.metadata || {};
                  const real = meta.endereco_real_entrega;
                  const fonte = meta.fonte_endereco_entrega || "xml";
                  const pendente = meta.pendente_conferencia_endereco !== false;
                  return fonte === "xml" || pendente || !real?.municipio;
                }).length;
                const semRateio = selectedDocs.filter(d => {
                  const meta = d.metadata || {};
                  return typeof meta.valor_rateio_cte !== "number";
                }).length;
                const totalBloqueios = semOrigem + semEndereco + semRateio;

                if (totalBloqueios > 0 || porRomaneio > 0) {
                  return (
                    <div className={`p-3 border rounded-lg text-xs space-y-1 ${totalBloqueios > 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-blue-50 border-blue-200 text-blue-700"}`}>
                      {totalBloqueios > 0 && (
                        <div className="flex items-center gap-2 font-semibold">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          Bloqueios detectados ({totalBloqueios}):
                        </div>
                      )}
                      {semOrigem > 0 && <div className="ml-6">• {semOrigem} NF-e(s) sem origem operacional — vincule OS ou complete romaneio</div>}
                      {porRomaneio > 0 && <div className="ml-6 text-blue-700">• {porRomaneio} NF-e(s) usam Romaneio/Faturamento como origem (OK para Calvo)</div>}
                      {semEndereco > 0 && <div className="ml-6">• {semEndereco} NF-e(s) sem endereco real completo</div>}
                      {semRateio > 0 && <div className="ml-6">• {semRateio} NF-e(s) sem valor_rateio_cte no metadata</div>}
                    </div>
                  );
                }
                return null;
              })()}

              {rateiosCalculados?.erros?.length ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  {rateiosCalculados.erros.map((e, i) => (
                    <div key={i} className="flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span>{e}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button
                onClick={handleGerar}
                disabled={gerando || !rateiosCalculados?.rateios?.length || rateiosCalculados?.erros?.length > 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {gerando ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Layers className="w-4 h-4 mr-2" />
                )}
                Gerar {selectedDocs.length} CT-es Rascunho
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
