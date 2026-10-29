import { useState, useCallback, useEffect, useMemo } from "react";
import { ArrowLeft, FileDown, Plus, Trash2, MapPin, Package, Truck, DollarSign, Clock, Lightbulb, Check, Copy, Route, Info, AlertCircle, TrendingUp, ListChecks, Calendar, Building2, User, FileText, BarChart3, Gauge, Link2, Loader2 } from "lucide-react";
import { FormSectionCard, DocStepNavigation, type DocStep } from "@/components/ui/premium-document";
import { useFormExitGuard } from "@/hooks/useFormExitGuard";
import {
  Field,
  MetaChip,
  StatCard,
  PanelSection,
  PanelRow,
  ChecklistItem,
  FormFooterBar,
  EnterpriseFormWorkspace,
  EnterpriseWorkspaceHeader,
  EnterpriseFormBody,
  EnterpriseContextSidebar,
  EnterpriseMainContent,
  EnterpriseStepStrip,
  EnterpriseWorkspaceFooter,
  PremiumDocumentDialog,
  PremiumDialogHeader,
} from "@/components/ui/enterprise";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Orcamento, EnderecoOrcamento, STATUS_CONFIG, OrcamentoStatus, DistanciaRota, DimensaoCarga } from "./types";
import { gerarPdfOrcamento } from "./orcamentoPdf";
import { calcularValoresDoOrcamento, montarPayloadOrcamento } from "./orcamentoCalculo";
import { calcularDerivadosCarga, volumeM3PorGrupo, avaliarCompatibilidadeVeiculo, catalogoPadraoVeiculo, type DerivadosCarga, type VeiculoCapacidade, type RegraFatorCubagem } from "./cargaCalculo";
import { carregarCapacidadesVeiculo } from "@/services/comercial/veiculoCapacidadeService";
import { carregarRegrasFatorCubagem } from "@/services/comercial/fatorCubagemService";
import { generateProfessionalPDF } from "@/lib/pdfGenerator";
import { FavoritosDropdown, SaveFavoritoButton } from "@/components/enderecos/EnderecosFavoritos";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { EnderecoCompleto, EnderecoType } from "@/components/ui/EnderecoCompleto";
import { toast } from "sonner";
import { TIPOS_VEICULO } from "@/constants/tiposVeiculo";
import { calcularDistancia, type DistanceResult } from "@/services/maps";
import { verificarInadimplenciaCliente } from "@/services/financeiro/inadimplenciaService";
import type { ResultadoCalculo } from "@/services/financeiro/calculoService";
import { calcularPrecoRapido } from "@/services/precificacao/precificacaoEngineService";
import { buscarTabelaValoresCliente } from "@/services/precificacao/buscarTabelasService";
import { gerarOSDoOrcamento, verificarOSJaGerada } from "@/services/comercial/orcamentoToOSService";
// MISSÃO COTACAO-EXPRESS — link da Fase 2 (endereços completos) para o cliente
import {
  buscarCotacaoPorOrcamento,
  gerarLinkFase2EAtualizarStatus,
} from "@/services/cotacoes/cotacaoPublicaService";
import { FreightCompositionService } from "@/services/freteExterno/FreightCompositionService";
import { useTenant } from "@/contexts/TenantContext";

const gerarNumeroOrcamento = () => {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `ORC-${ano}${mes}-${seq}`;
};

/**
 * @deprecated Missão 78+109 — substituído por buscarTabelaValoresCliente() + calcularPrecoRapido().
 * Interface and inline functions removed — use centralized buscarTabelasService.
 */

/**
 * @deprecated TMS-COM-CARGA-01 — a recomendação agora é catalog-based em
 * `./cargaCalculo` (calcularDerivadosCarga/recomendarVeiculo), usando o
 * catálogo VEICULO_PARAMETROS. A função local antiga (limiares fixos) foi removida.
 */

interface Props {
  orcamento?: Orcamento;
  modo: "ver" | "editar" | "novo";
  onVoltar: () => void;
  onSalvar: (orc: Orcamento) => void;
  /** MISSÃO COTACAO-EXPRESS — id da cotação pública que originou este orçamento. */
  cotacaoId?: string | null;
}

const emptyEndereco = (): EnderecoOrcamento => ({ tipo: "coleta", sequencia: 1, endereco: "", cidade: "", uf: "", cep: "", contato: "", telefone: "", instrucoes: "", janelaInicio: "", janelaFim: "" });

const emptyOrcamento = (): Orcamento => ({
  id: String(Date.now()), numero: gerarNumeroOrcamento(),
  cliente: "", clienteCnpj: "", unidade: "São Paulo - Matriz", centroCusto: "", responsavel: "",
  dataEmissao: new Date().toISOString().split("T")[0], validade: "", tipoOperacao: "", modalidade: "contrato",
  prioridade: "normal", pedidoInterno: "", observacoesGerais: "", status: "em_analise",
  enderecos: [emptyEndereco()],
  carga: { descricao: "", volumes: 0, peso: 0, cubagem: 0, pallets: 0, valorDeclarado: 0, refrigerado: false, ajudante: false, fragil: false, empilhavel: false, risco: false, perigosa: false, controlada: false, observacoes: "", dimensoes: [] },
  veiculo: { tipo: "", subcategoria: "", carroceria: "" },
  valores: { tabelaVinculada: "", valorBase: 0, adicionais: 0, pedagio: 0, kmExcedente: 0, ajudante: 0, adValorem: 0, gris: 0, devolucao: 0, reentrega: 0, descontos: 0, valorFinal: 0, custoEstimado: 0, margemEstimada: 0, lucroEstimado: 0 },
  historico: [{ data: new Date().toLocaleString("pt-BR"), acao: "Orçamento criado", usuario: "Usuário atual" }],
});

// ============================================================
// Painel lateral de resumo do orçamento (somente visual)
// ============================================================
const ResumoOrcamentoPanel = ({ data, distanciaRota }: { data: Orcamento; distanciaRota: DistanceResult | null }) => {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const margemOk = (data.valores?.margemEstimada || 0) >= 15;
  const distanciaTxt = data.distancia_rota?.distancia_texto || distanciaRota?.distanciaTexto || "—";
  const statusLabel = STATUS_CONFIG[data.status]?.label || data.status;
  const statusColor = STATUS_CONFIG[data.status]?.color || "bg-slate-100 text-slate-600";

  const pendencias: string[] = [];
  if (!data.distancia_rota?.distancia_km && !distanciaRota?.distanciaKm) pendencias.push("Preencha os endereços para calcular distância e valor.");
  if (!data.valores?.tabelaVinculada) pendencias.push("Nenhuma tabela de valores vinculada.");

  const checklist = [
    { ok: Boolean(data.cliente?.trim()), label: "Cliente definido", detail: data.cliente || "—" },
    { ok: Boolean(data.tipoOperacao?.trim()), label: "Tipo da operação", detail: data.tipoOperacao || "—" },
    { ok: Boolean(data.veiculo?.tipo), label: "Veículo", detail: data.veiculo?.tipo?.toUpperCase() || "pendente" },
    { ok: (data.enderecos || []).filter((e) => e?.endereco?.trim()).length >= 2, label: "Origem e destino", detail: `${(data.enderecos || []).filter((e) => e?.endereco?.trim()).length} ponto(s)` },
    { ok: (data.valores?.valorFinal || 0) > 0, label: "Valores OK", detail: fmt(data.valores?.valorFinal || 0) },
    { ok: Boolean(data.valores?.tabelaVinculada), label: "Tabela vinculada", detail: data.valores?.tabelaVinculada || "—" },
  ];
  const totalCheckOk = checklist.filter((c) => c.ok).length;

  return (
    <div className="flex flex-col">
      {/* FINANCEIRO */}
      <PanelSection icon={TrendingUp} title="Financeiro" accent="emerald">
        <PanelRow label="Valor Final" value={fmt(data.valores?.valorFinal || 0)} />
        <PanelRow label="Custo Prestador" value={fmt(data.valores?.custoEstimado || 0)} />
        <PanelRow label="Lucro Estimado" value={fmt(data.valores?.lucroEstimado || 0)} valueClass={(data.valores?.lucroEstimado || 0) >= 0 ? "text-green-600" : "text-red-600"} />
        <PanelRow label="Margem" value={`${data.valores?.margemEstimada || 0}%`} valueClass={margemOk ? "text-green-600" : "text-amber-600"} />
        <div className="mt-1 flex items-center justify-between border-t border-slate-200/70 pt-2 text-xs">
          <span className="font-medium text-slate-500">Tabela</span>
          <span className="truncate font-bold text-slate-700">{data.valores?.tabelaVinculada || "Nenhuma"}</span>
        </div>
      </PanelSection>

      {/* CARGA & VEÍCULO */}
      <PanelSection icon={Package} title="Carga & Veículo" accent="blue">
        <PanelRow label="Tipo de Veículo" value={data.veiculo?.tipo ? data.veiculo.tipo.toUpperCase() : "—"} />
        <PanelRow label="Peso" value={data.carga?.peso ? `${data.carga.peso} kg` : "—"} />
        <PanelRow label="Cubagem" value={data.carga?.cubagem ? `${data.carga.cubagem} m³` : "—"} />
        <PanelRow label="Volumes" value={data.carga?.volumes || 0} />
        <PanelRow label="Isotérmico / Refrigerado" value={data.carga?.refrigerado ? "Sim" : "Não"} valueClass={data.carga?.refrigerado ? "text-sky-600" : undefined} />
        <div className="mt-1 flex items-center justify-between border-t border-slate-200/70 pt-2 text-xs">
          <span className="font-medium text-slate-500">Distância</span>
          <span className="truncate font-bold text-slate-700">{distanciaTxt}</span>
        </div>
      </PanelSection>

      {/* CHECKLIST (Painel Inteligente) */}
      <PanelSection icon={ListChecks} title="Checklist" accent="violet" right={
        <span className="text-[10px] font-bold text-slate-400">{totalCheckOk}/{checklist.length}</span>
      }>
        <div className="space-y-1.5">
          {checklist.map((item, i) => (
            <ChecklistItem key={i} ok={item.ok} label={item.label} detail={item.detail} />
          ))}
        </div>
      </PanelSection>

      {/* PENDÊNCIAS */}
      <PanelSection icon={AlertCircle} title="Pendências" accent={pendencias.length > 0 ? "amber" : "emerald"} right={
        <span className="text-[10px] font-bold text-slate-400">{pendencias.length}</span>
      }>
        {pendencias.length > 0 ? (
          <ul className="space-y-1">
            {pendencias.map((p, i) => (
              <li key={i} className="flex items-start gap-1.5 rounded-md border border-amber-100 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                <span className="mt-0.5 text-amber-400">●</span>
                <span className="flex-1">{p}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-1.5 text-[11px] text-emerald-600">
            <Check className="h-3.5 w-3.5" /> Orçamento consistente para envio.
          </p>
        )}
      </PanelSection>

      {/* ÚLTIMA ATUALIZAÇÃO */}
      <PanelSection icon={Clock} title="Última Atualização" accent="slate">
        <div className="flex items-center justify-between py-1.5">
          <span className="text-[11px] font-medium text-slate-500">Status</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor}`}>{statusLabel}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Calendar className="h-3 w-3 text-slate-400" />
          Emitido em {data.dataEmissao ? new Date(data.dataEmissao + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
        </div>
      </PanelSection>
    </div>
  );
};

// ============================================================
// Etapas do formulário premium (somente visual)
// ============================================================
const obterDocStepsOrcamento = (data: Orcamento): DocStep[] => {
  const identOk = Boolean(data.cliente?.trim() && data.tipoOperacao?.trim());
  const cargaOk = Boolean(data.carga?.descricao?.trim() || data.carga?.peso > 0);
  const veiculoOk = Boolean(data.veiculo?.tipo);
  const enderecosOk = (data.enderecos || []).filter((e) => e?.endereco?.trim()).length >= 2;
  const valoresOk = (data.valores?.valorFinal || 0) > 0;
  return [
    { value: "identificacao", label: "Identificação", icon: Info, done: identOk, pending: !identOk },
    { value: "carga", label: "Dados da Carga", icon: Package, done: cargaOk, pending: !cargaOk },
    { value: "veiculo", label: "Veículo", icon: Truck, done: veiculoOk, pending: !veiculoOk },
    { value: "enderecos", label: "Endereços", icon: MapPin, done: enderecosOk, pending: !enderecosOk },
    { value: "valores", label: "Valores", icon: DollarSign, done: valoresOk, pending: !valoresOk },
    { value: "documentos", label: "Docs e PDF", icon: FileDown, done: Boolean(data.observacoesGerais?.trim()), pending: false },
    { value: "historico", label: "Histórico", icon: Clock, done: (data.historico || []).length > 0 },
  ];
};

const OrcamentoForm = ({ orcamento, modo, onVoltar, onSalvar, cotacaoId }: Props) => {
  const [data, setData] = useState<Orcamento>(orcamento ? JSON.parse(JSON.stringify(orcamento)) : emptyOrcamento());
  // MISSÃO COTACAO-EXPRESS — cotação vinculada (prop vinda da lista ou lookup pelo id)
  const [cotacaoIdForm, setCotacaoIdForm] = useState<string | null>(cotacaoId || null);
  const [gerandoLinkFase2, setGerandoLinkFase2] = useState(false);
  const podeGerarLinkFase2 = Boolean(cotacaoIdForm) || modo !== "novo";
  // Guard contra perda de alterações (dirty + beforeunload + confirmação de saída).
  const [baseline] = useState<Orcamento>(() => orcamento ? JSON.parse(JSON.stringify(orcamento)) : emptyOrcamento());
  const exitGuard = useFormExitGuard({ current: data, initial: baseline });
  const handleExit = async () => {
    if (await exitGuard.confirmExit()) onVoltar();
  };
  const { tenant } = useTenant();
  // TMS-COM-CARGA-03/04 — catálogo de capacidade + regras de fator de cubagem.
  const [catalogoVeiculo, setCatalogoVeiculo] = useState<VeiculoCapacidade[]>(catalogoPadraoVeiculo());
  const [regrasFator, setRegrasFator] = useState<RegraFatorCubagem[]>([]);
  useEffect(() => {
    let ativo = true;
    carregarCapacidadesVeiculo()
      .then((c) => { if (ativo && Array.isArray(c) && c.length) setCatalogoVeiculo(c); })
      .catch(() => {});
    carregarRegrasFatorCubagem()
      .then((r) => { if (ativo) setRegrasFator(Array.isArray(r) ? r : []); })
      .catch(() => {});
    return () => { ativo = false; };
  }, []);

  // TMS-COM-CARGA-04 — orçamento EXISTENTE usa o FATOR SNAPSHOT (histórico imutável);
  // orçamento NOVO resolve pela regra vigente (modalidade → padrão geral → sem fator).
  const fatorSnapshot = modo !== "novo" && Number(data.carga?.fatorCubagem) > 0 ? Number(data.carga.fatorCubagem) : undefined;

  const derivados: DerivadosCarga = useMemo(
    () => calcularDerivadosCarga(data.carga, fatorSnapshot, catalogoVeiculo, regrasFator, data.modalidade),
    [data.carga, catalogoVeiculo, regrasFator, data.modalidade, fatorSnapshot]
  );
  const [distanciaRota, setDistanciaRota] = useState<DistanceResult | null>(null);
  const [calculandoDistancia, setCalculandoDistancia] = useState(false);
  const [convertendo, setConvertendo] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<string>("identificacao");
  const readOnly = modo === "ver";
  const [recalcPricingTick, setRecalcPricingTick] = useState(0);
  const [modalidadeTransporte, setModalidadeTransporte] = useState<'dedicado' | 'aereo' | 'fracionado' | 'comparar_todas'>('dedicado');
  const [parceiroExterno, setParceiroExterno] = useState<string>('');
  const [isCotandoExterno, setIsCotandoExterno] = useState(false);
  const [resultadoCotacaoExterna, setResultadoCotacaoExterna] = useState<any>(null);
  const [margemExterna, setMargemExterna] = useState<number>(20);

  // useEffect para buscar distância quando endereços mudam
  useEffect(() => {
    const calcularDistanciaAuto = async () => {
      const enderecos = data.enderecos || [];
      const cols = enderecos.filter(e => e.tipo === "coleta" && e.endereco?.trim());
      const ents = enderecos.filter(e => e.tipo === "entrega" && e.endereco?.trim());

      if (cols.length === 0 || ents.length === 0) return;

      const origem = cols[0].endereco;
      const destino = ents[ents.length - 1].endereco;
      if (!origem || !destino) return;
      if (origem.includes("undefined") || destino.includes("undefined")) return;

      console.log("[OrcamentoForm] Calculando distância...");
      console.log("[OrcamentoForm] VEÍCULO:", data.veiculo.tipo);
      console.log("[OrcamentoForm] CLIENTE:", data.cliente);
      console.log("[OrcamentoForm] ORIGEM:", origem);
      console.log("[OrcamentoForm] DESTINO:", destino);

      setCalculandoDistancia(true);
      try {
        const resultado = await calcularDistancia(origem, destino);
        console.log("[OrcamentoForm] RESULTADO MAPBOX:", resultado);

        if (resultado) {
          setDistanciaRota(resultado);
          setData((prev) => ({
            ...prev,
            distancia_rota: {
              distancia_km: resultado.distanciaKm,
              duracao_min: resultado.duracaoMin,
              distancia_texto: resultado.distanciaTexto,
              duracao_texto: resultado.duracaoTexto,
              maps_provider: "mapbox",
            },
          }));
        }
      } catch (e) {
        console.error("[OrcamentoForm] Erro ao calcular distancia:", e);
      } finally {
        setCalculandoDistancia(false);
      }
    };

    const timerId = setTimeout(calcularDistanciaAuto, 1000);
    return () => clearTimeout(timerId);
  }, [data.enderecos]);

  // useEffect para buscar tabela e calcular valor quando distância muda
  useEffect(() => {
    const calcularValorAuto = async () => {
      if (!data.distancia_rota?.distancia_km || !data.distancia_rota.distancia_km > 0) return;
      if (!data.veiculo.tipo) return;

      const km = data.distancia_rota.distancia_km;
      console.log("[OrcamentoForm] DISTÂNCIA CALCULADA:", km, "km");

      const enderecoOrigem = data.enderecos?.find((e: any) => e.tipo === "coleta" || e.tipo === "origem");
      const enderecoDestino = data.enderecos?.find((e: any) => e.tipo === "entrega" || e.tipo === "destino" || e.tipo === "delivery");

      try {
        const { tabela } = await buscarTabelaValoresCliente({
          tenant_id: tenant?.id || "",
          cliente_id: (data as any).clienteId || "",
          cliente_nome: data.cliente || "",
          tipo_veiculo: data.veiculo.tipo || "",
          tipo_operacao: "fracionado",
          distancia_km: Math.ceil(km),
          quantidade_paradas: 1,
          origem: { endereco: enderecoOrigem?.endereco || "", bairro: enderecoOrigem?.bairro || "", cidade: enderecoOrigem?.cidade || "", uf: enderecoOrigem?.uf || enderecoOrigem?.estado || "", cep: enderecoOrigem?.cep || "" },
          destino: { endereco: enderecoDestino?.endereco || "", bairro: enderecoDestino?.bairro || "", cidade: enderecoDestino?.cidade || "", uf: enderecoDestino?.uf || enderecoDestino?.estado || "", cep: enderecoDestino?.cep || "" },
          modo: "preview",
        });
        console.log("[OrcamentoForm] TABELA ENCONTRADA:", tabela);

        if (tabela && (tabela.fonte === "tabelas_valores" || tabela.fonte === "universal")) {
          const valorBasePuro = tabela.valor_base || 0;
          if (valorBasePuro <= 0) toast.warning("Preço não disponível na tabela selecionada.");
          const engineCalc = calcularPrecoRapido(tabela, km);
          const franquiaKm = tabela.franquia_km || 0;
          const valorKmExc = tabela.valor_km_excedente || 0;
          const kmExcedenteVal = Math.max(0, km - franquiaKm);
          const kmExcedenteCost = kmExcedenteVal * valorKmExc;

          setData((prev) => {
            const v = { ...prev.valores };
            const valorFinalCalc = engineCalc.valorCliente + v.adicionais + v.pedagio + v.ajudante + v.devolucao + v.reentrega - v.descontos;
            v.tabelaVinculada = tabela.nome || "Tabela";
            v.valorBase = valorBasePuro;
            v.kmExcedente = kmExcedenteCost;
            v.custoEstimado = engineCalc.valorPrestador;
            v.valorFinal = valorFinalCalc;
            v.lucroEstimado = v.valorFinal - v.custoEstimado;
            v.margemEstimada = v.valorFinal > 0 ? Math.round((v.lucroEstimado / v.valorFinal) * 1000) / 10 : 0;
            // TMS-COM-PRECO-01 — snapshot da regra aplicada (histórico imutável).
            v.pricing = {
              tabelaId: tabela.id || undefined,
              tabelaNome: tabela.nome || undefined,
              fonte: tabela.fonte,
              veiculoTarifado: data.veiculo.tipo || undefined,
              distanciaKm: km,
              franquiaKm,
              valorBase: valorBasePuro,
              kmExcedente: kmExcedenteCost,
              valorCalculado: valorFinalCalc,
              overrideManual: false,
              contexto: data.modalidade || undefined,
              calculadoEm: new Date().toISOString(),
            };
            return { ...prev, valores: v };
          });
          return;
        }
        if (tabela && tabela.fonte === "fallback_hardcoded") {
          toast.warning("Preço não disponível na tabela selecionada.");
        }
      } catch (e) {
        console.error("[OrcamentoForm] Erro buscarTabelaValoresCliente:", e);
      }

      console.warn("[OrcamentoForm] Nenhuma tabela ativa encontrada para este veículo:", data.veiculo.tipo, km);
      toast.warning("Nenhuma tabela ativa encontrada para este veículo e distância.");
    };

    const timerId = setTimeout(calcularValorAuto, 500);
    return () => clearTimeout(timerId);
  }, [data.distancia_rota?.distancia_km, data.veiculo.tipo, data.cliente, recalcPricingTick]);

  const update = (path: string, value: any) => {
    setData((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = clone;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return clone;
    });
  };

  const handleCotacaoExterna = async () => {
    setIsCotandoExterno(true);
    setResultadoCotacaoExterna(null);
    try {
      const enderecos = data.enderecos || [];
      const pontoOrigem = enderecos.find((e) => e.tipo === "coleta") || enderecos[0];
      const entregas = enderecos.filter((e) => e.tipo === "entrega");
      const pontoDestino = entregas[entregas.length - 1] || enderecos[enderecos.length - 1];

      const cepOrigem = pontoOrigem?.cep || "";
      const cepDestino = pontoDestino?.cep || "";
      const volumes = (data.carga?.dimensoes || []).length > 0
        ? data.carga.dimensoes
        : [{ quantidade: data.carga?.volumes || 0 }];
      const valorNota = data.carga?.valorDeclarado || 0;

      const resultado = await FreightCompositionService.calcularRotaCompleta(parceiroExterno, cepOrigem, cepDestino, volumes, valorNota);
      setResultadoCotacaoExterna(resultado);
      update("valores.custoEstimado", resultado.custoOperacionalTotal);
      update("valores.pricing", { ...data.valores?.pricing, composicao_externa: resultado });
      const valorVendaSugerido = resultado.custoOperacionalTotal * (1 + (margemExterna / 100));
      update("valores.valorFinal", valorVendaSugerido);
      update("valores.lucroEstimado", valorVendaSugerido - resultado.custoOperacionalTotal);
    } catch (e) {
      console.error("[OrcamentoForm] Erro na cotação externa:", e);
      toast.error("Não foi possível cotar com o parceiro externo.");
    } finally {
      setIsCotandoExterno(false);
    }
  };

  const aplicarSugestaoVeiculo = () => {
    const rec = derivados.recomendacao;
    if (rec.disponivel && rec.tipo) {
      update("veiculo.tipo", rec.tipo);
      toast.success(`Veículo recomendado aplicado: ${rec.label || rec.tipo}`);
    }
  };

  // TMS-COM-CARGA-01 — editor de dimensões (grupos de volume em cm).
  const addDimensao = () => update("carga.dimensoes", [...(data.carga.dimensoes || []), { quantidade: 1, comprimentoCm: 0, larguraCm: 0, alturaCm: 0 } as DimensaoCarga]);
  const removeDimensao = (i: number) => update("carga.dimensoes", (data.carga.dimensoes || []).filter((_, idx) => idx !== i));
  const updateDimensao = (i: number, field: keyof DimensaoCarga, value: number) =>
    update("carga.dimensoes", (data.carga.dimensoes || []).map((d, idx) => (idx === i ? { ...d, [field]: value } : d)));

  const fmtNum = (v: number, dec = 3) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const recalcular = () => {
    // TMS-COM-ORC-02 — cálculo canônico (fonte única).
    setData((prev) => ({
      ...prev,
      valores: calcularValoresDoOrcamento({ valores: prev.valores, carga: prev.carga, cliente: prev.cliente }) as typeof prev.valores,
    }));
  };

  const calcularDistanciaRota = useCallback(async () => {
    const cols = data.enderecos.filter(e => e.tipo === "coleta");
    const ents = data.enderecos.filter(e => e.tipo === "entrega");
    if (cols.length === 0 || ents.length === 0) return;
    const origem = cols[0].endereco;
    const destino = ents[ents.length - 1].endereco;
    if (!origem || !destino) return;
    setCalculandoDistancia(true);
    try {
      const result = await calcularDistancia(origem, destino);
      if (result) {
        setDistanciaRota(result);
        setData((prev) => ({
          ...prev,
          distancia_rota: {
            distancia_km: result.distanciaKm,
            duracao_min: result.duracaoMin,
            distancia_texto: result.distanciaTexto,
            duracao_texto: result.duracaoTexto,
            maps_provider: result.provider,
          },
        }));
      }
    } catch (err) {
      console.error("[OrcamentoForm] Erro ao calcular distancia:", err);
      setDistanciaRota(null);
    } finally {
      setCalculandoDistancia(false);
    }
}, [data.enderecos]);

  // ============================================================
  // Regra de sugestão de frete por km (provisória - parametrizar futuramente)
  // ============================================================
  const FRETE_BASE_SUGESTAO = 100; // valor base mínimo
  const FRETE_POR_KM = 2.5; // valor por km rodado

  const sugerirFretePorDistancia = (distanciaKm: number): number | null => {
    if (!distanciaKm || distanciaKm <= 0) return null;
    const sugestao = FRETE_BASE_SUGESTAO + (distanciaKm * FRETE_POR_KM);
    return Math.round(sugestao * 100) / 100;
  };

  const addEndereco = () => {
    const novoTipo = data.enderecos.length === 0 ? "coleta" : "entrega";
    setData((prev) => ({ ...prev, enderecos: [...prev.enderecos, { ...emptyEndereco(), sequencia: prev.enderecos.length + 1, tipo: novoTipo }] }));
  };

  const removeEndereco = (idx: number) => {
    setData((prev) => ({ ...prev, enderecos: prev.enderecos.filter((_, i) => i !== idx).map((e, i) => ({ ...e, sequencia: i + 1 })) }));
  };

  const gerarOS = async () => {
    try {
      // Bloquear se cliente estiver inadimplente (checagem prévia por uuid)
      if (data.clienteId) {
        const inadimplencia = await verificarInadimplenciaCliente(data.clienteId);
        if (inadimplencia.inadimplente) {
          toast.error(`Cliente inadimplente: ${inadimplencia.mensagem}`);
          return;
        }
      }

      // Fonte única de conversão: o serviço resolve o cliente (uuid — cadastra o
      // cliente da cotação quando necessário), grava endereços/carga/histórico e
      // atualiza o status do orçamento. Elimina o insert legado que mandava o
      // NOME em `ordens_servico.cliente` (uuid) e escrevia em `os_enderecos`.
      const resultado = await gerarOSDoOrcamento(comDerivadosCarga(data));
      if (!resultado.success) {
        toast.error(resultado.erro || "Erro ao gerar OS.");
        return;
      }

      setData((prev) => ({
        ...prev,
        status: "convertido" as OrcamentoStatus,
        osVinculadaId: resultado.osId,
        osVinculadaNumero: resultado.osNumero,
      }));
      toast.success(`Ordem de Serviço ${resultado.osNumero || ""} criada com sucesso!`);
    } catch (e: any) {
      console.error("[gerarOS] Erro catch:", e);
      toast.error("Erro ao gerar OS: " + e.message);
    }
  };

  // TMS-COM-CARGA-01 — grava os derivados reais da carga (cubagem/peso cubado/
  // peso considerado) e a recomendação explicável de veículo no contrato JSONB.
  const comDerivadosCarga = (orc: Orcamento): Orcamento => {
    const d = calcularDerivadosCarga(orc.carga, fatorSnapshot, catalogoVeiculo, regrasFator, orc.modalidade);
    return {
      ...orc,
      carga: {
        ...orc.carga,
        // TMS-COM-CARGA-02B — quando há grupos, a quantidade total é a soma dos grupos.
        volumes: d.volumesGrupos > 0 ? d.volumesGrupos : orc.carga.volumes,
        cubagem: d.cubagem,
        pesoCubado: d.pesoCubado,
        fatorCubagem: d.fator,
        pesoConsiderado: d.pesoConsiderado,
        pesoCubadoDisponivel: d.fatorDisponivel,
        fatorCubagemContexto: d.fatorContexto || undefined,
      },
      veiculo: {
        ...orc.veiculo,
        recomendado: d.recomendacao.disponivel && d.recomendacao.tipo ? d.recomendacao.tipo : undefined,
        recomendacaoDisponivel: d.recomendacao.disponivel,
        recomendacaoMotivos: d.recomendacao.motivos,
      },
      // TMS-COM-PRECO-01 — snapshot com flag de override manual (calculado vs ajustado).
      valores: (() => {
        const p = orc.valores?.pricing;
        if (!p) return orc.valores;
        const override = Number(orc.valores.valorFinal || 0) !== Number(p.valorCalculado || 0);
        return { ...orc.valores, pricing: { ...p, overrideManual: override } };
      })(),
    };
  };

  const handleSalvar = () => {
    // TMS-COM-ORC-02 — payload com os valores FINAIS calculados SINCRONAMENTE
    // na mesma operação (elimina o race do setData assíncrono do recalcular()).
    let payload = montarPayloadOrcamento(comDerivadosCarga(data));
    if (payload.distancia_rota && payload.distancia_rota.distancia_km > 0) {
      const sugestaoFrete = sugerirFretePorDistancia(payload.distancia_rota.distancia_km);
      if (sugestaoFrete !== null) {
        payload = {
          ...payload,
          frete_sugerido: {
            valor_base: FRETE_BASE_SUGESTAO,
            valor_por_km: FRETE_POR_KM,
            sugestao: sugestaoFrete,
            distancia_km: payload.distancia_rota.distancia_km,
          },
        };
      }
    }
    setData(payload);
    onSalvar(payload);
    exitGuard.markClean();
  };

  const handleSalvarRascunho = () => {
    const payload = { ...montarPayloadOrcamento(comDerivadosCarga(data)), status: "rascunho" as OrcamentoStatus };
    setData(payload);
    onSalvar(payload);
    exitGuard.markClean();
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // MISSÃO COTACAO-EXPRESS — gera o link público da Fase 2 e move a cotação
  // para 'Aguardando Detalhes' (cliente completa número/complemento/contato).
  const handleGerarLinkFase2 = async () => {
    if (gerandoLinkFase2) return;
    if (modo === "novo") {
      toast.warning("Salve o orçamento antes de gerar o link da Fase 2.");
      return;
    }
    setGerandoLinkFase2(true);
    try {
      let id = cotacaoIdForm;
      if (!id) {
        const busca = await buscarCotacaoPorOrcamento(data.id);
        if (!busca.ok || !busca.dado) {
          toast.error("Nenhuma cotação pública vinculada a este orçamento.");
          return;
        }
        id = busca.dado.id;
        setCotacaoIdForm(id);
      }
      const res = await gerarLinkFase2EAtualizarStatus(id);
      if (!res.ok || !res.dado) {
        toast.error(res.erro || "Não foi possível gerar o link da Fase 2.");
        return;
      }
      try {
        await navigator.clipboard.writeText(res.dado);
        toast.success("Link da Fase 2 copiado!", { description: res.dado, duration: 60000 });
      } catch {
        toast.success("Link da Fase 2 gerado!", { description: res.dado, duration: 60000 });
      }
    } finally {
      setGerandoLinkFase2(false);
    }
  };

  const etapasDoc = obterDocStepsOrcamento(data);
  const idxAbaAtual = etapasDoc.findIndex((s) => s.value === abaAtiva);
  const temProximaEtapa = idxAbaAtual >= 0 && idxAbaAtual < etapasDoc.length - 1;
  const handleAvancarEtapa = () => {
    const proxima = etapasDoc[idxAbaAtual + 1];
    if (proxima) setAbaAtiva(proxima.value);
  };

  return (
    <PremiumDocumentDialog>
      {/* Cabeçalho fixo do formulário premium */}
      <PremiumDialogHeader onClose={handleExit}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button variant="outline" size="icon" onClick={handleExit} title="Voltar" className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm font-extrabold text-slate-800 truncate">
                {modo === "novo" ? "Novo Orçamento Comercial" : "Orçamento Comercial"} <span className="text-primary">{data.numero}</span>
              </h1>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${STATUS_CONFIG[data.status]?.color || "bg-slate-100 text-slate-600"}`}>
                {STATUS_CONFIG[data.status]?.label || data.status}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              {modo === "novo" ? "Novo orçamento" : data.cliente || "Cliente não definido"}
              {data.validade ? ` • Válido até ${new Date(data.validade + "T12:00:00").toLocaleDateString("pt-BR")}` : ""}
              {data.modalidade ? ` • ${data.modalidade === "contrato" ? "Contrato" : data.modalidade === "esporadico" ? "Esporádico" : data.modalidade}` : ""}
              {data.responsavel ? ` • ${data.responsavel}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* MISSÃO COTACAO-EXPRESS — abre a Fase 2 para o cliente completar os endereços */}
          {podeGerarLinkFase2 && (
            <Button variant="outline" size="sm" onClick={() => void handleGerarLinkFase2()} disabled={gerandoLinkFase2}>
              {gerandoLinkFase2 ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Link2 className="w-4 h-4 mr-1" />}
              Gerar Link da Fase 2
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={async () => await gerarPdfOrcamento(data)}><FileDown className="w-4 h-4 mr-1" /> Gerar PDF</Button>
          <Button variant="outline" size="sm" disabled>Gerar Contrato</Button>
          {data.status === "aprovado" && <Button variant="default" size="sm" onClick={() => gerarOS()}>Converter em OS</Button>}
        </div>
      </PremiumDialogHeader>

      {/* Workspace Enterprise */}
      <div className="flex-1 min-h-0 p-3 sm:p-4">
        <EnterpriseFormWorkspace>
          <EnterpriseWorkspaceHeader>
      {/* Resumo horizontal do workspace — indicadores rápidos da etapa atual */}
      <div className="px-4 pb-3 pt-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <MetaChip icon={Gauge} label="Prioridade" value={data.prioridade || "—"} tone={data.prioridade === "urgente" ? "red" : data.prioridade === "normal" ? "blue" : "slate"} />
          <MetaChip icon={FileText} label="Modalidade" value={data.modalidade === "contrato" ? "Contrato" : data.modalidade === "esporadico" ? "Esporádico" : data.modalidade || "—"} tone="slate" />
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_CONFIG[data.status]?.color || "bg-slate-100 text-slate-600"}`}>
            {STATUS_CONFIG[data.status]?.label || data.status}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
          <StatCard icon={DollarSign} label="Valor Final" value={fmt(data.valores?.valorFinal || 0)} tone={(data.valores?.valorFinal || 0) > 0 ? "blue" : "slate"} />
          <StatCard icon={Truck} label="Custo Prest." value={fmt(data.valores?.custoEstimado || 0)} tone={(data.valores?.custoEstimado || 0) > 0 ? "orange" : "slate"} />
          <StatCard icon={TrendingUp} label="Lucro Est." value={fmt(data.valores?.lucroEstimado || 0)} tone={(data.valores?.lucroEstimado || 0) >= 0 ? "green" : "red"} />
          <StatCard icon={TrendingUp} label="Margem" value={`${data.valores?.margemEstimada || 0}%`} tone={(data.valores?.margemEstimada || 0) >= 15 ? "green" : (data.valores?.margemEstimada || 0) > 0 ? "amber" : "slate"} />
          <StatCard icon={Route} label="Distância" value={data.distancia_rota?.distancia_texto || "—"} tone="slate" />
          <StatCard icon={FileText} label="Tabela" value={data.valores?.tabelaVinculada || "Nenhuma"} tone="slate" />
        </div>
      </div>
      </EnterpriseWorkspaceHeader>

      <EnterpriseFormBody>
        {/* Painel lateral esquerdo — contexto comercial */}
        <EnterpriseContextSidebar>
          <PanelSection icon={Building2} title="Contrato" accent="primary">
            <PanelRow label="Cliente" value={data.cliente || "—"} />
            <PanelRow label="Unidade" value={data.unidade || "—"} />
            <PanelRow label="Tipo de Operação" value={data.tipoOperacao || "—"} />
            <PanelRow label="Modalidade" value={data.modalidade === "contrato" ? "Contrato" : data.modalidade === "esporadico" ? "Esporádico" : data.modalidade || "—"} />
            <PanelRow label="Responsável" value={data.responsavel || "—"} />
            <PanelRow label="Validade" value={data.validade ? new Date(data.validade + "T12:00:00").toLocaleDateString("pt-BR") : "—"} />
          </PanelSection>
          <PanelSection icon={Gauge} title="Prioridade & Status" accent="blue">
            <PanelRow label="Prioridade" value={<span className="capitalize">{data.prioridade || "—"}</span>} />
            <PanelRow label="Status" value={<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CONFIG[data.status]?.color || "bg-slate-100 text-slate-600"}`}>{STATUS_CONFIG[data.status]?.label || data.status}</span>} />
            <PanelRow label="Emissão" value={data.dataEmissao ? new Date(data.dataEmissao + "T12:00:00").toLocaleDateString("pt-BR") : "—"} />
          </PanelSection>
          <ResumoOrcamentoPanel data={data} distanciaRota={distanciaRota} />
        </EnterpriseContextSidebar>

        <EnterpriseMainContent>

      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
        <EnterpriseStepStrip className="mb-5">
          <DocStepNavigation steps={obterDocStepsOrcamento(data)} value={abaAtiva} />
        </EnterpriseStepStrip>

        {/* IDENTIFICAÇÃO */}
        <TabsContent value="identificacao">
          <div className="space-y-4">
          <FormSectionCard icon={Info} title="Dados do Documento" description="Identificação básica do orçamento comercial.">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Número"><Input value={data.numero} readOnly className="bg-muted" /></Field>
              <Field label="Data de Emissão"><Input type="date" value={data.dataEmissao} max={new Date().toISOString().split("T")[0]} readOnly={readOnly} onChange={(e) => update("dataEmissao", e.target.value)} /></Field>
              <Field label="Validade"><Input type="date" value={data.validade} readOnly={readOnly} onChange={(e) => update("validade", e.target.value)} /></Field>
              <Field label="Cliente">
                 {readOnly ? <Input value={data.cliente} readOnly /> : (
                   <SearchableSelect 
                     table="clientes" 
                     labelField="nome_fantasia" 
                     valueField="nome_fantasia" 
                     searchFields={["nome_fantasia", "razao_social", "cnpj"]} 
                     secondaryField="cnpj"
                     value={data.cliente} 
                     onChange={(v, rec) => {
                        update("cliente", v || "");
                        if (rec && rec.cnpj) update("clienteCnpj", rec.cnpj);
                        if (rec && rec.condicao_comercial_tabela_id) {
                           setData(p => ({ ...p, valores: { ...p.valores, tabelaVinculada: String(rec.condicao_comercial_tabela_id) }}));
                           toast.success("Tabela de Valores vinculada carregada automaticamente!");
                        }
                     }} 
                   />
                 )}
              </Field>
              <Field label="CNPJ do Cliente"><Input value={data.clienteCnpj} readOnly={readOnly} onChange={(e) => update("clienteCnpj", e.target.value)} /></Field>
              <Field label="Pedido Interno"><Input value={data.pedidoInterno} readOnly={readOnly} onChange={(e) => update("pedidoInterno", e.target.value)} /></Field>
            </div>
          </FormSectionCard>

          <FormSectionCard icon={ListChecks} title="Contexto Comercial" description="Condições comerciais e responsáveis.">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Unidade">
                <Select value={data.unidade} onValueChange={(v) => update("unidade", v)} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="São Paulo - Matriz">São Paulo - Matriz</SelectItem>
                    <SelectItem value="Rio de Janeiro">Rio de Janeiro</SelectItem>
                    <SelectItem value="Porto Alegre">Porto Alegre</SelectItem>
                    <SelectItem value="Belo Horizonte">Belo Horizonte</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Centro de Custo"><Input value={data.centroCusto} readOnly={readOnly} onChange={(e) => update("centroCusto", e.target.value)} /></Field>
              <Field label="Responsável"><Input value={data.responsavel} readOnly={readOnly} onChange={(e) => update("responsavel", e.target.value)} /></Field>
              <Field label="Tipo de Operação">
                <Select value={data.tipoOperacao} onValueChange={(v) => update("tipoOperacao", v)} disabled={readOnly}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Distribuição">Distribuição</SelectItem>
                    <SelectItem value="Transferência">Transferência</SelectItem>
                    <SelectItem value="Coleta e Entrega">Coleta e Entrega</SelectItem>
                    <SelectItem value="Dedicado">Dedicado</SelectItem>
                    <SelectItem value="Last Mile">Last Mile</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Modalidade">
                <Select value={data.modalidade} onValueChange={(v) => update("modalidade", v as any)} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contrato">Contrato</SelectItem>
                    <SelectItem value="esporadico">Esporádico</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Prioridade">
                <Select value={data.prioridade} onValueChange={(v) => update("prioridade", v as any)} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                    <SelectItem value="programada">Programada</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select value={data.status} onValueChange={(v) => {
                  update("status", v);
                  setData((prev) => ({ ...prev, status: v as OrcamentoStatus, historico: [...prev.historico, { data: new Date().toLocaleString("pt-BR"), acao: `Status alterado para ${STATUS_CONFIG[v as OrcamentoStatus].label}`, usuario: "Usuário atual" }] }));
                }} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FormSectionCard>

          <FormSectionCard icon={Truck} title="COMO A CARGA SERÁ TRANSPORTADA?" description="Defina o motor de decisão da cotação.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <button type="button" onClick={() => { setModalidadeTransporte('dedicado'); setParceiroExterno(''); }} className={`flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition ${modalidadeTransporte === 'dedicado' ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'border-slate-200 hover:border-slate-300'}`}>
                <span className="text-2xl">🚚</span>
                <span className="text-sm font-bold text-slate-800">Conexão — Dedicado</span>
                <span className="text-[11px] text-muted-foreground">Frota e tabela Conexão</span>
              </button>
              <button type="button" onClick={() => { setModalidadeTransporte('fracionado'); setParceiroExterno(''); }} className={`flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition ${modalidadeTransporte === 'fracionado' ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'border-slate-200 hover:border-slate-300'}`}>
                <span className="text-2xl">🚛</span>
                <span className="text-sm font-bold text-slate-800">Parceiro — Fracionado</span>
                <span className="text-[11px] text-muted-foreground">Transportadoras / gateway</span>
              </button>
              <button type="button" onClick={() => { setModalidadeTransporte('aereo'); setParceiroExterno(''); }} className={`flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition ${modalidadeTransporte === 'aereo' ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'border-slate-200 hover:border-slate-300'}`}>
                <span className="text-2xl">✈️</span>
                <span className="text-sm font-bold text-slate-800">Aéreo</span>
                <span className="text-[11px] text-muted-foreground">Companhias aéreas</span>
              </button>
              <button type="button" onClick={() => { setModalidadeTransporte('comparar_todas'); setParceiroExterno(''); }} className={`flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition ${modalidadeTransporte === 'comparar_todas' ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'border-slate-200 hover:border-slate-300'}`}>
                <span className="text-2xl">🔄</span>
                <span className="text-sm font-bold text-slate-800">Comparar todas</span>
                <span className="text-[11px] text-muted-foreground">Simulação inteligente</span>
              </button>
            </div>
          </FormSectionCard>

          <FormSectionCard icon={Clock} title="Observações Gerais">
            <Field label="Observações Gerais" className="md:col-span-2 lg:col-span-3">
              <Textarea value={data.observacoesGerais} readOnly={readOnly} onChange={(e) => update("observacoesGerais", e.target.value)} rows={3} />
            </Field>
          </FormSectionCard>
          </div>
        </TabsContent>

        {/* ENDEREÇOS */}
        <TabsContent value="enderecos">
          <div className="space-y-4">
            {data.enderecos.map((end, idx) => (
              <Card key={idx}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      Ponto {end.sequencia} – {end.tipo === "coleta" ? "Coleta" : end.tipo === "entrega" ? "Entrega" : "Retorno"}
                    </CardTitle>
                    <div className="flex gap-2">
                       {!readOnly && <SaveFavoritoButton endereco={end} />}
                       {!readOnly && data.enderecos.length > 1 && (
                         <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeEndereco(idx)}><Trash2 className="w-3.5 h-3.5" /></Button>
                       )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-4 pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Field label="Tipo">
                      <Select value={end.tipo} onValueChange={(v) => { const e = [...data.enderecos]; e[idx] = { ...e[idx], tipo: v as any }; setData((p) => ({ ...p, enderecos: e })); }} disabled={readOnly}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="coleta">Coleta</SelectItem>
                          <SelectItem value="entrega">Entrega</SelectItem>
                          <SelectItem value="retorno">Retorno</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Contato"><Input value={end.contato} readOnly={readOnly} onChange={(e) => { const es = [...data.enderecos]; es[idx] = { ...es[idx], contato: e.target.value }; setData((p) => ({ ...p, enderecos: es })); }} /></Field>
                    <Field label="Telefone"><Input value={end.telefone} readOnly={readOnly} onChange={(e) => { const es = [...data.enderecos]; es[idx] = { ...es[idx], telefone: e.target.value }; setData((p) => ({ ...p, enderecos: es })); }} /></Field>
                    <Field label="Janela Início"><Input type="time" value={end.janelaInicio} readOnly={readOnly} onChange={(e) => { const es = [...data.enderecos]; es[idx] = { ...es[idx], janelaInicio: e.target.value }; setData((p) => ({ ...p, enderecos: es })); }} /></Field>
                    <Field label="Janela Fim"><Input type="time" value={end.janelaFim} readOnly={readOnly} onChange={(e) => { const es = [...data.enderecos]; es[idx] = { ...es[idx], janelaFim: e.target.value }; setData((p) => ({ ...p, enderecos: es })); }} /></Field>
                  </div>

                  {readOnly ? (
                     <Field label="Endereço Cadastrado"><Input value={`${end.endereco}${end.cidade ? ', ' + end.cidade : ''}${end.uf ? '/' + end.uf : ''}${end.cep ? ' - ' + end.cep : ''}`} readOnly /></Field>
                  ) : (
<EnderecoCompleto
                         label="Dados do Endereço (ViaCEP)"
                         value={{ cep: end.cep || "", logradouro: end.logradouro || "", numero: end.numero || "", complemento: end.complemento || "", bairro: end.bairro || "", cidade: end.cidade || "", estado: end.uf || "", referencia: end.instrucoes || "" } as any}
                          onChange={(obj) => {
                             const { logradouro: log, numero: num } = (() => {
                               const match = obj.logradouro?.match(/^(.+?),\s*(\d+)\s*[-–]?\s*$/);
                               return match ? { logradouro: match[1].trim(), numero: match[2].trim() } : { logradouro: obj.logradouro, numero: obj.numero };
                             })();
                             const es = [...data.enderecos];
                             const uf = (obj.estado || end.uf || "").length > 2
                               ? (obj.estado || end.uf || "").substring(0, 2).toUpperCase()
                               : (obj.estado || end.uf || "");
                             es[idx] = {
                               ...es[idx],
                               cep: obj.cep,
                               logradouro: log,
                               numero: num,
                               complemento: obj.complemento,
                               bairro: obj.bairro || end.bairro || "",
                               cidade: obj.cidade || end.cidade || "",
                               uf: uf,
                               instrucoes: obj.referencia || "",
                               endereco: `${log}${num ? ', ' + num : ''}${obj.bairro || end.bairro ? ' - ' + (obj.bairro || end.bairro) : ''}, ${obj.cidade || end.cidade || ''}/${uf}`.replace(/^, |^ - /g, "").replace(/, \/$/, "")
                             };
                             setData((p) => ({ ...p, enderecos: es }));
                          }}
                      />
                  )}
                  
                  <Field label="Instruções Específicas / Referência" className="lg:col-span-2">
                     <Input value={end.instrucoes} readOnly={readOnly} onChange={(e) => { const es = [...data.enderecos]; es[idx] = { ...es[idx], instrucoes: e.target.value }; setData((p) => ({ ...p, enderecos: es })); }} />
                  </Field>
                </CardContent>
              </Card>
            ))}
            {distanciaRota && (
              <Card className="mt-4 bg-blue-50 border-blue-200">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Route className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">Distância Coleta → Última Entrega</p>
                        <p className="text-xs text-blue-600"> {distanciaRota.distanciaTexto} · {distanciaRota.duracaoTexto}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {!readOnly && (
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={addEndereco}><Plus className="w-4 h-4 mr-1" /> Adicionar Ponto</Button>
                {distanciaRota && (
                  <Button variant="ghost" size="sm" onClick={calcularDistanciaRota} disabled={calculandoDistancia}>
                    {calculandoDistancia ? "Calculando..." : "Atualizar Distância"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* CARGA */}
        <TabsContent value="carga">
          <Card>
            <CardContent className="p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Field label="Descrição da Carga" className="lg:col-span-2"><Input value={data.carga.descricao} readOnly={readOnly} onChange={(e) => update("carga.descricao", e.target.value)} /></Field>
                <Field label="Quantidade de Volumes"><Input type="number" value={data.carga.volumes || ""} readOnly={readOnly} onChange={(e) => update("carga.volumes", Number(e.target.value))} /></Field>
                <Field label="Peso real total (kg)"><Input type="number" value={data.carga.peso || ""} readOnly={readOnly} onChange={(e) => update("carga.peso", Number(e.target.value))} /></Field>
                <Field label="Pallets"><Input type="number" value={data.carga.pallets || ""} readOnly={readOnly} onChange={(e) => update("carga.pallets", Number(e.target.value))} /></Field>
                <Field label="Valor Declarado (R$)"><Input type="number" value={data.carga.valorDeclarado || ""} readOnly={readOnly} onChange={(e) => update("carga.valorDeclarado", Number(e.target.value))} /></Field>
                <div className="flex items-center gap-6 lg:col-span-1">
                  <div className="flex items-center gap-2">
                    <Switch checked={data.carga.refrigerado} onCheckedChange={(v) => update("carga.refrigerado", v)} disabled={readOnly} />
                    <Label className="text-xs">Isotérmico / Refrigerado</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={data.carga.ajudante} onCheckedChange={(v) => update("carga.ajudante", v)} disabled={readOnly} />
                    <Label className="text-xs">Ajudante</Label>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground lg:col-span-4">
                  <strong>Classificação térmica:</strong> <strong>Seco</strong>, <strong>Térmico/Isotérmico</strong> (conserva a temperatura sem gerar frio) e <strong>Refrigerado</strong> (cadeia de frio). A exigência exata é definida na <em>Tabela de Valores</em>; o interruptor Isotérmico/Refrigerado sinaliza operação com controle de temperatura.
                </p>
                <Field label="Observações da Carga" className="lg:col-span-4">
                  <Textarea value={data.carga.observacoes} readOnly={readOnly} onChange={(e) => update("carga.observacoes", e.target.value)} rows={2} />
                </Field>
              </div>

              {/* DIMENSÕES DOS VOLUMES — grupos com tamanhos diferentes */}
              <div className="rounded-xl border-2 border-primary/20 bg-primary/[0.02] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-bold flex items-center gap-2 text-primary uppercase tracking-wide">
                    <Package className="w-4 h-4" /> Dimensões dos Volumes
                  </p>
                  {!readOnly && (
                    <Button variant="outline" size="sm" onClick={addDimensao}>
                      <Plus className="w-4 h-4 mr-1" /> Adicionar grupo de volumes
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Cada grupo pode ter tamanho diferente. Informe as dimensões em <strong>centímetros</strong>; a cubagem do grupo e o total são calculados automaticamente.
                </p>
                {(data.carga.dimensoes || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhum grupo informado. Adicione um grupo de volumes para calcular a cubagem por dimensão.
                    Sem grupos, a cubagem usa o valor já informado no orçamento (quando existir).
                  </p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">#</TableHead>
                          <TableHead>Qtd</TableHead>
                          <TableHead>Comprimento (cm)</TableHead>
                          <TableHead>Largura (cm)</TableHead>
                          <TableHead>Altura (cm)</TableHead>
                          <TableHead className="text-right">Cubagem do grupo (m³)</TableHead>
                          <TableHead className="w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(data.carga.dimensoes || []).map((d, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                            <TableCell><Input type="number" className="h-8 w-20" value={d.quantidade || ""} readOnly={readOnly} onChange={(e) => updateDimensao(i, "quantidade", Number(e.target.value))} /></TableCell>
                            <TableCell><Input type="number" className="h-8 w-24" value={d.comprimentoCm || ""} readOnly={readOnly} onChange={(e) => updateDimensao(i, "comprimentoCm", Number(e.target.value))} /></TableCell>
                            <TableCell><Input type="number" className="h-8 w-24" value={d.larguraCm || ""} readOnly={readOnly} onChange={(e) => updateDimensao(i, "larguraCm", Number(e.target.value))} /></TableCell>
                            <TableCell><Input type="number" className="h-8 w-24" value={d.alturaCm || ""} readOnly={readOnly} onChange={(e) => updateDimensao(i, "alturaCm", Number(e.target.value))} /></TableCell>
                            <TableCell className="text-right font-mono text-xs">{fmtNum(volumeM3PorGrupo(d))}</TableCell>
                            <TableCell>
                              {!readOnly && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => removeDimensao(i)} title="Remover grupo">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        {derivados.volumesGrupos} volume(s) nos grupos · cubagem total{" "}
                        <strong className="text-foreground">{fmtNum(derivados.cubagem)} m³</strong>
                      </span>
                      {Number(data.carga.volumes || 0) > 0 && Number(data.carga.volumes || 0) !== derivados.volumesGrupos && (
                        <span className="text-amber-700">
                          Quantidade de Volumes informada ({data.carga.volumes || 0}) difere da soma dos grupos ({derivados.volumesGrupos}). Ao salvar, prevalece a soma dos grupos.
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* RESUMO FÍSICO DA CARGA */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Resumo físico da carga</p>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="rounded-xl border bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Volumes totais</p><p className="text-lg font-extrabold">{derivados.volumesGrupos > 0 ? derivados.volumesGrupos : (data.carga.volumes || 0)}</p></div>
                  <div className="rounded-xl border bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Peso real</p><p className="text-lg font-extrabold">{(data.carga.peso || 0).toLocaleString("pt-BR")} kg</p></div>
                  <div className="rounded-xl border bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Cubagem total</p><p className="text-lg font-extrabold">{fmtNum(derivados.cubagem)} m³</p></div>
                  <div className="rounded-xl border bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Peso cubado</p><p className="text-lg font-extrabold">{derivados.fatorDisponivel ? `${derivados.pesoCubado.toLocaleString("pt-BR")} kg` : "— não configurado"}</p></div>
                  <div className="rounded-xl border bg-indigo-50 border-indigo-100 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Peso considerado</p><p className="text-lg font-extrabold text-indigo-700">{derivados.pesoConsiderado.toLocaleString("pt-BR")} kg</p></div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Peso considerado = MAX(peso real, peso cubado).{" "}
                  {derivados.fatorDisponivel
                    ? <>Fator aplicado: <strong>{derivados.fator} kg/m³</strong>{derivados.fatorContexto && derivados.fatorContexto !== "snapshot" ? ` (${derivados.fatorContexto})` : derivados.fatorContexto === "snapshot" ? " (snapshot do orçamento)" : ""}.</>
                    : <>Fator de cubagem <strong>não configurado</strong> (Configurações → Veículos) — peso cubado não calculado.</>}
                </p>
                {derivados.notas.length > 0 && (
                  <ul className="text-[11px] text-amber-700 space-y-0.5 mt-1">
                    {derivados.notas.map((n, i) => <li key={i}>• {n}</li>)}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VEÍCULO */}
        <TabsContent value="veiculo">
          {modalidadeTransporte === 'dedicado' && (
          <>
          {!readOnly && derivados.recomendacao.disponivel && (
            <Card className="mb-4 border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <Lightbulb className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-blue-800">Veículo recomendado para a operação: <span className="uppercase">{derivados.recomendacao.label || derivados.recomendacao.tipo}</span>{derivados.recomendacao.configuracao ? ` · ${derivados.recomendacao.configuracao}` : ""}</p>
                      {derivados.recomendacao.criterios && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {([
                            ["Peso", derivados.recomendacao.criterios.peso],
                            ["Cubagem", derivados.recomendacao.criterios.cubagem],
                            ["Dimensão individual", derivados.recomendacao.criterios.dimensao],
                            ["Pallets", derivados.recomendacao.criterios.pallets],
                            ...(data.carga.refrigerado ? [["Isotérmico / Refrigerado", derivados.recomendacao.criterios.refrigerado]] : []),
                          ] as [string, string][]).map(([lbl, st]) => (
                            <Badge key={lbl} variant="outline" className={`text-[10px] ${st === "ok" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : st === "falha" ? "bg-red-50 text-red-700 border-red-200" : "bg-slate-50 text-slate-600"}`}>
                              {st === "ok" ? "✓" : st === "falha" ? "✗" : "—"} {lbl}{st === "nao_parametrizado" ? " (não parametrizado)" : ""}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <ul className="mt-1 space-y-0.5">
                        {derivados.recomendacao.motivos.map((m, i) => <li key={i} className="text-xs text-blue-700">• {m}</li>)}
                      </ul>
                      <p className="text-[11px] text-blue-700/80 mt-1">Compatível pelos parâmetros cadastrados. Validação operacional recomendada para cargas complexas/palletizadas.</p>
                    </div>
                  </div>
                  {data.veiculo.tipo !== derivados.recomendacao.tipo && (
                    <Button onClick={aplicarSugestaoVeiculo} className="bg-blue-600 hover:bg-blue-700 gap-2">
                      <Check className="w-4 h-4" /> Usar recomendação
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          {!readOnly && !derivados.recomendacao.disponivel && (data.carga.peso > 0 || (data.carga.dimensoes || []).length > 0) && (
            <Card className="mb-4 border-amber-200 bg-amber-50">
              <CardContent className="p-4">
                <p className="font-semibold text-amber-800 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Recomendação indisponível — capacidade não cadastrada</p>
                <ul className="mt-1 space-y-0.5">
                  {derivados.recomendacao.faltando.map((m, i) => <li key={i} className="text-xs text-amber-700">• {m}</li>)}
                </ul>
                <p className="text-[11px] text-amber-700 mt-1">A seleção manual permanece disponível.</p>
              </CardContent>
            </Card>
          )}
          {/* TMS-COM-CARGA-02 — veículo SELECIONADO incompatível com a carga (não bloqueante) */}
          {data.veiculo.tipo && (() => {
            const comp = avaliarCompatibilidadeVeiculo(data.veiculo.tipo, {
              pesoConsideradoKg: derivados.pesoConsiderado,
              cubagemM3: derivados.cubagem,
              dimensoes: data.carga.dimensoes,
              pallets: data.carga.pallets,
              refrigerado: data.carga.refrigerado === true,
            }, catalogoVeiculo);
            if (comp.ok) return null;
            return (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <p className="font-semibold">A capacidade cadastrada deste veículo é inferior aos dados da carga.</p>
                <ul className="mt-1 space-y-0.5">
                  {comp.excedentes.map((m, i) => <li key={i}>• {m}</li>)}
                </ul>
                <p className="mt-1">A decisão operacional humana é preservada (aviso não bloqueante).</p>
              </div>
            );
          })()}
          {data.veiculo.tipo && derivados.recomendacao.disponivel && derivados.recomendacao.tipo && data.veiculo.tipo !== derivados.recomendacao.tipo && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Veículo <strong>selecionado</strong> ({data.veiculo.tipo}) difere do <strong>recomendado</strong> ({derivados.recomendacao.label || derivados.recomendacao.tipo}) para esta carga. A escolha humana é mantida.
            </div>
          )}
          <Card>
            <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Veículo selecionado para a operação">
                <Select value={data.veiculo.tipo} onValueChange={(v) => update("veiculo.tipo", v)} disabled={readOnly}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_VEICULO.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Subcategoria">
                <Select value={data.veiculo.subcategoria} onValueChange={(v) => update("veiculo.subcategoria", v)} disabled={readOnly}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {["urbano", "leve", "médio", "pesado", "dedicado", "refrigerado", "distribuição", "transferência", "outro"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tipo de Carroceria">
                <Select value={data.veiculo.carroceria} onValueChange={(v) => update("veiculo.carroceria", v)} disabled={readOnly}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {["baú", "baú refrigerado", "baú isotérmico", "sider", "grade baixa", "graneleira", "prancha", "plataforma", "carroceria aberta", "cegonha", "tanque", "container", "furgão", "refrigerada", "lonada", "outro"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>
          </>
          )}

          {modalidadeTransporte === 'aereo' && (
            <Card>
              <CardContent className="space-y-4 p-5">
                <Field label="Qual Companhia Aérea?">
                  <Select value={parceiroExterno} onValueChange={setParceiroExterno} disabled={readOnly}>
                    <SelectTrigger><SelectValue placeholder="Selecione a companhia" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AZUL_CARGO">Azul Cargo Logistics</SelectItem>
                      <SelectItem value="GOLLOG">Gollog</SelectItem>
                      <SelectItem value="LATAM_CARGO">Latam Cargo</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </CardContent>
            </Card>
          )}

          {modalidadeTransporte === 'fracionado' && (
            <Card>
              <CardContent className="space-y-4 p-5">
                <Field label="Qual Transportadora/Gateway?">
                  <Select value={parceiroExterno} onValueChange={setParceiroExterno} disabled={readOnly}>
                    <SelectTrigger><SelectValue placeholder="Selecione a transportadora" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FRENET">Frenet Gateway</SelectItem>
                      <SelectItem value="RODONAVES">RTE Rodonaves</SelectItem>
                      <SelectItem value="JAMEF">Jamef Encomendas Urgentes</SelectItem>
                      <SelectItem value="BRASPRESS">Braspress</SelectItem>
                      <SelectItem value="KANGU">Kangu - Mercado Livre</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </CardContent>
            </Card>
          )}

          {modalidadeTransporte === 'comparar_todas' && (
            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">Comparativo de modalidades</p>
                  <Button className="gap-2" onClick={() => console.log("Rodar Simulação Inteligente")}>
                    ⚡ Rodar Simulação Inteligente
                  </Button>
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Opção</TableHead>
                        <TableHead>Prazo</TableHead>
                        <TableHead>Custo Interno</TableHead>
                        <TableHead>Venda</TableHead>
                        <TableHead>Cobertura</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                          Nenhuma simulação executada. Clique em "Rodar Simulação Inteligente" para comparar as modalidades.
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* VALORES */}
        <TabsContent value="valores">
          {modalidadeTransporte === 'dedicado' && (
          <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Composição de Valores</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
                <Field label="Tabela Vinculada"><Input value={data.valores.tabelaVinculada} readOnly={readOnly} onChange={(e) => update("valores.tabelaVinculada", e.target.value)} /></Field>
                <Field label="Valor Base (R$)"><Input type="number" value={data.valores.valorBase || ""} readOnly={readOnly} onChange={(e) => update("valores.valorBase", Number(e.target.value))} onBlur={recalcular} /></Field>
                <Field label="Adicionais (R$)"><Input type="number" value={data.valores.adicionais || ""} readOnly={readOnly} onChange={(e) => update("valores.adicionais", Number(e.target.value))} onBlur={recalcular} /></Field>
                <Field label="Pedágio (R$)"><Input type="number" value={data.valores.pedagio || ""} readOnly={readOnly} onChange={(e) => update("valores.pedagio", Number(e.target.value))} onBlur={recalcular} /></Field>
                <Field label="Km Excedente (R$)"><Input type="number" value={data.valores.kmExcedente || ""} readOnly={readOnly} onChange={(e) => update("valores.kmExcedente", Number(e.target.value))} onBlur={recalcular} /></Field>
                <Field label="Ajudante (R$)"><Input type="number" value={data.valores.ajudante || ""} readOnly={readOnly} onChange={(e) => update("valores.ajudante", Number(e.target.value))} onBlur={recalcular} /></Field>
                <Field label="Devolução (R$)"><Input type="number" value={data.valores.devolucao || ""} readOnly={readOnly} onChange={(e) => update("valores.devolucao", Number(e.target.value))} onBlur={recalcular} /></Field>
                <Field label="Reentrega (R$)"><Input type="number" value={data.valores.reentrega || ""} readOnly={readOnly} onChange={(e) => update("valores.reentrega", Number(e.target.value))} onBlur={recalcular} /></Field>
                <Field label="Descontos (R$)"><Input type="number" value={data.valores.descontos || ""} readOnly={readOnly} onChange={(e) => update("valores.descontos", Number(e.target.value))} onBlur={recalcular} /></Field>
                <Field label="Custo Estimado (R$)"><Input type="number" value={data.valores.custoEstimado || ""} readOnly={readOnly} onChange={(e) => update("valores.custoEstimado", Number(e.target.value))} onBlur={recalcular} /></Field>
              </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4"/> Resumo do Resultado</CardTitle></CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Distância</span><span className="font-bold">{data.distancia_rota?.distancia_texto || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tabela</span><span className="text-xs font-semibold">{data.valores.tabelaVinculada || "Nenhuma"}</span></div>
                  {(data as any).faixa_aplicada && <div className="flex justify-between"><span className="text-muted-foreground">Faixa</span><span className="text-xs">{ (data as any).faixa_aplicada }</span></div>}
                  <hr className="border-primary/10" />
                  <div className="flex justify-between"><span className="text-muted-foreground">Valor Base Cliente</span><span>{fmt(data.valores.valorBase)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">+ Adicionais</span><span>{fmt(data.valores.adicionais)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">+ Pedágio</span><span>{fmt(data.valores.pedagio)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">+ Km Excedente</span><span>{fmt(data.valores.kmExcedente)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">+ Ajudante</span><span>{fmt(data.valores.ajudante)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">+ Devolução</span><span>{fmt(data.valores.devolucao)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">+ Reentrega</span><span>{fmt(data.valores.reentrega)}</span></div>
                  <div className="flex justify-between text-destructive"><span>− Descontos</span><span>{fmt(data.valores.descontos)}</span></div>
                  <hr className="border-primary/20" />
                  <div className="flex justify-between text-lg font-bold text-primary"><span>Valor Final Cliente</span><span>{fmt(data.valores.valorFinal)}</span></div>
                </div>
                <div className="pt-2 border-t border-primary/20 space-y-1 text-sm bg-white/50 p-3 rounded-lg">
                  <div className="flex justify-between"><span className="text-muted-foreground">Custo Prestador</span><span className="font-bold text-orange-600">{fmt(data.valores.custoEstimado)}</span></div>
                  <div className="flex justify-between font-semibold text-green-600"><span>Lucro Estimado</span><span>{fmt(data.valores.lucroEstimado)}</span></div>
                  <div className="flex justify-between font-semibold"><span className="text-muted-foreground">Margem</span><Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{data.valores.margemEstimada}%</Badge></div>
                </div>
                {!data.distancia_rota?.distancia_km && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <p className="text-[10px] text-yellow-700">Preencha os endereços para calcular distância e valor automaticamente.</p>
                  </div>
                )}
                {readOnly ? null : (
                  <Button variant="outline" size="sm" className="w-full border-primary text-primary hover:bg-primary/5" onClick={calcularDistanciaRota} disabled={calculandoDistancia}>
                    {calculandoDistancia ? "Calculando..." : "Recalcular pela distância"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* TMS-COM-PRECO-01 — origem do cálculo (tabela/veículo/distância) + override */}
          <div className="mt-4 rounded-xl border bg-slate-50 p-3 text-xs">
            {data.valores.pricing?.tabelaNome ? (
              <>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span><span className="text-muted-foreground">Tabela aplicada:</span> <strong>{data.valores.pricing.tabelaNome}</strong>{data.valores.pricing.fonte ? ` (${data.valores.pricing.fonte})` : ""}</span>
                  <span><span className="text-muted-foreground">Veículo tarifado:</span> <strong>{(data.valores.pricing.veiculoTarifado || "—").toUpperCase()}</strong></span>
                  <span><span className="text-muted-foreground">Distância considerada:</span> <strong>{Number(data.valores.pricing.distanciaKm || 0).toLocaleString("pt-BR")} km</strong></span>
                  {typeof data.valores.pricing.franquiaKm === "number" && <span><span className="text-muted-foreground">Franquia:</span> {data.valores.pricing.franquiaKm} km</span>}
                </div>
                {Number(data.valores.pricing.valorBase || 0) <= 0 && (
                  <p className="mt-1 text-amber-700">Preço não disponível na tabela selecionada.</p>
                )}
                {data.valores.pricing.overrideManual && (
                  <p className="mt-1 text-amber-700">
                    Preço ajustado manualmente. Calculado: {fmt(data.valores.pricing.valorCalculado || 0)} · Ajustado: {fmt(data.valores.valorFinal)}.
                  </p>
                )}
                {!readOnly && (
                  <Button variant="ghost" size="sm" className="mt-1 h-7 text-primary" onClick={() => setRecalcPricingTick((t) => t + 1)}>
                    Recalcular pela tabela
                  </Button>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Preço automático indisponível: informe cliente, veículo e origem/destino (distância) para aplicar a tabela.</p>
            )}
          </div>
          </>
          )}

          {modalidadeTransporte !== 'dedicado' && (
            <div className="mt-4">
              {!resultadoCotacaoExterna ? (
                <div className="rounded-md border bg-white p-6 text-center">
                  <p className="mb-3 text-sm text-slate-600">Endereços preenchidos. Clique abaixo para buscar os valores na API.</p>
                  <Button className="gap-2" disabled={isCotandoExterno || !parceiroExterno} onClick={handleCotacaoExterna}>
                    {isCotandoExterno ? "Cotando..." : "🔄 Cotar Frete Oficial"}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-slate-800">Composição de Frete Externo</h3>
                    <Button variant="outline" className="gap-2" disabled={isCotandoExterno} onClick={handleCotacaoExterna}>
                      {isCotandoExterno ? "Cotando..." : "🔄 Recalcular Frete"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-4 rounded-md border bg-white p-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                  🔒 Visão Interna (DRE)
                </h3>
                <p className="text-xs text-muted-foreground">Quebra das pernas e custo operacional. Não visível ao cliente.</p>
                <div className="space-y-2 rounded-lg border bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">Perna 1 (Coleta): {resultadoCotacaoExterna.pernaColeta.descricao}</span>
                    <span className="font-semibold text-red-600">R$ {resultadoCotacaoExterna.pernaColeta.custo}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">Perna 2 (Aéreo/LTL): {resultadoCotacaoExterna.pernaPrincipal.descricao}</span>
                    <span className="font-semibold text-red-600">R$ {resultadoCotacaoExterna.pernaPrincipal.custo}</span>
                  </div>
                  {resultadoCotacaoExterna.pernaEntrega && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">Perna 3 (Entrega): {resultadoCotacaoExterna.pernaEntrega.descricao}</span>
                      <span className="font-semibold text-red-600">R$ {resultadoCotacaoExterna.pernaEntrega.custo}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="font-semibold text-slate-700">Custo Total</span>
                    <span className="font-bold text-red-600">R$ {resultadoCotacaoExterna.custoOperacionalTotal}</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="mb-2 text-sm text-slate-500">Margem de Lucro (%)</label>
                  <input
                    type="number"
                    className="border p-2 rounded"
                    value={margemExterna}
                    onChange={(e) => {
                      const newMargin = Number(e.target.value);
                      setMargemExterna(newMargin);
                      const novoValor = resultadoCotacaoExterna.custoOperacionalTotal * (1 + (newMargin / 100));
                      update('valores.valorFinal', novoValor);
                      update('valores.lucroEstimado', novoValor - resultadoCotacaoExterna.custoOperacionalTotal);
                    }}
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-md border border-emerald-100 bg-emerald-50/40 p-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-emerald-800">
                  👤 Visão Cliente
                </h3>
                <p className="text-xs text-emerald-700/70">Serviço unificado apresentado na proposta.</p>
                <div className="rounded-lg border border-emerald-100 bg-white p-4">
                  {resultadoCotacaoExterna.nivelServico === 'RETIRADA_AEROPORTO' ? (
                    <div className="text-orange-600 font-bold mb-2">⚠️ Atenção: Retirada no Aeroporto/Base pelo Cliente (Sem last-mile)</div>
                  ) : (
                    <div className="text-emerald-600 font-bold mb-2">✅ Entrega Porta a Porta</div>
                  )}
                  <span className="text-sm text-emerald-700">
                    {resultadoCotacaoExterna.nivelServico === 'RETIRADA_AEROPORTO'
                      ? (modalidadeTransporte === 'aereo' ? 'Transporte aéreo até o aeroporto' : modalidadeTransporte === 'fracionado' ? 'Transporte fracionado até a base' : 'Transporte até a base')
                      : (modalidadeTransporte === 'aereo' ? 'Transporte aéreo porta a porta' : modalidadeTransporte === 'fracionado' ? 'Transporte fracionado porta a porta' : 'Solução logística porta a porta')}
                  </span>
                  <div className="mt-3 flex flex-col">
                    <span className="text-sm text-emerald-700">Valor Final de Venda</span>
                    <span className="text-2xl font-bold text-emerald-600">R$ {(resultadoCotacaoExterna.custoOperacionalTotal * (1 + (margemExterna / 100))).toFixed(2)}</span>
                    <span className="mt-1 text-xs text-emerald-600/70">Prazo total estimado: {resultadoCotacaoExterna.prazoTotal} dias úteis</span>
                  </div>
                </div>
              </div>
                  </div>
                </>
              )}
            </div>
          )}
        </TabsContent>

        {/* DOCUMENTOS E PDF */}
        <TabsContent value="documentos">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-primary">Documentos Anexos e Geração de Proposta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center text-muted-foreground bg-muted/10">
                 <FileDown className="w-8 h-8 opacity-50 mb-2" />
                 <p className="text-sm font-medium">Nenhum anexo encontrado.</p>
                 <p className="text-xs">Faça upload de cotações, fotos da carga ou referências aqui.</p>
                 {!readOnly && <Button variant="outline" size="sm" className="mt-4">Anexar Arquivo</Button>}
              </div>
              
              <div className="mt-4 flex gap-2 w-full">
                        <Button
                          variant="outline"
                          className="flex-1 text-xs"
                          onClick={() => {
                            toast.success("Gerando PDF profissional...");
                            generateProfessionalPDF(data, "ORÇAMENTO");
                          }}
                        >
                          Gerar PDF
                        </Button>
                        <Button variant="outline" className="flex-1 text-xs"><Copy className="w-3 h-3 mr-1"/> Duplicar</Button>
                      </div>
              
              <div className="flex gap-4 p-4 bg-orange-50/50 rounded-lg border border-orange-100 flex-wrap">
                 <Button onClick={async () => await gerarPdfOrcamento(data)} className="bg-orange-500 hover:bg-orange-600 text-white gap-2"><FileDown className="w-4 h-4"/> Gerar PDF (Proposta Comercial)</Button>
                 <Button variant="outline" onClick={() => window.print()}>Imprimir</Button>
                 <Button variant="outline" className="text-primary hover:text-primary/80" onClick={handleSalvar}>Duplicar</Button>
                 
                  <div className="flex-1 min-w-[200px] flex gap-2 justify-end">
                     {data.status === "enviado" || data.status === "em_analise" ? (
                       <>
                         <Button className="bg-green-600 hover:bg-green-700 text-white gap-2" onClick={() => { 
                           update("status", "aprovado"); 
                           handleSalvar();
                           toast.success("Orçamento aprovado com sucesso!");
                         }}><Check className="w-4 h-4"/> Aprovar</Button>
                         <Button variant="destructive" onClick={() => { update("status", "reprovado"); handleSalvar(); }}>Reprovar</Button>
                       </>
) : (data.status === "aprovado" ? (
                          <Button 
                            className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
                            disabled={convertendo}
                            onClick={async () => {
                              if (convertendo) return;
                              setConvertendo(true);
                              try {
                                const resultado = await gerarOSDoOrcamento(data);
                                if (resultado.success) {
                                  update("status", "convertido");
                                  toast.success(`OS ${resultado.osNumero} criada com sucesso!`);
                                  setTimeout(() => {
                                    window.location.hash = `#/operacao?tab=os&os=${resultado.osId}`;
                                    window.location.reload();
                                  }, 1000);
                                } else {
                                  toast.error(resultado.erro || "Erro ao converter orçamento em OS.");
                                  setConvertendo(false);
                                }
                              } catch (err: any) {
                                toast.error(err.message || "Erro inesperado ao converter.");
                                setConvertendo(false);
                              }
                            }}
                          >{convertendo ? <span className="animate-spin"><Truck className="w-4 h-4"/></span> : <Truck className="w-4 h-4"/>} Converter em OS</Button>
                     ) : null)}
                  </div>
              </div>
              
              <Field label="Observações Finais e Condicionantes">
                <Textarea rows={3} value={data.observacoesGerais} onChange={(e) => update("observacoesGerais", e.target.value)} readOnly={readOnly} />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="historico">
          <Card>
            <CardContent className="p-4">
              {data.motivoReprovacao && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm">
                  <p className="font-semibold text-red-700">Motivo da reprovação:</p>
                  <p className="text-red-600">{data.motivoReprovacao}</p>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Usuário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...data.historico].reverse().map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{h.data}</TableCell>
                      <TableCell className="text-sm">{h.acao}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{h.usuario}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
        </EnterpriseMainContent>
        </EnterpriseFormBody>

        {/* Rodapé interno do workspace */}
        <EnterpriseWorkspaceFooter>
        <FormFooterBar
          onCancelar={handleExit}
          onSalvarRascunho={!readOnly ? handleSalvarRascunho : undefined}
          canRascunho={!readOnly && data.status !== "rascunho"}
          onSalvar={!readOnly ? handleSalvar : undefined}
          salvarLabel="Salvar Orçamento"
          onAvancar={handleAvancarEtapa}
          canAvancar={temProximaEtapa}
          avancarLabel="Avançar"
          readOnly={readOnly}
        />
        </EnterpriseWorkspaceFooter>
        </EnterpriseFormWorkspace>
      </div>
    </PremiumDocumentDialog>
  );
};

export default OrcamentoForm;

