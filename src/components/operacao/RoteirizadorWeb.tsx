import { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { formatarDistanciaKm } from "@/lib/formatNumbers";
import { 
  LayoutDashboard, 
  Upload, 
  MapPin, 
  Truck, 
  Route, 
  Map as MapIcon, 
  FileCheck, 
  Download, 
  AlertTriangle, 
  Package, 
  Scale, 
  Boxes, 
  MapPinned,
  Thermometer,
  Clock,
  Flag,
  FileText,
ChevronRight, 
  CheckCircle,
  XCircle,
  Save,
  Plus,
  RotateCcw,
  Smartphone,
  Copy,
  Home,
  ExternalLink,
  Trash2
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import MapboxMap from "@/components/MapboxMap";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  PedidoRoteirizacao, 
  VeiculoRoteirizacao,
  ResultadoRoteirizacao,
  AlertaRoteirizacao,
  GrupoPedidos,
  TipoVeiculo,
  CAPACIDADES_PADRAO_VEICULOS,
  CABECALHO_PLANILHA,
  ModoRoteirizacao,
  ModoPercurso,
  SugestaoFrotaCenario
} from "@/types/roteirizacao";
import {
  calcularCubagemPedido,
  calcularTotaisPedidos,
  agruparPorFaixaCep,
  agruparPorRegiao,
  agruparPorCidade,
  validarListaPedidos,
  sugerirVeiculosNecessarios,
  distribuirPedidosEntreVeiculos,
  gerarResumoRoteirizacao,
  gerarAlertasPorDemandaxFrota,
  gerarSugestoesComparativasPorRegiao,
  getCapacidadePadrao,
  getNomeTipoVeiculo,
  getIconeTipoVeiculo,
  normalizarTipoVeiculo,
  normalizarColunasPlanilha,
  detectarPendenciasDados,
  gerarSolicitacaoDadosWhatsApp,
  obterCentroideAproximado,
  avaliarJanelasHorario,
  identificarMacroRegiao,
  agruparPorMacroRegiao,
  verificarRodizioMunicipalSP,
  optimizarSequenciaParadas,
  estimarDistanciaTempoLocal
} from "@/services/roteirizacaoService";
import { calcularDistanciaTempoRota, geocodificarEndereco, temCoordenadaValida } from "@/services/roteirizacaoMapbox";
import { despacharRotaParaApp } from "@/services/roteirizacaoDespachoService";
import type { DespachoRotaResultado } from "@/services/roteirizacaoDespachoService";

type ComposicaoItem = {
  tipo: TipoVeiculo;
  quantidade: number;
  refrigerado?: boolean;
};

interface OrigemRoteirizador {
  rotulo: string;
  cep: string;
  endereco: string;
  cidade: string;
  uf: string;
  latitude: number;
  longitude: number;
}

const PRESETS_ORIGEM: OrigemRoteirizador[] = [
  { rotulo: "Base Diadema (ABC)", cep: "09900-000", endereco: "Base Diadema", cidade: "Diadema", uf: "SP", latitude: -23.686, longitude: -46.622 },
  { rotulo: "CD Guarulhos", cep: "07000-000", endereco: "CD Guarulhos", cidade: "Guarulhos", uf: "SP", latitude: -23.454, longitude: -46.533 },
  { rotulo: "Base Centro SP", cep: "01000-000", endereco: "Base Centro SP", cidade: "São Paulo", uf: "SP", latitude: -23.5505, longitude: -46.6333 },
];

const CHAVE_BASES_LOCAL = "tms_roteirizador_bases_v1";

function carregarBasesLocal(): OrigemRoteirizador[] {
  try {
    const bruto = localStorage.getItem(CHAVE_BASES_LOCAL);
    if (!bruto) return [];
    const parsed = JSON.parse(bruto);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (b: unknown): b is OrigemRoteirizador =>
        Boolean(b) && typeof b === "object" &&
        typeof (b as { rotulo?: unknown }).rotulo === "string",
    );
  } catch {
    return [];
  }
}

function persistirBasesLocal(bases: OrigemRoteirizador[]): void {
  try {
    localStorage.setItem(CHAVE_BASES_LOCAL, JSON.stringify(bases));
  } catch {
    // localStorage indisponível — ignora silenciosamente
  }
}

const CORES_ROTAS = [
  "#6366f1", "#10b981", "#f97316", "#ec4899", "#06b6d4", "#eab308",
  "#8b5cf6", "#ef4444", "#14b8a6", "#f43f5e", "#3b82f6", "#a855f7",
];

