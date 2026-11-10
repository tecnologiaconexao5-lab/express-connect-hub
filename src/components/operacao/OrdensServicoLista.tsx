import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Plus, Filter, Edit, Eye, AlertTriangle, Truck, MapPin, Trash2, Calendar, Clock, ChevronDown, CheckCircle2, LocateFixed, Loader2, FileCheck, Network, BellRing, ShieldAlert, UserPlus, History, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import PaginationBar from "@/components/ui/PaginationBar";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { OrdemServico, obterStatusGlobalOS, statusesOSParaGlobalFiltro } from "./osTypes";
import { STATUS_GLOBAL_INFO, obterClasseBadgeGlobal, STATUS_FILTRO_OPCOES, type StatusGlobal } from "./statusGlobal";
import { obterClasseBadgeDivergencia, obterLabelDivergencia } from "@/services/escala/syncDiagnostico";
import OrdemServicoForm, { limparRascunhoNovaOS } from "./OrdemServicoForm";
import OrdemServicoPreview from "./OrdemServicoPreview";
import EntregasComprovantes from "@/components/comprovantes/EntregasComprovantes";
import RastreamentoOSDialog from "@/components/operacao/RastreamentoOSDialog";
import { fromOSRow, OSRow } from "@/lib/dbMappers";
import { HistoricoOS } from "./HistoricoOS";
import { publicarOportunidade } from "@/services/operacao/redePrestadoresService";
import { notificarBaseAgregados, classificarSlaAlocacao, emRiscoSlaPendente, type NivelSlaAlocacao } from "@/services/operacao/osAlocacaoPendenteService";
import {
  buscarSugestoesPrestadores,
  type MatchOSContext,
  type SugestaoMatch,
} from "@/services/operacao/matchPrestadoresService";
import { PERFORMANCE_CORES } from "@/lib/performancePrestador";
import { formatarDataBR, formatarDataHoraSolicitacaoBR, hojeISOSP } from "@/lib/formatDates";
import { clienteVeioDeCotacao } from "@/lib/clienteCotacao";
import { obterAgendamentoClienteOS } from "@/lib/cotacaoOS";
import { resumoRotaOSDetalhado } from "@/lib/resumoRotaOS";
import { buscarTabelaPrestador } from "@/services/precificacao/buscarTabelasService";

const STATUS_ENCERRADOS = ["finalizada", "cancelada"];
type OSComDataCriacao = OrdemServico & { createdAt?: string };

/** Data local no formato YYYY-MM-DD (evita o deslocamento de fuso do toISOString). */
const dataLocalISO = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Tempo decorrido desde a criação da OS, ex.: "2h 15m". */
const formatarTempoParada = (createdAt?: string | null): string => {
  if (!createdAt) return "";
  const criada = new Date(createdAt).getTime();
  if (Number.isNaN(criada)) return "";
  const diffMin = Math.floor((Date.now() - criada) / (1000 * 60));
  if (diffMin <= 0) return "agora";
  const dias = Math.floor(diffMin / (60 * 24));
  const horas = Math.floor((diffMin % (60 * 24)) / 60);
  const minutos = diffMin % 60;
  const partes: string[] = [];
  if (dias > 0) partes.push(`${dias}d`);
  if (horas > 0) partes.push(`${horas}h`);
  if (minutos > 0 || partes.length === 0) partes.push(`${minutos}m`);
  return partes.join(" ");
};

// LOTE 2 — farol de SLA de alocação (OS sem prestador):
// até 20 min verde · 20–40 amarelo · >40 vermelho.
const FAROL_SLA_CLASSES: Record<NivelSlaAlocacao, string> = {
  ok: "bg-emerald-600 text-white",
  atencao: "bg-amber-500 text-white",
  atrasado: "bg-red-600 text-white",
};
const FAROL_SLA_ROW: Record<NivelSlaAlocacao, string> = {
  ok: "bg-emerald-50/50 border-l-4 border-l-emerald-400 hover:bg-emerald-50",
  atencao: "bg-amber-50/60 border-l-4 border-l-amber-400 hover:bg-amber-50",
  atrasado: "bg-red-50/60 border-l-4 border-l-red-500 hover:bg-red-50",
};

const OrdensServicoLista = () => {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [busca, setBusca] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [modoForm, setModoForm] = useState<"ver" | "editar" | "novo" | null>(null);
  const [osSelecionada, setOsSelecionada] = useState<OrdemServico | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [osPreview, setOsPreview] = useState<OrdemServico | null>(null);
  // Visão DEDICADA de comprovantes/POD (não abre o formulário da OS).
  const [osComprovantes, setOsComprovantes] = useState<OrdemServico | null>(null);
  // Histórico rápido da OS (Dialog na coluna Ações).
  const [osHistorico, setOsHistorico] = useState<OrdemServico | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Filtros
  const [showFiltros, setShowFiltros] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroCliente, setFiltroCliente] = useState("todos");
  const [filtroTipoVeiculo, setFiltroTipoVeiculo] = useState("todos");
  const [filtroTipoCarga, setFiltroTipoCarga] = useState("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  
  // Rastreamento
  const [showRastreamento, setShowRastreamento] = useState(false);
  const [osRastreamento, setOsRastreamento] = useState<OrdemServico | null>(null);
  
  // Exclusão
  const [osParaExcluir, setOsParaExcluir] = useState<OrdemServico | null>(null);
  const [vinculosCount, setVinculosCount] = useState({ escalas: 0, financeiro: 0, pagamentos: 0 });
  const [excluindo, setExcluindo] = useState(false);
  const [syncStatusMap, setSyncStatusMap] = useState<Record<string, { label: string; classe: string }>>({});
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  // Busca aplicada (debounce) — vai para a QUERY, antes do `.range()`.
  const [buscaAplicada, setBuscaAplicada] = useState("");
  // Opções do filtro de cliente (independentes da página atual).
  const [clientesFiltro, setClientesFiltro] = useState<string[]>([]);
  // REFINAMENTO-FLUXO-ALOCACAO-TMS: foco rápido em OSs órfãs (sem prestador).
  const [somenteSemPrestador, setSomenteSemPrestador] = useState(false);
  const [acaoOrfa, setAcaoOrfa] = useState<{ osId: string; tipo: "rede" | "base" } | null>(null);
  // Alocação rápida de prestador para OS sem prestador (coluna Ações).
  const [osAlocando, setOsAlocando] = useState<OrdemServico | null>(null);
  const [prestadorAlocacao, setPrestadorAlocacao] = useState<string | null>(null);
  const [prestadorAlocacaoNome, setPrestadorAlocacaoNome] = useState("");
  const [motoristaAlocacao, setMotoristaAlocacao] = useState("");
  const [repasseAlocacao, setRepasseAlocacao] = useState("");
  const [calculandoRepasse, setCalculandoRepasse] = useState(false);
  const [salvandoAlocacao, setSalvandoAlocacao] = useState(false);
  const [sugestoesAlocacao, setSugestoesAlocacao] = useState<SugestaoMatch[]>([]);
  const [buscandoSugestoesAlocacao, setBuscandoSugestoesAlocacao] = useState(false);
  const PAGE_SIZE = 25;

  // Debounce da busca livre (evita uma query a cada tecla).
  useEffect(() => {
    const timer = setTimeout(() => setBuscaAplicada(busca.trim()), 350);
    return () => clearTimeout(timer);
  }, [busca]);

  // Opções do filtro de cliente — vêm de `clientes`, não só da página actual.
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("clientes")
          .select("nome_fantasia, razao_social")
          .limit(1000);
        if (!ativo) return;
        const nomes = Array.from(
          new Set(
            (data || [])
              .map((c) => {
                const row = c as { nome_fantasia?: string | null; razao_social?: string | null };
                return String(row.nome_fantasia || row.razao_social || "").trim();
              })
              .filter(Boolean),
          ),
        ).sort((a, b) => a.localeCompare(b, "pt-BR"));
        setClientesFiltro(nomes);
      } catch {
        // mantém opções vazias
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (searchParams.get("action") === "novo") {
      setOsSelecionada(null);
      limparRascunhoNovaOS();
      setModoForm("novo");
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
    if (searchParams.get("status")) {
      setFiltroStatus(searchParams.get("status") || "todos");
    }
    // Deep-link: abrir OS específica pelo ID (?os=<id>)
    const osId = searchParams.get("os");
    if (osId) {
      searchParams.delete("os");
      setSearchParams(searchParams, { replace: true });
      // Após carregar, abre a OS no preview
      setTimeout(async () => {
        const { data } = await supabase
          .from("ordens_servico")
          .select("*, clientes(nome_fantasia, razao_social, status, origem_comercial)")
          .eq("id", osId)
          .single();
        if (data) {
          const row = data as OSRow & {
            cliente?: string;
            cliente_id?: string;
            created_at?: string;
            clientes?: { nome_fantasia?: string; razao_social?: string };
          };
          const os = fromOSRow(row);
          const clienteUuidDeepLink =
            row.cliente_id ||
            (typeof row.cliente === "string" && /^[0-9a-f-]{36}$/i.test(row.cliente)
              ? row.cliente
              : os.clienteId);
          const osCompleta: OrdemServico = {
            ...os,
            cliente: row.clientes?.nome_fantasia || row.clientes?.razao_social || os.cliente || "",
            clienteId: clienteUuidDeepLink,
            createdAt: row.created_at,
          };
          setOsPreview(osCompleta);
          setShowPreview(true);
        }
      }, 800);
    }
  }, [searchParams]);


  const fetchOrdens = async (paginaSolicitada?: number) => {
    try {
      setIsLoading(true);
      const pagina = paginaSolicitada ?? page;
      const from = (pagina - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const termoBusca = buscaAplicada.replace(/[%,()*]/g, " ").trim();
      const statusFiltrados =
        filtroStatus !== "todos"
          ? statusesOSParaGlobalFiltro(filtroStatus as StatusGlobal)
          : null;

      // Filtro de cliente por nome → ids (aplicado no backend).
      let clientesFiltroIds: string[] | null = null;
      if (filtroCliente !== "todos") {
        const [porFantasia, porRazao] = await Promise.all([
          supabase.from("clientes").select("id").eq("nome_fantasia", filtroCliente).limit(100),
          supabase.from("clientes").select("id").eq("razao_social", filtroCliente).limit(100),
        ]);
        clientesFiltroIds = Array.from(
          new Set(
            [...(porFantasia.data || []), ...(porRazao.data || [])]
              .map((c) => String((c as { id?: unknown }).id || ""))
              .filter(Boolean),
          ),
        );
        if (clientesFiltroIds.length === 0) {
          setOrdens([]);
          setTotalCount(0);
          return;
        }
      }

      // Busca livre → ids de clientes/prestadores + colunas simples.
      let clientesBuscaIds: string[] = [];
      let prestadoresBuscaIds: string[] = [];
      if (termoBusca.length > 0) {
        const [clientesRes, prestadoresRes] = await Promise.all([
          supabase
            .from("clientes")
            .select("id")
            .or(`nome_fantasia.ilike.%${termoBusca}%,razao_social.ilike.%${termoBusca}%`)
            .limit(200),
          supabase
            .from("prestadores")
            .select("id")
            .ilike("nome_completo", `%${termoBusca}%`)
            .limit(200),
        ]);
        clientesBuscaIds = Array.from(
          new Set(
            (clientesRes.data || [])
              .map((c) => String((c as { id?: unknown }).id || ""))
              .filter(Boolean),
          ),
        );
        prestadoresBuscaIds = Array.from(
          new Set(
            (prestadoresRes.data || [])
              .map((p) => String((p as { id?: unknown }).id || ""))
              .filter(Boolean),
          ),
        );
      }

      let query = supabase
        .from("ordens_servico")
        .select("*, clientes(nome_fantasia, razao_social, status, origem_comercial)", { count: "exact" });

      if (statusFiltrados) query = query.in("status", statusFiltrados);
      if (clientesFiltroIds) query = query.in("cliente", clientesFiltroIds);
      if (filtroTipo !== "todos") query = query.eq("tipo_operacao", filtroTipo);
      if (filtroTipoVeiculo !== "todos") query = query.ilike("veiculo_tipo", filtroTipoVeiculo);
      if (filtroTipoCarga !== "todos") query = query.ilike("carga_tipo", filtroTipoCarga);
      if (somenteSemPrestador) query = query.is("prestador", null);

      if (filtroPeriodo !== "todos") {
        const agora = new Date();
        if (filtroPeriodo === "hoje") {
          query = query.eq("data", hojeISOSP());
        } else if (filtroPeriodo === "ontem") {
          const ontem = new Date(agora);
          ontem.setDate(ontem.getDate() - 1);
          query = query.eq("data", dataLocalISO(ontem));
        } else if (filtroPeriodo === "semana") {
          const umaSemanaAtras = new Date(agora);
          umaSemanaAtras.setDate(agora.getDate() - 7);
          query = query.gte("data", dataLocalISO(umaSemanaAtras));
        } else if (filtroPeriodo === "mes") {
          const inicioMes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-01`;
          query = query.gte("data", inicioMes);
        } else if (filtroPeriodo === "personalizado" && dataInicio && dataFim) {
          query = query.gte("data", dataInicio).lte("data", dataFim);
        }
      }

      if (termoBusca.length > 0) {
        // Partial match: "1202", "OS-1202" e "OS 1202" localizam OS-202611-1202.
        const termoNumeros = termoBusca.replace(/\D/g, "");
        const orParts = [
          `numero.ilike.%${termoBusca}%`,
          `veiculo_placa.ilike.%${termoBusca}%`,
        ];
        if (termoNumeros && termoNumeros !== termoBusca) {
          orParts.push(`numero.ilike.%${termoNumeros}%`);
        }
        if (clientesBuscaIds.length > 0) {
          const ids = clientesBuscaIds.join(",");
          orParts.push(`cliente.in.(${ids})`, `cliente_id.in.(${ids})`);
        }
        if (prestadoresBuscaIds.length > 0) {
          const ids = prestadoresBuscaIds.join(",");
          orParts.push(`prestador.in.(${ids})`, `prestador_id.in.(${ids})`);
        }
        query = query.or(orParts.join(","));
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);
      if (count !== null) setTotalCount(count);
      if (error) {
        if (error.code === "42P01") {
          setOrdens([]);
          return;
        }
        throw error;
      }
      if (data && data.length > 0) {
        const osIds = data.map((item: any) => item.id).filter(Boolean);
        const syncMap: Record<string, { label: string; classe: string }> = {};

        if (osIds.length > 0) {
          const { data: alocacoes } = await supabase
            .from("alocacoes_escala")
            .select("ordem_servico_id, prestador_id, tipo_veiculo")
            .in("ordem_servico_id", osIds);

          if (alocacoes) {
            alocacoes.forEach((alc: any) => {
              syncMap[alc.ordem_servico_id] = {
                label: "Sincronizada",
                classe: obterClasseBadgeDivergencia("sincronizada"),
              };
            });
          }
        }

        data.forEach((item: any) => {
          if (!syncMap[item.id]) {
            syncMap[item.id] = {
              label: "Sem Programação",
              classe: obterClasseBadgeDivergencia("os_sem_escala"),
            };
          }
        });

        setSyncStatusMap(syncMap);

        // FIX UUID — `ordens_servico.prestador` é uuid; resolve o nome para exibir
        // na lista/edição (o form usa nome_completo no select).
        const linhas = data as any[];
        const idsPrestador = Array.from(
          new Set(
            linhas
              .map((item) => item?.prestador)
              .filter((v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)),
          ),
        );
        let nomesPrestador: Record<string, string> = {};
        if (idsPrestador.length > 0) {
          const { data: prestadoresRows } = await supabase
            .from("prestadores")
            .select("id, nome_completo")
            .in("id", idsPrestador);
          nomesPrestador = Object.fromEntries(
            (prestadoresRows || []).map((p) => [(p as { id: string }).id, String((p as { nome_completo?: string | null }).nome_completo || "")]),
          );
        }

        const normalizados = linhas.map((item) => {
          const os = fromOSRow(item);
          const agendamento = obterAgendamentoClienteOS({
            carga: item.carga,
            observacoes: item.observacoes_gerais,
            observacaoAgendamento: os.observacaoAgendamento,
          });
          const prestadorUuid =
            typeof item.prestador === "string" && /^[0-9a-f-]{36}$/i.test(item.prestador) ? item.prestador : "";
          // `ordens_servico.cliente` é o uuid; a UI exibe o nome. Preserva o uuid
          // em `clienteId` para o Preview resolver o telefone/WhatsApp da cotação.
          const clienteUuidLista =
            typeof item.cliente === "string" && /^[0-9a-f-]{36}$/i.test(item.cliente)
              ? item.cliente
              : os.clienteId || "";
          return {
            ...os,
            // ETAPA-4 — preserva o itinerário (dados operacionais incluídos) ao editar.
            enderecos: Array.isArray(item.enderecos) ? item.enderecos : [],
            // Nome para exibição/edição; o uuid fica em prestadorId (gravação).
            prestador: prestadorUuid ? (nomesPrestador[prestadorUuid] || "") : (os.prestador || ""),
            prestadorId: prestadorUuid || undefined,
            cliente: item.clientes?.nome_fantasia || item.clientes?.razao_social || os.cliente || "Cliente não informado",
            clienteId: clienteUuidLista || undefined,
            clienteCotacao: clienteVeioDeCotacao({
              origemCotacao: item.carga?.origem_cotacao,
              clienteStatus: item.clientes?.status,
              clienteOrigemComercial: item.clientes?.origem_comercial,
            }),
            agendadaCotacao: agendamento.agendada,
            agendamentoCotacao: agendamento.dataHora,
            createdAt: item.created_at as string | undefined,
          };
        });
        setOrdens(normalizados as OrdemServico[]);
      } else {
        setOrdens([]);
        setSyncStatusMap({});
      }
    } catch (e: any) {
      if (e.code !== "42P01") toast.error("Erro ao buscar ordens de serviço.");
      setOrdens([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Chave estável de filtros: quando muda, a paginação volta para a página 1
  // e a QUERY é refeita com os filtros no backend.
  const filtrosKey = [
    filtroStatus,
    filtroCliente,
    filtroTipo,
    filtroTipoVeiculo,
    filtroTipoCarga,
    filtroPeriodo,
    dataInicio,
    dataFim,
    somenteSemPrestador ? "1" : "0",
    buscaAplicada,
  ].join("\u0001");
  const filtrosKeyAnterior = useRef(filtrosKey);

  useEffect(() => {
    const mudou = filtrosKeyAnterior.current !== filtrosKey;
    filtrosKeyAnterior.current = filtrosKey;
    if (mudou && page !== 1) {
      setPage(1);
      return;
    }
    void fetchOrdens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filtrosKey]);

  const handleSalvar = () => {
    setModoForm(null);
    setOsSelecionada(null);
    fetchOrdens();
  };

  /** OS órfã: sem prestador vinculado e ainda não encerrada. */
  const osSemPrestador = (os: OrdemServico) =>
    !(os.prestador || "").trim() && !STATUS_ENCERRADOS.includes(String(os.status));

  const fecharAlocacao = () => {
    setOsAlocando(null);
    setPrestadorAlocacao(null);
    setPrestadorAlocacaoNome("");
    setMotoristaAlocacao("");
    setRepasseAlocacao("");
    setSugestoesAlocacao([]);
    setBuscandoSugestoesAlocacao(false);
    setCalculandoRepasse(false);
  };

  /**
   * Repasse sugerido pela tabela de custo do prestador (cotação/OS).
   * Fallback quando a OS não tem `custo_prestador` calculado — usa o veículo
   * e a distância da OS (preenchidos pela Cotação Express) e, quando o
   * prestador já foi escolhido, a tabela específica dele.
   */
  const calcularRepasseSugerido = async (
    os: OrdemServico,
    prestadorId?: string | null,
  ): Promise<number> => {
    const carga = (os.carga || {}) as Record<string, unknown>;
    const tipoVeiculo = String(
      os.veiculoTipo || carga.tipo_veiculo || carga.tipoVeiculo || "",
    ).trim();
    const km = Number(
      carga.distancia_km ?? carga.km ?? carga.distanciaKm ?? 0,
    );
    const paradas = Array.isArray(os.enderecos) && os.enderecos.length > 0 ? os.enderecos.length : 2;

    if (!tipoVeiculo || !Number.isFinite(km) || km <= 0) return 0;

    try {
      const { tabela } = await buscarTabelaPrestador({
        tenant_id: "",
        cliente_id: "",
        prestador_id: prestadorId || undefined,
        tipo_veiculo: tipoVeiculo,
        tipo_operacao: "fracionado",
        distancia_km: km,
        quantidade_paradas: paradas,
        origem: { cidade: "", uf: "" },
        destino: { cidade: "", uf: "" },
        modo: "preview",
        data_operacao: os.data || undefined,
      });
      if (!tabela || tabela.fonte === "nao_encontrada") return 0;

      const base = Number(tabela.valor_minimo || 0) + Number(tabela.valor_saida || 0);
      const kmIncluso = Number(tabela.km_incluso || 0);
      const kmExcedente = Math.max(0, km - kmIncluso);
      const total = base + kmExcedente * Number(tabela.valor_km || 0);
      return total > 0 ? Number(total.toFixed(2)) : 0;
    } catch {
      return 0;
    }
  };

  const abrirAlocacao = async (os: OrdemServico) => {
    setOsAlocando(os);
    setPrestadorAlocacao(null);
    setPrestadorAlocacaoNome("");
    setMotoristaAlocacao("");
    setSugestoesAlocacao([]);
    // Repasse automático: usa o custo já calculado da OS (com fallbacks legados)
    // e permanece editável manualmente no modal.
    const repasseAtual =
      Number(os.custoPrestador) ||
      Number(os.carga?.custoPrestador) ||
      Number(os.carga?.repassePrestador) ||
      0;
    setRepasseAlocacao(repasseAtual > 0 ? String(Number(repasseAtual.toFixed(2))) : "");

    // Sem custo gravado → calcula pela tabela da cotação vinculada.
    if (!(repasseAtual > 0)) {
      setCalculandoRepasse(true);
      try {
        const sugerido = await calcularRepasseSugerido(os);
        if (sugerido > 0) setRepasseAlocacao(String(sugerido));
      } finally {
        setCalculandoRepasse(false);
      }
    }
  };

  /** Ao escolher o motorista, completa o repasse pela tabela dele (se vazio). */
  const preencherRepasseAoSelecionar = async (prestadorId: string) => {
    if (!osAlocando) return;
    const atual = Number(String(repasseAlocacao).replace(",", "."));
    if (Number.isFinite(atual) && atual > 0) return;
    setCalculandoRepasse(true);
    try {
      const sugerido = await calcularRepasseSugerido(osAlocando, prestadorId);
      if (sugerido > 0) setRepasseAlocacao(String(sugerido));
    } finally {
      setCalculandoRepasse(false);
    }
  };

  const handleAlocarPrestador = async () => {
    if (!osAlocando) return;
    if (!prestadorAlocacao) {
      toast.error("Selecione o prestador.");
      return;
    }
    // BUG 3 (Lote 2): repasse OPCIONAL. Quando vazio, preserva o custo já
    // existente da OS (se houver); nunca bloqueia a alocação.
    const repasseInformado = Number(String(repasseAlocacao).replace(",", "."));
    const repasse =
      Number.isFinite(repasseInformado) && repasseInformado > 0 ? repasseInformado : null;
    const repasseAnterior = Number(osAlocando.custoPrestador);
    const custoFinal =
      repasse ?? (Number.isFinite(repasseAnterior) && repasseAnterior > 0 ? repasseAnterior : null);

    setSalvandoAlocacao(true);
    try {
      const cargaAtual =
        osAlocando.carga && typeof osAlocando.carga === "object" ? osAlocando.carga : {};
      const cargaNova = {
        ...cargaAtual,
        ...(motoristaAlocacao.trim() ? { motorista: motoristaAlocacao.trim() } : {}),
      };

      // `prestador` e `prestador_id` recebem o mesmo UUID (padrão OsMobile) —
      // o gatilho financeiro cria Receber/Pagar/Pagamentos no UPDATE.
      // O status da OS é preservado (decisão desta missão).
      const { error } = await supabase
        .from("ordens_servico")
        .update({
          prestador: prestadorAlocacao,
          prestador_id: prestadorAlocacao,
          custo_prestador: custoFinal,
          carga: cargaNova,
          updated_at: new Date().toISOString(),
        })
        .eq("id", osAlocando.id);

      if (error) throw error;

      toast.success(
        `Prestador${prestadorAlocacaoNome ? ` ${prestadorAlocacaoNome}` : ""} alocado na OS ${osAlocando.numero || ""}.`,
        {
          description: custoFinal
            ? `Repasse: R$ ${custoFinal.toFixed(2)}`
            : "Sem repasse definido — pode ser informado depois.",
        },
      );
      fecharAlocacao();
      fetchOrdens();
    } catch (err) {
      toast.error(
        "Erro ao alocar prestador: " + (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setSalvandoAlocacao(false);
    }
  };

  const sugerirPrestadoresAlocacao = async () => {
    if (!osAlocando) return;
    setBuscandoSugestoesAlocacao(true);
    try {
      const enderecos = Array.isArray(osAlocando.enderecos) ? osAlocando.enderecos : [];
      const coleta = enderecos[0];
      const entrega = enderecos[enderecos.length - 1];
      const janela = String(osAlocando.janelaOperacional || "");
      const partes = janela.split(/[-–—]|às|as/i).map((p) => p.trim());
      const ctx: MatchOSContext = {
        tipoVeiculo: osAlocando.veiculoTipo || "",
        pesoKg: Number(osAlocando.carga?.peso || 0),
        cubagemM3: Number(osAlocando.carga?.cubagem || 0),
        temperatura: osAlocando.veiculoTermica || osAlocando.carga?.tipo || "",
        tipoCarga: osAlocando.carga?.tipo || "",
        cidadeColeta: coleta?.cidade || null,
        ufColeta: coleta?.estado || coleta?.uf || null,
        cidadeEntrega: entrega?.cidade || null,
        ufEntrega: entrega?.estado || entrega?.uf || null,
        data: osAlocando.dataProgramada || osAlocando.data || null,
        janelaInicio: coleta?.janelaInicio || partes[0] || "",
        janelaFim: coleta?.janelaFim || partes[1] || "",
        modalidade: osAlocando.modalidade || "esporadico",
        tipoOperacao: osAlocando.tipoOperacao || null,
      };
      const resultado = await buscarSugestoesPrestadores(ctx, 6);
      setSugestoesAlocacao(resultado.sugestoes);
      if (resultado.sugestoes.length === 0) {
        toast.info(
          resultado.eliminados.length > 0
            ? `Nenhum prestador passou nos requisitos eliminatórios (${resultado.eliminados.length} descartado(s)).`
            : "Nenhum prestador compatível com esta OS.",
        );
      }
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      toast.error(`Erro ao sugerir prestadores: ${mensagem}`);
    } finally {
      setBuscandoSugestoesAlocacao(false);
    }
  };

  const handlePublicarNaRede = async (os: OrdemServico) => {
    if (!os.id) return;
    if (!(os.custoPrestador > 0)) {
      toast.error("Defina o valor de repasse (custo do prestador) antes de publicar na Rede.");
      return;
    }
    setAcaoOrfa({ osId: os.id, tipo: "rede" });
    try {
      const res = await publicarOportunidade({ os_id: os.id, valor_prestador: os.custoPrestador });
      if (res.sucesso) {
        toast.success(`OS ${os.numero} publicada na Rede de Prestadores.`);
      } else {
        toast.error(res.erro || "Não foi possível publicar na Rede.");
      }
    } finally {
      setAcaoOrfa(null);
    }
  };

  const handleNotificarBase = async (os: OrdemServico) => {
    if (!os.id) return;
    setAcaoOrfa({ osId: os.id, tipo: "base" });
    try {
      const res = await notificarBaseAgregados(os.id);
      if (!res.sucesso) {
        toast.error(res.erro || "Não foi possível notificar a base.");
      } else if (res.total === 0) {
        toast.warning("Nenhum prestador compatível elegível encontrado para notificar.");
      } else {
        toast.success(`Base/agregados notificados (${res.total} prestador${res.total > 1 ? "es" : ""}).`);
      }
    } finally {
      setAcaoOrfa(null);
    }
  };

  const isAtrasada = (os: OrdemServico) => {
    if (os.status === "finalizada" || os.status === "cancelada") return false;
    // BUG 2 (Lote 2): NÃO usar `os.data` (coluna date, vira 00:00 e marca
    // "Atraso" horas depois da criação). O atraso real depende do prazo.
    const dateStr = os.previsaoTermino;
    if (!dateStr) return false;
    try {
      return new Date(dateStr).getTime() < new Date().getTime();
    } catch {
      return false;
    }
  };

  const safeFormatDate = (dateStr?: string) => {
    // Datas "YYYY-MM-DD" (coluna date) são formatadas por string: `new Date()`
    // interpretaria como UTC e exibiria o dia anterior em UTC-3.
    const iso = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
    return formatarDataBR(dateStr) || "—";
  };

  // Filtros, contagem e paginação são aplicados no BACKEND (antes do .range()).
  // A lista já chega filtrada — NÃO repetir o filtro no frontend (isso causava
  // páginas quase vazias quando o total absoluto era usado na paginação).
  const filtradas = ordens;

  const totalOrfas = ordens.filter(osSemPrestador).length;

  useEffect(() => {
    if (!osParaExcluir) return;
    (async () => {
      const osId = osParaExcluir.id;
      const [escalas, financeiro, pagamentos] = await Promise.all([
        supabase.from("alocacoes_escala").select("id", { count: "exact", head: true }).eq("ordem_servico_id", osId),
        supabase.from("financeiro_receber").select("id", { count: "exact", head: true }).eq("os_id", osId),
        supabase.from("pagamentos_prestadores").select("id", { count: "exact", head: true }).eq("os_id", osId),
      ]);
      setVinculosCount({
        escalas: escalas.count ?? 0,
        financeiro: financeiro.count ?? 0,
        pagamentos: pagamentos.count ?? 0,
      });
    })();
  }, [osParaExcluir]);

  const handleDelete = async () => {
    if (!osParaExcluir) return;

    // TEMPORÁRIO (limpeza de testes): exclusão liberada sem senha administrativa.
    // Reativar a validação ao fim da homologação.

    try {
      setExcluindo(true);
      const osId = osParaExcluir.id;

      // Limpar registros vinculados antes de excluir a OS
      await Promise.allSettled([
        supabase.from("alocacoes_escala").delete().eq("ordem_servico_id", osId),
        supabase.from("financeiro_receber").delete().eq("os_id", osId),
        supabase.from("pagamentos_prestadores").delete().eq("os_id", osId),
        supabase.from("composicao_financeira_os").delete().eq("os_id", osId),
      ]);

      const { error } = await supabase.from("ordens_servico").delete().eq("id", osId);
      if (error) throw error;

      toast.success(`OS ${osParaExcluir.numero} excluída com sucesso.`);
      setOsParaExcluir(null);
      fetchOrdens();
    } catch (e: any) {
      toast.error("Erro ao excluir OS: " + e.message);
    } finally {
      setExcluindo(false);
    }
  };

  const clientesDisponiveis = clientesFiltro;

  if (modoForm) {
    return (
      <OrdemServicoForm
        key={`${modoForm}-${osSelecionada?.id || "novo"}`}
        os={osSelecionada || undefined}
        modo={modoForm}
        onVoltar={() => { setModoForm(null); setOsSelecionada(null); fetchOrdens(); }}
        onSalvar={handleSalvar}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Ordens de Serviço</h2>
          <p className="text-sm text-muted-foreground">{totalCount ?? filtradas.length} OS encontrada(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFiltros(!showFiltros)} className={showFiltros ? "bg-muted" : ""}>
            <Filter className="w-4 h-4 mr-1" /> Filtros
          </Button>
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => {
              // Isola a nova criação: sem OS anterior e sem rascunho antigo.
              setOsSelecionada(null);
              limparRascunhoNovaOS();
              setModoForm("novo");
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> Nova OS
          </Button>
        </div>
      </div>

      {showFiltros && (
        <Card className="border-orange-100 shadow-sm animate-in slide-in-from-top duration-200">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Status</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos os Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  {STATUS_FILTRO_OPCOES.map((op) => (
                    <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Cliente</Label>
              <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos os Clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Clientes</SelectItem>
                  {clientesDisponiveis.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Tipo Veículo</Label>
              <Select value={filtroTipoVeiculo} onValueChange={setFiltroTipoVeiculo}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos os Veículos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Veículos</SelectItem>
                  <SelectItem value="moto">Moto</SelectItem>
                  <SelectItem value="carro_passeio">Carro Passeio</SelectItem>
                  <SelectItem value="fiorino">Fiorino</SelectItem>
                  <SelectItem value="van">Van</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="vuc">VUC</SelectItem>
                  <SelectItem value="tres_quartos">3/4</SelectItem>
                  <SelectItem value="toco">Toco</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                  <SelectItem value="carreta">Carreta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Tipo Carga</Label>
              <Select value={filtroTipoCarga} onValueChange={setFiltroTipoCarga}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas as Cargas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Cargas</SelectItem>
                  <SelectItem value="Seca">Seca</SelectItem>
                  <SelectItem value="Refrigerada">Refrigerada</SelectItem>
                  <SelectItem value="Congelada">Congelada</SelectItem>
                  <SelectItem value="Mista">Mista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Tipo Operação</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas as Operações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Operações</SelectItem>
                  <SelectItem value="Coleta e Entrega">Coleta e Entrega</SelectItem>
                  <SelectItem value="Apenas Coleta">Apenas Coleta</SelectItem>
                  <SelectItem value="Apenas Entrega">Apenas Entrega</SelectItem>
                  <SelectItem value="Transferência">Transferência</SelectItem>
                  <SelectItem value="Dedicado">Dedicado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Período</Label>
              <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todo o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todo o período</SelectItem>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="ontem">Ontem</SelectItem>
                  <SelectItem value="semana">Últimos 7 dias</SelectItem>
                  <SelectItem value="mes">Este mês</SelectItem>
                  <SelectItem value="personalizado">Período personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filtroPeriodo === "personalizado" && (
              <div className="md:col-span-4 grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Data Inicial</Label>
                  <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Data Final</Label>
                  <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-9" />
                </div>
              </div>
            )}
            <div className="flex items-end">
              <Button variant="ghost" size="sm" className="text-xs text-orange-600 h-9" onClick={() => {
                setFiltroStatus("todos");
                setFiltroCliente("todos");
                setFiltroPeriodo("todos");
                setFiltroTipo("todos");
                setFiltroTipoVeiculo("todos");
                setFiltroTipoCarga("todos");
                setBusca("");
              }}>Limpar Filtros</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por número, cliente, prestador, placa..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9 h-10" />
            </div>
            {/* FILTRO RÁPIDO — OSs órfãs (sem prestador) */}
            <Button
              variant={somenteSemPrestador ? "default" : "outline"}
              size="sm"
              className={`h-10 whitespace-nowrap ${somenteSemPrestador ? "bg-red-600 hover:bg-red-700 text-white" : "border-red-200 text-red-700 hover:bg-red-50"}`}
              onClick={() => setSomenteSemPrestador((v) => !v)}
              title="Mostrar apenas OSs sem prestador (risco de atraso)"
            >
              <ShieldAlert className="w-4 h-4 mr-2" />
              Só sem prestador
              {totalOrfas > 0 && (
                <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${somenteSemPrestador ? "bg-white/20" : "bg-red-100 text-red-700"}`}>
                  {totalOrfas}
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-[10px] uppercase font-bold">Nº OS</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Cliente</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Rota</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Tipo Veículo</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Carga</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Prestador / Placa</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Status</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Sinc</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Prazo</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-bold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                      <p className="font-medium">Carregando ordens de serviço...</p>
                    </div>
                  </TableCell></TableRow>
                ) : filtradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-20">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Search className="w-10 h-10 opacity-20" />
                        <p className="font-medium">Nenhuma Ordem de Serviço encontrada.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtradas.map(os => {
                  const atrasada = isAtrasada(os);
                  const comOcorrencia = os.status === "ocorrencia";
                  const semPrestador = osSemPrestador(os);
                  const farolSla = classificarSlaAlocacao((os as OSComDataCriacao).createdAt, semPrestador);
                  const riscoSlaPendente = emRiscoSlaPendente(
                    os.status,
                    (os as OSComDataCriacao).createdAt,
                  );
                  const statusAtivo = !STATUS_ENCERRADOS.includes(String(os.status)) && os.status !== "rascunho";
                  const paradaHa = statusAtivo
                    ? formatarTempoParada((os as OSComDataCriacao).createdAt)
                    : "";
                  // BUG 2 (refino): coluna Rota com bairro + cidade nas DUAS pontas
                  // (antes só a origem cabia / era truncada).
                  const resumoRota = resumoRotaOSDetalhado(os.enderecos);
                  const rotaTexto = resumoRota.texto || os.unidade || "Rota padrão";

                  return (
                    <TableRow
                      key={os.id}
                      className={`transition-colors group ${
                        semPrestador
                          ? FAROL_SLA_ROW[farolSla?.nivel ?? "ok"]
                          : riscoSlaPendente
                            ? "bg-red-50/60 border-l-4 border-l-red-500 hover:bg-red-50"
                            : "hover:bg-muted/30"
                      }`}
                    >
                      <TableCell className="py-4">
                        <div className="flex items-center gap-1.5 font-bold text-sm">
                          {comOcorrencia && <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />}
                          {semPrestador && <ShieldAlert className="w-3.5 h-3.5 text-red-600 animate-pulse" />}
                          {os.numero}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="w-3 h-3" /> {safeFormatDate(os.data)}
                        </div>
                        {(os as OSComDataCriacao).createdAt && (
                          <div
                            className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400"
                            title="Data e hora exatas em que a OS foi solicitada"
                          >
                            <Clock className="w-3 h-3" /> Solicitada{" "}
                            {formatarDataHoraSolicitacaoBR((os as OSComDataCriacao).createdAt)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                         <div className="flex flex-wrap items-center gap-1.5">
                           <span className="font-semibold text-sm">{os.cliente || "—"}</span>
                           {os.clienteCotacao && (
                             <Badge className="border border-violet-200 bg-violet-100 px-1.5 py-0 text-[9px] font-bold uppercase text-violet-700">
                               Cliente Cotação
                             </Badge>
                           )}
                           {os.agendadaCotacao && (
                             <Badge
                               title={`Agendado: ${os.agendamentoCotacao || "a confirmar"}`}
                               className="gap-1 whitespace-nowrap border border-amber-300 bg-amber-100 px-1.5 py-0 text-[9px] font-bold normal-case tracking-normal text-amber-900"
                             >
                               <Clock className="h-2.5 w-2.5 shrink-0" /> Agendado:{" "}
                               {os.agendamentoCotacao || "a confirmar"}
                             </Badge>
                           )}
                         </div>
                         <div className="text-[10px] text-muted-foreground uppercase tracking-tight">{os.tipoOperacao || "Transporte"}</div>
                      </TableCell>
<TableCell>
                         <div
                           className="flex items-start gap-1 text-xs font-semibold"
                           title={rotaTexto}
                         >
                           <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="line-clamp-2 max-w-[360px] break-words leading-snug">
                              {rotaTexto}
                            </span>
                         </div>
                         {resumoRota.multiplos && (
                           <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-tight text-violet-600">
                             {resumoRota.paradas} paradas
                           </span>
                         )}
                       </TableCell>
                       <TableCell>
                         <div className="text-xs font-semibold">{os.veiculoTipo || "—"}</div>
                       </TableCell>
                       <TableCell>
                         <div className="text-xs font-semibold">{os.carga?.tipo || "Seca"}</div>
                         <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">{os.carga?.descricao || "—"}</div>
                       </TableCell>
                       <TableCell>
                        {semPrestador ? (
                          <div className="flex flex-col gap-1 rounded-lg border border-red-200/80 bg-red-50/70 p-2">
                            <Badge className="w-fit gap-1 border border-red-200 bg-red-100 px-2 py-0.5 text-[9px] font-bold uppercase text-red-700">
                              <ShieldAlert className="w-3 h-3" /> Sem prestador
                            </Badge>
                            <span className="text-[10px] font-medium text-red-600">
                              Nenhum motorista alocado
                            </span>
                            {paradaHa && farolSla && (
                              <span className={`inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white ${FAROL_SLA_CLASSES[farolSla.nivel]}`}>
                                <Clock className="h-2.5 w-2.5" /> {farolSla.label} · Parada há {paradaHa}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Avatar className="w-7 h-7 border border-muted shadow-sm">
                              <AvatarFallback className="text-[9px] font-bold bg-primary/5 text-primary">
                                {os.prestador ? os.prestador[0] : "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{os.prestador || "Pendente"}</span>
                              <span className="text-[10px] font-bold text-orange-600">{os.veiculoPlaca || "—"}</span>
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${obterClasseBadgeGlobal(os.status, "preenchido")} inline-flex items-center whitespace-nowrap text-[9px] uppercase font-bold py-0.5 px-2`}>
                          {statusAtivo && (
                            <span
                              className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse"
                              aria-hidden="true"
                            />
                          )}
                          {STATUS_GLOBAL_INFO[obterStatusGlobalOS(os.status)].label}
                        </Badge>
                        {(os.dataProgramada || os.previsaoInicio) && (
                          <div className="mt-1 flex items-center gap-0.5 whitespace-nowrap text-[9px] font-bold uppercase text-blue-600">
                            <Clock className="w-2.5 h-2.5" /> Agendado
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {os.id && syncStatusMap[os.id] ? (
                          <Badge className={`${syncStatusMap[os.id].classe} text-[8px] font-bold py-0 px-1.5`}>
                            {syncStatusMap[os.id].label}
                          </Badge>
                        ) : (
                          <span className="text-[9px] text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className={`text-sm font-medium ${atrasada ? 'text-red-600' : ''}`}>
                          {os.previsaoTermino ? safeFormatDate(os.previsaoTermino) : "Sem prazo"}
                        </div>
                        {(atrasada || riscoSlaPendente) && (
                          <Badge className="mt-1 flex w-fit items-center gap-1 whitespace-nowrap border border-red-300 bg-red-600 px-1.5 py-0 text-[9px] font-bold uppercase text-white">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {atrasada ? "Atraso" : "Risco de SLA"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {/* Ações sempre visíveis — o lápis de edição não pode
                            depender de hover (regressão reportada). */}
                        <div className="flex items-center justify-end gap-1">
                          {semPrestador && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 border-orange-200 bg-orange-50 px-2 text-[11px] font-semibold text-orange-700 hover:bg-orange-100 hover:text-orange-800"
                                title="Alocar Prestador"
                                disabled={acaoOrfa?.osId === os.id}
                                onClick={(e) => { e.stopPropagation(); abrirAlocacao(os); }}
                              >
                                <UserPlus className="w-3.5 h-3.5" /> Alocar Prestador
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-violet-50 hover:text-violet-600"
                                title="Publicar na Rede de Prestadores"
                                disabled={acaoOrfa?.osId === os.id}
                                onClick={(e) => { e.stopPropagation(); handlePublicarNaRede(os); }}
                              >
                                {acaoOrfa?.osId === os.id && acaoOrfa?.tipo === "rede" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-amber-50 hover:text-amber-600"
                                title="Notificar base/agregados"
                                disabled={acaoOrfa?.osId === os.id}
                                onClick={(e) => { e.stopPropagation(); handleNotificarBase(os); }}
                              >
                                {acaoOrfa?.osId === os.id && acaoOrfa?.tipo === "base" ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
                              </Button>
                              <div className="mx-1 h-6 w-px bg-border" />
                            </>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100 hover:text-slate-700" title="Histórico da OS" onClick={(e) => { e.stopPropagation(); setOsHistorico(os); }}>
                            <History className="w-4 h-4"/>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600" title="Rastreamento" onClick={(e) => { e.stopPropagation(); setOsRastreamento(os); setShowRastreamento(true); }}>
                            <LocateFixed className="w-4 h-4"/>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" title="Visualizar" onClick={() => { setOsPreview(os); setShowPreview(true); }}>
                            <Eye className="w-4 h-4"/>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600" title="Ver comprovantes" onClick={() => setOsComprovantes(os)}>
                            <FileCheck className="w-4 h-4"/>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-orange-50 hover:text-orange-600" title={os.status === "finalizada" || os.status === "cancelada" ? "OS finalizada/cancelada não pode ser editada" : "Editar"} disabled={os.status === "finalizada" || os.status === "cancelada"} onClick={() => { setOsSelecionada(os); setModoForm("editar"); }}>
                            <Edit className="w-4 h-4"/>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 hover:text-red-600" title="Excluir" onClick={() => setOsParaExcluir(os)}>
                            <Trash2 className="w-4 h-4 text-red-400"/>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={totalCount}
        onPageChange={(next) => {
          setPage(next);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        loading={isLoading}
      />

      {/* Modal Confirmação Exclusão */}
      {/* Modal Histórico da OS */}
      <Dialog open={!!osHistorico} onOpenChange={(open) => { if (!open) setOsHistorico(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-slate-600" /> Histórico — {osHistorico?.numero || "OS"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <HistoricoOS historico={osHistorico?.historico} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOsHistorico(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Alocar Prestador */}
      <Dialog open={!!osAlocando} onOpenChange={(open) => { if (!open) fecharAlocacao(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-orange-500" /> Alocar Prestador
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/40 p-3 text-xs">
              <p className="font-semibold text-slate-800">
                {osAlocando?.numero || "OS"}
                {osAlocando?.cliente ? ` · ${osAlocando.cliente}` : ""}
              </p>
              <p className="text-muted-foreground">
                O status da OS é preservado; ao alocar, o financeiro (receber, pagar e pagamentos) é gerado
                automaticamente.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                onClick={() => void sugerirPrestadoresAlocacao()}
                disabled={buscandoSugestoesAlocacao}
              >
                {buscandoSugestoesAlocacao ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {buscandoSugestoesAlocacao ? "Analisando..." : "Sugerir Melhores Prestadores"}
              </Button>
              <span className="text-[10px] text-muted-foreground">Requisitos + score (0–100)</span>
            </div>

            {sugestoesAlocacao.length > 0 && (
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-indigo-100 bg-indigo-50/40 p-2">
                {sugestoesAlocacao.map((s, i) => (
                  <div
                    key={s.prestadorId}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2"
                  >
                    <span className="text-[11px] font-black text-slate-500">{i + 1}º</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <p className="truncate text-xs font-bold text-slate-800">{s.nome}</p>
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-bold ${PERFORMANCE_CORES[s.categoriaPerformance]}`}
                        >
                          {s.categoriaPerformance}
                        </Badge>
                      </div>
                      <p className="truncate text-[10px] text-slate-500">
                        {s.veiculo?.tipo || "—"}
                        {s.veiculo?.capacidadeKg ? ` · ${s.veiculo.capacidadeKg}kg` : ""}
                        {s.regiao ? ` · ${s.regiao}` : ""}
                      </p>
                      <p className="truncate text-[10px] text-emerald-700">{s.motivos.slice(0, 3).join(" · ")}</p>
                    </div>
                    <Badge className={i === 0 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}>
                      {s.compatibilidade}%
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 bg-emerald-600 px-2 text-[11px] text-white hover:bg-emerald-700"
                      onClick={() => {
                        setPrestadorAlocacao(s.prestadorId);
                        setPrestadorAlocacaoNome(s.nome);
                        void preencherRepasseAoSelecionar(s.prestadorId);
                      }}
                    >
                      Selecionar
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Prestador *</Label>
              <SearchableSelect
                table="prestadores"
                labelField="nome_completo"
                searchFields={["nome_completo", "cpf_cnpj", "telefone", "whatsapp"]}
                placeholder="Buscar prestador (nome, CPF/CNPJ, telefone)..."
                value={prestadorAlocacao}
                onChange={(value, record) => {
                  setPrestadorAlocacao(value);
                  setPrestadorAlocacaoNome(String(record?.nome_completo || ""));
                  if (value) void preencherRepasseAoSelecionar(value);
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Nome do motorista (opcional)</Label>
              <Input
                value={motoristaAlocacao}
                onChange={(e) => setMotoristaAlocacao(e.target.value)}
                placeholder="Ex.: João Silva"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Repasse do prestador (R$) — opcional</Label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={repasseAlocacao}
                  onChange={(e) => setRepasseAlocacao(e.target.value)}
                  placeholder="0,00"
                />
                {calculandoRepasse && (
                  <Loader2 className="absolute right-2.5 top-3 h-4 w-4 animate-spin text-slate-400" />
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {calculandoRepasse
                  ? "Calculando pela tabela da cotação vinculada..."
                  : "Se vazio, usa a tabela/cotação quando existir. Pode ficar em branco — não bloqueia a alocação."}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={fecharAlocacao} disabled={salvandoAlocacao}>
              Cancelar
            </Button>
            <Button
              className="gap-2 bg-orange-500 text-white hover:bg-orange-600"
              onClick={handleAlocarPrestador}
              disabled={salvandoAlocacao}
            >
              {salvandoAlocacao ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Alocar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!osParaExcluir} onOpenChange={() => setOsParaExcluir(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Confirmar Exclusão
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Você está prestes a excluir a <strong>OS {osParaExcluir?.numero}</strong>. Esta ação é irreversível e removerá todos os históricos e vínculos financeiros.
            </p>
            {(vinculosCount.escalas > 0 || vinculosCount.financeiro > 0 || vinculosCount.pagamentos > 0) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                <p className="text-xs font-bold text-red-700 uppercase">Registros vinculados encontrados</p>
                {vinculosCount.escalas > 0 && <p className="text-xs text-red-600">• {vinculosCount.escalas} programação(ões) vinculada(s)</p>}
                {vinculosCount.financeiro > 0 && <p className="text-xs text-red-600">• {vinculosCount.financeiro} registro(s) financeiro(s) a receber</p>}
                {vinculosCount.pagamentos > 0 && <p className="text-xs text-red-600">• {vinculosCount.pagamentos} pagamento(s) a prestador(es)</p>}
                <p className="text-xs text-red-700 font-semibold mt-1">Todos serão removidos permanentemente.</p>
              </div>
            )}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-bold text-amber-800">Exclusão liberada temporariamente</p>
              <p className="mt-0.5 text-[11px] text-amber-700">
                A senha administrativa está desativada nesta fase (limpeza das OS de teste).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOsParaExcluir(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={excluindo}>
              {excluindo ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Rastreamento — telemetria real do App (portal_tracking_realtime) */}
      <RastreamentoOSDialog
        open={showRastreamento}
        onOpenChange={(open) => {
          setShowRastreamento(open);
          if (!open) setOsRastreamento(null);
        }}
        os={osRastreamento}
      />

      {/* Modal Preview OS */}
      <Dialog open={showPreview} onOpenChange={(open) => { if (!open) { setShowPreview(false); setOsPreview(null); } }}>
        <DialogContent className="w-[96vw] max-w-[1600px] max-h-[92vh] h-full overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-500" /> Visualização da Ordem de Serviço
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {osPreview && <OrdemServicoPreview os={osPreview} onVoltar={() => { setShowPreview(false); setOsPreview(null); }} />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Comprovantes / POD — visão dedicada (NÃO é o formulário da OS) */}
      <Dialog open={!!osComprovantes} onOpenChange={(open) => { if (!open) setOsComprovantes(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-emerald-600" /> Comprovantes da Entrega
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              OS {osComprovantes?.numero || "—"} · {osComprovantes?.cliente || "—"}
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            {osComprovantes && (
              <EntregasComprovantes osId={osComprovantes.id} numeroOs={osComprovantes.numero} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOsComprovantes(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdensServicoLista;
