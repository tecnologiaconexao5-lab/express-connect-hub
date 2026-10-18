import { useState, useEffect, useMemo } from "react";
import {
  FileText, CheckCircle2, XCircle, AlertTriangle, Eye,
  Loader2, Layers, DollarSign, MapPin, Hash, RefreshCw,
  ChevronDown, ChevronRight, SendHorizontal, Search, Calculator, Pencil,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  gerarRascunhoCteLote,
  validarDocumentosParaLote,
} from "@/services/fiscal/cteLoteService";
import type { EnderecoRealEntrega } from "@/types/fiscal";

interface PreviaRomaneioCteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoteGerado: () => void;
}

const fmtFin = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";
const fmtCep = (cep: string) => cep?.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep || "";
const fmtNum = (v: number, decimals = 2) => v?.toFixed(decimals) || "0.00";

function gerarLoteId(): string {
  return `LOTE-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

type FormaRateio =
  | "pdf"
  | "valor_nf"
  | "peso"
  | "volumes"
  | "igual"
  | "manual_linha";

const FORMAS_RATEIO: { value: FormaRateio; label: string }[] = [
  { value: "pdf", label: "Rateio do PDF / metadata.valor_rateio_cte" },
  { value: "valor_nf", label: "Proporcional ao valor da NF-e" },
  { value: "peso", label: "Proporcional ao peso" },
  { value: "volumes", label: "Proporcional aos volumes" },
  { value: "igual", label: "Igual por NF-e" },
  { value: "manual_linha", label: "Manual por NF-e (editar linha a linha)" },
];

interface DocPrevia {
  id: string;
  numero: string | null;
  chave_acesso: string | null;
  destinatario_nome: string | null;
  emitente_nome: string | null;
  valor_total: number | null;
  ordem_servico_id: string | null;
  peso_bruto: number | null;
  volumes: number | null;
  metadata: Record<string, any>;
  validacao: {
    temOs: boolean;
    temEndereco: boolean;
    temRateio: boolean;
    fonteValida: boolean;
    naoPendente: boolean;
    municipioOk: boolean;
    ibgeOk: boolean;
    origemOk: boolean;
    origemOperacional: string;
    romaneioCompleto: boolean;
    temRomaneio: boolean;
    bloqueios: string[];
    valido: boolean;
  };
  enderecoReal: EnderecoRealEntrega | null;
  enderecoCompleto: string;
  municipioDestino: string;
  valorRateioPdf: number | null;
  valorRateioCalculado: number | null;
  observacao: string;
  codigoIbge: string | null;
}

export default function PreviaRomaneioCteModal({
  open,
  onOpenChange,
  onLoteGerado,
}: PreviaRomaneioCteModalProps) {
  const [romaneioBusca, setRomaneioBusca] = useState("340612");
  const [romaneios, setRomaneios] = useState<string[]>([]);
  const [romaneioSelecionado, setRomaneioSelecionado] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocPrevia[]>([]);
  const [loading, setLoading] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [linhaExpandida, setLinhaExpandida] = useState<string | null>(null);
  const [filtroNumero, setFiltroNumero] = useState("");
  const [resultado, setResultado] = useState<{
    loteId: string; total: number; gerados: number; falhas: number; erros: string[];
  } | null>(null);

  // Rateio config
  const [valorTotalManual, setValorTotalManual] = useState("");
  const [formaRateio, setFormaRateio] = useState<FormaRateio>("pdf");
  const [editandoValorTotal, setEditandoValorTotal] = useState(false);
  const [rateioManual, setRateioManual] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      carregarRomaneios();
      setResultado(null);
      setLinhaExpandida(null);
      setEditandoValorTotal(false);
      setRateioManual({});
    }
  }, [open]);

  // Auto-detect: usar PDF se todos tem valor_rateio_cte
  useEffect(() => {
    if (docs.length > 0) {
      const todosTemRateio = docs.every(d => d.valorRateioPdf !== null && d.valorRateioPdf > 0);
      if (todosTemRateio) {
        setFormaRateio("pdf");
        const totalPdf = docs.reduce((s, d) => s + (d.valorRateioPdf || 0), 0);
        setValorTotalManual(fmtNum(totalPdf));
        setEditandoValorTotal(false);
      }
    }
  }, [docs]);

  const carregarRomaneios = async () => {
    try {
      const { data } = await supabase
        .from("fiscal_documentos_vinculados")
        .select("metadata->romaneio_numero")
        .not("metadata->romaneio_numero", "is", null);
      if (data) {
        const numeros = [...new Set(
          data.map((d: any) => d.romaneio_numero).filter(Boolean).filter((n: string) => n.trim().length > 0)
        )].sort((a: string, b: string) => b.localeCompare(a));
        setRomaneios(numeros as string[]);
      }
    } catch (err: any) { console.error("Erro ao carregar romaneios:", err); }
  };

  const processarDocumento = (doc: any): DocPrevia => {
    const meta = doc.metadata || {};
    const real = meta.endereco_real_entrega as EnderecoRealEntrega | undefined;
    const fonte = meta.fonte_endereco_entrega || "xml";
    const pendente = meta.pendente_conferencia_endereco !== false;
    const valorRateioPdf = typeof meta.valor_rateio_cte === "number" ? meta.valor_rateio_cte : null;
    const codigoIbge = real?.codigo_ibge || "3550308";
    const pesoBruto = meta.romaneio_peso ? parseFloat(meta.romaneio_peso) : (doc.peso_bruto ?? null);
    const volumes = meta.romaneio_caixas ? parseInt(meta.romaneio_caixas, 10) : (doc.volumes ?? null);

    const completo = meta.endereco_completo || real?.enderecoCompleto || real?.endereco_completo || "";
    const enderecoCompleto = completo.trim().length > 10 ? completo.trim() : [
      real?.logradouro,
      real?.numero ? `, ${real.numero}` : "",
      real?.bairro ? ` - ${real.bairro}` : "",
      real?.municipio ? ` - ${real.municipio}/${real.uf}` : "",
      real?.cep ? ` - CEP ${fmtCep(real.cep)}` : "",
    ].join("");

    const municipioDestino = (real?.municipio && real?.uf)
      ? `${real.municipio}/${real.uf}`
      : `${doc.municipio_destino || "?"}/${doc.uf_destino || "?"}`;

    const observacao = enderecoCompleto ? `ENTREGA: ${enderecoCompleto}` : "";

    const bloqueios: string[] = [];
    const temOs = !!doc.ordem_servico_id;
    const temEndereco = !!real?.municipio && !!real?.uf && fonte !== "xml" && !pendente;
    const temRateio = valorRateioPdf !== null && valorRateioPdf > 0;
    const fonteValida = fonte !== "xml";
    const naoPendente = !pendente;
    const municipioOk = !!real?.municipio && !!real?.uf;
    const ibgeOk = !!codigoIbge;
    const temRomaneio = !!meta.romaneio_numero;
    const romaneioCompleto = temRomaneio && temEndereco && temRateio && typeof meta.romaneio_valor_total === "number";
    const origemOk = temOs || romaneioCompleto;
    const origemOperacional = temOs ? "OS" : romaneioCompleto ? "Romaneio/Faturamento" : "Nenhuma";

    if (!origemOk) {
      if (!temOs && temRomaneio && !romaneioCompleto) bloqueios.push("Romaneio incompleto (faltam dados fiscais)");
      else bloqueios.push("Sem OS vinculada e sem romaneio completo");
    }
    if (!temEndereco) {
      if (fonte === "xml") bloqueios.push("Fonte endereco = XML (fiscal)");
      if (pendente) bloqueios.push("Endereco pendente de conferencia");
      if (!real?.municipio) bloqueios.push("Municipio destino ausente");
    }
    if (!ibgeOk) bloqueios.push("Sem codigo IBGE");

    return {
      id: doc.id, numero: doc.numero || null, chave_acesso: doc.chave_acesso || null,
      destinatario_nome: doc.destinatario_nome || null, emitente_nome: doc.emitente_nome || null,
      valor_total: doc.valor_total ?? null, ordem_servico_id: doc.ordem_servico_id || null,
      peso_bruto: pesoBruto, volumes, metadata: meta,
      validacao: {
        temOs, temEndereco, temRateio, fonteValida, naoPendente, municipioOk, ibgeOk,
        origemOk, origemOperacional, romaneioCompleto, temRomaneio,
        bloqueios, valido: bloqueios.length === 0,
      },
      enderecoReal: real || null, enderecoCompleto, municipioDestino,
      valorRateioPdf, valorRateioCalculado: valorRateioPdf,
      observacao, codigoIbge,
    };
  };

  const buscarDocumentos = async (numeroRomaneio: string) => {
    setLoading(true);
    setRomaneioSelecionado(numeroRomaneio);
    setResultado(null);
    setLinhaExpandida(null);
    setRateioManual({});
    try {
      const { data } = await supabase
        .from("fiscal_documentos_vinculados")
        .select("*")
        .filter("metadata->>romaneio_numero", "eq", numeroRomaneio)
        .order("numero", { ascending: true });
      setDocs(data ? data.map(processarDocumento) : []);
    } catch (err: any) { toast.error("Erro ao buscar documentos: " + err.message); }
    finally { setLoading(false); }
  };

  // ── Cálculo de rateio ────────────────────────────────────────
  const valorTotalNum = parseFloat(valorTotalManual) || 0;

  const rateiosCalculados = useMemo(() => {
    if (docs.length === 0 || valorTotalNum <= 0) return null;

    const resultados: { docId: string; valor: number }[] = [];

    switch (formaRateio) {
      case "pdf": {
        // Usa metadata.valor_rateio_cte se existir; senão usa valorTotalNum / n como fallback
        const temTodos = docs.every(d => d.valorRateioPdf !== null && d.valorRateioPdf > 0);
        if (temTodos) {
          for (const d of docs) resultados.push({ docId: d.id, valor: d.valorRateioPdf! });
        } else {
          const porDoc = valorTotalNum / docs.length;
          for (const d of docs) {
            resultados.push({ docId: d.id, valor: d.valorRateioPdf ?? porDoc });
          }
        }
        break;
      }
      case "valor_nf": {
        const totalNf = docs.reduce((s, d) => s + (d.valor_total || 0), 0);
        if (totalNf <= 0) {
          const porDoc = valorTotalNum / docs.length;
          for (const d of docs) resultados.push({ docId: d.id, valor: porDoc });
        } else {
          for (const d of docs) {
            const prop = (d.valor_total || 0) / totalNf;
            resultados.push({ docId: d.id, valor: parseFloat((valorTotalNum * prop).toFixed(2)) });
          }
        }
        break;
      }
      case "peso": {
        const totalPeso = docs.reduce((s, d) => s + (d.peso_bruto || 0), 0);
        if (totalPeso <= 0) {
          const porDoc = valorTotalNum / docs.length;
          for (const d of docs) resultados.push({ docId: d.id, valor: porDoc });
        } else {
          for (const d of docs) {
            const prop = (d.peso_bruto || 0) / totalPeso;
            resultados.push({ docId: d.id, valor: parseFloat((valorTotalNum * prop).toFixed(2)) });
          }
        }
        break;
      }
      case "volumes": {
        const totalVol = docs.reduce((s, d) => s + (d.volumes || 0), 0);
        if (totalVol <= 0) {
          const porDoc = valorTotalNum / docs.length;
          for (const d of docs) resultados.push({ docId: d.id, valor: porDoc });
        } else {
          for (const d of docs) {
            const prop = (d.volumes || 0) / totalVol;
            resultados.push({ docId: d.id, valor: parseFloat((valorTotalNum * prop).toFixed(2)) });
          }
        }
        break;
      }
      case "igual": {
        const porDoc = parseFloat((valorTotalNum / docs.length).toFixed(2));
        for (let i = 0; i < docs.length; i++) {
          resultados.push({ docId: docs[i].id, valor: i === docs.length - 1
            ? parseFloat((valorTotalNum - porDoc * (docs.length - 1)).toFixed(2))
            : porDoc });
        }
        break;
      }
      case "manual_linha": {
        for (const d of docs) {
          const manual = parseFloat(rateioManual[d.id] || "0") || 0;
          resultados.push({ docId: d.id, valor: manual });
        }
        break;
      }
    }

    return resultados;
  }, [docs, valorTotalNum, formaRateio, rateioManual]);

  // Aplicar rateios calculados aos documentos
  const docsComRateio = useMemo(() => {
    if (!rateiosCalculados) return docs;
    const map = new Map(rateiosCalculados.map(r => [r.docId, r.valor]));
    return docs.map(d => ({ ...d, valorRateioCalculado: map.get(d.id) ?? d.valorRateioPdf }));
  }, [docs, rateiosCalculados]);

  const somaRateio = useMemo(() => {
    return docsComRateio.reduce((s, d) => s + (d.valorRateioCalculado || 0), 0);
  }, [docsComRateio]);

  const diferenca = Math.abs(somaRateio - valorTotalNum);
  const somaOk = valorTotalNum > 0 && diferenca <= 0.02;

  // Bloqueios considerando rateio
  const totalBloqueios = useMemo(() => {
    return docsComRateio.filter(d => {
      const b = [...d.validacao.bloqueios];
      if (d.valorRateioCalculado === null || d.valorRateioCalculado <= 0) b.push("Valor rateio zerado ou ausente");
      if (formaRateio === "manual_linha" && !rateioManual[d.id]) b.push("Rateio manual nao informado");
      return b.length > 0;
    }).length + (!somaOk && valorTotalNum > 0 ? 1 : 0);
  }, [docsComRateio, somaOk, valorTotalNum, formaRateio, rateioManual]);

  const totalOk = docs.length - totalBloqueios;

  const docsFiltrados = useMemo(() => {
    if (!filtroNumero) return docsComRateio;
    return docsComRateio.filter(d => d.numero?.includes(filtroNumero));
  }, [docsComRateio, filtroNumero]);

  const handleRevalidar = () => {
    if (romaneioSelecionado) buscarDocumentos(romaneioSelecionado);
  };

  const handleAlterarValorTotal = () => {
    setEditandoValorTotal(true);
  };

  const handleGerarRascunhos = async () => {
    if (totalBloqueios > 0) {
      toast.error(`${totalBloqueios} bloqueio(s) detectado(s). Corrija antes de gerar.`);
      return;
    }
    if (docs.length === 0) { toast.error("Nenhum documento para gerar."); return; }
    if (valorTotalNum <= 0) { toast.error("Informe o valor total do frete."); return; }
    if (!rateiosCalculados || rateiosCalculados.length === 0) { toast.error("Nenhum rateio calculado."); return; }
    if (!somaOk) { toast.error(`Soma diverge: ${fmtFin(somaRateio)} vs ${fmtFin(valorTotalNum)}`); return; }

    // Verificar valores zerados
    const zerados = rateiosCalculados.filter(r => r.valor <= 0);
    if (zerados.length > 0) { toast.error(`${zerados.length} CT-e(s) com valor zerado.`); return; }

    const loteId = gerarLoteId();
    setGerando(true);
    try {
      const rateios = rateiosCalculados.map((r, idx) => ({
        documentoId: r.docId,
        valorRateado: r.valor,
        peso: null as any,
        proporcao: 1 / docs.length,
        ajuste: 0,
      }));

      const res = await gerarRascunhoCteLote({
        documentosIds: docsComRateio.map(d => d.id),
        rateios,
        osId: docsComRateio[0]?.ordem_servico_id || null,
        valorTotalRota: valorTotalNum,
        regraRateio: formaRateio,
        loteId,
      });

      // Atualizar metadata de cada documento com o rateio usado
      for (const d of docsComRateio) {
        const r = rateiosCalculados.find(rc => rc.docId === d.id);
        if (r) {
          const currentMeta = d.metadata || {};
          await supabase.from("fiscal_documentos_vinculados").update({
            metadata: {
              ...currentMeta,
              valor_rateio_cte: r.valor,
              forma_rateio_cte: formaRateio,
              romaneio_valor_total: valorTotalNum,
              rateio_origem: formaRateio,
            },
          }).eq("id", d.id);
        }
      }

      setResultado({ loteId: res.loteId, total: res.total, gerados: res.gerados, falhas: res.falhas, erros: res.erros });
      if (res.gerados > 0) { toast.success(`${res.gerados} CT-es rascunho gerados! Lote: ${res.loteId}`); onLoteGerado(); }
      if (res.falhas > 0) { toast.warning(`${res.falhas} falhas. Verifique os erros.`); }
    } catch (err: any) { toast.error("Erro ao gerar rascunhos: " + err.message); }
    finally { setGerando(false); }
  };

  const romaneiosFiltrados = romaneioBusca ? romaneios.filter(r => r.includes(romaneioBusca)) : romaneios;

  const bloqueiosRateio = !somaOk && valorTotalNum > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-indigo-600" />
            Prévia CT-e do Romaneio Calvo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ── Seletor de Romaneio ─────────────────────────── */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-600 block mb-1">Número do Romaneio</label>
              <div className="flex gap-2">
                <Input placeholder="Ex: 340612" value={romaneioBusca} onChange={(e) => setRomaneioBusca(e.target.value)} className="flex-1" />
                <Button onClick={() => buscarDocumentos(romaneioBusca)} disabled={loading || !romaneioBusca.trim()} size="sm">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span className="ml-1">Buscar</span>
                </Button>
              </div>
            </div>
            <div className="flex gap-1 flex-wrap max-w-[400px]">
              {romaneiosFiltrados.slice(0, 8).map(num => (
                <Button key={num} variant={romaneioSelecionado === num ? "default" : "outline"} size="sm" className="text-xs h-7"
                  onClick={() => { setRomaneioBusca(num); buscarDocumentos(num); }}>{num}</Button>
              ))}
            </div>
          </div>

          {/* ── Sumário ─────────────────────────────────────── */}
          {romaneioSelecionado && docs.length > 0 && (
            <>
              <div className="grid grid-cols-6 gap-2">
                <div className="p-3 bg-slate-50 border rounded-lg text-center">
                  <p className="text-lg font-bold text-slate-700">{docs.length}</p>
                  <p className="text-[10px] text-slate-500">CT-es previstos</p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                  <p className="text-lg font-bold text-blue-700">{fmtFin(somaRateio)}</p>
                  <p className="text-[10px] text-blue-600">Soma dos CT-es</p>
                </div>
                <div className={`p-3 border rounded-lg text-center ${bloqueiosRateio ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                  <p className={`text-lg font-bold ${bloqueiosRateio ? "text-red-700" : "text-green-700"}`}>
                    {bloqueiosRateio ? `R$ ${fmtNum(diferenca)}` : "OK"}
                  </p>
                  <p className={`text-[10px] ${bloqueiosRateio ? "text-red-600" : "text-green-600"}`}>
                    {bloqueiosRateio ? "Divergência" : "Soma confere"}
                  </p>
                </div>
                <div className={`p-3 border rounded-lg text-center ${totalBloqueios > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                  <p className={`text-lg font-bold ${totalBloqueios > 0 ? "text-red-700" : "text-green-700"}`}>{totalBloqueios}</p>
                  <p className={`text-[10px] ${totalBloqueios > 0 ? "text-red-600" : "text-green-600"}`}>Bloqueios</p>
                </div>
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-center">
                  <p className="text-lg font-bold text-indigo-700">{romaneioSelecionado}</p>
                  <p className="text-[10px] text-indigo-600">Romaneio</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                  <p className="text-lg font-bold text-amber-700">{formaRateio === "pdf" ? "PDF" : formaRateio === "igual" ? "Igual" : formaRateio === "valor_nf" ? "NF-e" : formaRateio === "peso" ? "Peso" : formaRateio === "volumes" ? "Vol." : "Manual"}</p>
                  <p className="text-[10px] text-amber-600">Rateio</p>
                </div>
              </div>

              {/* ── Config Rateio ────────────────────────────── */}
              <div className="p-3 border rounded-lg bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <Calculator className="w-4 h-4" />
                  Configuração do Rateio
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* Valor total */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">
                      Valor total do frete do romaneio
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <DollarSign className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          type="number" step="0.01" min="0"
                          value={valorTotalManual}
                          onChange={(e) => { setValorTotalManual(e.target.value); setEditandoValorTotal(true); }}
                          disabled={!editandoValorTotal && formaRateio === "pdf" && docs.every(d => d.valorRateioPdf !== null && d.valorRateioPdf > 0)}
                          className="pl-8 h-8 text-sm"
                          placeholder="0.00"
                        />
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleAlterarValorTotal}>
                        <Pencil className="w-3 h-3 mr-1" /> Alterar
                      </Button>
                    </div>
                  </div>

                  {/* Forma de rateio */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">
                      Forma de rateio
                    </label>
                    <Select value={formaRateio} onValueChange={(v) => setFormaRateio(v as FormaRateio)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMAS_RATEIO.map(f => (
                          <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Status da soma */}
                <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${bloqueiosRateio ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                  {bloqueiosRateio ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Valor total informado: <strong>{fmtFin(valorTotalNum)}</strong></span>
                  <span>|</span>
                  <span>Soma dos CT-es: <strong>{fmtFin(somaRateio)}</strong></span>
                  {bloqueiosRateio && <span>| Diferença: <strong>R$ {fmtNum(diferenca)}</strong></span>}
                  {!bloqueiosRateio && valorTotalNum > 0 && <span>| Status: <strong>OK</strong></span>}
                </div>
              </div>

              {/* ── Origem operacional ────────────────────────── */}
              {(() => {
                const comOs = docs.filter(d => d.validacao.temOs).length;
                const comRomaneio = docs.filter(d => !d.validacao.temOs && d.validacao.romaneioCompleto).length;
                const semNenhuma = docs.filter(d => !d.validacao.origemOk).length;
                return (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium text-slate-600">Origem operacional:</span>
                    {comOs > 0 && <Badge className="bg-green-50 text-green-700 text-[10px]">{comOs} com OS vinculada</Badge>}
                    {comRomaneio > 0 && <Badge className="bg-blue-50 text-blue-700 text-[10px]">{comRomaneio} via Romaneio/Faturamento (Calvo)</Badge>}
                    {semNenhuma > 0 && <Badge className="bg-red-50 text-red-700 text-[10px]">{semNenhuma} sem origem</Badge>}
                    {comRomaneio > 0 && comOs === 0 && <span className="text-blue-600">Operação fixa — faturamento por lote</span>}
                  </div>
                );
              })()}

              {/* ── Filtro ───────────────────────────────────── */}
              <div className="flex items-center gap-2">
                <Input placeholder="Filtrar NF-e..." value={filtroNumero} onChange={(e) => setFiltroNumero(e.target.value)} className="max-w-[200px] h-8 text-xs" />
                <span className="text-xs text-slate-400">{docsFiltrados.length} de {docs.length} NF-es</span>
              </div>

              {/* ── Tabela Principal ─────────────────────────── */}
              <ScrollArea className="h-[350px] border rounded-md">
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-100 sticky top-0 z-10">
                    <tr>
                      <th className="p-2 text-left w-8"></th>
                      <th className="p-2 text-left font-semibold">NF-e</th>
                      <th className="p-2 text-left font-semibold">Destino</th>
                      <th className="p-2 text-center font-semibold">IBGE</th>
                      <th className="p-2 text-right font-semibold">Valor CT-e</th>
                      {formaRateio === "manual_linha" && <th className="p-2 text-right font-semibold">Editar</th>}
                      <th className="p-2 text-left font-semibold">Endereço Real</th>
                      <th className="p-2 text-center font-semibold w-12">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {docsFiltrados.map((doc) => {
                      const bloqueiosAtivos = [
                        ...doc.validacao.bloqueios,
                        ...(!doc.valorRateioCalculado || doc.valorRateioCalculado <= 0 ? ["Valor rateio zerado"] : []),
                      ];
                      const docOk = bloqueiosAtivos.length === 0 && somaOk;
                      return (
                        <>
                          <tr key={doc.id}
                            className={`hover:bg-slate-50 cursor-pointer transition-colors ${docOk ? "" : "bg-red-50/30"} ${linhaExpandida === doc.id ? "bg-blue-50" : ""}`}
                            onClick={() => setLinhaExpandida(linhaExpandida === doc.id ? null : doc.id)}>
                            <td className="p-2">{linhaExpandida === doc.id ? <ChevronDown className="w-3.5 h-3.5 text-blue-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}</td>
                            <td className="p-2 font-mono font-medium">
                              {doc.numero || "S/N"}
                              {!doc.validacao.origemOk && <span className="text-[9px] text-red-500 block">sem origem</span>}
                              {!doc.validacao.temOs && doc.validacao.romaneioCompleto && <span className="text-[9px] text-blue-500 block">romaneio</span>}
                            </td>
                            <td className="p-2"><span className={doc.validacao.municipioOk ? "text-green-700" : "text-red-500"}>{doc.municipioDestino}</span></td>
                            <td className="p-2 text-center font-mono text-[10px]">{doc.codigoIbge ? <span className="text-green-600">{doc.codigoIbge}</span> : <span className="text-red-400">-</span>}</td>
                            <td className="p-2 text-right font-semibold">
                              {doc.valorRateioCalculado !== null ? (
                                <span className="text-green-700">{fmtFin(doc.valorRateioCalculado)}</span>
                              ) : <span className="text-red-400">-</span>}
                            </td>
                            {formaRateio === "manual_linha" && (
                              <td className="p-1" onClick={(e) => e.stopPropagation()}>
                                <Input
                                  type="number" step="0.01" min="0"
                                  className="h-7 w-24 text-[11px] text-right"
                                  value={rateioManual[doc.id] || ""}
                                  onChange={(e) => setRateioManual(prev => ({ ...prev, [doc.id]: e.target.value }))}
                                  placeholder="0.00"
                                />
                              </td>
                            )}
                            <td className="p-2 max-w-[250px] truncate">
                              {doc.enderecoCompleto ? <span className="text-green-700">{doc.enderecoCompleto}</span> : <span className="text-red-400">Endereço não conferido</span>}
                            </td>
                            <td className="p-2 text-center">
                              {docOk ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : (
                                <div className="flex flex-col items-center gap-0.5">
                                  <XCircle className="w-4 h-4 text-red-500" />
                                  {bloqueiosAtivos.map((b, bi) => <span key={bi} className="text-[9px] text-red-500">{b}</span>)}
                                </div>
                              )}
                            </td>
                          </tr>

                          {/* Detalhes expandidos */}
                          {linhaExpandida === doc.id && (
                            <tr key={`${doc.id}-detail`}><td colSpan={formaRateio === "manual_linha" ? 8 : 7} className="p-0">
                              <div className="bg-blue-50/50 border-t border-blue-100 p-4">
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                  <div className="space-y-2">
                                    <div className="font-semibold text-sm text-blue-800 mb-2">📋 Detalhes da NF-e {doc.numero}</div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div><span className="text-slate-400">Tomador:</span><p className="font-medium">{doc.destinatario_nome || "CALVO COMERCIAL"}</p></div>
                                      <div><span className="text-slate-400">Emitente:</span><p className="font-medium">{doc.emitente_nome || "CALVO"}</p></div>
                                      <div><span className="text-slate-400">Valor NF-e:</span><p className="font-medium">{doc.valor_total != null ? fmtFin(doc.valor_total) : "-"}</p></div>
                                      <div><span className="text-slate-400">Peso:</span><p className="font-medium">{doc.peso_bruto != null ? `${doc.peso_bruto} kg` : "-"}</p></div>
                                    </div>
                                    <div className="pt-2 border-t">
                                      <span className="text-slate-400">🏙️ Destino CT-e:</span>
                                      <p className="font-semibold text-green-700">{doc.municipioDestino}{doc.codigoIbge && <span className="text-slate-400 ml-2">IBGE: {doc.codigoIbge}</span>}</p>
                                    </div>
                                    <div className="pt-1">
                                      <span className="text-slate-400">💰 Valor CT-e (rateio):</span>
                                      <p className="font-semibold text-lg text-blue-700">{doc.valorRateioCalculado !== null ? fmtFin(doc.valorRateioCalculado) : "NÃO DEFINIDO"}</p>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="font-semibold text-sm text-blue-800 mb-2">📍 Endereço Real de Entrega</div>
                                    <div className="p-3 bg-white border rounded-lg"><p className="font-medium text-green-700">{doc.enderecoCompleto || "Endereço não conferido"}</p></div>
                                    <div className="pt-2 border-t">
                                      <span className="text-slate-400">📝 Observação no CT-e:</span>
                                      <div className="p-2 bg-white border rounded-lg mt-1"><p className="font-mono text-[11px] text-slate-700 whitespace-pre-wrap">{doc.observacao || "(sem observação)"}</p></div>
                                    </div>
                                    <div className="pt-2 border-t">
                                      <span className="text-slate-400">✅ Validações:</span>
                                      <div className="grid grid-cols-2 gap-1 mt-1">
                                        {[
                                          { label: `Origem: ${doc.validacao.origemOperacional}`, ok: doc.validacao.origemOk },
                                          { label: "Endereço real", ok: doc.validacao.temEndereco },
                                          { label: "Valor rateio", ok: doc.valorRateioCalculado !== null && doc.valorRateioCalculado > 0 },
                                          { label: "Fonte válida", ok: doc.validacao.fonteValida },
                                          { label: "Não pendente", ok: doc.validacao.naoPendente },
                                          { label: "Município OK", ok: doc.validacao.municipioOk },
                                          { label: "IBGE OK", ok: doc.validacao.ibgeOk },
                                        ].map(item => (
                                          <div key={item.label} className="flex items-center gap-1">
                                            {item.ok ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-400" />}
                                            <span className={item.ok ? "text-green-700" : "text-red-500"}>{item.label}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td></tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollArea>

              {/* Observações exemplo */}
              <div className="p-3 bg-slate-50 border rounded-lg">
                <span className="text-xs font-semibold text-slate-600">Exemplos de observação no CT-e:</span>
                <div className="mt-2 space-y-1">
                  {docs.slice(0, 3).map(d => (
                    <div key={d.id} className="text-[10px] font-mono text-slate-600 bg-white p-1.5 rounded border">
                      NF-e {d.numero} ({fmtFin(d.valorRateioCalculado || 0)}): {d.observacao || "(pendente)"}
                    </div>
                  ))}
                </div>
              </div>

              {/* Bloqueios */}
              {(totalBloqueios > 0 || bloqueiosRateio) && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-red-700 text-sm">
                    <AlertTriangle className="w-4 h-4" />Atenção — bloqueios detectados
                  </div>
                  <div className="text-xs text-red-600 space-y-1">
                    {bloqueiosRateio && <div className="flex items-center gap-1"><XCircle className="w-3 h-3" /><span>Soma dos CT-es ({fmtFin(somaRateio)}) diverge do valor total ({fmtFin(valorTotalNum)}) — diferença: R$ {fmtNum(diferenca)}</span></div>}
                    {!valorTotalNum && <div className="flex items-center gap-1"><XCircle className="w-3 h-3" /><span>Valor total do frete não informado</span></div>}
                    {docsComRateio.filter(d => !d.valorRateioCalculado || d.valorRateioCalculado <= 0).length > 0 && <div className="flex items-center gap-1"><XCircle className="w-3 h-3" /><span>{docsComRateio.filter(d => !d.valorRateioCalculado || d.valorRateioCalculado <= 0).length} CT-e(s) com valor zerado ou ausente</span></div>}
                    {docs.filter(d => !d.validacao.origemOk).length > 0 && <div className="flex items-center gap-1"><XCircle className="w-3 h-3" /><span>{docs.filter(d => !d.validacao.origemOk).length} sem origem operacional</span></div>}
                    {docs.filter(d => !d.validacao.temEndereco).length > 0 && <div className="flex items-center gap-1"><XCircle className="w-3 h-3" /><span>{docs.filter(d => !d.validacao.temEndereco).length} sem endereço real completo</span></div>}
                    {docs.filter(d => !d.validacao.ibgeOk).length > 0 && <div className="flex items-center gap-1"><XCircle className="w-3 h-3" /><span>{docs.filter(d => !d.validacao.ibgeOk).length} sem código IBGE</span></div>}
                    {formaRateio === "manual_linha" && docs.filter(d => !rateioManual[d.id]).length > 0 && <div className="flex items-center gap-1"><XCircle className="w-3 h-3" /><span>{docs.filter(d => !rateioManual[d.id]).length} sem rateio manual informado</span></div>}
                  </div>
                </div>
              )}
            </>
          )}

          {!romaneioSelecionado && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border border-dashed rounded-lg">
              <FileText className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">Selecione um romaneio para visualizar a prévia</p>
            </div>
          )}
          {loading && <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}

          {resultado && (
            <div className="space-y-3 p-4 bg-gradient-to-r from-blue-50 to-green-50 border rounded-lg">
              <div className="text-center"><Badge className="font-mono text-xs bg-white">Lote: {resultado.loteId}</Badge></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-white border rounded-lg text-center"><p className="text-xl font-bold text-blue-700">{resultado.total}</p><p className="text-[10px] text-blue-600">Total XMLs</p></div>
                <div className="p-3 bg-white border rounded-lg text-center"><p className="text-xl font-bold text-green-700">{resultado.gerados}</p><p className="text-[10px] text-green-600">CT-es Gerados</p></div>
                <div className="p-3 bg-white border rounded-lg text-center"><p className="text-xl font-bold text-red-700">{resultado.falhas}</p><p className="text-[10px] text-red-600">Falhas</p></div>
              </div>
              {resultado.erros.length > 0 && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 space-y-0.5">
                  {resultado.erros.map((e, i) => <div key={i} className="flex items-start gap-1"><XCircle className="w-3 h-3 mt-0.5" />{e}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleRevalidar} disabled={loading || !romaneioSelecionado}>
              <RefreshCw className="w-4 h-4 mr-1" />Revalidar
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={handleGerarRascunhos}
              disabled={gerando || totalBloqueios > 0 || docs.length === 0 || !!resultado || !somaOk || valorTotalNum <= 0}>
              {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Layers className="w-4 h-4 mr-2" />}
              {gerando ? "Gerando..." : resultado ? "Rascunhos gerados" : `Gerar ${docs.length} rascunhos locais`}
            </Button>
            <Button disabled className="bg-slate-400 text-white cursor-not-allowed" title="Envio Focus bloqueado">
              <SendHorizontal className="w-4 h-4 mr-2" />Enviar para Focus
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