function convexHull(pontos: [number, number][]): [number, number][] {
  if (pontos.length < 3) return pontos.slice();
  const pts = pontos.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function bufferHull(hull: [number, number][], fator = 0.18, pad = 0.004): [number, number][] {
  if (hull.length < 3) return hull;
  const cx = hull.reduce((a, p) => a + p[0], 0) / hull.length;
  const cy = hull.reduce((a, p) => a + p[1], 0) / hull.length;
  return hull.map(([x, y]) => [
    cx + (x - cx) * (1 + fator) + (x >= cx ? pad : -pad),
    cy + (y - cy) * (1 + fator) + (y >= cy ? pad : -pad),
  ] as [number, number]);
}

const RoteirizadorWeb = () => {
  const [activeTab, setActiveTab] = useState("visao_geral");
  const [pedidos, setPedidos] = useState<PedidoRoteirizacao[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoRoteirizacao[]>([]);
  const [modoRoteirizacao, setModoRoteirizacao] = useState<ModoRoteirizacao>("sugestao");
  const [loading, setLoading] = useState(true);
  
  const [importedPedidos, setImportedPedidos] = useState<PedidoRoteirizacao[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [carregandoOs, setCarregandoOs] = useState(false);
  const [composicaoAplicada, setComposicaoAplicada] = useState<Record<string, SugestaoFrotaCenario>>({});
  const [despachoAlvo, setDespachoAlvo] = useState<Record<number, string>>({});
  const [despachandoIdx, setDespachandoIdx] = useState<number | null>(null);
  const [despachos, setDespachos] = useState<Record<number, DespachoRotaResultado | undefined>>({});
  const [copiadoIdx, setCopiadoIdx] = useState<number | null>(null);

  // Filtros da aba Veiculos.
  const [filtroVeiculoBusca, setFiltroVeiculoBusca] = useState("");
  const [filtroVeiculoTipo, setFiltroVeiculoTipo] = useState("todos");
  const [filtroVeiculoStatus, setFiltroVeiculoStatus] = useState("todos");
  const [filtroVeiculoVinculo, setFiltroVeiculoVinculo] = useState("todos");
  const [filtroVeiculoRodizio, setFiltroVeiculoRodizio] = useState("todos");
  // Visao da aba Agrupamento.
  const [vistaAgrupamento, setVistaAgrupamento] = useState("macro");
  // Local de carregamento (origem/base) + foco do mapa.
  const [origem, setOrigem] = useState<OrigemRoteirizador>(() => ({ ...PRESETS_ORIGEM[0] }));
  const [geocodificandoOrigem, setGeocodificandoOrigem] = useState(false);
  const [mapaFocoId, setMapaFocoId] = useState<string | null>(null);
  // Percurso (ida / ida e volta) + gestão de bases personalizadas.
  const [modoPercurso, setModoPercurso] = useState<ModoPercurso>("sem_retorno");
  const [basesPersonalizadas, setBasesPersonalizadas] = useState<OrigemRoteirizador[]>(() => carregarBasesLocal());
  const [salvarBaseAberta, setSalvarBaseAberta] = useState(false);
  const [nomeNovaBase, setNomeNovaBase] = useState("");
  const [buscandoCepOrigem, setBuscandoCepOrigem] = useState(false);
  // Detalhe da parada (modal) + prévia do App Motorista.
  const [pedidoDetalhe, setPedidoDetalhe] = useState<PedidoRoteirizacao | null>(null);
  const [previaApp, setPreviaApp] = useState<{
    resultado: { veiculo: VeiculoRoteirizacao; pedidos: PedidoRoteirizacao[] };
    idx: number;
  } | null>(null);

  const sugestoesComparativas = useMemo(function() {
    if (pedidos.length === 0) return [];
    return gerarSugestoesComparativasPorRegiao(pedidos);
  }, [pedidos]);

  const veiculosFiltrados = useMemo(function() {
    const termo = filtroVeiculoBusca.trim().toLowerCase();
    return veiculos.filter(function(v) {
      if (termo) {
        const alvo = `${v.placa} ${v.motorista} ${v.regiaoBase}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      if (filtroVeiculoTipo !== "todos" && v.tipoVeiculo !== filtroVeiculoTipo) {
        return false;
      }
      if (filtroVeiculoStatus === "online" && !v.onlineApp) return false;
      if (filtroVeiculoStatus === "offline" && v.onlineApp) return false;
      if (filtroVeiculoVinculo === "contrato" && v.contratoOuAvulso !== "contrato") {
        return false;
      }
      if (filtroVeiculoVinculo === "avulso" && v.contratoOuAvulso !== "avulso") {
        return false;
      }
      if (filtroVeiculoVinculo === "agregado" && v.contratoOuAvulso !== "avulso") {
        return false;
      }
      if (filtroVeiculoRodizio === "liberados" && v.rodizioHoje) return false;
      if (filtroVeiculoRodizio === "rodizio" && !v.rodizioHoje) return false;
      return true;
    });
  }, [
    veiculos,
    filtroVeiculoBusca,
    filtroVeiculoTipo,
    filtroVeiculoStatus,
    filtroVeiculoVinculo,
    filtroVeiculoRodizio,
  ]);

  const gruposMacroRegiao = useMemo(function() {
    return agruparPorMacroRegiao(pedidos);
  }, [pedidos]);

  const gruposUrgencia = useMemo(function() {
    const urgentes = pedidos.filter(p => p.prioridade === "urgente");
    const comJanela = pedidos.filter(p =>
      p.prioridade !== "urgente" && Boolean(p.janelaInicio || p.janelaFim)
    );
    const semJanela = pedidos.filter(p =>
      p.prioridade !== "urgente" && !p.janelaInicio && !p.janelaFim
    );
    return [
      { nome: `Urgentes (${urgentes.length})`, pedidos: urgentes },
      { nome: `Com janela (${comJanela.length})`, pedidos: comJanela },
      { nome: `Sem janela (${semJanela.length})`, pedidos: semJanela },
    ].filter(g => g.pedidos.length > 0);
  }, [pedidos]);

  const montarConsultaGeocode = (p: PedidoRoteirizacao): string =>
    [
      p.endereco || p.enderecoCompleto,
      p.numero,
      p.bairro,
      p.cidade,
      p.estado,
      p.cep,
      "Brasil",
    ].filter(Boolean).join(", ");

  // Geocoding real (Mapbox -> Nominatim) para pedidos sem coordenadas (0,0).
  const geocodificarPedidosSemCoordenadas = async (
    lista: PedidoRoteirizacao[],
    limite = 60,
  ): Promise<PedidoRoteirizacao[]> => {
    const saida: PedidoRoteirizacao[] = [];
    let geocodificados = 0;
    let tentativas = 0;
    for (const pedido of lista) {
      if (temCoordenadaValida(pedido.latitude, pedido.longitude)) {
        saida.push(pedido);
        continue;
      }
      if (tentativas >= limite) {
        const centroide = obterCentroideAproximado(pedido.cidade, pedido.estado, pedido.cep);
        saida.push({ ...pedido, ...centroide });
        continue;
      }
      tentativas++;
      const consulta = montarConsultaGeocode(pedido);
      const coord = consulta ? await geocodificarEndereco(consulta) : null;
      if (coord) {
        saida.push({ ...pedido, ...coord });
        geocodificados++;
      } else {
        // Fallback de centroide (cidade/CEP) — garante coordenadas para a rota.
        const centroide = obterCentroideAproximado(pedido.cidade, pedido.estado, pedido.cep);
        saida.push({ ...pedido, ...centroide });
      }
      await new Promise(function(resolve) { setTimeout(resolve, 110); });
    }
    if (geocodificados > 0) {
      toast.success(`${geocodificados} endereco(s) geocodificado(s) automaticamente.`);
    }
    return saida;
  };

  const aplicarPresetOrigem = (preset: OrigemRoteirizador) => {
    setOrigem({ ...preset });
    toast.success(`Ponto de partida: ${preset.rotulo}`);
  };

  const geocodificarOrigem = async () => {
    const consulta = [origem.endereco, origem.cidade, origem.uf, origem.cep, "Brasil"]
      .filter(Boolean)
      .join(", ");
    if (!consulta.trim()) {
      toast.error("Informe o endereço/CEP da origem.");
      return;
    }
    setGeocodificandoOrigem(true);
    try {
      const coord = await geocodificarEndereco(consulta);
      if (coord) {
        setOrigem((prev) => ({
          ...prev,
          latitude: coord.latitude,
          longitude: coord.longitude,
        }));
        toast.success("Coordenadas da origem obtidas.");
      } else {
        toast.error("Não foi possível geocodificar a origem.");
      }
    } finally {
      setGeocodificandoOrigem(false);
    }
  };

  // Consulta ViaCEP ao digitar/sair do CEP da base.
  const buscarCepOrigem = async () => {
    const digitos = String(origem.cep || "").replace(/\D/g, "");
    if (digitos.length !== 8) return;
    setBuscandoCepOrigem(true);
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      if (!resposta.ok) return;
      const dados = await resposta.json();
      if (dados?.erro) return;
      setOrigem((prev) => ({
        ...prev,
        cep: dados.cep || prev.cep,
        endereco: dados.logradouro || prev.endereco,
        cidade: dados.localidade || prev.cidade,
        uf: dados.uf || prev.uf,
      }));
      toast.success("Endereço da base preenchido pelo ViaCEP.");
      // Busca coordenadas do endereço recém-preenchido.
      const consulta = [dados.logradouro, dados.localidade, dados.uf, dados.cep, "Brasil"]
        .filter(Boolean)
        .join(", ");
      if (consulta) {
        const coord = await geocodificarEndereco(consulta);
        if (coord) {
          setOrigem((prev) => ({
            ...prev,
            latitude: coord.latitude,
            longitude: coord.longitude,
          }));
        }
      }
    } catch {
      // silencioso — operador pode clicar em "Buscar coordenadas"
    } finally {
      setBuscandoCepOrigem(false);
    }
  };

  const salvarNovaBase = () => {
    const nome = nomeNovaBase.trim() || `Base ${basesPersonalizadas.length + 1}`;
    if (!origem.endereco && !origem.cidade) {
      toast.error("Preencha o endereço da base antes de salvar.");
      return;
    }
    const nova: OrigemRoteirizador = { ...origem, rotulo: nome };
    setBasesPersonalizadas((prev) => {
      const semDuplicada = prev.filter((b) => b.rotulo !== nome);
      const lista = [...semDuplicada, nova];
      persistirBasesLocal(lista);
      return lista;
    });
    setOrigem(nova);
    setNomeNovaBase("");
    setSalvarBaseAberta(false);
    toast.success(`Base "${nome}" salva no navegador.`);
  };

  const removerBasePersonalizada = (rotulo: string) => {
    setBasesPersonalizadas((prev) => {
      const lista = prev.filter((b) => b.rotulo !== rotulo);
      persistirBasesLocal(lista);
      return lista;
    });
    toast.success(`Base "${rotulo}" removida.`);
  };

  const origemCoords = temCoordenadaValida(origem.latitude, origem.longitude)
    ? { lat: origem.latitude, lng: origem.longitude }
    : undefined;
  
  // Inferir termico/refrigerado a partir de colunas REAIS do veiculo.
  const inferirVeiculoRefrigerado = (v: Record<string, any>): boolean => {
    const texto = `${v.tipo_veiculo || ""} ${v.tipo_carga || ""} ${v.observacoes || ""}`
      .toLowerCase();
    if (/refrig|t[eé]rmic/.test(texto)) return true;
    return v.temperatura_min != null || v.temperatura_max != null;
  };

  // FROTA: veiculos + prestadores usando SOMENTE colunas existentes no banco.
  const carregarFrota = async () => {
    try {
      setLoading(true);

      const { data: prestadores, error: prestadoresError } = await supabase
        .from("prestadores")
        .select("id, nome_completo, telefone, status, regiao_principal, endereco, metadata")
        .limit(300);
      if (prestadoresError) {
        console.warn("[Roteirizador] prestadores:", prestadoresError.message);
      }

      const { data: veiculosData, error: veiculosError } = await supabase
        .from("veiculos")
        .select(
          "id, tipo_veiculo, placa, capacidade_kg, capacidade_m3, prestador_vinculado, status, tipo_carga, temperatura_min, temperatura_max, observacoes",
        )
        .limit(300);
      if (veiculosError) {
        console.warn("[Roteirizador] veiculos:", veiculosError.message);
      }

      const prestadorMap = new Map<string, any>();
      (prestadores || []).forEach(function(p: any) {
        prestadorMap.set(p.id, p);
      });

      const veiculosReais: VeiculoRoteirizacao[] = [];
      (veiculosData || []).forEach(function(v: any) {
        // Aceita 'disponivel' / 'ativo' / 'Ativo' (case-insensitive).
        const statusLower = String(v.status || "").toLowerCase();
        const statusPermitido = statusLower === "" || statusLower === "disponivel" ||
          statusLower === "ativo";
        if (!statusPermitido) return;

        const tipo = normalizarTipoVeiculo(v.tipo_veiculo);
        const capPadrao = CAPACIDADES_PADRAO_VEICULOS.find(function(c) {
          return c.tipo === tipo;
        });
        const prest = v.prestador_vinculado
          ? prestadorMap.get(v.prestador_vinculado.toString())
          : null;
        const enderecoPrestador = (prest?.endereco && typeof prest.endereco === "object")
          ? prest.endereco
          : {};
        const disponivelApp = prest?.metadata?.disponivel_app;
        const onlineApp = disponivelApp === true || disponivelApp === "true" ||
          disponivelApp === 1;

        const rodizio = verificarRodizioMunicipalSP(v.placa || "");
        veiculosReais.push({
          id: v.id,
          tipoVeiculo: tipo,
          placa: v.placa || "SEM PLACA",
          motorista: prest?.nome_completo || "N/I",
          prestadorId: v.prestador_vinculado?.toString() || "",
          cepBasePrestador: String(enderecoPrestador.cep || "").replace(/\D/g, ""),
          regiaoBase: prest?.regiao_principal || "",
          capacidadePesoKg: Number(v.capacidade_kg) || capPadrao?.capacidadePesoKg || 1000,
          capacidadeCubagemM3: Number(v.capacidade_m3) || capPadrao?.capacidadeCubagemM3 || 5,
          tipoOperacao: inferirVeiculoRefrigerado(v) ? "refrigerado" : "seco",
          temperaturaMinima: v.temperatura_min != null
            ? Number(v.temperatura_min)
            : undefined,
          disponivel: true,
          contratoOuAvulso: prest ? "contrato" : "avulso",
          onlineApp,
          rodizioHoje: rodizio.rodizioHoje,
          diaRodizio: rodizio.diaRodizio,
        });
      });

      // Dedup pela placa normalizada (ex.: TST1A23 repetida).
      const placasVistas = new Set<string>();
      const veiculosUnicos = veiculosReais.filter(function(v) {
        const chave = String(v.placa || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        if (!chave || chave === "SEMPLACA") return true;
        if (placasVistas.has(chave)) return false;
        placasVistas.add(chave);
        return true;
      });
      setVeiculos(veiculosUnicos);
    } catch (e: any) {
      console.warn("[Roteirizador] Erro ao carregar frota:", e.message);
    } finally {
      setLoading(false);
    }
  };

  // Carga inicial: apenas a frota. Pedidos comecam vazios (sem OS antigas).
  useEffect(() => {
    void carregarFrota();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processImportData = (data: Record<string, unknown>[]) => {
    const novosPedidos: PedidoRoteirizacao[] = data.map((row, index) => {
      // Mapeador flexível: aceita cabeçalhos de planilhas de qualquer cliente.
      const dados = normalizarColunasPlanilha(row);
      const endereco = dados.endereco || "";
      const numero = (dados.numero ?? "").toString();
      const complemento = dados.complemento || "";
      const enderecoCompleto = [endereco, numero, complemento, dados.bairro]
        .filter(Boolean)
        .join(", ");

      const pesoOriginal = parseFloat(dados.peso_kg);
      const pesoValido = Number.isFinite(pesoOriginal) && pesoOriginal > 0;
      // Tolerância total: peso ausente assume 1 kg (permite roteirizar).
      const pesoKg = pesoValido ? pesoOriginal : 1;
      const pesoEstimado = !pesoValido;

      const comprimentoCm = parseFloat(dados.comprimento_cm) || 0;
      const larguraCm = parseFloat(dados.largura_cm) || 0;
      const alturaCm = parseFloat(dados.altura_cm) || 0;
      const quantidadeVolumes = parseInt(dados.quantidade_volumes) || 1;

      const dadosFaltantes: string[] = [];
      if (pesoEstimado) dadosFaltantes.push("peso");
      if (!comprimentoCm || !larguraCm || !alturaCm) dadosFaltantes.push("dimensões");
      if (!dados.telefone) dadosFaltantes.push("telefone");
      if (!dados.janela_inicio && !dados.janela_fim) dadosFaltantes.push("janela de horário");
      if (!dados.cep && !endereco) dadosFaltantes.push("endereço");

      const prioridade = (dados.prioridade || "media").toLowerCase();
      const prioridadeValida = ["baixa", "media", "alta", "urgente"].includes(prioridade)
        ? prioridade
        : "media";

      const p: PedidoRoteirizacao = {
        id: "IMP-" + Date.now() + "-" + index,
        numeroPedido: dados.numero_pedido || `SEM-NUM-${index}`,
        cliente: dados.cliente || "Não informado",
        destinatario: dados.destinatario || "Não informado",
        telefone: dados.telefone || "",
        documento: dados.documento || undefined,
        email: dados.email || undefined,
        cep: (dados.cep || "").replace(/\D/g, ""),
        enderecoCompleto,
        endereco,
        numero,
        complemento,
        bairro: dados.bairro || "",
        cidade: dados.cidade || "",
        estado: dados.estado || "",
        latitude: 0,
        longitude: 0,
        pesoKg,
        quantidadeVolumes,
        comprimentoCm,
        larguraCm,
        alturaCm,
        cubagemM3: 0,
        tipoCarga: (dados.tipo_carga as PedidoRoteirizacao["tipoCarga"]) || "seco",
        secoOuRefrigerado:
          (dados.seco_ou_refrigerado || "seco").toLowerCase().includes("refri")
            ? "refrigerado"
            : "seco",
        temperaturaMinima: dados.temperatura_minima
          ? parseFloat(dados.temperatura_minima)
          : undefined,
        janelaInicio: dados.janela_inicio || "",
        janelaFim: dados.janela_fim || "",
        prioridade: prioridadeValida as PedidoRoteirizacao["prioridade"],
        observacoes: dados.observacoes || "",
        status: "pendente" as const,
        dadosFaltantes,
        pesoEstimado,
      };
      p.cubagemM3 = calcularCubagemPedido(p);
      return p;
    });
    setImportedPedidos(novosPedidos);
    setFileError("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setFileError("");
    setImportedPedidos([]);

    const fileExt = file.name.split('.').pop()?.toLowerCase();

    if (fileExt === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processImportData(results.data);
          setIsUploading(false);
        },
        error: (err) => {
          setFileError("Erro ao ler CSV: " + err.message);
          setIsUploading(false);
        }
      });
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const workbook = XLSX.read(bstr, { type: 'binary' });
          const wsname = workbook.SheetNames[0];
          const ws = workbook.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);
          processImportData(data as Record<string, unknown>[]);
        } catch (err: any) {
          setFileError("Erro ao ler Excel: " + err.message);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      setFileError("Formato de arquivo não suportado. Use .csv ou .xlsx");
      setIsUploading(false);
    }
    
    e.target.value = '';
  };

  const confirmarImportacao = async () => {
    // Tolerância total: só é bloqueado o pedido SEM nenhuma referência de endereço.
    // Peso/dimensões/telefone/janela ausentes NÃO bloqueiam (peso assume 1 kg).
    const temEndereco = (p: PedidoRoteirizacao) =>
      Boolean(p.cep || p.endereco || p.enderecoCompleto || p.cidade);
    const validos = importedPedidos.filter(temEndereco);
    if (validos.length === 0) {
      toast.error("Nenhum pedido com endereço válido para importar.");
      return;
    }
    if (validos.length < importedPedidos.length) {
      toast.warning(
        `Foram ignorados ${importedPedidos.length - validos.length} pedidos sem endereço.`,
      );
    }
    const semDados = detectarPendenciasDados(validos).length;
    if (semDados > 0) {
      toast.info(
        `${semDados} pedido(s) com dados incompletos — roteirizados com valores padrão. Veja "Pendências de Dados".`,
      );
    }
    const geocodificados = await geocodificarPedidosSemCoordenadas(validos);
    setPedidos(geocodificados);
    setImportedPedidos([]);
    toast.success(`${geocodificados.length} pedidos importados com sucesso!`);
    setActiveTab("visao_geral");
  };

  const limparImportacao = () => {
    setImportedPedidos([]);
    setFileError("");
  };

  const totaisImportados = calcularTotaisPedidos(importedPedidos);

  const totais = calcularTotaisPedidos(pedidos);
  const alertasValidacao = validarListaPedidos(pedidos);
  const alertasDemandaxFrota = gerarAlertasPorDemandaxFrota(pedidos, veiculos);
  const gruposFaixaCep = agruparPorFaixaCep(pedidos);
  const gruposRegiao = agruparPorRegiao(pedidos);
  
  const [distribuicaoGerada, setDistribuicaoGerada] = useState<ReturnType<typeof distribuirPedidosEntreVeiculos>>([]);
  const [isGerando, setIsGerando] = useState(false);
  const [rotasCalculadas, setRotasCalculadas] = useState<Map<number, { distanciaKm: number; tempoMin: number; origem: string; alertas: string[]; routeCoordinates?: [number, number][] }>>(new Map());
  const [isCalculandoRotas, setIsCalculandoRotas] = useState(false);
  const [salvandoRota, setSalvandoRota] = useState<number | null>(null);

  // Manual Add Form
  const [novoPedido, setNovoPedido] = useState<Partial<PedidoRoteirizacao>>({
    numeroPedido: "", cliente: "", destinatario: "", telefone: "", cep: "", enderecoCompleto: "",
    numero: "", complemento: "", bairro: "", cidade: "", estado: "",
    janelaInicio: "", janelaFim: "", pesoKg: 0, quantidadeVolumes: 1, tipoCarga: "seco"
  });

  const handleAdicionarManual = () => {
    if (!novoPedido.cep || !novoPedido.cidade || !novoPedido.estado) {
      toast.error("Preencha ao menos CEP, Cidade e UF.");
      return;
    }
    const endereco = novoPedido.enderecoCompleto || "";
    const numero = novoPedido.numero || "";
    const complemento = novoPedido.complemento || "";
    const enderecoCompleto = [endereco, numero, complemento, novoPedido.bairro]
      .filter(Boolean)
      .join(", ");
    const pedidoCompleto = {
      ...novoPedido,
      id: "MAN-" + Date.now(),
      numeroPedido: novoPedido.numeroPedido || "MAN-" + Date.now(),
      cliente: novoPedido.cliente || "Manual",
      destinatario: novoPedido.destinatario || "Manual",
      telefone: novoPedido.telefone || "",
      cep: novoPedido.cep || "",
      enderecoCompleto,
      endereco,
      numero,
      complemento,
      bairro: novoPedido.bairro || "",
      cidade: novoPedido.cidade || "",
      estado: novoPedido.estado || "",
      latitude: 0,
      longitude: 0,
      pesoKg: novoPedido.pesoKg || 0,
      quantidadeVolumes: novoPedido.quantidadeVolumes || 1,
      cubagemM3: novoPedido.cubagemM3 || 0.01,
      tipoCarga: novoPedido.tipoCarga || "seco",
      secoOuRefrigerado: novoPedido.tipoCarga?.includes("refri") ? "refrigerado" : "seco",
      janelaInicio: novoPedido.janelaInicio || "",
      janelaFim: novoPedido.janelaFim || "",
      status: "pendente",
      prioridade: "normal",
    } as unknown as PedidoRoteirizacao;

    setPedidos(function(prev) { return [pedidoCompleto, ...prev]; });
    toast.success("Parada manual adicionada!");
    // Geocoding automatico (best-effort) para o endereco informado.
    void geocodificarEndereco(montarConsultaGeocode(pedidoCompleto)).then(function(coord) {
      if (!coord) return;
      setPedidos(function(prev) {
        return prev.map(function(item) {
          return item.id === pedidoCompleto.id ? { ...item, ...coord } : item;
        });
      });
    });
    setNovoPedido({
      numeroPedido: "", cliente: "", destinatario: "", telefone: "", cep: "", enderecoCompleto: "",
      numero: "", complemento: "", bairro: "", cidade: "", estado: "",
      janelaInicio: "", janelaFim: "", pesoKg: 0, quantidadeVolumes: 1, tipoCarga: "seco"
    });
  };

  const handleSalvarRotaNoSupabase = async (resultado: any, index: number) => {
    setSalvandoRota(index);
    try {
      const calculo = rotasCalculadas.get(index);
      
      const { data: rotaData, error: rotaError } = await supabase.from("rotas").insert([{
        nome: `Rota ${getNomeTipoVeiculo(resultado.veiculo.tipoVeiculo)} - ${resultado.veiculo.placa || 'Sem Placa'}`,
        data_rota: new Date().toISOString().split('T')[0],
        tipo_rota: "entrega",
        distancia_km: calculo?.distanciaKm || 0,
        duracao_min: calculo?.tempoMin || 0,
        peso_total: resultado.pedidos.reduce((acc: number, p: any) => acc + (p.pesoKg || 0), 0),
        volumes_total: resultado.pedidos.reduce((acc: number, p: any) => acc + (p.quantidadeVolumes || 0), 0),
        veiculo_sugerido: resultado.veiculo.tipoVeiculo,
        status: "pendente",
        metadata: { placa: resultado.veiculo.placa, origemCalculo: calculo?.origem }
      }]).select().single();

      if (rotaError) throw rotaError;

      const paradasToInsert = resultado.pedidos.map((p: PedidoRoteirizacao, i: number) => ({
        rota_id: rotaData.id,
        sequencia: i + 1,
        cliente_nome: p.cliente,
        telefone: p.telefone,
        cep: p.cep,
        endereco: p.enderecoCompleto,
        bairro: p.bairro,
        cidade: p.cidade,
        uf: p.estado,
        latitude: p.latitude || null,
        longitude: p.longitude || null,
        peso: p.pesoKg,
        volumes: p.quantidadeVolumes,
        cubagem: p.cubagemM3,
        status: "pendente",
        prioridade: p.prioridade
      }));

      const { error: paradasError } = await supabase.from("rota_paradas").insert(paradasToInsert);
      if (paradasError) throw paradasError;

      toast.success("Rota salva no banco com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao salvar rota: " + e.message);
    } finally {
      setSalvandoRota(null);
    }
  };

  // PEDIDOS: carrega SOMENTE enderecos de entrega/destino das OS pendentes.
  const carregarPedidosDasOS = async () => {
    try {
      setCarregandoOs(true);
      const { data: ordens, error } = await supabase
        .from("ordens_servico")
        .select("id, numero, cliente_id, cliente, enderecos, peso, volumes, cubagem, tipo_operacao, prioridade, carga_refrigerada, carga_tipo, instrucoes_operacionais_os, data_programada, status, created_at")
        .in("status", ["pendente", "agendada", "em_aberto"])
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const pedidosReais: PedidoRoteirizacao[] = [];
      (ordens || []).forEach(function(os: any) {
        let enderecos: any[] = [];
        try {
          enderecos = os.enderecos
            ? (typeof os.enderecos === "string" ? JSON.parse(os.enderecos) : os.enderecos)
            : [];
        } catch {
          enderecos = [];
        }
        if (!Array.isArray(enderecos) || enderecos.length === 0) return;

        const entregas = enderecos
          .filter(function(end: any, idx: number) {
            const tipo = String(end.tipo || end.tipo_parada || end.statusPonto || "")
              .toLowerCase();
            if (tipo.includes("entrega") || tipo === "destino") return true;
            if (tipo.includes("coleta") || tipo.includes("retirada") || tipo === "origem") {
              return false;
            }
            if (enderecos.length === 1) return true;
            return idx > 0; // 1o endereco assume coleta/origem; demais sao entregas
          })
          .filter(function(end: any) {
            return Boolean(end.cidade || end.logradouro || end.endereco);
          });

        const divisor = Math.max(entregas.length, 1);
        entregas.forEach(function(end: any, idx: number) {
          pedidosReais.push({
            id: `${os.id}-ent-${idx}`,
            numeroPedido: os.numero || `OS-${os.id?.toString().slice(0, 8)}`,
            cliente: os.cliente || "N/I",
            destinatario: end.nome_destinatario || end.nome || os.cliente || "N/I",
            telefone: end.telefone || end.telefone_contato || "",
            cep: (end.cep || "").toString().replace(/\D/g, ""),
            enderecoCompleto: `${end.logradouro || end.endereco || ""}, ${end.numero || ""} - ${end.bairro || ""}`,
            bairro: end.bairro || "",
            cidade: end.cidade || "",
            estado: end.uf || "",
            latitude: Number(end.latitude) || 0,
            longitude: Number(end.longitude) || 0,
            pesoKg: os.peso ? os.peso / divisor : 0,
            quantidadeVolumes: os.volumes ? Math.ceil(os.volumes / divisor) : 0,
            comprimentoCm: 0, larguraCm: 0, alturaCm: 0,
            cubagemM3: os.cubagem ? os.cubagem / divisor : 0,
            tipoCarga: os.carga_tipo || "seco",
            secoOuRefrigerado: os.carga_refrigerada ? "refrigerado" : "seco",
            prioridade: os.prioridade || "media",
            observacoes: os.instrucoes_operacionais_os || "",
            status: "pendente" as const,
          });
        });
      });

      setPedidos(pedidosReais);
      setDistribuicaoGerada([]);
      setRotasCalculadas(new Map());
      setComposicaoAplicada({});
      toast.success(
        `${pedidosReais.length} paradas de entrega carregadas das OS do sistema.`,
      );
    } catch (e: any) {
      toast.error("Erro ao carregar OS: " + (e?.message || "desconhecido"));
    } finally {
      setCarregandoOs(false);
    }
  };

  const iniciarLoteLimpo = () => {
    setPedidos([]);
    setImportedPedidos([]);
    setDistribuicaoGerada([]);
    setRotasCalculadas(new Map());
    setComposicaoAplicada({});
    setFileError("");
    toast.success("Lote limpo. Importe a planilha ou adicione paradas manualmente.");
  };

  // Constroi veiculos virtuais a partir de uma composicao escolhida/sugerida.
  const construirVeiculosDaComposicao = (
    composicao: ComposicaoItem[],
  ): VeiculoRoteirizacao[] => {
    const lista: VeiculoRoteirizacao[] = [];
    let seq = 0;
    composicao.forEach(function(item) {
      const cap = getCapacidadePadrao(item.tipo);
      const qtd = Math.max(1, item.quantidade || 1);
      for (let i = 0; i < qtd; i++) {
        lista.push({
          id: `virtual-${item.tipo}-${item.refrigerado ? "ref" : "seco"}-${seq++}`,
          tipoVeiculo: item.tipo,
          placa: "",
          motorista: "",
          capacidadePesoKg: cap?.capacidadePesoKg || 0,
          capacidadeCubagemM3: cap?.capacidadeCubagemM3 || 0,
          tipoOperacao: item.refrigerado ? "refrigerado" : "seco",
          disponivel: true,
          contratoOuAvulso: "contrato",
          onlineApp: false,
        });
      }
    });
    return lista;
  };

  const aplicarComposicao = (regiao: string, cenario: SugestaoFrotaCenario) => {
    setComposicaoAplicada(function(prev) {
      return { ...prev, [regiao]: cenario };
    });
    toast.success(
      `${regiao}: ${cenario.quantidade}x ${cenario.tipoNome} (${
        cenario.rotuloModo || "cenário"
      }) aplicado.`,
    );
  };

  const limparComposicaoRegiao = (regiao: string) => {
    setComposicaoAplicada(function(prev) {
      const copia = { ...prev };
      delete copia[regiao];
      return copia;
    });
  };

  const limparComposicao = () => setComposicaoAplicada({});

  /** Agrega as escolhas por região (e o recomendado das não escolhidas) numa composição única. */
  const montarComposicaoPorRegiao = (
    pedidosGeocodificados: PedidoRoteirizacao[],
  ): ComposicaoItem[] => {
    const pedidosSeco = pedidosGeocodificados.filter(
      (p) => p.secoOuRefrigerado !== "refrigerado",
    );
    const pedidosRefrigerado = pedidosGeocodificados.filter(
      (p) => p.secoOuRefrigerado === "refrigerado",
    );

    const acumulado = new Map<string, ComposicaoItem>();
    const adicionar = (tipo: TipoVeiculo, quantidade: number, refrigerado: boolean) => {
      if (quantidade <= 0) return;
      const chave = `${tipo}::${refrigerado ? "ref" : "seco"}`;
      const atual = acumulado.get(chave);
      if (atual) atual.quantidade += quantidade;
      else acumulado.set(chave, { tipo, quantidade, refrigerado });
    };

    gerarSugestoesComparativasPorRegiao(pedidosSeco)
      .filter((s) => s.regiao !== "Consolidado geral")
      .forEach((s) => {
        const escolha = composicaoAplicada[s.regiao] || s.recomendado;
        if (escolha) adicionar(escolha.tipo, escolha.quantidade, false);
      });

    // Cargas refrigeradas sempre com veículo refrigerado (Van/VUC).
    sugerirVeiculosNecessarios(pedidosRefrigerado, ["refrigerado"]).forEach((s) => {
      adicionar(s.tipo, s.quantidade, true);
    });

    return Array.from(acumulado.values());
  };

  const handleGerarRoteiros = async () => {
    if (pedidos.length === 0) {
      toast.error(
        "Nenhum pedido no lote. Importe uma planilha ou carregue as OS pendentes.",
      );
      return;
    }
    setIsGerando(true);
    try {
      // Geocoding automatico dos pedidos pendentes (com fallback de centroide).
      const pedidosGeocodificados = await geocodificarPedidosSemCoordenadas(pedidos);

      // Geocoding da origem, se necessario.
      let origemAtual = origem;
      if (!temCoordenadaValida(origemAtual.latitude, origemAtual.longitude)) {
        const consulta = [origemAtual.endereco, origemAtual.cidade, origemAtual.uf, origemAtual.cep, "Brasil"]
          .filter(Boolean)
          .join(", ");
        if (consulta.trim()) {
          const coord = await geocodificarEndereco(consulta);
          if (coord) {
            origemAtual = {
              ...origemAtual,
              latitude: coord.latitude,
              longitude: coord.longitude,
            };
            setOrigem(origemAtual);
          }
        }
      }
      let origemCalc = temCoordenadaValida(origemAtual.latitude, origemAtual.longitude)
        ? { lat: origemAtual.latitude, lng: origemAtual.longitude }
        : undefined;

      // Se a origem continuar sem coordenadas, usa o centroide da cidade/CEP.
      if (!origemCalc) {
        const centroide = obterCentroideAproximado(
          origemAtual.cidade,
          origemAtual.uf,
          origemAtual.cep,
        );
        origemCalc = { lat: centroide.latitude, lng: centroide.longitude };
        setOrigem((prev) => ({ ...prev, ...centroide }));
      }

      const temSelecaoRegional = Object.keys(composicaoAplicada).length > 0;
      let composicaoBase: ComposicaoItem[];
      if (temSelecaoRegional) {
        composicaoBase = montarComposicaoPorRegiao(pedidosGeocodificados);
      } else if (modoRoteirizacao === "sugestao") {
        composicaoBase = sugerirVeiculosNecessarios(
          pedidosGeocodificados,
          ["seco", "refrigerado"],
        ).map(function(s) {
          return {
            tipo: s.tipo,
            quantidade: s.quantidade,
            refrigerado: s.refrigerado,
          };
        });
      } else {
        composicaoBase = [];
      }

      // Livre de Rodízio SP: exclui placas em rodízio municipal no dia/horário da rota.
      const restricaoRodizio = Object.values(composicaoAplicada).some(
        (c) => c.restricaoRodizio,
      );
      const pedidosCentro = pedidosGeocodificados.filter(
        (p) => identificarMacroRegiao(p.cep, p.cidade, p.bairro) === "Centro SP",
      );
      const cepRefRodizio = pedidosCentro[0]?.cep || undefined;
      const janelaIniRodizio = pedidosCentro[0]?.janelaInicio || undefined;
      const janelaFimRodizio = pedidosCentro[0]?.janelaFim || undefined;
      const dataRotaRef = new Date();
      const veiculosDisponiveis = restricaoRodizio
        ? veiculos.filter(
            (v) =>
              !verificarRodizioMunicipalSP(
                v.placa,
                cepRefRodizio,
                dataRotaRef,
                janelaIniRodizio,
                janelaFimRodizio,
              ).rodizioHoje,
          )
        : veiculos;
      if (restricaoRodizio) {
        toast.info(
          `Livre de Rodízio SP: ${veiculosDisponiveis.length} veículo(s) liberados usados no pool.`,
        );
      }

      const veiculosParaUso = composicaoBase.length > 0
        ? construirVeiculosDaComposicao(composicaoBase)
        : veiculosDisponiveis;
      const res = distribuirPedidosEntreVeiculos(
        pedidosGeocodificados,
        veiculosParaUso,
        "disponiveis",
      );
      setDistribuicaoGerada(res);

      // Calculo automatico de distancia/tempo de TODAS as rotas (com origem).
      // O await é completo: o loading só encerra quando todas as rotas têm km/tempo.
      const novoMapa = new Map<number, {
        distanciaKm: number;
        tempoMin: number;
        origem: string;
        alertas: string[];
        routeCoordinates?: [number, number][];
      }>();
      const comRetorno = modoPercurso === "com_retorno";
      for (let i = 0; i < res.length; i++) {
        const pedidosOrdenados = optimizarSequenciaParadas(res[i].pedidos);
        try {
          const calc = await calcularDistanciaTempoRota(
            pedidosOrdenados.map(p => ({ latitude: p.latitude, longitude: p.longitude })),
            origemCalc,
            { comRetorno },
          );
          novoMapa.set(i, {
            distanciaKm: calc.distanciaTotalKm,
            tempoMin: calc.tempoTotalMinutos,
            origem: calc.origemCalculo,
            alertas: calc.alertas,
            routeCoordinates: calc.routeCoordinates,
          });
        } catch {
          const est = estimarDistanciaTempoLocal(pedidosOrdenados);
          novoMapa.set(i, {
            distanciaKm: est.distanciaTotalKm,
            tempoMin: est.tempoTotalMinutos,
            origem: "estimativa_local",
            alertas: est.alertas,
          });
        }
        await new Promise(r => setTimeout(r, 120));
      }
      setRotasCalculadas(novoMapa);
      toast.success(`Roteiros gerados (${res.length}) e distâncias calculadas!`);
      setActiveTab("roteiros");
    } catch (err: any) {
      toast.error("Erro ao gerar roteiros: " + err.message);
    } finally {
      setIsGerando(false);
    }
  };

  const escaparHtml = (valor: unknown): string =>
    String(valor ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const UUID_TEXTO_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const nomeSeguro = (valor: unknown): string => {
    const texto = String(valor ?? "").trim();
    if (!texto || UUID_TEXTO_RE.test(texto)) return "Destinatário não informado";
    return texto;
  };

  const regiaoDaRota = (resultado: { pedidos: PedidoRoteirizacao[] }): string =>
    Array.from(
      new Set(resultado.pedidos.map((p) => p.bairro || p.cidade).filter(Boolean)),
    ).slice(0, 3).join(" / ") || "—";

  const montarTextoRota = (
    resultado: { veiculo: VeiculoRoteirizacao; pedidos: PedidoRoteirizacao[] },
    idx: number,
    calculo: { distanciaKm: number; tempoMin: number } | undefined,
    pedidosOrdenados: PedidoRoteirizacao[],
  ): string => {
    const janela = avaliarJanelasHorario(pedidosOrdenados, { inicio: "08:00" });
    const codigo = `ROTA-${String(idx + 1).padStart(2, "0")}`;
    const volumesTotal = pedidosOrdenados.reduce(
      (acc, p) => acc + (p.quantidadeVolumes || 0),
      0,
    );
    const linhas: string[] = [];
    linhas.push(`CONEXAO EXPRESS - ROTA ${codigo} (WEB)`);
    linhas.push(`Regiao: ${regiaoDaRota(resultado)}`);
    linhas.push(
      `Percurso: ${modoPercurso === "com_retorno" ? "Ida e volta a base" : "Somente ida"}`,
    );
    linhas.push(
      `Veiculo: ${getNomeTipoVeiculo(resultado.veiculo.tipoVeiculo)} ${
        resultado.veiculo.placa || ""
      } | Motorista: ${resultado.veiculo.motorista || "a definir"}`,
    );
    linhas.push(
      `Distancia: ${calculo?.distanciaKm ?? 0} km | Tempo: ${
        calculo?.tempoMin ?? 0
      } min | Volumes: ${volumesTotal} | Janela: ${janela.janelaAtendida}`,
    );
    linhas.push("");
    linhas.push("PARADAS:");
    pedidosOrdenados.forEach((p, i) => {
      const endereco = [
        p.endereco || p.enderecoCompleto,
        p.numero,
        p.complemento,
        p.bairro,
        [p.cidade, p.estado].filter(Boolean).join("/"),
        p.cep,
      ].filter(Boolean).join(", ");
      const horario = (p.janelaInicio || p.janelaFim)
        ? `${p.janelaInicio || "--:--"}-${p.janelaFim || "--:--"}`
        : "sem janela";
      linhas.push(
        `[Parada #${i + 1}] ${p.destinatario || p.cliente} | ${endereco} | Horario: ${horario} | Carga: ${
          p.quantidadeVolumes || 0
        } vol / ${p.pesoKg || 0} kg | Contato: ${p.telefone || "-"} | Obs: ${
          p.observacoes || "-"
        }`,
      );
    });
    return linhas.join("\n");
  };

  const copiarRotaWhatsApp = async (
    resultado: { veiculo: VeiculoRoteirizacao; pedidos: PedidoRoteirizacao[] },
    idx: number,
  ) => {
    const pedidosOrdenados = optimizarSequenciaParadas(resultado.pedidos);
    const calculo = rotasCalculadas.get(idx);
    const texto = montarTextoRota(resultado, idx, calculo, pedidosOrdenados);
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Rota copiada para o WhatsApp.");
    } catch {
      const area = document.createElement("textarea");
      area.value = texto;
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
        toast.success("Rota copiada.");
      } catch {
        toast.error("Nao foi possivel copiar a rota.");
      }
      area.remove();
    }
    setCopiadoIdx(idx);
    setTimeout(function() {
      setCopiadoIdx((prev) => (prev === idx ? null : prev));
    }, 2000);
  };

  const imprimirRomaneio = (
    resultado: { veiculo: VeiculoRoteirizacao; pedidos: PedidoRoteirizacao[] },
    idx: number,
  ) => {
    const pedidosOrdenados = optimizarSequenciaParadas(resultado.pedidos);
    const calculo = rotasCalculadas.get(idx);
    const janela = avaliarJanelasHorario(pedidosOrdenados, { inicio: "08:00" });
    const peso = resultado.pedidos.reduce((a, p) => a + (p.pesoKg || 0), 0);
    const volumes = resultado.pedidos.reduce((a, p) => a + (p.quantidadeVolumes || 0), 0);
    const cubagem = resultado.pedidos.reduce((a, p) => a + calcularCubagemPedido(p), 0);

    const linhasTabela = pedidosOrdenados.map((p, i) => {
      const endereco = escaparHtml(
        [
          p.endereco || p.enderecoCompleto,
          p.numero,
          p.complemento,
          p.bairro,
          [p.cidade, p.estado].filter(Boolean).join("/"),
          p.cep,
        ].filter(Boolean).join(", "),
      );
      const horario = (p.janelaInicio || p.janelaFim)
        ? `${p.janelaInicio || "--:--"}-${p.janelaFim || "--:--"}`
        : "-";
      return `<tr><td>${i + 1}</td><td>${escaparHtml(p.destinatario || p.cliente)}</td><td>${endereco}</td><td>${horario}</td><td>${p.quantidadeVolumes || 0}/${p.pesoKg || 0}kg</td><td>${escaparHtml(p.telefone || "")}</td><td class="sign"></td></tr>`;
    }).join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Romaneio ROTA-${idx + 1}</title><style>
      *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:18px;font-size:11px}
      h1{font-size:16px;margin:0} .head{display:flex;justify-content:space-between;border-bottom:2px solid #3B1E6D;padding-bottom:8px;margin-bottom:10px}
      .muted{color:#666} .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0}
      .box{border:1px solid #ccc;border-radius:4px;padding:4px 6px} .box b{display:block;color:#555;font-size:9px;text-transform:uppercase}
      table{width:100%;border-collapse:collapse;margin-top:8px} th,td{border:1px solid #999;padding:4px;vertical-align:top}
      th{background:#3B1E6D;color:#fff;font-size:10px;text-align:left} .sign{width:90px;height:26px}
      .foot{margin-top:18px;display:flex;justify-content:space-between;gap:20px} .line{border-top:1px solid #333;width:45%;padding-top:4px;text-align:center;font-size:10px}
      @media print{body{margin:10mm}}
    </style></head><body>
      <div class="head"><div><h1>CONEXAO EXPRESS TRANSPORTES</h1><div class="muted">Romaneio de Carga / Entrega</div></div>
      <div style="text-align:right"><div><b>ROTA-${idx + 1}</b></div><div class="muted">${new Date().toLocaleString("pt-BR")}</div></div></div>
      <div class="grid">
        <div class="box"><b>Veiculo</b>${escaparHtml(getNomeTipoVeiculo(resultado.veiculo.tipoVeiculo))} ${escaparHtml(resultado.veiculo.placa || "")}</div>
        <div class="box"><b>Motorista</b>${escaparHtml(resultado.veiculo.motorista || "a definir")}</div>
        <div class="box"><b>Regiao</b>${escaparHtml(regiaoDaRota(resultado))}</div>
        <div class="box"><b>Paradas</b>${resultado.pedidos.length}</div>
        <div class="box"><b>Peso total</b>${peso.toFixed(1)} kg</div>
        <div class="box"><b>Volumes</b>${volumes}</div>
        <div class="box"><b>Cubagem</b>${cubagem.toFixed(2)} m3</div>
        <div class="box"><b>Distancia/Tempo</b>${calculo?.distanciaKm ?? 0} km / ${calculo?.tempoMin ?? 0} min</div>
        <div class="box"><b>Percurso</b>${modoPercurso === "com_retorno" ? "Ida e volta a base" : "Somente ida"}</div>
      </div>
      <div class="muted">Janela atendida: ${escaparHtml(janela.janelaAtendida)}</div>
      <table><thead><tr><th>#</th><th>Destinatario</th><th>Endereco</th><th>Horario</th><th>Vol/Kg</th><th>Contato</th><th>Conferencia</th></tr></thead><tbody>${linhasTabela}</tbody></table>
      <div class="foot"><div class="line">Assinatura do motorista</div><div class="line">Assinatura do conferente</div></div>
    </body></html>`;

    const win = window.open("", "_blank", "width=980,height=720");
    if (!win) {
      toast.error("Permita pop-ups para imprimir o romaneio.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function() { win.print(); }, 350);
  };

  const despacharRotaAtual = async (
    resultado: { veiculo: VeiculoRoteirizacao; pedidos: PedidoRoteirizacao[] },
    idx: number,
  ) => {
    const veiculoId = despachoAlvo[idx];
    const veiculo = veiculos.find((v) => v.id === veiculoId);
    if (!veiculo || !veiculo.prestadorId) {
      toast.error("Selecione um motorista/veiculo disponivel para despachar.");
      return;
    }
    setDespachandoIdx(idx);
    try {
      const pedidosOrdenados = optimizarSequenciaParadas(resultado.pedidos);
      const calculo = rotasCalculadas.get(idx);
      const res = await despacharRotaParaApp({
        pedidos: pedidosOrdenados,
        veiculo,
        prestadorId: veiculo.prestadorId || null,
        placa: veiculo.placa,
        tipoVeiculo: veiculo.tipoVeiculo,
        motorista: veiculo.motorista,
        regiao: regiaoDaRota(resultado),
        distanciaKm: calculo?.distanciaKm,
        duracaoMin: calculo?.tempoMin,
        rotaNome: `Rota ${getNomeTipoVeiculo(veiculo.tipoVeiculo)} ${
          veiculo.placa || ""
        }`.trim(),
      });
      setDespachos((prev) => ({ ...prev, [idx]: res }));
      toast.success(
        `Despachado para ${veiculo.motorista || "motorista"}. OS ${res.numeroOs} criada.`,
      );
    } catch (erro: any) {
      toast.error(erro?.message || "Falha ao despachar para o App.");
    } finally {
      setDespachandoIdx(null);
    }
  };

  const calcularDistanciaTempoUmaRota = async (pedidosRota: PedidoRoteirizacao[], index: number) => {
    setIsCalculandoRotas(true);
    try {
      const pedidosOrdenados = optimizarSequenciaParadas(pedidosRota);
      
      const resultado = await calcularDistanciaTempoRota(
        pedidosOrdenados.map(p => ({ latitude: p.latitude, longitude: p.longitude })),
        origemCoords,
        { comRetorno: modoPercurso === "com_retorno" },
      );

      const novoMapa = new Map(rotasCalculadas);
      novoMapa.set(index, {
        distanciaKm: resultado.distanciaTotalKm,
        tempoMin: resultado.tempoTotalMinutos,
        origem: resultado.origemCalculo,
        alertas: resultado.alertas,
        routeCoordinates: resultado.routeCoordinates
      });
      setRotasCalculadas(novoMapa);

      return resultado;
    } catch (err) {
      const estimativa = estimarDistanciaTempoLocal(pedidosRota);
      const novoMapa = new Map(rotasCalculadas);
      novoMapa.set(index, {
        distanciaKm: estimativa.distanciaTotalKm,
        tempoMin: estimativa.tempoTotalMinutos,
        origem: 'estimativa_local',
        alertas: estimativa.alertas,
      });
      setRotasCalculadas(novoMapa);
      return estimativa;
    } finally {
      setIsCalculandoRotas(false);
    }
  };

  const calcularTodasAsRotas = async () => {
    setIsCalculandoRotas(true);
    try {
      for (let i = 0; i < distribuicao.length; i++) {
        const resultado = distribuicao[i];
        const pedidosRota = resultado.pedidos;
        const pedidosOrdenados = optimizarSequenciaParadas(pedidosRota);
        
        const calcResultado = await calcularDistanciaTempoRota(
          pedidosOrdenados.map(p => ({ latitude: p.latitude, longitude: p.longitude })),
          origemCoords,
          { comRetorno: modoPercurso === "com_retorno" },
        );

        const novoMapa = new Map(rotasCalculadas);
        novoMapa.set(i, {
          distanciaKm: calcResultado.distanciaTotalKm,
          tempoMin: calcResultado.tempoTotalMinutos,
          origem: calcResultado.origemCalculo,
          alertas: calcResultado.alertas,
          routeCoordinates: calcResultado.routeCoordinates
        });
        setRotasCalculadas(novoMapa);
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      toast.success("Cálculo de distâncias concluído!");
    } catch (err: any) {
      toast.error("Erro ao calcular rotas: " + err.message);
    } finally {
      setIsCalculandoRotas(false);
    }
  };

  const distribuicao = distribuicaoGerada.length > 0 ? distribuicaoGerada : distribuirPedidosEntreVeiculos(pedidos, veiculos, modoRoteirizacao);
  

  const resumo = gerarResumoRoteirizacao(distribuicao, pedidos);

  const downloadModeloPlanilha = () => {
    const amostras = [
      ["PED-001", "Cliente A", "João Silva", "11999999999", "123.456.789-00", "joao@exemplo.com", "01234-567", "Rua Augusta", "150", "Ap 12", "Consolação", "São Paulo", "SP", "2.5", "1", "30", "20", "15", "seco", "seco", "08:00", "12:00", "media", "Entregar na portaria"],
      ["PED-002", "Cliente B", "Maria Santos", "11988888888", "", "", "04567-890", "Av Paulista", "1000", "", "Bela Vista", "São Paulo", "SP", "5.0", "2", "40", "30", "20", "seco", "seco", "", "", "alta", ""],
    ];
    const csvContent = [
      CABECALHO_PLANILHA.join(","),
      ...amostras.map(function(linha) { return linha.join(","); }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "modelo_importacao_pedidos.csv";
    link.click();
  };

  const getAlertaIcon = (tipo: 'erro' | 'aviso' | 'sugestao') => {
    switch (tipo) {
      case 'erro': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'aviso': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'sugestao': return <AlertTriangle className="w-4 h-4 text-blue-500" />;
    }
  };

  const moverParada = (origemIdx: number, pedidoId: string, destinoIdx: number) => {
    if (origemIdx === destinoIdx) return;
    setDistribuicaoGerada(function(prev) {
      const base = prev.length > 0 ? prev : distribuicao;
      const clone = base.map(function(r) {
        return { ...r, pedidos: [...r.pedidos] };
      });
      const origem = clone[origemIdx];
      const destino = clone[destinoIdx];
      if (!origem || !destino) return prev;
      const pos = origem.pedidos.findIndex(function(p) { return p.id === pedidoId; });
      if (pos < 0) return prev;
      const movido = origem.pedidos.splice(pos, 1)[0];
      destino.pedidos.push(movido);
      destino.pedidos = optimizarSequenciaParadas(destino.pedidos);
      return clone;
    });
    setRotasCalculadas(new Map());
    toast.success("Parada movida entre roteiros.");
  };

  const renderPendenciasDados = (lista: PedidoRoteirizacao[]) => {
    const pendencias = detectarPendenciasDados(lista);
    if (pendencias.length === 0) return null;
    const copiarSolicitacao = async () => {
      const texto = gerarSolicitacaoDadosWhatsApp(lista);
      try {
        await navigator.clipboard.writeText(texto);
        toast.success("Solicitação copiada — cole no WhatsApp/E-mail do cliente.");
      } catch {
        toast.error("Não foi possível copiar automaticamente.");
      }
    };
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-800">
                <AlertTriangle className="w-4 h-4" />
                Pendências de Dados do Cliente ({pendencias.length})
              </CardTitle>
              <CardDescription className="text-amber-700">
                Pedidos roteirizados com valores padrão (peso 1 kg). Solicite a
                complementação sem travar a operação.
              </CardDescription>
            </div>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={copiarSolicitacao}>
              <Copy className="w-3.5 h-3.5 mr-1" />
              Copiar Solicitação p/ Cliente (WhatsApp/E-mail)
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[240px] space-y-1 overflow-y-auto">
            {pendencias.map(({ pedido, faltando }) => (
              <div
                key={pedido.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-200 bg-white px-2 py-1 text-xs"
              >
                <span className="font-medium text-slate-700">
                  {pedido.numeroPedido || pedido.id}
                  {pedido.destinatario && pedido.destinatario !== "Não informado"
                    ? ` — ${pedido.destinatario}`
                    : ""}
                </span>
                <span className="text-amber-700">Faltando: {faltando.join(", ")}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSugestoesComparativas = () => {
    if (sugestoesComparativas.length === 0) return null;
    const regioesAcionaveis = sugestoesComparativas.filter(
      (s) => s.regiao !== "Consolidado geral",
    );
    const consolidado = sugestoesComparativas.find(
      (s) => s.regiao === "Consolidado geral",
    );
    const selecionadas = Object.entries(composicaoAplicada);
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Truck className="w-4 h-4 text-indigo-500" />
            Sugestões Comparativas de Frota por Região
          </CardTitle>
          <CardDescription>
            3 modos por região — escolha quantos veículos usar em cada região de forma independente.
            Máxima Ocupação, Rapidez (Motos) e Livre de Rodízio SP.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selecionadas.length > 0 && (
            <div className="mb-3 flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Composição aplicada:{" "}
                {selecionadas
                  .map(([regiao, c]) => `${regiao}: ${c.quantidade}x ${c.tipoNome}`)
                  .join(" • ")}
              </span>
              <Button
                variant="link"
                size="sm"
                className="h-6 self-start text-xs"
                onClick={limparComposicao}
              >
                Limpar tudo
              </Button>
            </div>
          )}
          <div className="space-y-3">
            {regioesAcionaveis.map(function(s) {
              const escolhida = composicaoAplicada[s.regiao];
              return (
                <div key={s.regiao} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {s.regiao}{" "}
                      <span className="font-normal text-muted-foreground">
                        ({s.paradas} paradas • {s.pesoKg.toFixed(1)} kg •{" "}
                        {s.cubagemM3.toFixed(2)} m³)
                      </span>
                    </p>
                    {escolhida && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-rose-600"
                        onClick={function() { limparComposicaoRegiao(s.regiao); }}
                      >
                        Limpar região
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {s.cenarios.map(function(c, ci) {
                      const isRec = Boolean(
                        s.recomendado && c.modo === s.recomendado.modo &&
                          c.tipo === s.recomendado.tipo &&
                          c.quantidade === s.recomendado.quantidade,
                      );
                      const isSel = Boolean(escolhida && escolhida.modo === c.modo);
                      return (
                        <span key={`${c.modo}-${c.tipo}`} className="inline-flex items-center gap-2">
                          {ci > 0 && (
                            <span className="text-[11px] text-slate-400">OU</span>
                          )}
                          <button
                            type="button"
                            onClick={function() { aplicarComposicao(s.regiao, c); }}
                            className={
                              "inline-flex flex-col items-start gap-0.5 rounded-lg border px-3 py-1.5 text-left text-xs transition-colors " +
                              (isSel
                                ? "border-emerald-400 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300"
                                : isRec
                                ? "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")
                            }
                            title={c.descricao || "Aplicar esta composição"}
                          >
                            <span className="font-semibold">{c.rotuloModo}</span>
                            <span>
                              {c.resumo}
                              {isRec && !isSel && (
                                <span className="ml-1 text-[10px] font-semibold text-indigo-600">
                                  recomendado
                                </span>
                              )}
                            </span>
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {consolidado && (
            <div className="mt-3 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              <span className="font-medium text-slate-600">Consolidado geral:</span>{" "}
              {consolidado.paradas} paradas • {consolidado.pesoKg.toFixed(1)} kg •{" "}
              {consolidado.cubagemM3.toFixed(2)} m³
              {consolidado.recomendado &&
                ` · recomendado ${consolidado.recomendado.quantidade}x ${consolidado.recomendado.tipoNome}`}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Route className="w-6 h-6 text-primary" />
            Roteirizador Web Profissional
          </h2>
          <p className="text-sm text-muted-foreground">Planejamento de rotas multipontos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadModeloPlanilha}>
            <Download className="w-4 h-4 mr-2" />
            Baixar Modelo
          </Button>
          <Button size="sm" onClick={() => setActiveTab("importar")}>
            <Upload className="w-4 h-4 mr-2" />
            Importar Planilha
          </Button>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleGerarRoteiros} disabled={isGerando}>
            <Route className="w-4 h-4 mr-2" />
            {isGerando ? "Gerando..." : "Gerar Roteiros Inteligentes"}
          </Button>
        </div>
      </div>

      <Card className="border-indigo-200 bg-indigo-50/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MapPinned className="w-4 h-4 text-indigo-600" />
            Local de Carregamento (Ponto de Partida)
          </CardTitle>
          <CardDescription>
            Ponto zero de todos os roteiros — usado no cálculo de km e tempo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS_ORIGEM.map(function(p) {
              return (
                <Button
                  key={p.rotulo}
                  size="sm"
                  variant={origem.rotulo === p.rotulo ? "default" : "outline"}
                  onClick={function() { aplicarPresetOrigem(p); }}
                >
                  <Home className="w-3.5 h-3.5 mr-1" />
                  {p.rotulo}
                </Button>
              );
            })}
            {basesPersonalizadas.map(function(b) {
              return (
                <span key={b.rotulo} className="inline-flex items-center rounded-md border bg-white">
                  <Button
                    size="sm"
                    variant={origem.rotulo === b.rotulo ? "secondary" : "ghost"}
                    className="rounded-r-none"
                    onClick={function() { aplicarPresetOrigem(b); }}
                  >
                    {b.rotulo}
                  </Button>
                  <button
                    type="button"
                    title="Remover base"
                    className="px-1.5 text-rose-500 hover:text-rose-700"
                    onClick={function() { removerBasePersonalizada(b.rotulo); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              );
            })}
            <Button
              size="sm"
              variant="outline"
              className="border-dashed"
              onClick={function() { setNomeNovaBase(""); setSalvarBaseAberta(true); }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Salvar Nova Base
            </Button>
            <Badge variant="outline" className="ml-auto bg-white">
              {temCoordenadaValida(origem.latitude, origem.longitude)
                ? `${origem.latitude.toFixed(4)}, ${origem.longitude.toFixed(4)}`
                : "Origem sem coordenadas"}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-white p-2">
            <span className="text-xs font-semibold text-slate-600">Percurso:</span>
            <Button
              size="sm"
              variant={modoPercurso === "sem_retorno" ? "default" : "outline"}
              onClick={function() { setModoPercurso("sem_retorno"); }}
            >
              <Flag className="w-3.5 h-3.5 mr-1" />
              Sem Retorno (Somente Ida)
            </Button>
            <Button
              size="sm"
              variant={modoPercurso === "com_retorno" ? "default" : "outline"}
              onClick={function() { setModoPercurso("com_retorno"); }}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Com Retorno à Base (Ida e Volta)
            </Button>
            <span className="text-[11px] text-muted-foreground">
              {modoPercurso === "com_retorno"
                ? "Origem → paradas → Origem (km e tempo incluem a volta)."
                : "Origem → paradas (sem a volta à base)."}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
            <Input
              value={origem.cep}
              onChange={function(e) { setOrigem({ ...origem, cep: e.target.value }); }}
              onBlur={function() { void buscarCepOrigem(); }}
              placeholder="CEP"
              className="h-9"
            />
            <Input
              value={origem.endereco}
              onChange={function(e) { setOrigem({ ...origem, endereco: e.target.value, rotulo: "Personalizado" }); }}
              placeholder="Endereço completo"
              className="h-9 md:col-span-2"
            />
            <Input
              value={origem.cidade}
              onChange={function(e) { setOrigem({ ...origem, cidade: e.target.value }); }}
              placeholder="Cidade"
              className="h-9"
            />
            <Input
              value={origem.uf}
              onChange={function(e) { setOrigem({ ...origem, uf: e.target.value }); }}
              placeholder="UF"
              className="h-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={function() { void geocodificarOrigem(); }}
              disabled={geocodificandoOrigem}
            >
              {geocodificandoOrigem ? "Buscando..." : "Buscar coordenadas"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {buscandoCepOrigem ? "Consultando ViaCEP..." : "CEP preenche endereço via ViaCEP · Mapbox / Nominatim"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Dialog open={salvarBaseAberta} onOpenChange={setSalvarBaseAberta}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar Nova Base</DialogTitle>
            <DialogDescription>
              A base fica salva neste navegador com endereço, cidade/UF e coordenadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome da base</Label>
              <Input
                value={nomeNovaBase}
                onChange={function(e) { setNomeNovaBase(e.target.value); }}
                placeholder="Ex.: Base Santana"
              />
            </div>
            <div className="rounded-lg border bg-slate-50 p-2 text-xs text-slate-600">
              <p><b>CEP:</b> {origem.cep || "—"}</p>
              <p><b>Endereço:</b> {origem.endereco || "—"}</p>
              <p><b>Cidade/UF:</b> {origem.cidade || "—"}/{origem.uf || "—"}</p>
              <p>
                <b>Coordenadas:</b>{" "}
                {temCoordenadaValida(origem.latitude, origem.longitude)
                  ? `${origem.latitude.toFixed(4)}, ${origem.longitude.toFixed(4)}`
                  : "sem coordenadas"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={function() { setSalvarBaseAberta(false); }}>
              Cancelar
            </Button>
            <Button onClick={salvarNovaBase}>
              <Save className="w-4 h-4 mr-1" />
              Salvar Base
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-card border w-full justify-start overflow-x-auto flex-wrap">
          <TabsTrigger value="visao_geral" className="gap-1">
            <LayoutDashboard className="w-4 h-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="importar" className="gap-1">
            <Upload className="w-4 h-4" />
            Importar Pedidos
          </TabsTrigger>
          <TabsTrigger value="agrupamento" className="gap-1">
            <MapPin className="w-4 h-4" />
            Agrupamento
          </TabsTrigger>
          <TabsTrigger value="veiculos" className="gap-1">
            <Truck className="w-4 h-4" />
            Veículos
          </TabsTrigger>
          <TabsTrigger value="roteiros" className="gap-1">
            <Route className="w-4 h-4" />
            Roteiros
          </TabsTrigger>
          <TabsTrigger value="mapa" className="gap-1">
            <MapIcon className="w-4 h-4" />
            Mapa
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-1">
            <FileCheck className="w-4 h-4" />
            Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao_geral" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-500" />
                Origem dos Pedidos
              </CardTitle>
              <CardDescription>
                Escolha antes de roteirizar — evita poluir o lote com OS antigas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={iniciarLoteLimpo}>
                  <Plus className="w-4 h-4 mr-2" />
                  Iniciar lote limpo (Planilha/Manual)
                </Button>
                <Button
                  size="sm"
                  onClick={function() { void carregarPedidosDasOS(); }}
                  disabled={carregandoOs}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {carregandoOs
                    ? "Carregando OS..."
                    : "Carregar OS pendentes do sistema"}
                </Button>
                <Badge variant="outline" className="ml-auto">
                  {pedidos.length} pedidos no lote
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                A tela inicia vazia por padrão. Ao carregar do sistema, apenas os
                endereços de entrega/destino das OS pendentes/agendadas são
                considerados (a coleta/origem é ignorada).
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-500" />
                  Total de Pedidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{totais.totalPedidos}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Scale className="w-4 h-4 text-green-500" />
                  Peso Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{totais.pesoTotalKg.toFixed(1)} kg</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-purple-500" />
                  Cubagem Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{totais.cubagemTotalM3.toFixed(2)} m³</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPinned className="w-4 h-4 text-orange-500" />
                  Regiões
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{totais.regioesIdentificadas.length}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Truck className="w-4 h-4 text-indigo-500" />
                  Veículos Necessários
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  // 0 pedidos ⇒ 0 veículos necessários (nunca o total da frota).
                  const plano = pedidos.length > 0
                    ? sugerirVeiculosNecessarios(pedidos, ['seco', 'refrigerado'])
                    : [];
                  const total = plano.reduce((acc, v) => acc + (v.quantidade || 0), 0);
                  return (
                    <>
                      <p className="text-2xl font-bold">{total}</p>
                      <p className="text-sm text-muted-foreground">
                        {plano.length > 0
                          ? plano
                              .map(v => `${v.quantidade}x ${getNomeTipoVeiculo(v.tipo)}`)
                              .join(", ")
                          : "Nenhum pedido no lote"}
                      </p>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Truck className="w-4 h-4 text-teal-500" />
                  Veículos Disponíveis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{veiculos.filter(v => v.disponivel).length}</p>
                <p className="text-xs text-muted-foreground">
                  {veiculos.filter(v => v.disponivel && v.contratoOuAvulso === 'contrato').length} contrato, {veiculos.filter(v => v.disponivel && v.contratoOuAvulso === 'avulso').length} avulso
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  Pedidos Alocados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{resumo.totalPedidos - resumo.pedidosNaoAlocados}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Não Alocados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{resumo.pedidosNaoAlocados}</p>
              </CardContent>
            </Card>
          </div>

          {(alertasValidacao.length > 0 || alertasDemandaxFrota.length > 0) && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-4 h-4" />
                  Alertas e Problemas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...alertasValidacao, ...alertasDemandaxFrota].map((alerta, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      {getAlertaIcon(alerta.tipo)}
                      <span>{alerta.mensagem}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {renderSugestoesComparativas()}

          {renderPendenciasDados(pedidos)}

          <Card>
            <CardHeader>
              <CardTitle>Modo de Roteirização</CardTitle>
              <CardDescription>Escolha como os veículos serão selecionados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button 
                  variant={modoRoteirizacao === "sugestao" ? "default" : "outline"}
                  onClick={() => setModoRoteirizacao("sugestao")}
                >
                  <Truck className="w-4 h-4 mr-2" />
                  Sistema Sugere Veículos
                </Button>
                <Button 
                  variant={modoRoteirizacao === "disponiveis" ? "default" : "outline"}
                  onClick={() => setModoRoteirizacao("disponiveis")}
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Usar Disponíveis
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="importar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Adicionar Parada Manual</CardTitle>
              <CardDescription>Insira uma parada pontual sem precisar de planilha</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label>CEP *</Label>
                  <Input value={novoPedido.cep} onChange={e => setNovoPedido({...novoPedido, cep: e.target.value})} placeholder="Ex: 01001-000" />
                </div>
                <div>
                  <Label>Cidade *</Label>
                  <Input value={novoPedido.cidade} onChange={e => setNovoPedido({...novoPedido, cidade: e.target.value})} placeholder="Ex: São Paulo" />
                </div>
                <div>
                  <Label>UF *</Label>
                  <Input value={novoPedido.estado} onChange={e => setNovoPedido({...novoPedido, estado: e.target.value})} placeholder="Ex: SP" />
                </div>
                <div>
                  <Label>Destinatário</Label>
                  <Input value={novoPedido.destinatario} onChange={e => setNovoPedido({...novoPedido, destinatario: e.target.value})} placeholder="Nome" />
                </div>
                <div>
                  <Label>Endereço (Rua)</Label>
                  <Input value={novoPedido.enderecoCompleto} onChange={e => setNovoPedido({...novoPedido, enderecoCompleto: e.target.value})} placeholder="Ex: Rua Augusta" />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input value={novoPedido.numero || ""} onChange={e => setNovoPedido({...novoPedido, numero: e.target.value})} placeholder="Ex: 150" />
                </div>
                <div>
                  <Label>Complemento</Label>
                  <Input value={novoPedido.complemento || ""} onChange={e => setNovoPedido({...novoPedido, complemento: e.target.value})} placeholder="Ex: Ap 12" />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={novoPedido.telefone || ""} onChange={e => setNovoPedido({...novoPedido, telefone: e.target.value})} placeholder="Ex: 11999999999" />
                </div>
                <div>
                  <Label>Peso (kg)</Label>
                  <Input type="number" value={novoPedido.pesoKg || ''} onChange={e => setNovoPedido({...novoPedido, pesoKg: parseFloat(e.target.value)})} placeholder="Ex: 5.5" />
                </div>
                <div>
                  <Label>Janela Início</Label>
                  <Input type="time" value={novoPedido.janelaInicio || ""} onChange={e => setNovoPedido({...novoPedido, janelaInicio: e.target.value})} />
                </div>
                <div>
                  <Label>Janela Fim</Label>
                  <Input type="time" value={novoPedido.janelaFim || ""} onChange={e => setNovoPedido({...novoPedido, janelaFim: e.target.value})} />
                </div>
                <div>
                  <Label>Tipo Carga</Label>
                  <Select value={novoPedido.tipoCarga} onValueChange={v => setNovoPedido({...novoPedido, tipoCarga: v as PedidoRoteirizacao["tipoCarga"]})}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seco">Seco</SelectItem>
                      <SelectItem value="refrigerado">Refrigerado</SelectItem>
                      <SelectItem value="fragil">Frágil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button className="w-full" onClick={handleAdicionarManual}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Parada
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Importar Planilha</CardTitle>
              <CardDescription>
                Faça upload de uma planilha CSV ou Excel com os pedidos a serem roteirizados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {importedPedidos.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center relative hover:bg-slate-50 transition-colors">
                  <input 
                    type="file" 
                    accept=".csv, .xlsx, .xls" 
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-sm text-gray-600 mb-4">
                    Arraste a planilha aqui ou clique para selecionar
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    Formatos aceitos: .csv, .xlsx, .xls
                  </p>
                  <Button variant="outline" className="pointer-events-none">
                    {isUploading ? 'Processando...' : 'Selecionar Arquivo'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-slate-50 border rounded-lg">
                    <div>
                      <h4 className="font-bold text-slate-800">Preview da Importação</h4>
                      <p className="text-sm text-slate-500">{importedPedidos.length} linhas processadas</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={limparImportacao}>Limpar</Button>
                      <Button className="bg-green-600 hover:bg-green-700" onClick={confirmarImportacao}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Confirmar Importação
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border rounded p-3 text-center">
                      <p className="text-xs text-muted-foreground">Total Pedidos</p>
                      <p className="text-xl font-bold">{totaisImportados.totalPedidos}</p>
                    </div>
                    <div className="bg-white border rounded p-3 text-center">
                      <p className="text-xs text-muted-foreground">Com endereço</p>
                      <p className="text-xl font-bold text-green-600">
                        {importedPedidos.filter(p => p.cep || p.endereco || p.enderecoCompleto || p.cidade).length}
                      </p>
                    </div>
                    <div className="bg-white border rounded p-3 text-center">
                      <p className="text-xs text-muted-foreground">Com pendência</p>
                      <p className="text-xl font-bold text-amber-600">
                        {importedPedidos.filter(p => (p.dadosFaltantes?.length || 0) > 0).length}
                      </p>
                    </div>
                    <div className="bg-white border rounded p-3 text-center">
                      <p className="text-xs text-muted-foreground">Cubagem / Peso</p>
                      <p className="text-sm font-bold text-blue-600">
                        {totaisImportados.cubagemTotalM3.toFixed(2)}m³ / {totaisImportados.pesoTotalKg.toFixed(0)}kg
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto border rounded-lg max-h-[400px]">
                    <Table>
                      <TableHeader className="bg-slate-100 sticky top-0 z-10">
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Nº Pedido</TableHead>
                          <TableHead>Destinatário</TableHead>
                          <TableHead>CEP</TableHead>
                          <TableHead>Cidade/UF</TableHead>
                          <TableHead>Peso</TableHead>
                          <TableHead>Cubagem</TableHead>
                          <TableHead>Alertas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importedPedidos.map((pedido, i) => {
                          const semEndereco = !pedido.cep && !pedido.endereco &&
                            !pedido.enderecoCompleto && !pedido.cidade;
                          const pendencias = pedido.dadosFaltantes || [];
                          const statusColor = semEndereco
                            ? "bg-red-100 text-red-800"
                            : pendencias.length > 0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-green-100 text-green-800";
                          const statusLabel = semEndereco
                            ? "Sem endereço"
                            : pendencias.length > 0
                            ? "Com pendência"
                            : "Completo";
                          const alertaTexto = semEndereco
                            ? "Sem endereço — será ignorado"
                            : pendencias.length > 0
                            ? `Faltando: ${pendencias.join(", ")}`
                            : "-";
                          
                          return (
                            <TableRow key={i} className={semEndereco ? "bg-red-50/50" : ""}>
                              <TableCell><Badge variant="outline" className={statusColor}>{statusLabel}</Badge></TableCell>
                              <TableCell className="font-medium text-xs">{pedido.numeroPedido}</TableCell>
                              <TableCell className="text-xs">{pedido.destinatario}</TableCell>
                              <TableCell className="text-xs font-mono">{pedido.cep || '-'}</TableCell>
                              <TableCell className="text-xs">{pedido.cidade}/{pedido.estado}</TableCell>
                              <TableCell className="text-xs">{pedido.pesoKg}kg{pedido.pesoEstimado ? "*" : ""}</TableCell>
                              <TableCell className="text-xs">{calcularCubagemPedido(pedido).toFixed(3)}m³</TableCell>
                              <TableCell className="text-xs max-w-xs truncate text-amber-700">
                                {alertaTexto}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              {fileError && <p className="text-red-500 mt-4 text-sm font-bold text-center">{fileError}</p>}
            </CardContent>
          </Card>

          {renderPendenciasDados(importedPedidos)}

          <Card>
            <CardHeader>
              <CardTitle>Modelo da Planilha</CardTitle>
              <CardDescription>Baixe o modelo para preenchimento correto</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={downloadModeloPlanilha}>
                <Download className="w-4 h-4 mr-2" />
                Baixar Modelo CSV
              </Button>
              <div className="mt-4 overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {CABECALHO_PLANILHA.map(cab => (
                        <TableHead key={cab} className="text-xs whitespace-nowrap">{cab}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      {CABECALHO_PLANILHA.map((cab, idx) => (
                        <TableCell key={idx} className="text-xs text-muted-foreground whitespace-nowrap">exemplo</TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agrupamento" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Agrupamento</CardTitle>
                <CardDescription>
                  Visualize os pedidos por macro-região, CEP, urgência/janelas ou rodízio
                </CardDescription>
              </div>
              <Select value={vistaAgrupamento} onValueChange={setVistaAgrupamento}>
                <SelectTrigger className="h-9 w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="macro">Macro-Região</SelectItem>
                  <SelectItem value="cep">Faixa de CEP</SelectItem>
                  <SelectItem value="urgencia">Urgência & Janelas</SelectItem>
                  <SelectItem value="rodizio">Rodízio SP</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {vistaAgrupamento === "rodizio" ? (
                <div className="grid gap-2">
                  {veiculos.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum veículo carregado.</p>
                  )}
                  {veiculos.map(function(v) {
                    return (
                      <div key={v.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{v.placa} — {v.motorista}</p>
                          <p className="text-sm text-muted-foreground">
                            {getNomeTipoVeiculo(v.tipoVeiculo)} · {v.regiaoBase || "—"}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={v.rodizioHoje
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"}
                        >
                          {v.rodizioHoje
                            ? `Rodízio Hoje (${v.diaRodizio || "—"})`
                            : `Liberado (${v.diaRodizio || "—"})`}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  {(() => {
                    if (vistaAgrupamento === "macro") return gruposMacroRegiao;
                    if (vistaAgrupamento === "cep") return gruposFaixaCep;
                    return gruposUrgencia.map(function(g, i) {
                      return {
                        id: `urg_${i}`,
                        nome: g.nome,
                        pedidos: g.pedidos,
                        pesoTotalKg: g.pedidos.reduce((a, p) => a + (p.pesoKg || 0), 0),
                        cubagemTotalM3: g.pedidos.reduce((a, p) => a + calcularCubagemPedido(p), 0),
                      };
                    });
                  })().map(function(grupo) {
                    return (
                      <div key={grupo.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{grupo.nome}</p>
                          <p className="text-sm text-muted-foreground">{grupo.pedidos.length} pedidos</p>
                        </div>
                        <div className="text-right text-sm">
                          <p>{grupo.pesoTotalKg.toFixed(1)} kg</p>
                          <p className="text-muted-foreground">{grupo.cubagemTotalM3.toFixed(2)} m³</p>
                        </div>
                      </div>
                    );
                  })}
                  {pedidos.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum pedido no lote.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          {renderSugestoesComparativas()}
        </TabsContent>

        <TabsContent value="veiculos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Veículos Disponíveis</CardTitle>
              <CardDescription>Frota disponível para roteirização</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <Input
                  value={filtroVeiculoBusca}
                  onChange={function(e) { setFiltroVeiculoBusca(e.target.value); }}
                  placeholder="Buscar placa, motorista ou região..."
                  className="h-9"
                />
                <Select value={filtroVeiculoTipo} onValueChange={setFiltroVeiculoTipo}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os tipos</SelectItem>
                    <SelectItem value="Moto">Moto</SelectItem>
                    <SelectItem value="Fiorino">Fiorino</SelectItem>
                    <SelectItem value="HR_Bongo">HR/Bongo</SelectItem>
                    <SelectItem value="Van_VUC">Van/VUC</SelectItem>
                    <SelectItem value="Caminhao_34">3/4</SelectItem>
                    <SelectItem value="Caminhao_Toco">Toco</SelectItem>
                    <SelectItem value="Caminhao_Truck">Truck</SelectItem>
                    <SelectItem value="Carreta">Carreta</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filtroVeiculoStatus} onValueChange={setFiltroVeiculoStatus}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Status App" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos (App)</SelectItem>
                    <SelectItem value="online">Online no App</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filtroVeiculoVinculo} onValueChange={setFiltroVeiculoVinculo}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Vínculo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos (vínculo)</SelectItem>
                    <SelectItem value="contrato">Contrato</SelectItem>
                    <SelectItem value="agregado">Agregado</SelectItem>
                    <SelectItem value="avulso">Avulso</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filtroVeiculoRodizio} onValueChange={setFiltroVeiculoRodizio}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Rodízio SP" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos (rodízio)</SelectItem>
                    <SelectItem value="liberados">Liberados hoje</SelectItem>
                    <SelectItem value="rodizio">Em rodízio SP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead>Região Base</TableHead>
                    <TableHead>Peso máx.</TableHead>
                    <TableHead>Cubagem máx.</TableHead>
                    <TableHead>Tipo Operação</TableHead>
                    <TableHead>Online (App)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Rodízio SP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {veiculosFiltrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="py-6 text-center text-muted-foreground">
                        Nenhum veículo para os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  )}
                  {veiculosFiltrados.map(veiculo => (
                    <TableRow key={veiculo.id}>
                      <TableCell className="font-medium">
                        {getIconeTipoVeiculo(veiculo.tipoVeiculo)} {getNomeTipoVeiculo(veiculo.tipoVeiculo)}
                      </TableCell>
                      <TableCell>{veiculo.placa}</TableCell>
                      <TableCell>{veiculo.motorista}</TableCell>
                      <TableCell>{veiculo.regiaoBase}</TableCell>
                      <TableCell>{veiculo.capacidadePesoKg} kg</TableCell>
                      <TableCell>{veiculo.capacidadeCubagemM3} m³</TableCell>
                      <TableCell>
                        <Badge variant={veiculo.tipoOperacao === 'refrigerado' ? 'default' : 'outline'}>
                          {veiculo.tipoOperacao}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={veiculo.onlineApp ? 'default' : 'outline'}>
                          {veiculo.onlineApp ? 'Online' : 'Offline'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={veiculo.disponivel ? 'default' : 'destructive'}>
                          {veiculo.disponivel ? 'Disponível' : 'Indisponível'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={veiculo.contratoOuAvulso === 'contrato' ? 'default' : 'outline'}>
                          {veiculo.contratoOuAvulso}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={veiculo.rodizioHoje
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"}
                        >
                          {veiculo.rodizioHoje
                            ? `Rodízio Hoje (${veiculo.diaRodizio || "—"})`
                            : "Liberado"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Capacidades Padrão</CardTitle>
              <CardDescription>Valores de referência por tipo de veículo</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Capacidade Peso</TableHead>
                    <TableHead>Capacidade Cubagem</TableHead>
                    <TableHead>Máx. paradas</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CAPACIDADES_PADRAO_VEICULOS.map(cap => (
                    <TableRow key={cap.tipo}>
                      <TableCell className="font-medium">
                        {getIconeTipoVeiculo(cap.tipo as TipoVeiculo)} {cap.tipo.replace('_', ' ')}
                      </TableCell>
                      <TableCell>{cap.capacidadePesoKg} kg</TableCell>
                      <TableCell>{cap.capacidadeCubagemM3} m³</TableCell>
                      <TableCell>{cap.maxParadas ?? '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{cap.observacao || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        
        <TabsContent value="roteiros" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Roteiros Gerados</CardTitle>
                <CardDescription>Distribuição inteligente dos pedidos entre os veículos</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={calcularTodasAsRotas} 
                  disabled={isCalculandoRotas || distribuicao.length === 0}
                >
                  <MapIcon className="w-4 h-4 mr-2"/>
                  {isCalculandoRotas ? "Calculando..." : "Calcular Todas as Distâncias"}
                </Button>
                <Button onClick={handleGerarRoteiros} disabled={isGerando}>
                   <Route className="w-4 h-4 mr-2"/>
                   {isGerando ? "Recalculando..." : "Atualizar Roteiros"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {distribuicaoGerada.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed">
                    <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhum roteiro gerado.</p>
                    <p className="text-sm text-slate-500">Clique em "Gerar Roteiros Inteligentes" para distribuir a carga.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                       <div className="bg-white p-4 border rounded-lg shadow-sm">
                         <p className="text-sm text-muted-foreground">Rotas Geradas</p>
                         <p className="text-2xl font-bold">{distribuicao.length}</p>
                       </div>
                       <div className="bg-white p-4 border rounded-lg shadow-sm">
                         <p className="text-sm text-muted-foreground">Pedidos Alocados</p>
                         <p className="text-2xl font-bold text-green-600">{resumo.totalPedidos - resumo.pedidosNaoAlocados}</p>
                       </div>
                       <div className="bg-white p-4 border rounded-lg shadow-sm">
                         <p className="text-sm text-muted-foreground">Não Alocados</p>
                         <p className="text-2xl font-bold text-red-600">{resumo.pedidosNaoAlocados}</p>
                       </div>
                       <div className="bg-white p-4 border rounded-lg shadow-sm">
                         <p className="text-sm text-muted-foreground">Ocupação Média</p>
                         <p className="text-2xl font-bold text-blue-600">{resumo.ocupacaoMedia.toFixed(1)}%</p>
                       </div>
                    </div>

                    {resumo.pedidosNaoAlocados > 0 && (
                      <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                        <div className="flex items-start gap-3">
                           <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                           <div>
                             <h4 className="font-bold text-red-800">Atenção: {resumo.pedidosNaoAlocados} pedidos não alocados</h4>
                             <p className="text-sm text-red-600 mb-2">Estes pedidos excederam a capacidade da frota ou não possuem veículos compatíveis (ex: falta de refrigerado).</p>
                             <div className="bg-white/60 p-2 rounded text-sm text-red-800 font-medium border border-red-100">
                               Sugestão Extra: {
                                 sugerirVeiculosNecessarios(
                                   pedidos.filter(p => !distribuicao.some(d => d.pedidos.some(dp => dp.id === p.id))),
                                   ['seco', 'refrigerado']
                                 ).map(s => `${s.quantidade}x ${getNomeTipoVeiculo(s.tipo)}`).join(', ') || 'Nenhuma'
                               }
                             </div>
                           </div>
                        </div>
                      </div>
                    )}

                    {distribuicao.map((resultado, idx) => {
                      const pesoUsado = resultado.pedidos.reduce((acc, p) => acc + (p.pesoKg || 0), 0);
                      const cubagemUsada = resultado.pedidos.reduce((acc, p) => acc + calcularCubagemPedido(p), 0);
                      const volumesUsados = resultado.pedidos.reduce((acc, p) => acc + (p.quantidadeVolumes || 0), 0);
                      const ocupacaoPeso = resultado.veiculo.capacidadePesoKg > 0 ? (pesoUsado / resultado.veiculo.capacidadePesoKg) * 100 : 0;
                      const ocupacaoCubagem = resultado.veiculo.capacidadeCubagemM3 > 0 ? (cubagemUsada / resultado.veiculo.capacidadeCubagemM3) * 100 : 0;
                      const pedidosOrdenadosCard = optimizarSequenciaParadas(resultado.pedidos);
                      const janelaCard = avaliarJanelasHorario(pedidosOrdenadosCard, { inicio: "08:00" });
                      const regiaoCard = regiaoDaRota(resultado);
                      
                      return (
                        <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                          <div className="bg-slate-50 p-4 border-b">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="text-3xl bg-white w-12 h-12 flex items-center justify-center rounded-lg shadow-sm border">
                                  {getIconeTipoVeiculo(resultado.veiculo.tipoVeiculo)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-lg text-slate-800">{getNomeTipoVeiculo(resultado.veiculo.tipoVeiculo)}</h3>
                                    <Badge variant="outline" className="font-mono bg-white">{resultado.veiculo.placa || 'S/PLACA'}</Badge>
                                    {resultado.veiculo.tipoOperacao === 'refrigerado' && (
                                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200"><Thermometer className="w-3 h-3 mr-1"/> Refrig.</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-slate-500">{resultado.veiculo.motorista || 'Sem motorista vinculado'}</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <Badge variant={ocupacaoPeso > 90 || ocupacaoCubagem > 90 ? 'destructive' : ocupacaoPeso > 70 || ocupacaoCubagem > 70 ? 'default' : 'outline'} className="text-sm px-3 py-1">
                                  {Math.max(ocupacaoPeso, ocupacaoCubagem).toFixed(0)}% Ocupação Máx
                                </Badge>
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => calcularDistanciaTempoUmaRota(resultado.pedidos, idx)}
                                    disabled={isCalculandoRotas}
                                  >
                                    <MapIcon className="w-3 h-3 mr-1" />
                                    {rotasCalculadas.get(idx) ? 'Recalcular' : 'Calcular Distância'}
                                  </Button>
                                  {rotasCalculadas.get(idx) && (
                                    <Button 
                                      size="sm" 
                                      className="bg-green-600 hover:bg-green-700"
                                      onClick={() => handleSalvarRotaNoSupabase(resultado, idx)}
                                      disabled={salvandoRota === idx}
                                    >
                                      <Save className="w-3 h-3 mr-1" />
                                      {salvandoRota === idx ? 'Salvando...' : 'Salvar Rota'}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mt-4">
                              <div className="bg-white p-2 rounded border">
                                <p className="text-slate-500 text-xs uppercase font-semibold">Paradas</p>
                                <p className="font-bold text-slate-700">{resultado.pedidos.length}</p>
                              </div>
                              <div className="bg-white p-2 rounded border">
                                <p className="text-slate-500 text-xs uppercase font-semibold">Volumes Totais</p>
                                <p className="font-bold text-slate-700">{volumesUsados}</p>
                              </div>
                              <div className="bg-white p-2 rounded border">
                                <p className="text-slate-500 text-xs uppercase font-semibold">Peso (kg)</p>
                                <div className="flex items-end justify-between">
                                  <p className="font-bold text-slate-700">{pesoUsado.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ {resultado.veiculo.capacidadePesoKg}</span></p>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 mt-1 rounded-full overflow-hidden">
                                  <div className={`h-full ${ocupacaoPeso > 90 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(ocupacaoPeso, 100)}%` }}></div>
                                </div>
                              </div>
                              <div className="bg-white p-2 rounded border">
                                <p className="text-slate-500 text-xs uppercase font-semibold">Cubagem (m³)</p>
                                <div className="flex items-end justify-between">
                                  <p className="font-bold text-slate-700">{cubagemUsada.toFixed(2)} <span className="text-xs font-normal text-slate-400">/ {resultado.veiculo.capacidadeCubagemM3}</span></p>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 mt-1 rounded-full overflow-hidden">
                                  <div className={`h-full ${ocupacaoCubagem > 90 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(ocupacaoCubagem, 100)}%` }}></div>
                                </div>
                              </div>
                              <div className="bg-white p-2 rounded border">
                                <p className="text-slate-500 text-xs uppercase font-semibold">Distância / Tempo</p>
                                {rotasCalculadas.get(idx) ? (
                                  <div>
                                    <p className="font-bold text-slate-700">{formatarDistanciaKm(rotasCalculadas.get(idx)?.distanciaKm)} km</p>
                                    <p className="text-xs text-slate-500">{rotasCalculadas.get(idx)?.tempoMin} min</p>
                                    <Badge variant={rotasCalculadas.get(idx)?.origem === 'estimativa_local' ? 'outline' : 'default'} className="text-[10px] mt-1">
                                      {rotasCalculadas.get(idx)?.origem === 'mapbox'
                                        ? 'Mapbox Directions'
                                        : rotasCalculadas.get(idx)?.origem === 'osrm'
                                        ? 'OSRM (malha real)'
                                        : 'Estimativa Haversine 1.35x'}
                                    </Badge>
                                    {modoPercurso === "com_retorno" && (
                                      <p className="text-[10px] font-semibold text-indigo-600 mt-0.5">Ida e volta à base</p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400">Não calculado</p>
                                )}
                              </div>
                            </div>

                            {rotasCalculadas.get(idx)?.alertas && rotasCalculadas.get(idx)!.alertas.length > 0 && (
                              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
                                {rotasCalculadas.get(idx)?.alertas.map((alerta, idxA) => (
                                  <p key={idxA} className="text-amber-700">⚠️ {alerta}</p>
                                ))}
                              </div>
                            )}

                            <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <Badge variant="outline" className="bg-white">
                                  Região: {regiaoCard}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={janelaCard.violacoes > 0
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"}
                                >
                                  Janela: {janelaCard.janelaAtendida}
                                </Badge>
                                {janelaCard.violacoes > 0 && (
                                  <span className="text-amber-700">
                                    {janelaCard.violacoes} parada(s) fora da janela
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Select
                                  value={despachoAlvo[idx] || ""}
                                  onValueChange={function(v) {
                                    setDespachoAlvo(function(prev) {
                                      return { ...prev, [idx]: v };
                                    });
                                  }}
                                >
                                  <SelectTrigger className="h-9 w-[220px]">
                                    <SelectValue placeholder="Motorista/veículo p/ despachar" /></SelectTrigger>
                                  <SelectContent>
                                    {veiculos.filter(function(v) {
                                      return Boolean(v.prestadorId);
                                    }).map(function(v) {
                                      return (
                                        <SelectItem key={v.id} value={v.id}>
                                          {v.motorista} — {v.placa || v.tipoVeiculo}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                  onClick={function() { void despacharRotaAtual(resultado, idx); }}
                                  disabled={despachandoIdx === idx || Boolean(despachos[idx])}
                                >
                                  {despachandoIdx === idx
                                    ? "Despachando..."
                                    : despachos[idx]
                                    ? "Despachado"
                                    : "Despachar para App"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={function() { void copiarRotaWhatsApp(resultado, idx); }}
                                >
                                  {copiadoIdx === idx ? "Copiado!" : "Copiar Rota (WhatsApp)"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={function() { imprimirRomaneio(resultado, idx); }}
                                >
                                  Imprimir Romaneio
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-indigo-300 text-indigo-700"
                                  onClick={function() { setPreviaApp({ resultado, idx }); }}
                                >
                                  <Smartphone className="w-3.5 h-3.5 mr-1" />
                                  Prévia App Motorista
                                </Button>
                              </div>
                            </div>
                            {despachos[idx] && (
                              <p className="mt-2 text-xs text-emerald-700">
                                Despachado: OS {despachos[idx]?.numeroOs} · Alocação{" "}
                                {despachos[idx]?.alocacaoId?.slice(0, 8)} ·{" "}
                                {despachos[idx]?.totalParadas} paradas.
                              </p>
                            )}
                          </div>
                          
                          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                            <Table>
                              <TableHeader className="bg-slate-50 sticky top-0">
                                <TableRow>
                                  <TableHead className="w-12 text-center">#</TableHead>
                                  <TableHead>Pedido</TableHead>
                                  <TableHead>CEP</TableHead>
                                  <TableHead>Destinatário / Cidade</TableHead>
                                  <TableHead className="text-right">Peso</TableHead>
                                  <TableHead className="text-right">Cubagem</TableHead>
                                  <TableHead className="text-center">Tipo</TableHead>
                                  <TableHead className="text-center">Mover</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {resultado.pedidos.map((pedido, i) => (
                                  <TableRow
                                    key={pedido.id}
                                    className="cursor-pointer hover:bg-indigo-50/60"
                                    onClick={function() { setPedidoDetalhe(pedido); }}
                                    title="Clique para ver os detalhes da entrega"
                                  >
                                    <TableCell className="text-center text-slate-500">{i + 1}</TableCell>
                                    <TableCell className="font-medium text-xs">
                                      {pedido.numeroPedido}
                                      {pedido.prioridade === 'urgente' && <Badge variant="destructive" className="ml-2 text-[10px] px-1 py-0 h-4">URGENTE</Badge>}
                                    </TableCell>
                                    <TableCell className="text-xs font-mono">{pedido.cep}</TableCell>
                                    <TableCell className="text-xs">
                                      <p className="font-medium truncate max-w-[150px]" title={nomeSeguro(pedido.destinatario)}>{nomeSeguro(pedido.destinatario)}</p>
                                      <p className="text-slate-500 truncate max-w-[150px]">{[pedido.cidade, pedido.estado].filter(Boolean).join("/") || "—"}</p>
                                    </TableCell>
                                    <TableCell className="text-right text-xs">{pedido.pesoKg} kg{pedido.pesoEstimado ? "*" : ""}</TableCell>
                                    <TableCell className="text-right text-xs">{calcularCubagemPedido(pedido).toFixed(3)} m³</TableCell>
                                    <TableCell className="text-center">
                                      <Badge variant={pedido.secoOuRefrigerado === 'refrigerado' ? 'default' : 'outline'} className="text-[10px]">
                                        {pedido.secoOuRefrigerado === 'refrigerado' ? 'Refri' : 'Seco'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-center" onClick={function(e) { e.stopPropagation(); }}>
                                      <Select
                                        value=""
                                        onValueChange={function(v) {
                                          moverParada(idx, pedido.id, Number(v));
                                        }}
                                      >
                                        <SelectTrigger className="h-8 w-[120px]">
                                          <SelectValue placeholder="Mover" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {distribuicao.map(function(_, di) {
                                            if (di === idx) return null;
                                            return (
                                              <SelectItem key={di} value={String(di)}>
                                                Rota {di + 1}
                                              </SelectItem>
                                            );
                                          })}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
<TabsContent value="mapa" className="space-y-4">
          {(() => {
            if (distribuicao.length === 0) {
              return (
                <Card>
                  <CardHeader>
                    <CardTitle>Mapa das Rotas por Região</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px] bg-gray-100 rounded-lg flex items-center justify-center">
                      <p className="text-muted-foreground">
                        Gere os roteiros para visualizar o mapa por região.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            const mapaLocations = distribuicao.flatMap((res, rIdx) => {
              const cor = CORES_ROTAS[rIdx % CORES_ROTAS.length];
              return optimizarSequenciaParadas(res.pedidos).map((p, pIdx) => ({
                id: `r${rIdx}-${p.id}`,
                numero: p.numeroPedido,
                latitude: p.latitude || 0,
                longitude: p.longitude || 0,
                status: "aguardando" as const,
                cliente: p.cliente,
                sequencia: pIdx + 1,
                routeColor: cor,
                routeId: `rota-${rIdx}`,
                destinatario: nomeSeguro(p.destinatario),
                endereco: [
                  p.endereco || p.enderecoCompleto,
                  p.numero,
                  p.complemento,
                  p.bairro,
                  [p.cidade, p.estado].filter(Boolean).join("/"),
                  p.cep,
                ].filter(Boolean).join(", "),
                peso: p.pesoKg,
                janela: (p.janelaInicio || p.janelaFim)
                  ? `${p.janelaInicio || "--:--"}-${p.janelaFim || "--:--"}`
                  : "—",
                motorista: res.veiculo.motorista || "",
              })).filter(l => temCoordenadaValida(l.latitude, l.longitude));
            });

            const mapaRouteLines = distribuicao.map((res, rIdx) => {
              const cor = CORES_ROTAS[rIdx % CORES_ROTAS.length];
              const calc = rotasCalculadas.get(rIdx);
              let coords: [number, number][] = calc?.routeCoordinates
                ? [...calc.routeCoordinates]
                : [];
              if (coords.length < 2) {
                const pts: [number, number][] = [];
                const origemVal = temCoordenadaValida(origem.latitude, origem.longitude);
                if (origemVal) {
                  pts.push([origem.longitude, origem.latitude]);
                }
                optimizarSequenciaParadas(res.pedidos).forEach(p => {
                  if (temCoordenadaValida(p.latitude, p.longitude)) {
                    pts.push([p.longitude!, p.latitude!]);
                  }
                });
                if (origemVal && modoPercurso === "com_retorno" && pts.length >= 2) {
                  pts.push([origem.longitude, origem.latitude]);
                }
                coords = pts;
              }
              return { id: `rota-${rIdx}`, color: cor, coordinates: coords };
            }).filter(l => l.coordinates.length >= 2);

            const mapaPolygons = distribuicao.map((res, rIdx) => {
              const cor = CORES_ROTAS[rIdx % CORES_ROTAS.length];
              const pts: [number, number][] = res.pedidos
                .filter(p => temCoordenadaValida(p.latitude, p.longitude))
                .map(p => [p.longitude!, p.latitude!] as [number, number]);
              const hull = convexHull(pts);
              if (hull.length < 3) return null;
              const buf = bufferHull(hull);
              return {
                id: `rota-${rIdx}`,
                color: cor,
                coordinates: [...buf, buf[0]] as [number, number][],
                label: regiaoDaRota(res),
              };
            }).filter(Boolean) as {
              id: string;
              color: string;
              coordinates: [number, number][];
              label: string;
            }[];

            const mapaLegend = distribuicao.map((res, rIdx) => ({
              color: CORES_ROTAS[rIdx % CORES_ROTAS.length],
              label: `${rIdx + 1}. ${getNomeTipoVeiculo(res.veiculo.tipoVeiculo)} ${res.veiculo.placa || ""}`,
            }));

            const origemValida = temCoordenadaValida(origem.latitude, origem.longitude);

            return (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                <Card className="lg:col-span-3">
                  <CardHeader className="pb-2">
                    <CardTitle>Mapa das Rotas por Região</CardTitle>
                    <CardDescription>
                      Polígonos por região, traçado das rotas e origem (CD/Base)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {mapaLocations.length === 0 ? (
                      <div className="h-[640px] bg-gray-100 flex items-center justify-center">
                        <p className="text-muted-foreground text-sm px-6 text-center">
                          Geocodifique os pedidos (a geração já faz automaticamente) para ver o mapa.
                        </p>
                      </div>
                    ) : (
                      <div className="h-[640px] w-full overflow-hidden">
                        <MapboxMap
                          title="Rotas e Regiões"
                          locations={mapaLocations}
                          origin={origemValida
                            ? { latitude: origem.latitude, longitude: origem.longitude, label: origem.rotulo }
                            : undefined}
                          routeLines={mapaRouteLines}
                          regionPolygons={mapaPolygons}
                          legend={mapaLegend}
                          focusRouteId={mapaFocoId}
                          showClustering={false}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Rotas / Regiões</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      size="sm"
                      variant={mapaFocoId === null ? "default" : "outline"}
                      className="w-full"
                      onClick={() => setMapaFocoId(null)}
                    >
                      Ver todas as regiões
                    </Button>
                    {distribuicao.map((res, rIdx) => {
                      const cor = CORES_ROTAS[rIdx % CORES_ROTAS.length];
                      const peso = res.pedidos.reduce((a, p) => a + (p.pesoKg || 0), 0);
                      const calc = rotasCalculadas.get(rIdx);
                      const emFoco = mapaFocoId === `rota-${rIdx}`;
                      return (
                        <div
                          key={rIdx}
                          className={
                            "rounded-lg border p-2 transition-opacity " +
                            (mapaFocoId && !emFoco ? "opacity-50" : "")
                          }
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: cor }} />
                            <p className="text-xs font-medium truncate">
                              {rIdx + 1}. {getNomeTipoVeiculo(res.veiculo.tipoVeiculo)} {res.veiculo.placa || ""}
                            </p>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {regiaoDaRota(res)} · {res.pedidos.length} paradas · {peso.toFixed(1)} kg · {calc?.distanciaKm ?? 0} km
                          </p>
                          <Button
                            size="sm"
                            variant={emFoco ? "default" : "outline"}
                            className="mt-1 h-7 w-full text-xs"
                            onClick={() => setMapaFocoId(`rota-${rIdx}`)}
                          >
                            {emFoco ? "Região em foco" : "Focar região"}
                          </Button>
                        </div>
                      );
                    })}
                    {!origemValida && (
                      <p className="text-[11px] text-amber-700">
                        Defina o Local de Carregamento para traçados completos.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })()}
        </TabsContent>

        <TabsContent value="auditoria" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Auditoria de Dados</CardTitle>
              <CardDescription>Validação e verificação de consistencia</CardDescription>
            </CardHeader>
            <CardContent>
              {alertasValidacao.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Todos os pedidos passaram na validação
                </p>
              ) : (
                <div className="space-y-2">
                  {alertasValidacao.map((alerta, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-3 border rounded-lg">
                      {getAlertaIcon(alerta.tipo)}
                      <div>
                        <p className="font-medium">{alerta.codigo}</p>
                        <p className="text-sm text-muted-foreground">{alerta.mensagem}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lista de Pedidos</CardTitle>
              <CardDescription>Todos os pedidos carregados para roteirização</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CEP</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Peso</TableHead>
                    <TableHead>Cubagem</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Prioridade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidos.map(pedido => (
                    <TableRow key={pedido.id}>
                      <TableCell className="font-medium">{pedido.numeroPedido}</TableCell>
                      <TableCell>{pedido.cliente}</TableCell>
                      <TableCell>{pedido.cep}</TableCell>
                      <TableCell>{pedido.cidade}</TableCell>
                      <TableCell>{pedido.pesoKg} kg</TableCell>
                      <TableCell>{calcularCubagemPedido(pedido).toFixed(3)} m³</TableCell>
                      <TableCell>
                        <Badge variant={pedido.secoOuRefrigerado === 'refrigerado' ? 'default' : 'outline'}>
                          {pedido.secoOuRefrigerado}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={pedido.prioridade === 'urgente' ? 'destructive' : pedido.prioridade === 'alta' ? 'default' : 'outline'}>
                          {pedido.prioridade}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detalhes da entrega (parada) */}
      <Dialog open={Boolean(pedidoDetalhe)} onOpenChange={(aberto) => { if (!aberto) setPedidoDetalhe(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Entrega</DialogTitle>
            <DialogDescription>
              Pedido {pedidoDetalhe?.numeroPedido} · {nomeSeguro(pedidoDetalhe?.destinatario)}
            </DialogDescription>
          </DialogHeader>
          {pedidoDetalhe && (() => {
            const p = pedidoDetalhe;
            const endereco = [
              p.endereco || p.enderecoCompleto,
              p.numero,
              p.complemento,
              p.bairro,
              [p.cidade, p.estado].filter(Boolean).join("/"),
              p.cep,
            ].filter(Boolean).join(", ");
            const queryMaps = [p.endereco || p.enderecoCompleto, p.numero, p.bairro, p.cidade, p.estado, p.cep]
              .filter(Boolean).join(", ");
            return (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded border p-2">
                    <p className="text-[10px] uppercase text-slate-500">Cliente</p>
                    <p className="font-medium">{p.cliente || "—"}</p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-[10px] uppercase text-slate-500">Destinatário</p>
                    <p className="font-medium">{nomeSeguro(p.destinatario)}</p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-[10px] uppercase text-slate-500">Contato</p>
                    <p className="font-medium">{p.telefone || "—"}</p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-[10px] uppercase text-slate-500">Documento</p>
                    <p className="font-medium">{p.documento || "—"}</p>
                  </div>
                </div>
                <div className="rounded border p-2">
                  <p className="text-[10px] uppercase text-slate-500">Endereço completo</p>
                  <p className="font-medium">{endereco || "—"}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded border p-2">
                    <p className="text-[10px] uppercase text-slate-500">Dimensões (C x L x A)</p>
                    <p className="font-medium">
                      {p.comprimentoCm || 0} x {p.larguraCm || 0} x {p.alturaCm || 0} cm
                    </p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-[10px] uppercase text-slate-500">Peso / Volumes</p>
                    <p className="font-medium">
                      {p.pesoKg || 0} kg{p.pesoEstimado ? " (estimado)" : ""} · {p.quantidadeVolumes || 0} vol
                    </p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-[10px] uppercase text-slate-500">Cubagem</p>
                    <p className="font-medium">{calcularCubagemPedido(p).toFixed(3)} m³</p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-[10px] uppercase text-slate-500">Janela</p>
                    <p className="font-medium">
                      {(p.janelaInicio || p.janelaFim)
                        ? `${p.janelaInicio || "--:--"} - ${p.janelaFim || "--:--"}`
                        : "Sem janela"}
                    </p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-[10px] uppercase text-slate-500">Tipo</p>
                    <p className="font-medium">
                      {p.secoOuRefrigerado === "refrigerado" ? "Refrigerado" : "Seco"}
                      {p.temperaturaMinima != null ? ` · ${p.temperaturaMinima}°C` : ""}
                    </p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-[10px] uppercase text-slate-500">Prioridade</p>
                    <p className="font-medium capitalize">{p.prioridade || "media"}</p>
                  </div>
                </div>
                {p.observacoes && (
                  <div className="rounded border p-2">
                    <p className="text-[10px] uppercase text-slate-500">Observações</p>
                    <p className="font-medium whitespace-pre-wrap">{p.observacoes}</p>
                  </div>
                )}
                {p.dadosFaltantes && p.dadosFaltantes.length > 0 && (
                  <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    Dados pendentes do cliente: {p.dadosFaltantes.join(", ")}
                  </div>
                )}
                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={() => {
                    if (!queryMaps) {
                      toast.error("Sem endereço para abrir no Google Maps.");
                      return;
                    }
                    window.open(
                      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryMaps)}`,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Abrir no Google Maps
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Prévia do App Motorista (simulador mobile) */}
      <Dialog open={Boolean(previaApp)} onOpenChange={(aberto) => { if (!aberto) setPreviaApp(null); }}>
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Prévia App Motorista</DialogTitle>
            <DialogDescription>Simulação da sequência de paradas no aplicativo</DialogDescription>
          </DialogHeader>
          {previaApp && (() => {
            const ordenados = optimizarSequenciaParadas(previaApp.resultado.pedidos);
            const veiculo = previaApp.resultado.veiculo;
            return (
              <div className="mx-auto w-full max-w-[380px] rounded-[2rem] border-8 border-slate-900 bg-slate-100 shadow-2xl">
                <div className="rounded-t-[1.4rem] bg-[#2E1065] px-4 py-3 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-orange-300">Conexão Express</p>
                      <p className="text-sm font-bold">Minha Rota</p>
                    </div>
                    <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold">
                      {ordenados.length} paradas
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-indigo-100">
                    {getIconeTipoVeiculo(veiculo.tipoVeiculo)} {getNomeTipoVeiculo(veiculo.tipoVeiculo)}
                    {veiculo.placa ? ` · ${veiculo.placa}` : ""}
                  </p>
                </div>
                <div className="max-h-[60vh] space-y-2 overflow-y-auto bg-slate-100 p-3">
                  {ordenados.map((p, i) => (
                    <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex items-start gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {nomeSeguro(p.destinatario)}
                          </p>
                          <p className="truncate text-[11px] text-slate-500">
                            {[p.endereco || p.enderecoCompleto, p.numero, p.bairro, p.cidade]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Pedido {p.numeroPedido}
                            {p.janelaInicio || p.janelaFim
                              ? ` · ${p.janelaInicio || "--:--"}-${p.janelaFim || "--:--"}`
                              : ""}
                          </p>
                        </div>
                        <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-700">
                          Aguardando
                        </span>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-[11px] font-semibold text-white"
                          onClick={() => toast.info("Prévia: no App abre a câmera para o comprovante.")}
                        >
                          📸 Comprovante
                        </button>
                        <button
                          type="button"
                          className="flex-1 rounded-lg border border-rose-300 py-1.5 text-[11px] font-semibold text-rose-600"
                          onClick={() => toast.info("Prévia: no App registra a devolução com foto/assinatura.")}
                        >
                          ↩ Devolução
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-b-[1.4rem] border-t bg-white p-3">
                  <p className="text-center text-[10px] text-slate-400">
                    Simulação visual — o motorista vê esta sequência no App.
                  </p>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoteirizadorWeb;