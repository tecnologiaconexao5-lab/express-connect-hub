// ============================================================
// OS MOBILE — ferramenta de campo 100% mobile (sem sidebar desktop)
//   Aba 1 · Nova OS  — paradas, rota Mapbox, retorno à origem,
//                      adicionais, cubagem e composição de valores.
//   Aba 2 · Em Aberto — filtros por data, baixa de campo com
//                      recebedor/documento/local/horário/fotos/WhatsApp.
//   Aba 3 · Financeiro — repasses pendentes com marcação OS Mobile.
//   Extra  · Recibo de pagamento (cliente/prestador) em PDF A4.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlusCircle,
  ClipboardList,
  Wallet,
  MapPin,
  RotateCcw,
  Clock,
  CloudRain,
  Receipt,
  Loader2,
  RefreshCw,
  Plus,
  Trash2,
  Navigation,
  CheckCircle2,
  Camera,
  MessageCircle,
  Copy,
  ExternalLink,
  Banknote,
  CalendarDays,
  ChevronRight,
  X,
  AlertTriangle,
  Package,
  Weight,
  Ruler,
  Bike,
  UserRound,
  Phone,
  KeyRound,
  ArrowRight,
  CircleDollarSign,
  Route,
  Gauge,
  ListChecks,
  MapPinned,
  FileText,
  Send,
  LockKeyhole,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { criarOrdemServico } from "@/services/ordemServicoService";
import {
  calcularCustoMotoboy,
  calcularReceitaClienteMoto,
  RECEITA_CLIENTE_MOTO,
  OPCOES_PAGAMENTO_PRESTADOR,
  VALOR_KM_RETORNO,
  VALOR_ESPERA_EXCEDENTE,
  VALOR_PARADA_EXTRA,
  type TipoPagamentoPrestador,
} from "@/lib/custoMotoboy";
import { calcularLitros, alertaBauMoto } from "@/lib/cubagem";
import { veiculoPorPeso, OPCOES_VEICULO, labelVeiculo } from "@/lib/veiculoPeso";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import EnderecoCompleto, { type EnderecoType } from "@/components/ui/EnderecoCompleto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  montarEnderecoTexto,
  calcularRotaMobile,
  enderecoTemCidade,
} from "@/services/maps/mobileRouteService";
import {
  buscarEmpresaMobile,
  concluirOSMobile,
  osEhMobile,
  uploadComprovanteMobile,
  type FechamentoOSMobile,
  type OSMobileLista,
  type RepasseMobile,
} from "@/services/mobile/osMobileService";
import type { DadosEmpresaFatura } from "@/services/financeiro/faturaService";
import { useAuth } from "@/contexts/AuthContext";
import { toClienteInsert } from "@/lib/dbMappers";
import { gerarMensagemComprovantePOD } from "@/lib/podComprovante";
import { limparCacheHistoricoEnderecos, salvarEnderecoFavoritoCliente } from "@/services/clientes/historicoEnderecosCliente";
import ReciboPagamento from "@/components/os-mobile/ReciboPagamento";

// ============================================================
// Constantes e helpers
// ============================================================

type AbaMobile = "nova" | "aberto" | "financeiro";

const ABAS_MOBILE: { id: AbaMobile; label: string; Icon: typeof PlusCircle }[] = [
  { id: "nova", label: "Nova OS", Icon: PlusCircle },
  { id: "aberto", label: "Em Aberto", Icon: ClipboardList },
  { id: "financeiro", label: "Financeiro", Icon: Wallet },
];

// Status considerados "em aberto" para a operação de campo.
const STATUS_EM_ABERTO = [
  "em_analise",
  "pendente",
  "agendada",
  "em_andamento",
  "em_rota",
  "coletado",
];

// Finalizadas permanecem acessíveis para reimpressão/geração do recibo.
const STATUS_FINALIZADAS = ["finalizada", "entregue"];

const OPCOES_PIX_TIPO = ["CPF/CNPJ", "Celular", "E-mail", "Chave Aleatória"];

/**
 * Wizard da Nova OS — 3 etapas. O estado do formulário vive no componente
 * pai (NovaOSView), então avançar/voltar nunca perde o que já foi digitado.
 */
const ETAPAS_NOVA_OS = [
  { id: 1, label: "Rota", descricao: "Cliente, retirada e entrega" },
  { id: 2, label: "Carga", descricao: "Peso, volumes e veículo" },
  { id: 3, label: "Resumo", descricao: "Valores, observações e criar" },
] as const;

type EtapaNovaOS = (typeof ETAPAS_NOVA_OS)[number]["id"];

const LOCAIS_ENTREGA = [
  "Portaria",
  "Recepção",
  "Familiar",
  "Irmão(ã)",
  "Vizinho",
  "Funcionário(a)",
  "Outros",
];

const TIPOS_CARGA = [
  { value: "seca", label: "Seca" },
  { value: "refrigerado", label: "Refrigerada" },
  { value: "fragil", label: "Frágil" },
];

const fmtBRL = (valor: number) =>
  (Number.isFinite(valor) ? valor : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const fmtData = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
};

const fmtDataHora = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

const hojeISO = () => new Date().toISOString().split("T")[0];

const agoraLocalInput = () => {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const diasAtrasISO = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().split("T")[0];
};

const somenteDigitos = (v: string) => v.replace(/\D/g, "");

function validarTelefone(telefone: string): boolean {
  return somenteDigitos(telefone).length >= 10;
}

function validarPixChave(tipo: string, chave: string): boolean {
  const valor = chave.trim();
  if (!valor) return false;
  if (tipo === "CPF/CNPJ") {
    const digitos = somenteDigitos(valor);
    return digitos.length === 11 || digitos.length === 14;
  }
  if (tipo === "Celular") return somenteDigitos(valor).length >= 10;
  if (tipo === "E-mail") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
  return valor.length >= 10;
}

/** Normaliza os rótulos de PIX usados no TMS para as opções do OS Mobile. */
function normalizarTipoPix(tipo?: string | null): string {
  const valor = (tipo || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (!valor) return "CPF/CNPJ";
  if (valor.includes("email") || valor.includes("e-mail")) return "E-mail";
  if (valor.includes("celular") || valor.includes("telefone") || valor.includes("fone")) {
    return "Celular";
  }
  if (valor.includes("aleator")) return "Chave Aleatória";
  if (valor.includes("cpf") || valor.includes("cnpj")) return "CPF/CNPJ";
  const exato = OPCOES_PIX_TIPO.find((opcao) => opcao.toLowerCase() === valor);
  return exato || "CPF/CNPJ";
}

const uid = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

// Referências estáveis para o SearchableSelect (evita reconsultas por props novas).
const CLIENTE_SEARCH_FIELDS = ["nome_fantasia", "razao_social", "cnpj"];
const PRESTADOR_SEARCH_FIELDS = ["nome_completo", "cpf_cnpj", "telefone", "whatsapp"];
const FILTRO_ATIVO = { status: "ativo" };
// Clientes incluem os pré-cadastros feitos no próprio mobile (requerem validação
// pelo backoffice, mas precisam aparecer para a operação de rua).
const FILTRO_CLIENTES_OS = { status: ["ativo", "pre-cadastro"] };

interface ParadaForm {
  id: string;
  sequencia: number;
  tipo: "retirada" | "entrega" | "ambos";
  nomeLocal: string;
  endereco: EnderecoType;
  janelaInicio: string;
  janelaFim: string;
  instrucoes: string;
  /** Com quem falar no local (placeholder "PROCURAR" do WhatsApp) */
  nomeContato: string;
  /** Telefone do contato no local (placeholder "TELEFONE" do WhatsApp) */
  telefoneContato: string;
  /** O que será retirado/entregue no local (placeholder "RETIRAR/ENTREGAR") */
  material: string;
  /** Salva o endereço em `enderecos_clientes` vinculado ao cliente da OS */
  salvarFavorito: boolean;
}

const etiquetaParada = (tipo: ParadaForm["tipo"]) =>
  tipo === "retirada" ? "Retirada" : tipo === "entrega" ? "Entrega" : "Retirada e Entrega";

const criarParada = (tipo: "retirada" | "entrega" | "ambos", sequencia: number): ParadaForm => ({
  id: uid(),
  sequencia,
  tipo,
  nomeLocal: etiquetaParada(tipo),
  endereco: {
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    referencia: "",
  },
  janelaInicio: "",
  janelaFim: "",
  instrucoes: "",
  nomeContato: "",
  telefoneContato: "",
  material: "",
  salvarFavorito: false,
});

const statusBadge = (status: string) => {
  const mapa: Record<string, { label: string; className: string }> = {
    em_analise: { label: "Em análise", className: "bg-orange-100 text-orange-800 border-orange-200" },
    pendente: { label: "Pendente", className: "bg-amber-100 text-amber-800 border-amber-200" },
    agendada: { label: "Alocado", className: "bg-blue-100 text-blue-800 border-blue-200" },
    em_andamento: { label: "Em andamento", className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
    em_rota: { label: "Em rota", className: "bg-violet-100 text-violet-800 border-violet-200" },
    coletado: { label: "Coletado", className: "bg-cyan-100 text-cyan-800 border-cyan-200" },
    finalizada: { label: "Finalizada", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  };
  return mapa[status] || { label: status, className: "bg-slate-100 text-slate-700 border-slate-200" };
};

const valorTexto = (valor: unknown): string => {
  if (typeof valor === "string") return valor.trim();
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  return "";
};

const primeiroTexto = (...valores: unknown[]): string => {
  for (const valor of valores) {
    const texto = valorTexto(valor);
    if (texto) return texto;
  }
  return "";
};

const formatarCep = (valor: unknown): string => {
  const digitos = valorTexto(valor).replace(/\D/g, "");
  if (digitos.length === 8) return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
  return valorTexto(valor);
};

const tipoDoPonto = (
  ponto: Record<string, unknown>,
): "retirada" | "entrega" | "ambos" | "outro" => {
  const tipo = primeiroTexto(ponto.tipo_parada, ponto.tipo).toLowerCase();
  if (
    tipo.includes("ambos") ||
    (tipo.includes("retirada") && tipo.includes("entrega")) ||
    tipo.includes("retirada_entrega") ||
    tipo.includes("coleta_entrega")
  ) {
    return "ambos";
  }
  if (tipo.includes("retirada") || tipo.includes("coleta") || tipo.includes("origem")) return "retirada";
  if (tipo.includes("entrega") || tipo.includes("destino")) return "entrega";
  return "outro";
};

const formatarEnderecoCompletoPonto = (ponto: Record<string, unknown>): string => {
  const logradouro = primeiroTexto(ponto.logradouro);
  const numero = primeiroTexto(ponto.numero);
  const complemento = primeiroTexto(ponto.complemento);
  const bairro = primeiroTexto(ponto.bairro);
  const cidade = primeiroTexto(ponto.cidade);
  const uf = primeiroTexto(ponto.estado, ponto.uf);
  const cep = formatarCep(ponto.cep);

  const rua = [logradouro, numero].filter(Boolean).join(", ");
  const endereco = [
    rua ? (complemento ? `${rua} - ${complemento}` : rua) : "",
    bairro,
    [cidade, uf].filter(Boolean).join("/"),
    cep ? `CEP ${cep}` : "",
  ]
    .filter(Boolean)
    .join(" - ");

  return (
    endereco ||
    primeiroTexto(ponto.endereco_formatado, ponto.endereco) ||
    "Endereço não informado"
  );
};

const bairroDoPonto = (ponto: Record<string, unknown>): string => {
  const bairro = primeiroTexto(ponto.bairro);
  if (bairro) return bairro;
  const endereco = primeiroTexto(ponto.endereco_formatado, ponto.endereco);
  const partes = endereco
    .split(",")
    .map((parte) => parte.trim())
    .filter(Boolean);
  return partes.length >= 2 ? partes[1] : "";
};

const horarioDoPonto = (ponto: Record<string, unknown>): string => {
  const inicio = primeiroTexto(ponto.janela_inicio, ponto.janelaInicio);
  const fim = primeiroTexto(ponto.janela_fim, ponto.janelaFim);
  if (inicio && fim) return `${inicio} às ${fim}`;
  return inicio || fim || "A combinar";
};

/**
 * Endereço exibido no Padrão Rota (grupos): SEM número, com bairro, cidade/UF e CEP.
 */
const formatarEnderecoSemNumeroPonto = (ponto: Record<string, unknown>): string => {
  const logradouro = primeiroTexto(ponto.logradouro);
  const bairro = primeiroTexto(ponto.bairro);
  const cidade = primeiroTexto(ponto.cidade);
  const uf = primeiroTexto(ponto.estado, ponto.uf);
  const cep = formatarCep(ponto.cep);

  const endereco = [
    logradouro,
    bairro,
    [cidade, uf].filter(Boolean).join("/"),
    cep ? `CEP ${cep}` : "",
  ]
    .filter(Boolean)
    .join(" - ");

  return (
    endereco ||
    primeiroTexto(ponto.endereco_formatado, ponto.endereco) ||
    "Endereço não informado"
  );
};

/**
 * Query do Maps enxuta: apenas "Logradouro, Número, Cidade".
 * Sem CEP, sem Estado/UF e sem complemento — link curto e profissional.
 */
const consultaMapsDoPonto = (ponto: Record<string, unknown>): string => {
  const logradouro = primeiroTexto(ponto.logradouro);
  const numero = primeiroTexto(ponto.numero);
  const cidade = primeiroTexto(ponto.cidade);

  const ruaComNumero = [logradouro, numero].filter(Boolean).join(", ");
  if (ruaComNumero && cidade) return `${ruaComNumero}, ${cidade}`;
  if (ruaComNumero) return ruaComNumero;

  // Fallback: endereço já formatado — remove CEP, UF e cidade redundante.
  const uf = primeiroTexto(ponto.estado, ponto.uf);
  const bruto = primeiroTexto(ponto.endereco_formatado, ponto.endereco);
  const ehCep = (pedaco: string) => /^\d{5}-?\d{3}$/.test(pedaco) || /^CEP\s*\d/i.test(pedaco);

  const limpo = bruto
    .split(/[,;]/)
    .map((pedaco) => pedaco.trim())
    .filter(Boolean)
    .filter((pedaco) => !ehCep(pedaco))
    .filter((pedaco) => !uf || (pedaco !== uf && !pedaco.endsWith(`/${uf}`)))
    .filter((pedaco) => !cidade || (pedaco !== cidade && !pedaco.endsWith(`/${cidade}`)));

  return [limpo.join(", "), cidade].filter(Boolean).join(", ") || "Endereço não informado";
};

/**
 * Link curto do Maps: codifica apenas "Logradouro, Número, Cidade".
 */
const linkMapsCurtoDoPonto = (ponto: Record<string, unknown>): string => {
  const consulta = consultaMapsDoPonto(ponto);
  return `https://maps.google.com/?q=${encodeURIComponent(consulta)}`;
};

/**
 * Encurtador de URL sem autenticação (TinyURL).
 * Retorna `null` quando a API falhar/estourar o timeout — o texto original é preservado.
 */
const encurtarUrlMaps = async (url: string): Promise<string | null> => {
  try {
    const controller = new AbortController();
    const limite = setTimeout(() => controller.abort(), 6000);
    const resposta = await fetch(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
      { signal: controller.signal },
    );
    clearTimeout(limite);
    if (!resposta.ok) return null;
    const curto = (await resposta.text()).trim();
    return curto.startsWith("http") ? curto : null;
  } catch {
    return null;
  }
};

/**
 * Substitui todos os links longos do Maps do texto por links curtos,
 * em paralelo. Se a API falhar, o link longo original permanece.
 */
const encurtarLinksDoMaps = async (texto: string): Promise<string> => {
  const encontrados = texto.match(/https:\/\/maps\.google\.com\/\?q=\S+/g);
  if (!encontrados?.length) return texto;

  const unicos = [...new Set(encontrados)];
  const pares = await Promise.all(
    unicos.map(async (link) => [link, await encurtarUrlMaps(link)] as const),
  );

  return pares.reduce(
    (acc, [link, curto]) => (curto ? acc.split(link).join(curto) : acc),
    texto,
  );
};

const rotuloFormaPagamento = (statusFaturamento?: string | null): string => {
  const status = valorTexto(statusFaturamento).toLowerCase();
  if (status.includes("faturad")) return "Faturada";
  if (status.includes("fatur")) return "A faturar";
  if (status.includes("pago") || status.includes("paga")) return "Pago";
  if (status.includes("vista")) return "À vista";
  return "À vista";
};

/**
 * Padrão de rota do WhatsApp (layout EXATO solicitado).
 * - 1 bloco RET para cada retirada e 1 bloco ENT para cada entrega/parada.
 * - `fechamento` é opcional e, quando informado, acrescenta a baixa de campo
 *   ao final (usado pelo botão "Concluir e Enviar WhatsApp").
 */
const gerarPadraoRotaWhatsApp = (
  os: OSMobileLista,
  fechamento?: Partial<FechamentoOSMobile> | null,
): string => {
  const pontos = [...os.enderecos].sort(
    (a, b) => Number(a.sequencia ?? 0) - Number(b.sequencia ?? 0),
  );

  const retiradas = pontos.filter((ponto) => tipoDoPonto(ponto) === "retirada");
  const entregas = pontos.filter((ponto) => tipoDoPonto(ponto) === "entrega");
  const ambos = pontos.filter((ponto) => tipoDoPonto(ponto) === "ambos");

  const pontoRetirada: Record<string, unknown> =
    retiradas[0] || ambos[0] || (os.origem ? { endereco: os.origem } : {});
  const pontoEntrega: Record<string, unknown> =
    entregas[entregas.length - 1] ||
    ambos[ambos.length - 1] ||
    (os.destino ? { endereco: os.destino } : {});

  const bairroRetirada = bairroDoPonto(pontoRetirada) || "Origem";
  const bairroEntrega = bairroDoPonto(pontoEntrega) || "Destino";
  const distancia =
    os.distanciaKm > 0
      ? `${os.distanciaKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`
      : "—";

  // O resumo operacional do WhatsApp é do MOTORISTA: imprime ESTRITAMENTE o
  // valor do repasse (valor_prestador), nunca o valor cobrado do cliente.
  const valorPrestador = (Number(os.custoPrestador) || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const observacao = valorTexto(os.observacoesGerais)
    .replace(/^\[OS MOBILE\]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const blocos: string[] = [];
  let sequencia = 0;

  const adicionarBloco = (tipo: "RET" | "ENT" | "RET/ENT", ponto: Record<string, unknown>) => {
    sequencia += 1;
    const icone = tipo === "ENT" ? "🟠" : tipo === "RET" ? "🟣" : "🟣🟠";
    blocos.push(
      [
        `*${icone} 【 ${sequencia} 】 ${tipo}* • ${formatarEnderecoSemNumeroPonto(ponto)}`,
        `⏰ ${horarioDoPonto(ponto)}`,
        `🗺️ ${linkMapsCurtoDoPonto(ponto)}`,
      ].join("\n"),
    );
  };

  if (pontos.length > 0) {
    pontos.forEach((ponto) => {
      const tipo = tipoDoPonto(ponto);
      if (tipo === "retirada") adicionarBloco("RET", ponto);
      else if (tipo === "ambos") adicionarBloco("RET/ENT", ponto);
      else adicionarBloco("ENT", ponto);
    });
  } else {
    adicionarBloco("RET", pontoRetirada);
    adicionarBloco("ENT", pontoEntrega);
  }

  const linhas = [
    "*🟠 CONEXÃO ⚡ EXPRESS 🟣*",
    "━━━━━━━━━━━━━━━━━🏍️",
    "",
    `*${bairroRetirada} ━➤ ${bairroEntrega}* | ${distancia}`,
    "",
    blocos.join("\n\n"),
    "",
    "━━━━━━━━━━━━━━━━━",
    `💰 R$ ${valorPrestador} | ${rotuloFormaPagamento(os.statusFaturamento)}`,
    "",
    `⚠️ ATENÇÃO: ${observacao}`,
  ];

  let mensagem = linhas.join("\n");

  if (fechamento) {
    const recebedor = primeiroTexto(fechamento.recebedor);
    const documento = primeiroTexto(fechamento.documento);
    const local = primeiroTexto(fechamento.local);
    const dataHora = primeiroTexto(fechamento.dataHoraEntrega);
    const observacaoBaixa = primeiroTexto(fechamento.observacao);
    const totalFotos = Array.isArray(fechamento.fotos) ? fechamento.fotos.length : 0;
    const temDadosDeBaixa = Boolean(
      recebedor || documento || local || dataHora || observacaoBaixa || totalFotos > 0,
    );

    if (temDadosDeBaixa) {
      const baixa = ["", "✅ BAIXA DE CAMPO"];
      if (recebedor) baixa.push(`👤 Recebido por: ${recebedor}`);
      if (documento) baixa.push(`🪪 Documento: ${documento}`);
      if (local) baixa.push(`📌 Local: ${local}`);
      if (dataHora) baixa.push(`🕒 Data/Hora: ${fmtDataHora(dataHora)}`);
      if (totalFotos > 0) baixa.push(`📷 Comprovantes: ${totalFotos} foto(s)`);
      if (observacaoBaixa) baixa.push(`📝 Observação: ${observacaoBaixa}`);
      mensagem += `\n${baixa.join("\n")}`;
    }
  }

  return mensagem;
};

const gerarMensagemWhatsApp = (
  os: OSMobileLista,
  fechamento?: Partial<FechamentoOSMobile> | null,
): string => gerarPadraoRotaWhatsApp(os, fechamento);

/**
 * Orientação privada enviada ao motorista (WhatsApp individual).
 * Diferente do Padrão Rota, exibe o endereço COMPLETO (com número) e todas as
 * instruções operacionais de cada parada.
 */
const gerarOrientacaoWhatsApp = (os: OSMobileLista): string => {
  const pontos = [...os.enderecos].sort(
    (a, b) => Number(a.sequencia ?? 0) - Number(b.sequencia ?? 0),
  );

  const retiradas = pontos.filter((ponto) => tipoDoPonto(ponto) === "retirada");
  const entregas = pontos.filter((ponto) => tipoDoPonto(ponto) === "entrega");
  const ambos = pontos.filter((ponto) => tipoDoPonto(ponto) === "ambos");

  const pontoRetirada: Record<string, unknown> =
    retiradas[0] || ambos[0] || (os.origem ? { endereco: os.origem } : {});
  const pontoEntrega: Record<string, unknown> =
    entregas[entregas.length - 1] ||
    ambos[ambos.length - 1] ||
    (os.destino ? { endereco: os.destino } : {});

  const observacaoOS = valorTexto(os.observacoesGerais)
    .replace(/^\[OS MOBILE\]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const valorRepasse = (Number(os.custoPrestador) || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const blocos: string[] = [];
  let sequencia = 0;

  const adicionarBloco = (
    tipo: "RETIRADA" | "ENTREGA" | "RETIRADA E ENTREGA",
    ponto: Record<string, unknown>,
  ) => {
    sequencia += 1;
    const icone = tipo === "RETIRADA" ? "🟣" : tipo === "ENTREGA" ? "🟠" : "🟣🟠";

    const verboMaterial =
      tipo === "ENTREGA" ? "ENTREGAR" : tipo === "RETIRADA" ? "RETIRAR" : "RETIRAR/ENTREGAR";

    const procurarPor =
      primeiroTexto(
        ponto.nome_contato,
        ponto.procurar_por,
        ponto.contato_nome,
        ponto.contato,
        ponto.nome_local,
      ) || "—";
    const telefone =
      primeiroTexto(ponto.telefone_contato, ponto.contato_telefone, ponto.telefone) || "—";
    const material = primeiroTexto(ponto.material, ponto.volumes) || "—";
    const orientacoes =
      primeiroTexto(ponto.instrucoes, ponto.observacoes, ponto.observacao, ponto.referencia) ||
      observacaoOS ||
      "—";

    blocos.push(
      [
        "━━━━━━━━━━━━━━━━━",
        `${icone} 【 ${sequencia} 】 ${tipo}`,
        "━━━━━━━━━━━━━━━━━",
        `📍 ENDEREÇO: ${formatarEnderecoCompletoPonto(ponto)}`,
        `🗺️ ${linkMapsCurtoDoPonto(ponto)}`,
        `⏰ JANELA: ${horarioDoPonto(ponto)}`,
        `👤 PROCURAR: ${procurarPor}`,
        `📞 TELEFONE: ${telefone}`,
        `📦 ${verboMaterial}: ${material}`,
        `⚠️ ORIENTAÇÕES: ${orientacoes}`,
      ].join("\n"),
    );
  };

  if (pontos.length > 0) {
    pontos.forEach((ponto) => {
      const tipo = tipoDoPonto(ponto);
      if (tipo === "retirada") adicionarBloco("RETIRADA", ponto);
      else if (tipo === "ambos") adicionarBloco("RETIRADA E ENTREGA", ponto);
      else adicionarBloco("ENTREGA", ponto);
    });
  } else {
    adicionarBloco("RETIRADA", pontoRetirada);
    adicionarBloco("ENTREGA", pontoEntrega);
  }

  const linhas = [
    "🟠 CONEXÃO ⚡ EXPRESS 🟣",
    "📋 ORIENTAÇÃO DE EXECUÇÃO",
    `OS nº ${os.numero || os.id}`,
    "",
    `Olá, ${os.prestadorNome || "Motorista"}! Você foi selecionado para executar esta OS.`,
    "",
    `🚚 VEÍCULO: ${os.veiculoTipo || "Moto"}`,
    `💰 VALOR: R$ ${valorRepasse}`,
    `💳 PAGAMENTO: ${valorTexto(os.statusFaturamento) || "À vista"}`,
    "",
    blocos.join("\n\n"),
    "",
    "━━━━━━━━━━━━━━━━━",
    "📸 COMPROVAÇÃO",
    "Enviar o comprovante de entrega pelo WhatsApp após a conclusão.",
    "",
    "🤝 CONDUTA PROFISSIONAL",
    "Seja sempre educado e cordial, utilize trajes adequados à operação e mantenha uma postura profissional. Em caso de dúvida, dificuldade, atraso ou ocorrência, entre em contato com a Conexão Express imediatamente.",
    "",
    "🟠 CONEXÃO ⚡ EXPRESS 🟣",
  ];

  return linhas.join("\n");
};

// ============================================================
// Shell mobile
// ============================================================

function MobileTabBar({ aba, onChange }: { aba: AbaMobile; onChange: (aba: AbaMobile) => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      aria-label="Navegação principal mobile"
    >
      <div className="mx-auto grid max-w-lg grid-cols-3">
        {ABAS_MOBILE.map(({ id, label, Icon }) => {
          const ativo = aba === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex flex-col items-center gap-0.5 px-2 pb-1 pt-2 text-[11px] font-semibold transition-colors ${
                ativo ? "text-orange-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span
                className={`flex h-9 w-14 items-center justify-center rounded-xl transition-colors ${
                  ativo ? "bg-orange-100" : "bg-transparent"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={ativo ? 2.4 : 1.9} />
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function SecaoMobile({
  icon,
  titulo,
  subtitulo,
  children,
  tone = "default",
}: {
  icon: React.ReactNode;
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
  tone?: "default" | "orange";
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div
        className={`flex items-center gap-2 rounded-t-2xl border-b px-4 py-3 ${
          tone === "orange" ? "border-orange-100 bg-orange-50/70" : "border-slate-100 bg-slate-50/70"
        }`}
      >
        <span className={tone === "orange" ? "text-orange-600" : "text-slate-600"}>{icon}</span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-800">{titulo}</h2>
          {subtitulo && <p className="text-[11px] leading-tight text-slate-500">{subtitulo}</p>}
        </div>
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  );
}

function LinhaResumo({
  label,
  value,
  destaque,
  negativo,
}: {
  label: string;
  value: string;
  destaque?: boolean;
  negativo?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className={destaque ? "font-bold text-slate-900" : "text-slate-600"}>{label}</span>
      <span
        className={`tabular-nums ${
          destaque
            ? "text-base font-black text-slate-900"
            : negativo
              ? "font-semibold text-red-600"
              : "font-semibold text-slate-700"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ============================================================
// Aba 1 — Nova OS
// ============================================================

function EtapaNovaOSHeader({
  etapa,
  onSelecionar,
}: {
  etapa: EtapaNovaOS;
  onSelecionar: (etapa: EtapaNovaOS) => void;
}) {
  const etapaAtual = ETAPAS_NOVA_OS.find((item) => item.id === etapa) || ETAPAS_NOVA_OS[0];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
          Nova OS · etapa {etapa} de {ETAPAS_NOVA_OS.length}
        </p>
        <p className="text-[10px] font-semibold text-slate-500">{etapaAtual.label}</p>
      </div>
      <div className="flex items-center gap-1.5">
        {ETAPAS_NOVA_OS.map((item) => {
          const ativo = item.id === etapa;
          const concluido = item.id < etapa;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelecionar(item.id)}
              className={`flex-1 rounded-xl border px-1.5 py-1.5 text-[10px] font-bold transition-colors ${
                ativo
                  ? "border-orange-500 bg-orange-600 text-white"
                  : concluido
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              <span className="block truncate">
                {item.id}. {item.label}
              </span>
              <span
                className={`mt-0.5 block truncate text-[9px] font-normal ${
                  ativo ? "text-orange-100" : "text-slate-400"
                }`}
              >
                {item.descricao}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NovaOSView({ onAbrirEmAberto }: { onAbrirEmAberto?: () => void }) {
  const [etapa, setEtapa] = useState<EtapaNovaOS>(1);
  const [osCriada, setOsCriada] = useState<OSMobileLista | null>(null);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [clienteNome, setClienteNome] = useState("");
  const [clienteRapidoOpen, setClienteRapidoOpen] = useState(false);
  const [clienteRapidoNome, setClienteRapidoNome] = useState("");
  const [clienteRapidoFantasia, setClienteRapidoFantasia] = useState("");
  const [clienteRapidoCnpj, setClienteRapidoCnpj] = useState("");
  const [clienteRapidoTelefone, setClienteRapidoTelefone] = useState("");
  const [salvandoClienteRapido, setSalvandoClienteRapido] = useState(false);
  const [paradas, setParadas] = useState<ParadaForm[]>(() => [
    criarParada("retirada", 1),
    criarParada("entrega", 2),
  ]);

  const [retornoOrigem, setRetornoOrigem] = useState(false);
  const [tempoEspera, setTempoEspera] = useState(0);
  const [taxaChuva, setTaxaChuva] = useState(false);
  const [taxaChuvaValor, setTaxaChuvaValor] = useState(20);
  const [taxasExtras, setTaxasExtras] = useState(0);
  const [paradasAdicionaisManual, setParadasAdicionaisManual] = useState<number | null>(null);

  const [peso, setPeso] = useState("");
  const [volumes, setVolumes] = useState("1");
  const [tipoCarga, setTipoCarga] = useState("seca");
  const [descricao, setDescricao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [comprimento, setComprimento] = useState("");
  const [largura, setLargura] = useState("");
  const [altura, setAltura] = useState("");

  const [veiculoTipo, setVeiculoTipo] = useState("moto");
  const [veiculoManual, setVeiculoManual] = useState(false);

  const [pagamentoPrestador, setPagamentoPrestador] = useState<TipoPagamentoPrestador>("avista");
  const [custoManual, setCustoManual] = useState(false);
  const [custoPrestador, setCustoPrestador] = useState("");
  const [valorBaseManual, setValorBaseManual] = useState("");

  const [kmIda, setKmIda] = useState(0);
  const [kmRetorno, setKmRetorno] = useState(0);
  const [duracaoMin, setDuracaoMin] = useState(0);
  const [calculandoRota, setCalculandoRota] = useState(false);
  const [rotaCalculada, setRotaCalculada] = useState(false);
  const [rotaErro, setRotaErro] = useState("");
  const [criando, setCriando] = useState(false);

  const pesoNumero = Number(peso) || 0;
  const litros = calcularLitros({
    comprimento: Number(comprimento) || 0,
    largura: Number(largura) || 0,
    altura: Number(altura) || 0,
  });
  const alertaBau = veiculoTipo === "moto" ? alertaBauMoto(litros) : null;

  // Regra fixa de veículo por peso (mesma do Pedido Rápido).
  useEffect(() => {
    if (veiculoManual) return;
    const sugerido = veiculoPorPeso(pesoNumero);
    if (sugerido) setVeiculoTipo(sugerido);
  }, [pesoNumero, veiculoManual]);

  const recalcularRota = useCallback(async () => {
    if (paradas.length < 2 || paradas.some((p) => !enderecoTemCidade(p.endereco))) {
      setRotaCalculada(false);
      setKmIda(0);
      setKmRetorno(0);
      setDuracaoMin(0);
      setRotaErro("");
      return;
    }

    setCalculandoRota(true);
    setRotaErro("");
    try {
      const resultado = await calcularRotaMobile(
        paradas.map((p) => ({ endereco: p.endereco })),
        retornoOrigem,
      );
      if (!resultado) {
        setRotaCalculada(false);
        setRotaErro("Não foi possível calcular a rota. Confira os endereços e o token do Mapbox.");
        return;
      }
      setKmIda(resultado.kmIda);
      setKmRetorno(resultado.kmRetorno);
      setDuracaoMin(resultado.duracaoMin);
      setRotaCalculada(true);
    } finally {
      setCalculandoRota(false);
    }
  }, [paradas, retornoOrigem]);

  // Recalcula automaticamente (debounce) quando paradas/retorno mudam.
  useEffect(() => {
    if (paradas.length < 2 || paradas.some((p) => !enderecoTemCidade(p.endereco))) {
      setRotaCalculada(false);
      setKmIda(0);
      setKmRetorno(0);
      setDuracaoMin(0);
      setRotaErro("");
      return;
    }
    const timer = setTimeout(() => {
      void recalcularRota();
    }, 900);
    return () => clearTimeout(timer);
  }, [recalcularRota, paradas]);

  const kmNumero = retornoOrigem ? kmRetorno : 0; // km do trecho de retorno
  const valorRetornoPreview = kmNumero * VALOR_KM_RETORNO;

  const receitaMoto = useMemo(
    () => calcularReceitaClienteMoto(kmIda + (retornoOrigem ? kmRetorno : 0)),
    [kmIda, kmRetorno, retornoOrigem],
  );

  const baseCliente =
    veiculoTipo === "moto" ? receitaMoto.total : Number(valorBaseManual) || 0;

  // Regra do chamado: cada minuto de espera aumenta o valor do cliente.
  // O motor do prestador mantém a franquia operacional de 20 min.
  const esperaValor = Math.round(Math.max(0, tempoEspera) * VALOR_ESPERA_EXCEDENTE * 100) / 100;
  const paradasExtras = Math.max(0, paradas.length - 2);
  const paradasAdicionaisAuto = paradasExtras * VALOR_PARADA_EXTRA;
  const paradasAdicionaisValor = paradasAdicionaisManual ?? paradasAdicionaisAuto;
  const chuvaValor = taxaChuva ? Number(taxaChuvaValor) || 0 : 0;
  const extrasValor = Number(taxasExtras) || 0;
  const totalCliente = baseCliente + esperaValor + chuvaValor + paradasAdicionaisValor + extrasValor;

  const custoMotor = useMemo(
    () =>
      calcularCustoMotoboy({
        km: kmIda,
        paradas: paradas.length,
        peso: pesoNumero,
        retorno: retornoOrigem,
        kmRetorno: retornoOrigem ? kmRetorno : 0,
        pagamento: pagamentoPrestador,
        esperaMin: tempoEspera,
      }),
    [kmIda, paradas.length, pesoNumero, retornoOrigem, kmRetorno, pagamentoPrestador, tempoEspera],
  );

  const custoAutoParaEstado = custoMotor.total + chuvaValor + extrasValor;

  useEffect(() => {
    if (!custoManual && veiculoTipo === "moto") {
      const custoCalculado = custoAutoParaEstado;
      setCustoPrestador(String(custoCalculado));
    }
  }, [custoAutoParaEstado, custoManual, veiculoTipo]);

  const custoPrestadorFinal =
    veiculoTipo === "moto" && !custoManual ? custoAutoParaEstado : Number(custoPrestador) || 0;
  const margem = totalCliente - custoPrestadorFinal;

  const atualizarParada = (id: string, patch: Partial<ParadaForm>) => {
    setParadas((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const adicionarParada = () => {
    if (paradas.length >= 8) {
      toast.error("Máximo de 8 paradas por OS");
      return;
    }
    setParadas((prev) => [
      ...prev,
      criarParada(prev.length % 2 === 0 ? "retirada" : "entrega", prev.length + 1),
    ]);
  };

  const removerParada = (id: string) => {
    if (paradas.length <= 2) {
      toast.error("A OS precisa de pelo menos 1 retirada e 1 entrega");
      return;
    }
    setParadas((prev) =>
      prev
        .filter((p) => p.id !== id)
        .map((p, index) => ({ ...p, sequencia: index + 1 })),
    );
  };

  const limpar = () => {
    setEtapa(1);
    setClienteId(null);
    setClienteNome("");
    setClienteRapidoOpen(false);
    setClienteRapidoNome("");
    setClienteRapidoFantasia("");
    setClienteRapidoCnpj("");
    setClienteRapidoTelefone("");
    setParadas([criarParada("retirada", 1), criarParada("entrega", 2)]);
    setRetornoOrigem(false);
    setTempoEspera(0);
    setTaxaChuva(false);
    setTaxaChuvaValor(20);
    setTaxasExtras(0);
    setParadasAdicionaisManual(null);
    setPeso("");
    setVolumes("1");
    setTipoCarga("seca");
    setDescricao("");
    setObservacoes("");
    setComprimento("");
    setLargura("");
    setAltura("");
    setVeiculoTipo("moto");
    setVeiculoManual(false);
    setPagamentoPrestador("avista");
    setCustoManual(false);
    setCustoPrestador("");
    setValorBaseManual("");
    setKmIda(0);
    setKmRetorno(0);
    setDuracaoMin(0);
    setRotaCalculada(false);
    setRotaErro("");
  };

  const resolverTenantId = async (): Promise<string | undefined> => {
    try {
      const { data } = await supabase.rpc("current_tenant_id_safe");
      if (typeof data === "string" && data) return data;
    } catch {
      // segue para o fallback
    }
    try {
      const { data: authData } = await supabase.auth.getUser();
      const authUserId = authData?.user?.id;
      if (!authUserId) return undefined;
      const { data: vinculo } = await supabase
        .from("tenant_usuarios")
        .select("tenant_id")
        .eq("user_id", authUserId)
        .maybeSingle();
      const tenantId = (vinculo as Record<string, unknown> | null)?.tenant_id;
      return typeof tenantId === "string" && tenantId ? tenantId : undefined;
    } catch {
      return undefined;
    }
  };

  const salvarClienteRapido = async () => {
    const nome = clienteRapidoNome.trim() || clienteRapidoFantasia.trim();
    if (!nome) {
      toast.error("Informe o nome do cliente");
      return;
    }
    setSalvandoClienteRapido(true);
    try {
      const tenantId = await resolverTenantId();
      const novoId = uid();
      const payload = toClienteInsert({
        razaoSocial: clienteRapidoNome.trim() || clienteRapidoFantasia.trim(),
        nomeFantasia: clienteRapidoFantasia.trim() || clienteRapidoNome.trim(),
        cnpj: somenteDigitos(clienteRapidoCnpj) || undefined,
        telefone: clienteRapidoTelefone.trim() || undefined,
        status: "pre-cadastro",
        observacoes: "Cadastro via Mobile - Requer Validação",
        tenantId,
      });
      // ID gerado no cliente: garante o vínculo da OS mesmo quando o
      // RETURNING do INSERT é bloqueado pelo RLS de SELECT.
      payload.id = novoId;

      // Insert sem `.select()` — o RLS de SELECT pode ocultar a linha recém
      // criada e transformar um INSERT bem-sucedido em falso erro.
      const { error } = await supabase.from("clientes").insert([payload]);
      if (error) throw error;

      // Verificação best-effort (não bloqueia o fluxo de campo).
      const { data: confirma } = await supabase
        .from("clientes")
        .select("id, nome_fantasia, razao_social, status")
        .eq("id", novoId)
        .maybeSingle();
      if (!confirma) {
        console.warn(
          "[OsMobile] Pré-cadastro gravado, mas a leitura foi bloqueada pelo RLS.",
          novoId,
        );
      }

      const row = confirma as Record<string, unknown> | null;
      setClienteId(novoId);
      setClienteNome(
        String(row?.nome_fantasia || row?.razao_social || payload.nome_fantasia || nome),
      );
      limparCacheHistoricoEnderecos();
      setClienteRapidoOpen(false);
      setClienteRapidoNome("");
      setClienteRapidoFantasia("");
      setClienteRapidoCnpj("");
      setClienteRapidoTelefone("");
      toast.success("Cliente pré-cadastrado", {
        description: "Status: Pré-cadastro · requer validação pelo backoffice.",
      });
    } catch (error) {
      const detalhe =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : error instanceof Error
            ? error.message
            : String(error);
      console.error("[OsMobile] Erro ao pré-cadastrar cliente:", error);
      toast.error("Não foi possível cadastrar o cliente", { description: detalhe });
    } finally {
      setSalvandoClienteRapido(false);
    }
  };

  const validarEtapa = (atual: EtapaNovaOS): string[] => {
    const erros: string[] = [];
    if (atual === 1) {
      if (!clienteId) erros.push("Selecione o cliente da OS");
      if (!paradas.some((p) => p.tipo === "retirada" || p.tipo === "ambos"))
        erros.push("Inclua pelo menos uma retirada");
      if (!paradas.some((p) => p.tipo === "entrega" || p.tipo === "ambos"))
        erros.push("Inclua pelo menos uma entrega");
      if (paradas.some((p) => !enderecoTemCidade(p.endereco))) {
        erros.push("Preencha cidade/UF de todas as paradas");
      }
      if (kmIda <= 0) erros.push("Calcule a rota no Mapbox antes de continuar");
    }
    if (atual === 2) {
      if (totalCliente <= 0) erros.push("O valor total do cliente deve ser maior que zero");
      if (custoPrestadorFinal <= 0) erros.push("Informe o repasse previsto do prestador");
      if (pesoNumero > 2500) erros.push("Acima de 2.500 kg contate a operação");
    }
    return erros;
  };

  const irParaEtapa = (destino: EtapaNovaOS) => {
    if (destino > etapa) {
      for (let atual = etapa; atual < destino; atual += 1) {
        const erros = validarEtapa(atual as EtapaNovaOS);
        if (erros.length > 0) {
          toast.error(erros[0], {
            description:
              erros.length > 1 ? `${erros.length - 1} pendência(s) adicional(is).` : undefined,
          });
          return;
        }
      }
    }
    setEtapa(destino);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const validar = (): string[] => {
    const erros: string[] = [];
    if (!clienteId) erros.push("Selecione o cliente da OS");
    if (!paradas.some((p) => p.tipo === "retirada" || p.tipo === "ambos"))
      erros.push("Inclua pelo menos uma retirada");
    if (!paradas.some((p) => p.tipo === "entrega" || p.tipo === "ambos"))
      erros.push("Inclua pelo menos uma entrega");
    if (paradas.some((p) => !enderecoTemCidade(p.endereco))) {
      erros.push("Preencha cidade/UF de todas as paradas");
    }
    if (kmIda <= 0) erros.push("Calcule a rota no Mapbox antes de criar a OS");
    if (totalCliente <= 0) erros.push("O valor total do cliente deve ser maior que zero");
    if (custoPrestadorFinal <= 0) erros.push("Informe o repasse previsto do prestador");
    if (pesoNumero > 2500) erros.push("Acima de 2.500 kg contate a operação");

    return erros;
  };

  const criarOS = async () => {
    const erros = validar();
    if (erros.length > 0) {
      toast.error(erros[0], { description: erros.length > 1 ? `${erros.length - 1} pendência(s) adicional(is).` : undefined });
      return;
    }

    setCriando(true);
    try {
      const enderecosMeta = paradas.map((p, index) => ({
        id: p.id,
        sequencia: index + 1,
        tipo: p.tipo === "retirada" ? "coleta" : "entrega",
        tipo_parada: p.tipo,
        ambos: p.tipo === "ambos",
        nome_local: p.nomeLocal || etiquetaParada(p.tipo),
        logradouro: p.endereco.logradouro || "",
        numero: p.endereco.numero || "",
        complemento: p.endereco.complemento || "",
        bairro: p.endereco.bairro || "",
        cidade: p.endereco.cidade || "",
        estado: p.endereco.estado || "",
        cep: p.endereco.cep || "",
        referencia: p.endereco.referencia || "",
        contato_nome: p.nomeContato || p.endereco.contatoNome || "",
        contato_telefone: p.telefoneContato || p.endereco.contatoTelefone || "",
        nome_contato: p.nomeContato || p.endereco.contatoNome || "",
        telefone_contato: p.telefoneContato || p.endereco.contatoTelefone || "",
        material: p.material || "",
        endereco: montarEnderecoTexto(p.endereco),
        endereco_formatado: montarEnderecoTexto(p.endereco),
        latitude: p.endereco.latitude ?? null,
        longitude: p.endereco.longitude ?? null,
        janela_inicio: p.janelaInicio,
        janela_fim: p.janelaFim,
        instrucoes: p.instrucoes,
      }));

      const primeira = paradas[0];
      const ultima = paradas[paradas.length - 1];
      const kmTotal = kmIda + (retornoOrigem ? kmRetorno : 0);

      const metadata = {
        origem: "os-mobile",
        tipo_operacao: "fracionado",
        veiculo_sugerido: veiculoTipo,
        enderecos: enderecosMeta,
        // A OS nasce "Em Aberto": o prestador (cadastrado ou avulso) é
        // definido depois, na aba Em Aberto → "Alocar Prestador".
        cobranca_cliente: {
          fonte: "tabela-moto",
          franquia: RECEITA_CLIENTE_MOTO.franquia,
          franquia_km: RECEITA_CLIENTE_MOTO.franquiaKm,
          valor_km_adicional: RECEITA_CLIENTE_MOTO.valorKmAdicional,
          km_total: kmTotal,
          base: baseCliente,
          espera: esperaValor,
          chuva: chuvaValor,
          paradas_adicionais: paradasAdicionaisValor,
          extras: extrasValor,
          total: totalCliente,
        },
        moto_motor: {
          km: kmIda,
          km_retorno: retornoOrigem ? kmRetorno : 0,
          paradas: paradas.length,
          peso: pesoNumero,
          retorno: retornoOrigem,
          pagamento: pagamentoPrestador,
          tempo_espera_min: tempoEspera,
          custo_total: custoPrestadorFinal,
          itens: custoMotor.itens,
          custo_manual: custoManual,
          calculado_em: new Date().toISOString(),
        },
      };

      const cargaMobile = {
        origem: "os-mobile",
        mobile: true,
        cubagem_litros: litros,
        dimensoes_cm: {
          comprimento: Number(comprimento) || 0,
          largura: Number(largura) || 0,
          altura: Number(altura) || 0,
        },
        bau_alerta: alertaBau?.texto || null,
      };

      const resultado = await criarOrdemServico({
        cliente_id: clienteId as string,
        cliente: clienteId as string,
        status: "pendente",
        origem: montarEnderecoTexto(primeira.endereco),
        origem_cidade: primeira.endereco.cidade || undefined,
        origem_uf: primeira.endereco.estado || undefined,
        destino: montarEnderecoTexto(ultima.endereco),
        destino_cidade: ultima.endereco.cidade || undefined,
        destino_uf: ultima.endereco.estado || undefined,
        descricao: descricao || `OS Mobile · ${paradas.length} parada(s)`,
        peso: pesoNumero,
        volumes: Number(volumes) || 1,
        tipo_carga: tipoCarga,
        observacoes: `[OS MOBILE] ${observacoes.trim()}`.trim(),
        valor_cliente: totalCliente,
        custo_prestador: custoPrestadorFinal,
        veiculo_tipo: veiculoTipo,
        data_coleta: hojeISO(),
        distancia_km: kmTotal,
        distancia_rota: {
          distancia_km: kmTotal,
          km_ida: kmIda,
          km_retorno: retornoOrigem ? kmRetorno : 0,
          duracao_min: duracaoMin,
          provider: "mapbox",
          retorno: retornoOrigem,
        },
        enderecos: enderecosMeta,
        carga: cargaMobile,
        metadata,
        retorno_obrigatorio: retornoOrigem,
        tempo_estimado: duracaoMin,
      });

      if (!resultado.sucesso || !resultado.os_id) {
        throw new Error(resultado.erro || "Falha ao criar a OS");
      }

      await supabase.from("ordens_servico").update({ enderecos: enderecosMeta }).eq("id", resultado.os_id);
      limparCacheHistoricoEnderecos(clienteId as string);

      // Favoritos por cliente: grava em enderecos_clientes os pontos marcados
      // com "Salvar endereço como favorito" — sempre vinculados ao cliente_id.
      const favoritos = paradas.filter(
        (p) => p.salvarFavorito && Boolean((p.endereco.logradouro || "").trim()),
      );
      if (favoritos.length > 0 && clienteId) {
        const resultados = await Promise.all(
          favoritos.map((p) =>
            salvarEnderecoFavoritoCliente(clienteId, {
              tipoEndereco: etiquetaParada(p.tipo),
              nomeLocal: p.nomeLocal,
              cep: p.endereco.cep,
              logradouro: p.endereco.logradouro,
              numero: p.endereco.numero,
              complemento: p.endereco.complemento,
              bairro: p.endereco.bairro,
              cidade: p.endereco.cidade,
              uf: p.endereco.estado,
              referencia: p.endereco.referencia,
              instrucoes: p.instrucoes || p.endereco.referencia,
              contatoLocal: p.nomeContato || p.endereco.contatoNome,
              telefoneLocal: p.telefoneContato || p.endereco.contatoTelefone,
              latitude: p.endereco.latitude ?? null,
              longitude: p.endereco.longitude ?? null,
            }),
          ),
        );
        const salvos = resultados.filter((r) => r.ok).length;
        const falhas = resultados.length - salvos;
        if (salvos > 0) {
          toast.success(
            `${salvos} endereço(s) salvo(s) como favorito(s) do cliente`,
            falhas > 0 ? { description: `${falhas} falhou(aram) — confira o endereço.` } : undefined,
          );
        } else {
          const motivo = resultados.find((r) => !r.ok)?.erro;
          toast.warning("Não foi possível salvar os endereços favoritos", {
            description: motivo || undefined,
          });
        }
      }

      // Snapshot da OS recém-criada para o painel de sucesso e para o
      // "Copiar Padrão Rota" — o formulário pode ser limpo em seguida.
      const osSnapshot: OSMobileLista = {
        id: resultado.os_id,
        numero: resultado.os_numero || null,
        status: "pendente",
        data: hojeISO(),
        createdAt: new Date().toISOString(),
        clienteId,
        clienteNome: clienteNome || null,
        prestadorId: null,
        prestadorNome: null,
        veiculoTipo,
        valorCliente: totalCliente,
        statusFaturamento: null,
        custoPrestador: custoPrestadorFinal,
        distanciaKm: kmTotal,
        origem: montarEnderecoTexto(primeira.endereco),
        destino: montarEnderecoTexto(ultima.endereco),
        peso: pesoNumero,
        volumes: Number(volumes) || 1,
        observacoesGerais: `[OS MOBILE] ${observacoes.trim()}`.trim(),
        recebedorNome: null,
        recebedorDocumento: null,
        enderecos: enderecosMeta,
        fechamento: null,
        isMobile: true,
      };

      toast.success(`OS ${resultado.os_numero || resultado.os_id} criada com sucesso!`, {
        description: `${fmtBRL(totalCliente)} ao cliente · ${fmtBRL(custoPrestadorFinal)} ao prestador`,
      });
      setOsCriada(osSnapshot);
      limpar();
    } catch (error) {
      toast.error("Não foi possível criar a OS", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setCriando(false);
    }
  };

  const copiarPadraoRotaCriada = async () => {
    if (!osCriada) return;
    try {
      await navigator.clipboard.writeText(gerarPadraoRotaWhatsApp(osCriada));
      toast.success("Copiado!");
    } catch {
      toast.error("Não foi possível copiar o Padrão Rota");
    }
  };

  const copiarOrientacaoCriada = async () => {
    if (!osCriada) return;
    const gerandoLink = toast.loading("Gerando link...", {
      description: "Encurtando os links do Google Maps.",
    });
    try {
      const texto = await encurtarLinksDoMaps(gerarOrientacaoWhatsApp(osCriada));
      await navigator.clipboard.writeText(texto);
      toast.success("Copiado!", {
        description: "Orientação privada pronta para enviar ao motorista.",
      });
    } catch {
      toast.error("Não foi possível copiar a Orientação");
    } finally {
      toast.dismiss(gerandoLink);
    }
  };

  if (osCriada) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-emerald-200 bg-white p-5 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-11 w-11 text-emerald-600" />
          <p className="mt-2 text-base font-black text-slate-800">
            OS {osCriada.numero || osCriada.id} criada com sucesso!
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {osCriada.clienteNome || "Cliente"} · {fmtBRL(osCriada.valorCliente)} ·{" "}
            {osCriada.distanciaKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km
          </p>

          <div className="mt-4 grid grid-cols-1 gap-2">
            <Button
              type="button"
              onClick={() => void copiarPadraoRotaCriada()}
              className="h-12 w-full bg-green-600 text-sm font-bold text-white hover:bg-green-700"
            >
              📋 Copiar Padrão Rota
            </Button>

            <Button
              type="button"
              onClick={() => void copiarOrientacaoCriada()}
              className="h-12 w-full bg-slate-900 text-sm font-bold text-white hover:bg-slate-800"
            >
              📋 Copiar Orientação Privada
            </Button>
          </div>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left">
            <p className="text-[11px] font-black text-amber-800">A OS ainda está sem prestador</p>
            <p className="mt-0.5 text-[10px] leading-tight text-amber-700">
              Ela entrou na aba “Em Aberto”. Aloque o motoboy (cadastrado ou avulso) para gerar o
              repasse no financeiro.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => {
              limpar();
              setOsCriada(null);
              onAbrirEmAberto?.();
            }}
            className="mt-2 h-12 w-full bg-orange-600 text-sm font-bold text-white hover:bg-orange-700"
          >
            <Bike className="mr-2 h-4 w-4" /> Ir para “Em Aberto” e alocar prestador
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              limpar();
              setOsCriada(null);
            }}
            className="mt-2 h-11 w-full"
          >
            Criar Outra OS
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <EtapaNovaOSHeader etapa={etapa} onSelecionar={irParaEtapa} />

      {etapa === 1 && (
        <>
          <SecaoMobile icon={<UserRound className="h-4 w-4" />} titulo="Cliente" subtitulo="Quem está contratando o serviço">
        <SearchableSelect
          table="clientes"
          labelField="nome_fantasia"
          searchFields={CLIENTE_SEARCH_FIELDS}
          placeholder="Pesquisar cliente por nome ou CNPJ..."
          value={clienteId}
          onChange={(value, record) => {
            setClienteId(value);
            setClienteNome(
              record?.nome_fantasia || record?.razao_social || "",
            );
          }}
          secondaryField="cnpj"
          filters={FILTRO_CLIENTES_OS}
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 w-full border-dashed"
          onClick={() => setClienteRapidoOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" /> Cadastro rápido (Pré-cadastro)
        </Button>
      </SecaoMobile>

      <Dialog open={clienteRapidoOpen} onOpenChange={setClienteRapidoOpen}>
        <DialogContent className="max-h-[92vh] w-[96vw] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastro rápido de cliente</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
              O cliente será criado como <strong>Pré-cadastro</strong> e ficará marcado como
              “Cadastro via Mobile - Requer Validação” no TMS.
            </div>

            <div>
              <Label className="text-[11px] font-semibold text-slate-600">Razão social / Nome *</Label>
              <Input
                value={clienteRapidoNome}
                onChange={(e) => setClienteRapidoNome(e.target.value)}
                placeholder="Ex.: Transportes Silva Ltda"
                className="mt-1 h-10"
              />
            </div>

            <div>
              <Label className="text-[11px] font-semibold text-slate-600">Nome fantasia</Label>
              <Input
                value={clienteRapidoFantasia}
                onChange={(e) => setClienteRapidoFantasia(e.target.value)}
                placeholder="Opcional"
                className="mt-1 h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] font-semibold text-slate-600">CNPJ</Label>
                <Input
                  value={clienteRapidoCnpj}
                  onChange={(e) => setClienteRapidoCnpj(e.target.value)}
                  placeholder="Opcional"
                  className="mt-1 h-10"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-slate-600">Telefone</Label>
                <Input
                  type="tel"
                  value={clienteRapidoTelefone}
                  onChange={(e) => setClienteRapidoTelefone(e.target.value)}
                  placeholder="Opcional"
                  className="mt-1 h-10"
                />
              </div>
            </div>

            <Button
              type="button"
              onClick={() => void salvarClienteRapido()}
              disabled={salvandoClienteRapido}
              className="h-11 w-full bg-orange-600 text-white hover:bg-orange-700"
            >
              {salvandoClienteRapido ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Salvar pré-cadastro
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SecaoMobile
        icon={<MapPinned className="h-4 w-4" />}
        titulo="Paradas da rota"
        subtitulo="Use Retirada e Entrega. Paradas extras entram na ordem exibida."
        tone="orange"
      >
        <div className="space-y-3">
          {paradas.map((parada, index) => (
            <div key={parada.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="text-xs font-bold text-slate-700">Parada {index + 1}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removerParada(parada.id)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remover parada"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => atualizarParada(parada.id, { tipo: "retirada" })}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-bold transition-colors ${
                    parada.tipo === "retirada"
                      ? "border-orange-500 bg-orange-600 text-white"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  <Package className="h-3.5 w-3.5" /> Retirada
                </button>
                <button
                  type="button"
                  onClick={() => atualizarParada(parada.id, { tipo: "entrega" })}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-bold transition-colors ${
                    parada.tipo === "entrega"
                      ? "border-blue-500 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  <MapPin className="h-3.5 w-3.5" /> Entrega
                </button>
                <button
                  type="button"
                  onClick={() => atualizarParada(parada.id, { tipo: "ambos" })}
                  className={`col-span-2 flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-bold transition-colors ${
                    parada.tipo === "ambos"
                      ? "border-violet-500 bg-violet-600 text-white"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  <Package className="h-3.5 w-3.5" />
                  <MapPin className="h-3.5 w-3.5" /> Retirada e Entrega (Ambos)
                </button>
              </div>

              <div className="mb-2">
                <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Identificação do local
                </Label>
                <Input
                  value={parada.nomeLocal}
                  onChange={(e) => atualizarParada(parada.id, { nomeLocal: e.target.value })}
                  placeholder="Ex.: CD São Paulo, Casa do cliente"
                  className="mt-1 h-9 bg-white text-sm"
                />
              </div>

              <EnderecoCompleto
                value={parada.endereco}
                clienteId={clienteId || undefined}
                onChange={(endereco) => atualizarParada(parada.id, { endereco })}
                onSelectEnderecoSalvo={(salvo) => {
                  const etiquetaAtual = etiquetaParada(parada.tipo).toLowerCase();
                  const nomeAtual = parada.nomeLocal.trim().toLowerCase();
                  atualizarParada(parada.id, {
                    instrucoes: parada.instrucoes || salvo.instrucoes || salvo.referencia || "",
                    nomeContato: parada.nomeContato || salvo.contatoLocal || "",
                    telefoneContato: parada.telefoneContato || salvo.telefoneLocal || "",
                    nomeLocal:
                      (!nomeAtual || nomeAtual === etiquetaAtual) && salvo.nomeLocal
                        ? salvo.nomeLocal
                        : parada.nomeLocal,
                  });
                }}
                hideDebugInfo
                hideOperationalDetails
              />

              <label
                className={`mt-2 flex items-start gap-2 rounded-xl border px-2.5 py-2 text-[11px] font-semibold transition-colors ${
                  parada.salvarFavorito
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-slate-200 bg-white text-slate-600"
                } ${clienteId ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}
              >
                <input
                  type="checkbox"
                  checked={parada.salvarFavorito}
                  disabled={!clienteId}
                  onChange={(e) =>
                    atualizarParada(parada.id, { salvarFavorito: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 accent-amber-500"
                />
                <span className="flex items-start gap-1.5">
                  <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span>
                    Salvar endereço como favorito para este cliente
                    <span className="block text-[10px] font-normal text-slate-500">
                      {clienteId
                        ? "Ficará disponível no autocomplete deste cliente nas próximas OS."
                        : "Selecione o cliente para habilitar."}
                    </span>
                  </span>
                </span>
              </label>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Janela início
                  </Label>
                  <Input
                    type="time"
                    value={parada.janelaInicio}
                    onChange={(e) => atualizarParada(parada.id, { janelaInicio: e.target.value })}
                    className="mt-1 h-9 bg-white text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Janela fim
                  </Label>
                  <Input
                    type="time"
                    value={parada.janelaFim}
                    onChange={(e) => atualizarParada(parada.id, { janelaFim: e.target.value })}
                    className="mt-1 h-9 bg-white text-sm"
                  />
                </div>
              </div>

              <div className="mt-2">
                <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Instruções do ponto
                </Label>
                <Input
                  value={parada.instrucoes}
                  onChange={(e) => atualizarParada(parada.id, { instrucoes: e.target.value })}
                  placeholder="Ex.: falar na portaria, documento com RG"
                  className="mt-1 h-9 bg-white text-sm"
                />
              </div>

              <div className="mt-2">
                <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Procurar por (contato no local)
                </Label>
                <Input
                  value={parada.nomeContato}
                  onChange={(e) => atualizarParada(parada.id, { nomeContato: e.target.value })}
                  placeholder="Ex.: João da portaria"
                  className="mt-1 h-9 bg-white text-sm"
                />
              </div>

              <div className="mt-2">
                <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Telefone do contato
                </Label>
                <Input
                  type="tel"
                  inputMode="tel"
                  value={parada.telefoneContato}
                  onChange={(e) => atualizarParada(parada.id, { telefoneContato: e.target.value })}
                  placeholder="(11) 99999-9999"
                  className="mt-1 h-9 bg-white text-sm"
                />
              </div>

              <div className="mt-2">
                <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {parada.tipo === "entrega"
                    ? "O que entregar (material)"
                    : parada.tipo === "retirada"
                      ? "O que retirar (material)"
                      : "O que retirar / entregar (material)"}
                </Label>
                <Input
                  value={parada.material}
                  onChange={(e) => atualizarParada(parada.id, { material: e.target.value })}
                  placeholder={
                    parada.tipo === "entrega"
                      ? "Ex.: 2 caixas de documentos"
                      : "Ex.: 1 envelope e 1 volume"
                  }
                  className="mt-1 h-9 bg-white text-sm"
                />
              </div>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" onClick={adicionarParada} className="w-full border-dashed">
          <Plus className="mr-2 h-4 w-4" /> Adicionar parada
        </Button>
      </SecaoMobile>

      <SecaoMobile
        icon={<Route className="h-4 w-4" />}
        titulo="Rota e retorno"
        subtitulo="O Mapbox calcula a rota completa. Ative o retorno para voltar ao primeiro ponto."
      >
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800">Retorno à origem</p>
            <p className="text-[11px] leading-tight text-slate-500">
              Soma o trecho última parada → origem no cliente e no prestador.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={retornoOrigem}
            onClick={() => setRetornoOrigem((v) => !v)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              retornoOrigem ? "bg-orange-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                retornoOrigem ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {retornoOrigem && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">Retorno estimado</span>
              <span className="font-black">+ {fmtBRL(valorRetornoPreview)}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-orange-700">
              {kmRetorno.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km de retorno · R$ 1,50/km ·{" "}
              {custoManual ? "motor pausado (custo manual)" : "última parada → origem"}
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-slate-200 bg-white p-2 text-center">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Ida</p>
            <p className="text-sm font-black text-slate-800">
              {kmIda > 0 ? `${kmIda.toLocaleString("pt-BR")} km` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2 text-center">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Retorno</p>
            <p className="text-sm font-black text-slate-800">
              {retornoOrigem && kmRetorno > 0 ? `${kmRetorno.toLocaleString("pt-BR")} km` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2 text-center">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Tempo</p>
            <p className="text-sm font-black text-slate-800">
              {duracaoMin > 0 ? `${duracaoMin} min` : "—"}
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] font-semibold text-slate-500">
          KM total considerado:{" "}
          <span className="text-slate-800">
            {(kmIda + (retornoOrigem ? kmRetorno : 0)).toLocaleString("pt-BR", {
              maximumFractionDigits: 2,
            })}{" "}
            km
          </span>
          {retornoOrigem ? " (ida + retorno à origem)" : " (somente ida)"}
        </p>

        {rotaErro && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {rotaErro}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={() => void recalcularRota()}
          disabled={calculandoRota}
          className="w-full"
        >
          {calculandoRota ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="mr-2 h-4 w-4" />
          )}
          {rotaCalculada ? "Recalcular rota no Mapbox" : "Calcular rota no Mapbox"}
        </Button>
      </SecaoMobile>
        </>
      )}

      {etapa === 2 && (
        <>
      <SecaoMobile
        icon={<Package className="h-4 w-4" />}
        titulo="Carga e cubagem"
        subtitulo="O veículo é sugerido pelo peso. Litros = (C × L × A) / 1000."
      >
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] font-semibold text-slate-600">Peso (kg)</Label>
            <div className="relative mt-1">
              <Weight className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                placeholder="0"
                className="h-10 pl-8"
              />
            </div>
          </div>
          <div>
            <Label className="text-[11px] font-semibold text-slate-600">Volumes</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={volumes}
              onChange={(e) => setVolumes(e.target.value)}
              className="mt-1 h-10"
            />
          </div>
        </div>

        <div>
          <Label className="text-[11px] font-semibold text-slate-600">Tipo de carga</Label>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {TIPOS_CARGA.map((tipo) => (
              <button
                key={tipo.value}
                type="button"
                onClick={() => setTipoCarga(tipo.value)}
                className={`rounded-xl border px-2 py-2 text-xs font-bold ${
                  tipoCarga === tipo.value
                    ? "border-orange-500 bg-orange-600 text-white"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {tipo.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-[11px] font-semibold text-slate-600">Dimensões (cm)</Label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            <div>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={comprimento}
                onChange={(e) => setComprimento(e.target.value)}
                placeholder="Comprimento"
                className="h-10 px-2 text-xs"
              />
            </div>
            <div>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={largura}
                onChange={(e) => setLargura(e.target.value)}
                placeholder="Largura"
                className="h-10 px-2 text-xs"
              />
            </div>
            <div>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={altura}
                onChange={(e) => setAltura(e.target.value)}
                placeholder="Altura"
                className="h-10 px-2 text-xs"
              />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <Ruler className="h-3.5 w-3.5" /> Litros calculados
            </span>
            <span className="text-sm font-black text-slate-800">
              {litros.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L
            </span>
          </div>
          {alertaBau && (
            <div
              className={`mt-2 rounded-xl border px-3 py-2 text-[11px] font-semibold ${
                alertaBau.nivel >= 4
                  ? "border-red-200 bg-red-50 text-red-700"
                  : alertaBau.nivel >= 3
                    ? "border-orange-200 bg-orange-50 text-orange-700"
                    : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {alertaBau.texto}
            </div>
          )}
          <p className="mt-1 text-[10px] text-slate-400">
            Padrão baú moto: aprox. 40×40×40 cm ou 80 a 90 litros.
          </p>
        </div>

        <div>
          <Label className="text-[11px] font-semibold text-slate-600">Veículo</Label>
          <select
            value={veiculoTipo}
            onChange={(e) => {
              setVeiculoTipo(e.target.value);
              setVeiculoManual(true);
            }}
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
          >
            {OPCOES_VEICULO.map((opcao) => (
              <option key={opcao.value} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-slate-400">
            Sugestão automática pelo peso: {labelVeiculo(veiculoTipo) || "sem sugestão"}.
          </p>
        </div>

        <div>
          <Label className="text-[11px] font-semibold text-slate-600">Descrição da carga</Label>
          <Textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={2}
            placeholder="Ex.: 2 caixas de documentos, frágil..."
            className="mt-1 text-sm"
          />
        </div>
      </SecaoMobile>
        </>
      )}

      {etapa === 3 && (
        <>
      <SecaoMobile
        icon={<Banknote className="h-4 w-4" />}
        titulo="Resumo e valores"
        subtitulo="Receita do cliente e repasse previsto do prestador. A alocação do prestador é feita na aba Em Aberto."
        tone="orange"
      >
        <div>
          <Label className="text-[11px] font-semibold text-slate-600">Tipo de pagamento do prestador (prazo) *</Label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {OPCOES_PAGAMENTO_PRESTADOR.map((opcao) => (
              <button
                key={opcao.value}
                type="button"
                onClick={() => setPagamentoPrestador(opcao.value)}
                className={`rounded-xl border px-2 py-2 text-left ${
                  pagamentoPrestador === opcao.value
                    ? "border-orange-500 bg-orange-600 text-white"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                <p className="text-xs font-bold">{opcao.label}</p>
                <p
                  className={`mt-0.5 text-[9px] leading-tight ${
                    pagamentoPrestador === opcao.value ? "text-orange-100" : "text-slate-400"
                  }`}
                >
                  {opcao.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
              <Clock className="h-3.5 w-3.5" /> Tempo de Espera (Aguarde) *
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={tempoEspera}
              onChange={(e) => setTempoEspera(Number(e.target.value) || 0)}
              className="mt-1 h-10"
            />
            <p className="mt-1 text-[10px] text-slate-400">
              {tempoEspera > 0
                ? `${tempoEspera} min × R$ 0,40 = ${fmtBRL(esperaValor)} no total do cliente`
                : "Cada minuto de espera soma R$ 0,40 ao cliente"}
            </p>
          </div>
          <div>
            <Label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
              <CloudRain className="h-3.5 w-3.5" /> Taxa de chuva
            </Label>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTaxaChuva((v) => !v)}
                className={`h-10 flex-1 rounded-lg border px-2 text-xs font-bold ${
                  taxaChuva
                    ? "border-sky-500 bg-sky-600 text-white"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                {taxaChuva ? "Aplicada" : "Não aplicar"}
              </button>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={taxaChuvaValor}
                onChange={(e) => setTaxaChuvaValor(Number(e.target.value) || 0)}
                className="h-10 w-20"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
              <ListChecks className="h-3.5 w-3.5" /> Paradas adicionais
            </Label>
            <div className="mt-1 flex items-center gap-1.5">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={paradasAdicionaisValor}
                onChange={(e) => setParadasAdicionaisManual(Number(e.target.value) || 0)}
                className="h-10"
              />
              {paradasAdicionaisManual !== null && (
                <button
                  type="button"
                  onClick={() => setParadasAdicionaisManual(null)}
                  className="rounded-lg border border-slate-200 px-2 py-2 text-[10px] font-bold text-slate-500"
                >
                  Auto
                </button>
              )}
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              {paradasExtras} extra(s) · sugestão {fmtBRL(paradasAdicionaisAuto)}
            </p>
          </div>
          <div>
            <Label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
              <CircleDollarSign className="h-3.5 w-3.5" /> Taxas extras
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={taxasExtras}
              onChange={(e) => setTaxasExtras(Number(e.target.value) || 0)}
              className="mt-1 h-10"
            />
          </div>
        </div>

        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-orange-700">
              Relatório de valores
            </span>
            <Badge variant="outline" className="border-orange-200 bg-white text-[10px] text-orange-700">
              Tabela Moto · franquia {fmtBRL(RECEITA_CLIENTE_MOTO.franquia)}
            </Badge>
          </div>
          <div className="space-y-1.5 text-sm">
            {veiculoTipo === "moto" ? (
              <>
                <LinhaResumo label={`Base cliente (${kmIda + (retornoOrigem ? kmRetorno : 0)} km)`} value={fmtBRL(baseCliente)} />
                <p className="text-[10px] text-slate-500">
                  Franquia {RECEITA_CLIENTE_MOTO.franquiaKm} km · {fmtBRL(RECEITA_CLIENTE_MOTO.valorKmAdicional)}/km adicional.
                </p>
              </>
            ) : (
              <div>
                <Label className="text-[11px] font-semibold text-slate-600">Valor base do cliente (manual)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={valorBaseManual}
                  onChange={(e) => setValorBaseManual(e.target.value)}
                  className="mt-1 h-9 bg-white"
                  placeholder="0,00"
                />
              </div>
            )}
            <LinhaResumo label="Tempo de espera" value={fmtBRL(esperaValor)} />
            <LinhaResumo label="Taxa de chuva" value={fmtBRL(chuvaValor)} />
            <LinhaResumo label="Paradas adicionais" value={fmtBRL(paradasAdicionaisValor)} />
            <LinhaResumo label="Taxas extras" value={fmtBRL(extrasValor)} />
            <div className="my-2 h-px bg-orange-200" />
            <LinhaResumo label="VALOR TOTAL DO CLIENTE" value={fmtBRL(totalCliente)} destaque />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-slate-800">Custo do prestador</p>
              <p className="text-[10px] text-slate-500">
                {veiculoTipo === "moto"
                  ? "Calculado pela faixa, paradas, peso, espera e retorno."
                  : "Veículo diferente de moto: informe manualmente."}
              </p>
            </div>
            {veiculoTipo === "moto" && (
              <button
                type="button"
                onClick={() => setCustoManual((v) => !v)}
                className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${
                  custoManual
                    ? "border-amber-400 bg-amber-50 text-amber-800"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {custoManual ? "Voltar ao automático" : "Ajustar manualmente"}
              </button>
            )}
          </div>

          {custoManual && (
            <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] font-semibold text-amber-800">
              Custo ajustado — o motor está pausado. Faixa, retorno, paradas, peso e espera não são aplicados.
            </div>
          )}

          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={custoPrestador}
              onChange={(e) => {
                setCustoManual(true);
                setCustoPrestador(e.target.value);
              }}
              readOnly={veiculoTipo === "moto" && !custoManual}
              className={`h-10 pl-9 text-base font-bold ${
                veiculoTipo === "moto" && !custoManual ? "bg-slate-50 text-slate-700" : ""
              }`}
            />
          </div>

          {veiculoTipo === "moto" && (
            <div className="mt-2 space-y-1">
              {custoMotor.itens.map((item) => (
                <div key={item.chave} className="flex items-start justify-between gap-2 text-[10px]">
                  <span className="text-slate-500">
                    <strong className="text-slate-700">{item.label}</strong> · {item.detalhe}
                  </span>
                  <span className="shrink-0 tabular-nums font-semibold text-slate-700">{fmtBRL(item.valor)}</span>
                </div>
              ))}
              {(chuvaValor > 0 || extrasValor > 0) && (
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>Adicionais (chuva + extras)</span>
                  <span className="font-semibold text-slate-700">{fmtBRL(chuvaValor + extrasValor)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <LinhaResumo label="Margem prevista" value={fmtBRL(margem)} destaque />
          <p className="mt-1 text-[10px] text-emerald-700">
            Receita {fmtBRL(totalCliente)} - custo {fmtBRL(custoPrestadorFinal)}
          </p>
        </div>
      </SecaoMobile>

      <SecaoMobile icon={<FileText className="h-4 w-4" />} titulo="Observações da OS">
        <Textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={3}
          placeholder="Instruções para a operação, ponto de referência, contato..."
          className="text-sm"
        />
        <p className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <LockKeyhole className="h-3 w-3" /> A OS será gravada com o marcador [OS MOBILE] para o financeiro.
        </p>
      </SecaoMobile>
        </>
      )}

      <div className="sticky bottom-2 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total cliente</p>
            <p className="text-xl font-black text-slate-900">{fmtBRL(totalCliente)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Repasse prestador</p>
            <p className="text-base font-black text-orange-700">{fmtBRL(custoPrestadorFinal)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {etapa > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => irParaEtapa((etapa - 1) as EtapaNovaOS)}
              disabled={criando}
            >
              Voltar
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={limpar} disabled={criando}>
              Limpar
            </Button>
          )}
          {etapa < 3 ? (
            <Button
              type="button"
              onClick={() => irParaEtapa((etapa + 1) as EtapaNovaOS)}
              disabled={calculandoRota}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {calculandoRota ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              Continuar
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void criarOS()}
              disabled={criando || calculandoRota}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {criando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              {criando ? "Criando..." : "Criar OS"}
            </Button>
          )}
        </div>
        <p className="mt-2 text-center text-[10px] font-semibold text-slate-500">
          Etapa {etapa} de {ETAPAS_NOVA_OS.length} · ao criar, a OS entra na aba “Em Aberto” sem prestador.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Aba 2 — Em Aberto / baixa de campo
// ============================================================

interface OSRowLista {
  id: string;
  numero: string | null;
  status: string | null;
  data: string | null;
  created_at: string | null;
  cliente: string | null;
  cliente_id: string | null;
  prestador: string | null;
  prestador_id: string | null;
  veiculo_tipo: string | null;
  valor_cliente: number | string | null;
  status_faturamento: string | null;
  custo_prestador: number | string | null;
  distancia_km: number | string | null;
  origem: string | null;
  destino: string | null;
  peso: number | string | null;
  volumes: number | string | null;
  observacoes_gerais: string | null;
  recebedor_nome: string | null;
  recebedor_documento: string | null;
  enderecos: unknown;
  localizacao_entrega_json: unknown;
  carga: unknown;
}

const numeroOuZero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fechamentoDeJson = (valor: unknown): FechamentoOSMobile | null => {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const obj = valor as Record<string, unknown>;
  const fotos = Array.isArray(obj.fotos)
    ? obj.fotos.filter((f): f is string => typeof f === "string")
    : [];
  return {
    recebedor: typeof obj.recebedor === "string" ? obj.recebedor : "",
    documento: typeof obj.documento === "string" ? obj.documento : "",
    local: typeof obj.local === "string" ? obj.local : "",
    dataHoraEntrega:
      typeof obj.data_hora_entrega === "string" ? obj.data_hora_entrega : "",
    observacao: typeof obj.observacao === "string" ? obj.observacao : "",
    fotos,
  };
};

function EmAbertoView({ ativo, empresa }: { ativo: boolean; empresa: DadosEmpresaFatura | null }) {
  const { user } = useAuth();
  const [osLista, setOsLista] = useState<OSMobileLista[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [preset, setPreset] = useState<"hoje" | "7" | "30" | "todas" | "custom">("30");
  const [dataInicio, setDataInicio] = useState(diasAtrasISO(30));
  const [dataFim, setDataFim] = useState(hojeISO());
  const [busca, setBusca] = useState("");
  const [mostrarFinalizadas, setMostrarFinalizadas] = useState(false);

  const [osSelecionada, setOsSelecionada] = useState<OSMobileLista | null>(null);
  const [recebedor, setRecebedor] = useState("");
  const [documentoRecebedor, setDocumentoRecebedor] = useState("");
  const [localEntrega, setLocalEntrega] = useState("Portaria");
  const [dataHoraEntrega, setDataHoraEntrega] = useState(agoraLocalInput());
  const [observacaoEntrega, setObservacaoEntrega] = useState("");
  const [fotos, setFotos] = useState<{ file: File; preview: string }[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [reciboOS, setReciboOS] = useState<OSMobileLista | null>(null);
  const [pixTipoBaixa, setPixTipoBaixa] = useState("CPF/CNPJ");
  const [pixChaveBaixa, setPixChaveBaixa] = useState("");
  const [carregandoPix, setCarregandoPix] = useState(false);
  // Evita que o pré-carregamento assíncrono de uma OS sobrescreva outra.
  const baixaTokenRef = useRef(0);

  // ============================================================
  // Alocar prestador — a OS nasce SEM prestador (aba Nova OS) e o
  // prestador (cadastrado ou avulso) é definido aqui, em Em Aberto.
  // ============================================================
  const [osAlocando, setOsAlocando] = useState<OSMobileLista | null>(null);
  const [prestadorId, setPrestadorId] = useState<string | null>(null);
  const [prestadorNome, setPrestadorNome] = useState("");
  const [nomeMotorista, setNomeMotorista] = useState("");
  const [avulsoNome, setAvulsoNome] = useState("");
  const [avulsoDocumento, setAvulsoDocumento] = useState("");
  const [avulsoTelefone, setAvulsoTelefone] = useState("");
  const [avulsoOrigem, setAvulsoOrigem] = useState("");
  const [avulsoPixTipo, setAvulsoPixTipo] = useState("CPF/CNPJ");
  const [avulsoPixChave, setAvulsoPixChave] = useState("");
  const [repasseAlocacao, setRepasseAlocacao] = useState("");
  const [salvandoAlocacao, setSalvandoAlocacao] = useState(false);
  const alocacaoTokenRef = useRef(0);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const statuses = mostrarFinalizadas
        ? [...STATUS_EM_ABERTO, ...STATUS_FINALIZADAS]
        : STATUS_EM_ABERTO;

      let query = supabase
        .from("ordens_servico")
        .select(
          "id, numero, status, data, created_at, cliente, cliente_id, prestador, prestador_id, veiculo_tipo, valor_cliente, status_faturamento, custo_prestador, distancia_km, origem, destino, peso, volumes, observacoes_gerais, recebedor_nome, recebedor_documento, enderecos, localizacao_entrega_json, carga",
        )
        .in("status", statuses)
        .order("created_at", { ascending: false })
        .limit(200);

      if (dataInicio) query = query.gte("data", dataInicio);
      if (dataFim) query = query.lte("data", dataFim);

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as unknown as OSRowLista[];
      if (rows.length === 0) {
        setOsLista([]);
        return;
      }

      const clienteIds = [...new Set(rows.map((r) => r.cliente || r.cliente_id).filter((v): v is string => Boolean(v)))];
      const prestadorIds = [...new Set(rows.map((r) => r.prestador || r.prestador_id).filter((v): v is string => Boolean(v)))];

      const [clientesRes, prestadoresRes] = await Promise.all([
        clienteIds.length
          ? supabase.from("clientes").select("id, nome_fantasia, razao_social").in("id", clienteIds)
          : Promise.resolve({ data: [] as Record<string, unknown>[] }),
        prestadorIds.length
          ? supabase.from("prestadores").select("id, nome_completo").in("id", prestadorIds)
          : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      ]);

      const clientesMap = new Map<string, string>();
      (clientesRes.data || []).forEach((c) => {
        const row = c as Record<string, unknown>;
        const nome = String(row.nome_fantasia || row.razao_social || "");
        if (row.id && nome) clientesMap.set(String(row.id), nome);
      });

      const prestadoresMap = new Map<string, string>();
      (prestadoresRes.data || []).forEach((p) => {
        const row = p as Record<string, unknown>;
        if (row.id && row.nome_completo) prestadoresMap.set(String(row.id), String(row.nome_completo));
      });

      const mapped: OSMobileLista[] = rows.map((row) => {
        const clienteId = row.cliente || row.cliente_id || null;
        const prestadorId = row.prestador || row.prestador_id || null;
        const cargaRow = (row.carga || {}) as Record<string, unknown>;
        const avulsoCarga = (cargaRow.avulso || null) as Record<string, unknown> | null;
        const nomeAvulso =
          avulsoCarga && typeof avulsoCarga.nome === "string" && avulsoCarga.nome
            ? String(avulsoCarga.nome)
            : null;
        return {
          id: row.id,
          numero: row.numero,
          status: row.status || "pendente",
          data: row.data,
          createdAt: row.created_at,
          clienteId,
          clienteNome: clienteId ? clientesMap.get(clienteId) || null : null,
          prestadorId,
          prestadorNome: prestadorId
            ? prestadoresMap.get(prestadorId) || null
            : nomeAvulso,
          veiculoTipo: row.veiculo_tipo,
          valorCliente: numeroOuZero(row.valor_cliente),
          statusFaturamento: row.status_faturamento,
          custoPrestador: numeroOuZero(row.custo_prestador),
          distanciaKm: numeroOuZero(row.distancia_km),
          origem: row.origem,
          destino: row.destino,
          peso: numeroOuZero(row.peso),
          volumes: numeroOuZero(row.volumes),
          observacoesGerais: row.observacoes_gerais,
          recebedorNome: row.recebedor_nome,
          recebedorDocumento: row.recebedor_documento,
          enderecos: Array.isArray(row.enderecos)
            ? (row.enderecos.filter((e) => typeof e === "object" && e !== null) as Record<string, unknown>[])
            : [],
          fechamento: fechamentoDeJson(row.localizacao_entrega_json),
          isMobile: osEhMobile({ carga: row.carga, observacoes_gerais: row.observacoes_gerais }),
        };
      });

      setOsLista(mapped);
    } catch (error) {
      console.error("[OsMobile] Erro ao carregar OS:", error);
      toast.error("Não foi possível carregar as OS em aberto");
    } finally {
      setCarregando(false);
    }
  }, [dataInicio, dataFim, mostrarFinalizadas]);

  useEffect(() => {
    if (ativo) void carregar();
  }, [ativo, carregar]);

  const aplicarPreset = (novo: typeof preset) => {
    setPreset(novo);
    if (novo === "hoje") {
      setDataInicio(hojeISO());
      setDataFim(hojeISO());
    } else if (novo === "7") {
      setDataInicio(diasAtrasISO(7));
      setDataFim(hojeISO());
    } else if (novo === "30") {
      setDataInicio(diasAtrasISO(30));
      setDataFim(hojeISO());
    } else if (novo === "todas") {
      setDataInicio("");
      setDataFim("");
    }
  };

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return osLista;
    return osLista.filter((os) =>
      [os.numero, os.clienteNome, os.prestadorNome, os.origem, os.destino]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(termo)),
    );
  }, [osLista, busca]);

  const resetFormularioAlocacao = () => {
    setPrestadorId(null);
    setPrestadorNome("");
    setNomeMotorista("");
    setAvulsoNome("");
    setAvulsoDocumento("");
    setAvulsoTelefone("");
    setAvulsoOrigem("");
    setAvulsoPixTipo("CPF/CNPJ");
    setAvulsoPixChave("");
    setRepasseAlocacao("");
  };

  const fecharAlocacao = () => {
    alocacaoTokenRef.current += 1;
    setOsAlocando(null);
    resetFormularioAlocacao();
  };

  const abrirAlocacao = async (os: OSMobileLista) => {
    const token = ++alocacaoTokenRef.current;
    resetFormularioAlocacao();
    setOsAlocando(os);
    setPrestadorId(os.prestadorId);
    setPrestadorNome(os.prestadorNome || "");
    setNomeMotorista(os.prestadorNome || "");
    setRepasseAlocacao(os.custoPrestador > 0 ? String(os.custoPrestador) : "");

    // Dados do avulso/motorista ficam em `carga` (jsonb) — a OS não tem coluna metadata.
    try {
      const { data } = await supabase
        .from("ordens_servico")
        .select("carga")
        .eq("id", os.id)
        .maybeSingle();
      if (alocacaoTokenRef.current !== token) return;
      const carga = ((data as Record<string, unknown> | null)?.carga || {}) as Record<string, unknown>;
      const avulso = (carga.avulso || null) as Record<string, unknown> | null;
      if (avulso && typeof avulso === "object") {
        setAvulsoNome(typeof avulso.nome === "string" ? avulso.nome : "");
        setAvulsoDocumento(typeof avulso.documento === "string" ? avulso.documento : "");
        setAvulsoTelefone(typeof avulso.telefone_whatsapp === "string" ? avulso.telefone_whatsapp : "");
        setAvulsoOrigem(typeof avulso.origem === "string" ? avulso.origem : "");
        setAvulsoPixTipo(
          typeof avulso.pix_tipo === "string" && avulso.pix_tipo ? avulso.pix_tipo : "CPF/CNPJ",
        );
        setAvulsoPixChave(typeof avulso.pix_chave === "string" ? avulso.pix_chave : "");
      }
      if (typeof carga.motorista === "string" && carga.motorista) setNomeMotorista(carga.motorista);
    } catch (error) {
      console.warn("[OsMobile] Não foi possível carregar os dados da alocação:", error);
    }
  };

  const alocarPrestador = async () => {
    if (!osAlocando) return;

    const erros: string[] = [];
    if (!prestadorId) {
      if (!avulsoNome.trim()) erros.push("Informe o nome do prestador avulso");
      if (!validarTelefone(avulsoTelefone)) erros.push("Telefone (WhatsApp) do prestador inválido");
      if (!avulsoOrigem.trim()) erros.push("Informe a origem (local/ponto do motoboy)");
      // PIX é OPCIONAL na alocação — ele é exigido na baixa/finalização.
    }
    const repasse = Number(String(repasseAlocacao).replace(",", ".")) || 0;
    if (repasse <= 0) erros.push("Informe o repasse previsto do prestador");
    if (erros.length > 0) {
      toast.error(erros[0], {
        description: erros.length > 1 ? `${erros.length - 1} pendência(s) adicional(is).` : undefined,
      });
      return;
    }

    setSalvandoAlocacao(true);
    try {
      const { data: atual } = await supabase
        .from("ordens_servico")
        .select("carga")
        .eq("id", osAlocando.id)
        .maybeSingle();
      const cargaAtual = ((atual as Record<string, unknown> | null)?.carga || {}) as Record<string, unknown>;
      const cargaNova: Record<string, unknown> = { ...cargaAtual };

      if (prestadorId) {
        delete cargaNova.avulso;
        if (nomeMotorista.trim()) cargaNova.motorista = nomeMotorista.trim();
        else delete cargaNova.motorista;
      } else {
        cargaNova.avulso = {
          nome: avulsoNome.trim(),
          documento: avulsoDocumento.trim(),
          telefone_whatsapp: avulsoTelefone.trim(),
          origem: avulsoOrigem.trim(),
          pix_tipo: avulsoPixTipo,
          pix_chave: avulsoPixChave.trim(),
        };
        if (nomeMotorista.trim()) cargaNova.motorista = nomeMotorista.trim();
      }

      // `prestador` (uuid) e `prestador_id` (text) recebem o MESMO id: assim o
      // trigger M80 cria financeiro_pagar + pagamentos_prestadores sozinho.
      const { error } = await supabase
        .from("ordens_servico")
        .update({
          prestador: prestadorId,
          prestador_id: prestadorId,
          custo_prestador: repasse,
          status: "agendada",
          carga: cargaNova,
          updated_at: new Date().toISOString(),
        })
        .eq("id", osAlocando.id);
      if (error) throw error;

      if (prestadorId) {
        // Cadastrado: o trigger M80 cuida do Receber + Pagar + Pagamentos.
        // Se a OS tinha um avulso antes, limpa a chave PIX/observações antigas
        // para a baixa não confirmar o PIX de quem saiu.
        const { data: pagar } = await supabase
          .from("financeiro_pagar")
          .select("id, observacoes")
          .eq("os_id", osAlocando.id)
          .limit(1)
          .maybeSingle();
        const rowPagar = pagar as Record<string, unknown> | null;
        const obsAntiga = typeof rowPagar?.observacoes === "string" ? rowPagar.observacoes : "";
        if (rowPagar?.id && obsAntiga.includes("avulso cadastrado via /os-mobile")) {
          const { error: erroLimpeza } = await supabase
            .from("financeiro_pagar")
            .update({
              chave_pix: null,
              fornecedor_documento: null,
              descricao: `Repasse ${osAlocando.numero || osAlocando.id}`,
              observacoes: `Prestador avulso realocado para o cadastro via /os-mobile · OS ${osAlocando.numero || osAlocando.id}`,
            })
            .eq("id", String(rowPagar.id));
          if (erroLimpeza) {
            console.warn("[OsMobile] Não foi possível limpar o Pagar do avulso:", erroLimpeza.message);
          }
        }
      } else {
        // Avulso: o trigger não cria Pagar (prestador_id NULL) — criamos aqui.
        const vencimento = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        const obsWhatsApp = `WhatsApp: ${avulsoTelefone.trim()}`;
        const obsOrigem = `Origem: ${avulsoOrigem.trim()}`;
        const obsPix = avulsoPixChave.trim()
          ? ` · PIX ${avulsoPixTipo}: ${avulsoPixChave.trim()}`
          : " · PIX a informar na baixa";
        const descricao = `Repasse OS Mobile · ${osAlocando.numero || osAlocando.id}`;
        const observacoes =
          `Prestador avulso cadastrado via /os-mobile · OS ${osAlocando.numero || osAlocando.id}` +
          ` · ${obsWhatsApp} · ${obsOrigem}${obsPix}`;

        const { data: existente } = await supabase
          .from("financeiro_pagar")
          .select("id")
          .eq("os_id", osAlocando.id)
          .limit(1)
          .maybeSingle();

        if (existente?.id) {
          const { error: erroAtualiza } = await supabase
            .from("financeiro_pagar")
            .update({
              descricao,
              valor: repasse,
              vencimento,
              data_vencimento: vencimento,
              status: "pendente",
              fornecedor_nome: avulsoNome.trim(),
              fornecedor_documento: avulsoDocumento.trim() || null,
              chave_pix: avulsoPixChave.trim() || null,
              observacoes,
            })
            .eq("id", String(existente.id));
          if (erroAtualiza) {
            console.warn("[OsMobile] Pagar do avulso não atualizado:", erroAtualiza.message);
          }
        } else {
          const { error: erroPagar } = await supabase.from("financeiro_pagar").insert([
            {
              descricao,
              valor: repasse,
              vencimento,
              data_vencimento: vencimento,
              data_emissao: hojeISO(),
              status: "pendente",
              os_id: osAlocando.id,
              fornecedor_nome: avulsoNome.trim(),
              fornecedor_documento: avulsoDocumento.trim() || null,
              chave_pix: avulsoPixChave.trim() || null,
              observacoes,
            },
          ]);
          if (erroPagar) console.warn("[OsMobile] Pagar do avulso não criado:", erroPagar.message);
        }

        // Realocação cadastrado → avulso: o trigger M80 não atualiza
        // `pagamentos_prestadores` quando prestador_id fica NULL, deixando uma
        // linha órfã do prestador anterior. Cancela para não virar pagamento fantasma.
        try {
          const { data: pg } = await supabase
            .from("pagamentos_prestadores")
            .select("id")
            .eq("os_id", osAlocando.id)
            .limit(1)
            .maybeSingle();
          if (pg?.id) {
            const { error: erroCancela } = await supabase
              .from("pagamentos_prestadores")
              .update({ status_pagamento: "cancelado" })
              .eq("id", String(pg.id));
            if (erroCancela) {
              console.warn("[OsMobile] Pagamento do prestador anterior não cancelado:", erroCancela.message);
            }
          }
        } catch (erroPagamentos) {
          console.warn("[OsMobile] Falha ao checar pagamentos_prestadores:", erroPagamentos);
        }
      }

      toast.success(`Prestador alocado na OS ${osAlocando.numero || osAlocando.id}`, {
        description: prestadorId
          ? `${nomeMotorista.trim() || prestadorNome || "Prestador cadastrado"} · repasse ${fmtBRL(repasse)}`
          : `${avulsoNome.trim()} · repasse ${fmtBRL(repasse)}`,
      });
      fecharAlocacao();
      await carregar();
    } catch (error) {
      console.error("[OsMobile] Erro ao alocar prestador:", error);
      toast.error("Não foi possível alocar o prestador", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSalvandoAlocacao(false);
    }
  };

  const abrirBaixa = async (os: OSMobileLista) => {
    setOsSelecionada(os);
    setRecebedor(os.fechamento?.recebedor || os.recebedorNome || "");
    setDocumentoRecebedor(os.fechamento?.documento || os.recebedorDocumento || "");
    setLocalEntrega(os.fechamento?.local || "Portaria");
    setDataHoraEntrega(os.fechamento?.dataHoraEntrega || agoraLocalInput());
    setObservacaoEntrega(os.fechamento?.observacao || "");
    setFotos([]);
    setPixTipoBaixa("CPF/CNPJ");
    setPixChaveBaixa("");
    const token = ++baixaTokenRef.current;

    // PIX é exigido na baixa: pré-carrega da conta a pagar da OS (avulso) ou
    // do cadastro do prestador para o operador só confirmar.
    setCarregandoPix(true);
    try {
      const { data: pagar } = await supabase
        .from("financeiro_pagar")
        .select("chave_pix, observacoes")
        .eq("os_id", os.id)
        .limit(1)
        .maybeSingle();

      const row = pagar as Record<string, unknown> | null;
      let chave = typeof row?.chave_pix === "string" ? row.chave_pix.trim() : "";
      let tipo = "CPF/CNPJ";
      const obs = typeof row?.observacoes === "string" ? row.observacoes : "";
      const match = obs.match(/PIX\s+([^:]+):\s*([^·]+)/i);
      if (match) {
        tipo = normalizarTipoPix(match[1]);
        if (!chave) chave = match[2].trim();
      }

      if (!chave && os.prestadorId) {
        const { data: prestador } = await supabase
          .from("prestadores")
          .select("chave_pix, tipo_chave_pix")
          .eq("id", os.prestadorId)
          .maybeSingle();
        const dadosPrestador = prestador as Record<string, unknown> | null;
        if (typeof dadosPrestador?.chave_pix === "string") {
          chave = dadosPrestador.chave_pix.trim();
        }
        if (dadosPrestador?.tipo_chave_pix) {
          tipo = normalizarTipoPix(String(dadosPrestador.tipo_chave_pix));
        }
      }

      if (baixaTokenRef.current !== token) return;
      setPixTipoBaixa(tipo);
      setPixChaveBaixa(chave);
    } catch (error) {
      console.warn("[OsMobile] Não foi possível pré-carregar o PIX da baixa:", error);
    } finally {
      if (baixaTokenRef.current === token) setCarregandoPix(false);
    }
  };

  const adicionarFotos = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const novas = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setFotos((prev) => [...prev, ...novas].slice(0, 6));
  };

  const removerFoto = (index: number) => {
    setFotos((prev) => {
      const alvo = prev[index];
      if (alvo) URL.revokeObjectURL(alvo.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const copiarPadraoRota = async (os: OSMobileLista) => {
    const texto = gerarPadraoRotaWhatsApp(os);
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Padrão Rota copiado", {
        description: "Cole no WhatsApp do grupo.",
      });
    } catch {
      toast.error("Não foi possível copiar o Padrão Rota");
    }
  };

  const copiarOrientacao = async (os: OSMobileLista) => {
    const gerandoLink = toast.loading("Gerando link...", {
      description: "Encurtando os links do Google Maps.",
    });
    try {
      const texto = await encurtarLinksDoMaps(gerarOrientacaoWhatsApp(os));
      await navigator.clipboard.writeText(texto);
      toast.success("Orientação copiada", {
        description: "Cole no WhatsApp do motorista (privado).",
      });
    } catch {
      toast.error("Não foi possível copiar a Orientação");
    } finally {
      toast.dismiss(gerandoLink);
    }
  };

  const concluir = async (enviarWhatsApp: boolean) => {
    if (!osSelecionada) return;
    if (!recebedor.trim()) {
      toast.error("Informe o nome de quem recebeu");
      return;
    }
    if (!dataHoraEntrega) {
      toast.error("Informe o horário da entrega");
      return;
    }
    // PIX é obrigatório na baixa/finalização (não na criação da OS).
    if (!validarPixChave(pixTipoBaixa, pixChaveBaixa)) {
      toast.error("Informe a chave PIX do repasse", {
        description: "O PIX é exigido na baixa para liberar o pagamento do prestador.",
      });
      return;
    }

    // A mensagem é montada de forma SÍNCRONA com os dados já preenchidos.
    // Isso mantém o gesto do usuário e permite abrir o WhatsApp diretamente,
    // sem depender de await/upload (que costuma bloquear pop-up no celular).
    const dadosPreview: FechamentoOSMobile = {
      recebedor: recebedor.trim(),
      documento: documentoRecebedor.trim(),
      local: localEntrega,
      dataHoraEntrega,
      observacao: observacaoEntrega.trim(),
      fotos: fotos.map((foto) => foto.preview),
    };
    const mensagemWhatsApp = gerarMensagemWhatsApp(osSelecionada, dadosPreview);

    let janelaWhats: Window | null = null;
    if (enviarWhatsApp) {
      const url = `https://wa.me/?text=${encodeURIComponent(mensagemWhatsApp)}`;
      janelaWhats = window.open(url, "_blank");

      if (!janelaWhats) {
        try {
          await navigator.clipboard.writeText(mensagemWhatsApp);
          toast.info("Mensagem copiada", {
            description: "Abra o WhatsApp e cole a mensagem.",
          });
        } catch {
          toast.info("Permita pop-ups para abrir o WhatsApp automaticamente.");
        }
      }
    }

    setSalvando(true);
    try {
      const urls: string[] = [];
      for (const foto of fotos) {
        const url = await uploadComprovanteMobile(osSelecionada.id, foto.file);
        if (url) urls.push(url);
      }

      const dados: FechamentoOSMobile = {
        recebedor: recebedor.trim(),
        documento: documentoRecebedor.trim(),
        local: localEntrega,
        dataHoraEntrega,
        observacao: observacaoEntrega.trim(),
        fotos: urls,
      };

      const resultado = await concluirOSMobile(osSelecionada.id, dados, user?.name || null);
      if (!resultado.ok) throw new Error(resultado.erro || "Falha ao concluir a OS");

      // Grava o PIX confirmado na baixa na conta a pagar do repasse.
      try {
        const { data: pagarRows } = await supabase
          .from("financeiro_pagar")
          .select("id, chave_pix, observacoes")
          .eq("os_id", osSelecionada.id);

        const chavePix = pixChaveBaixa.trim();
        for (const linha of (pagarRows || []) as unknown as Record<string, unknown>[]) {
          const idPagar = typeof linha.id === "string" ? linha.id : "";
          if (!idPagar) continue;
          const chaveAtual = typeof linha.chave_pix === "string" ? linha.chave_pix.trim() : "";
          if (chaveAtual && chaveAtual !== chavePix) continue;
          const obsAtual = typeof linha.observacoes === "string" ? linha.observacoes : "";
          const obsSemPix = obsAtual
            .replace(/PIX\s+[^:·]+:\s*[^·]*/gi, "")
            .replace(/·\s*PIX a informar na baixa/gi, "")
            .replace(/\s{2,}/g, " ")
            .replace(/·\s*$/, "")
            .trim();
          const obsNova = `${obsSemPix ? `${obsSemPix} · ` : ""}PIX ${pixTipoBaixa}: ${chavePix}`;
          await supabase
            .from("financeiro_pagar")
            .update({
              chave_pix: chavePix,
              observacoes: obsNova,
              updated_at: new Date().toISOString(),
            })
            .eq("id", idPagar);
        }
      } catch (error) {
        console.warn("[OsMobile] PIX da baixa não atualizado no financeiro:", error);
      }

      const atualizada: OSMobileLista = {
        ...osSelecionada,
        status: "finalizada",
        recebedorNome: dados.recebedor,
        recebedorDocumento: dados.documento,
        fechamento: dados,
      };

      toast.success("Baixa concluída", {
        description: `OS ${osSelecionada.numero || osSelecionada.id} finalizada`,
      });
      setOsSelecionada(null);
      setReciboOS(atualizada);
      await carregar();
    } catch (error) {
      if (janelaWhats && !janelaWhats.closed) janelaWhats.close();
      toast.error("Não foi possível concluir a OS", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSalvando(false);
    }
  };

  const copiarComprovantePOD = async () => {
    if (!osSelecionada) return;
    if (!recebedor.trim()) {
      toast.error("Informe o nome de quem recebeu");
      return;
    }

    const texto = gerarMensagemComprovantePOD({
      osNumero: osSelecionada.numero || osSelecionada.id,
      recebedor: recebedor.trim(),
      documento: documentoRecebedor.trim(),
      local: localEntrega,
      dataHora: dataHoraEntrega,
      observacao: observacaoEntrega.trim(),
    });

    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Comprovante (POD) copiado", {
        description: "Cole no WhatsApp do cliente final.",
      });
    } catch {
      toast.error("Não foi possível copiar o comprovante");
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              {mostrarFinalizadas ? "OS em aberto e finalizadas" : "OS em aberto"}
            </h2>
            <p className="text-[11px] text-slate-500">
              {filtradas.length} OS · filtro por data de criação/serviço
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => void carregar()} disabled={carregando}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${carregando ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {([
            ["hoje", "Hoje"],
            ["7", "7 dias"],
            ["30", "30 dias"],
            ["todas", "Todas"],
          ] as const).map(([valor, label]) => (
            <button
              key={valor}
              type="button"
              onClick={() => aplicarPreset(valor)}
              className={`rounded-lg border px-1 py-1.5 text-[11px] font-bold ${
                preset === valor
                  ? "border-orange-500 bg-orange-600 text-white"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] font-semibold uppercase text-slate-500">De</Label>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => {
                setPreset("custom");
                setDataInicio(e.target.value);
              }}
              className="mt-1 h-9 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] font-semibold uppercase text-slate-500">Até</Label>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => {
                setPreset("custom");
                setDataFim(e.target.value);
              }}
              className="mt-1 h-9 text-xs"
            />
          </div>
        </div>

        <div className="mt-2">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por OS, cliente, prestador ou rota..."
            className="h-9 text-sm"
          />
        </div>

        <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={mostrarFinalizadas}
            onChange={(e) => setMostrarFinalizadas(e.target.checked)}
            className="h-4 w-4 accent-orange-600"
          />
          Incluir finalizadas (gerar recibo)
        </label>
      </div>

      {carregando && (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-10">
          <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
        </div>
      )}

      {!carregando && filtradas.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
          <p className="text-sm font-bold text-slate-700">Nenhuma OS encontrada</p>
          <p className="text-[11px] text-slate-500">
            Ajuste o filtro de data, marque “Incluir finalizadas” ou crie uma nova OS.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {filtradas.map((os) => {
          const badge = statusBadge(os.status);
          const finalizada = STATUS_FINALIZADAS.includes(os.status);
          const alocado = Boolean(os.prestadorId) || Boolean(os.prestadorNome);
          return (
            <article key={os.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-black text-slate-800">{os.numero || os.id.slice(0, 8)}</p>
                    <Badge variant="outline" className={`text-[10px] ${badge.className}`}>
                      {badge.label}
                    </Badge>
                    {os.isMobile && (
                      <Badge variant="outline" className="border-orange-200 bg-orange-50 text-[10px] text-orange-700">
                        OS Mobile
                      </Badge>
                    )}
                    {!finalizada && !alocado && (
                      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-700">
                        Sem prestador
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    {os.clienteNome || "Cliente não informado"}
                    {os.prestadorNome ? ` · ${os.prestadorNome}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-black text-slate-800">{fmtBRL(os.valorCliente)}</p>
                  <p className="text-[10px] text-slate-400">{fmtData(os.data || os.createdAt)}</p>
                </div>
              </div>

              <div className="mt-2 flex items-start gap-1.5 rounded-xl bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="min-w-0">
                  <span className="font-semibold text-slate-700">{os.origem || "Origem"}</span>
                  <ArrowRight className="mx-1 inline h-3 w-3" />
                  <span className="font-semibold text-slate-700">{os.destino || "Destino"}</span>
                  {os.distanciaKm > 0 && (
                    <span className="ml-1 text-slate-400">· {os.distanciaKm.toLocaleString("pt-BR")} km</span>
                  )}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => void copiarPadraoRota(os)}
                >
                  📋 Copiar Padrão Rota
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => void copiarOrientacao(os)}
                >
                  📋 Copiar Orientação Privada
                </Button>
              </div>

              {!finalizada && (
                <div className="mt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={`w-full ${
                      alocado
                        ? ""
                        : "border-orange-600 bg-orange-600 text-white hover:bg-orange-700 hover:text-white"
                    }`}
                    onClick={() => void abrirAlocacao(os)}
                  >
                    <Bike className="mr-1.5 h-3.5 w-3.5" />
                    {alocado ? "Trocar prestador" : "Alocar prestador"}
                  </Button>
                </div>
              )}

              {finalizada ? (
                <div className="mt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setReciboOS(os)}
                    className="w-full bg-orange-600 text-white hover:bg-orange-700"
                  >
                    <Receipt className="mr-1.5 h-3.5 w-3.5" /> Gerar recibo da OS finalizada
                  </Button>
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void abrirBaixa(os)}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Dar baixa
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setReciboOS(os)}>
                    <Receipt className="mr-1.5 h-3.5 w-3.5" /> Recibo
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* ============================================================
          Alocar prestador — cadastrado (trigger M80 cuida do financeiro)
          ou avulso (Pagar criado/atualizado aqui).
          ============================================================ */}
      <Dialog open={Boolean(osAlocando)} onOpenChange={(v) => !v && fecharAlocacao()}>
        <DialogContent className="flex max-h-[85vh] w-[96vw] max-w-md flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="shrink-0 border-b border-slate-200 px-5 pb-3 pr-10 pt-5">
            <DialogTitle className="flex items-center gap-2">
              <Bike className="h-4 w-4 text-orange-600" /> Alocar prestador
            </DialogTitle>
          </DialogHeader>

          {osAlocando && (
            <>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                <p className="text-sm font-black text-slate-800">
                  {osAlocando.numero || osAlocando.id.slice(0, 8)}
                </p>
                <p>{osAlocando.clienteNome || "Cliente não informado"}</p>
                <p className="mt-0.5 truncate">
                  {osAlocando.origem || "Origem"} → {osAlocando.destino || "Destino"}
                </p>
              </div>

              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Label className="text-[11px] font-semibold text-slate-600">
                    Prestador cadastrado (opcional)
                  </Label>
                  <SearchableSelect
                    table="prestadores"
                    labelField="nome_completo"
                    searchFields={PRESTADOR_SEARCH_FIELDS}
                    placeholder="Pesquisar prestador (nome, CPF, placa, telefone)..."
                    value={prestadorId}
                    onChange={(value, record) => {
                      const nome = value && record?.nome_completo ? record.nome_completo : "";
                      setPrestadorId(value);
                      setPrestadorNome(nome);
                      setNomeMotorista(value ? nome : "");
                    }}
                    secondaryField="cpf_cnpj"
                    filters={FILTRO_ATIVO}
                  />
                </div>
                {prestadorId && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setPrestadorId(null);
                      setPrestadorNome("");
                      setNomeMotorista("");
                    }}
                  >
                    Usar avulso
                  </Button>
                )}
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-600">
                  Nome do motorista (saudação do WhatsApp)
                </Label>
                <Input
                  value={nomeMotorista}
                  onChange={(e) => setNomeMotorista(e.target.value)}
                  placeholder={
                    prestadorId
                      ? prestadorNome || "Nome do prestador"
                      : avulsoNome.trim() || "Motorista"
                  }
                  className="mt-1 h-10 bg-white"
                />
                <p className="mt-1 text-[10px] leading-tight text-slate-500">
                  Usado na saudação: “Olá, {nomeMotorista.trim() || prestadorNome || avulsoNome.trim() || "Motorista"}!”
                </p>
              </div>

              {!prestadorId && (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-600">Nome do avulso *</Label>
                      <Input
                        value={avulsoNome}
                        onChange={(e) => setAvulsoNome(e.target.value)}
                        placeholder="Nome completo"
                        className="mt-1 h-10 bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-600">CPF/CNPJ</Label>
                      <Input
                        value={avulsoDocumento}
                        onChange={(e) => setAvulsoDocumento(e.target.value)}
                        placeholder="Documento"
                        className="mt-1 h-10 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                      <Phone className="h-3.5 w-3.5" /> Telefone (WhatsApp) *
                    </Label>
                    <Input
                      type="tel"
                      inputMode="tel"
                      value={avulsoTelefone}
                      onChange={(e) => setAvulsoTelefone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="mt-1 h-10 bg-white"
                    />
                  </div>

                  <div>
                    <Label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                      <MapPin className="h-3.5 w-3.5" /> Origem (local/ponto do motoboy) *
                    </Label>
                    <Input
                      value={avulsoOrigem}
                      onChange={(e) => setAvulsoOrigem(e.target.value)}
                      placeholder="Ex.: Base Zona Sul / Rua X"
                      className="mt-1 h-10 bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                        <KeyRound className="h-3.5 w-3.5" /> Tipo de PIX
                      </Label>
                      <select
                        value={avulsoPixTipo}
                        onChange={(e) => setAvulsoPixTipo(e.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                      >
                        {OPCOES_PIX_TIPO.map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {tipo}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-600">Chave PIX</Label>
                      <Input
                        value={avulsoPixChave}
                        onChange={(e) => setAvulsoPixChave(e.target.value)}
                        placeholder="Opcional"
                        className="mt-1 h-10 bg-white"
                      />
                    </div>
                  </div>
                  <p className="rounded-lg bg-white px-2.5 py-1.5 text-[10px] leading-tight text-slate-500">
                    O PIX é opcional na alocação. Ele será exigido na baixa/finalização do serviço.
                  </p>
                </div>
              )}

              {prestadorId && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
                  <p className="font-bold">{nomeMotorista.trim() || prestadorNome}</p>
                  <p className="text-emerald-700">
                    Receber, Pagar e Pagamentos serão criados automaticamente pelo TMS ao salvar a alocação.
                  </p>
                </div>
              )}

              <div>
                <Label className="text-[11px] font-semibold text-slate-600">
                  Repasse previsto ao prestador (R$) *
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={repasseAlocacao}
                  onChange={(e) => setRepasseAlocacao(e.target.value)}
                  placeholder="Ex.: 65,50"
                  className="mt-1 h-10 bg-white"
                />
                <p className="mt-1 text-[10px] leading-tight text-slate-500">
                  Valor calculado na criação: {fmtBRL(osAlocando.custoPrestador)}. Ajuste aqui se o
                  repasse for diferente.
                </p>
              </div>

              </div>

              {/* Rodapé fixo — sempre visível (fora da área de rolagem) */}
              <div
                className="shrink-0 border-t border-slate-200 bg-white px-5 pt-3"
                style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
              >
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" onClick={fecharAlocacao} disabled={salvandoAlocacao}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void alocarPrestador()}
                    disabled={salvandoAlocacao}
                    className="bg-orange-600 text-white hover:bg-orange-700"
                  >
                    {salvandoAlocacao ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Bike className="mr-1.5 h-4 w-4" />}
                    {salvandoAlocacao ? "Alocando..." : "Alocar"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(osSelecionada)} onOpenChange={(v) => !v && setOsSelecionada(null)}>
        <DialogContent className="max-h-[92vh] w-[96vw] max-w-md overflow-y-auto p-0 gap-0">
          <DialogHeader className="sticky top-0 z-10 flex flex-row items-center justify-between border-b bg-white px-4 py-3 space-y-0">
            <DialogTitle className="text-base">Baixa de campo</DialogTitle>
            <Button type="button" size="icon" variant="ghost" onClick={() => setOsSelecionada(null)}>
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          {osSelecionada && (
            <div className="space-y-3 p-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-black text-slate-800">{osSelecionada.numero || osSelecionada.id}</p>
                <p className="text-[11px] text-slate-500">
                  {osSelecionada.clienteNome || "Cliente"} · {fmtBRL(osSelecionada.valorCliente)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {osSelecionada.origem || "Origem"} <ArrowRight className="mx-1 inline h-3 w-3" />{" "}
                  {osSelecionada.destino || "Destino"}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void copiarPadraoRota(osSelecionada)}
              >
                <Copy className="mr-1.5 h-4 w-4" /> Copiar Padrão Rota
              </Button>

              <div>
                <Label className="text-[11px] font-semibold text-slate-600">Nome de quem recebeu *</Label>
                <Input
                  value={recebedor}
                  onChange={(e) => setRecebedor(e.target.value)}
                  placeholder="Ex.: João Silva"
                  className="mt-1 h-10"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] font-semibold text-slate-600">Documento (RG/CPF)</Label>
                  <Input
                    value={documentoRecebedor}
                    onChange={(e) => setDocumentoRecebedor(e.target.value)}
                    placeholder="Opcional"
                    className="mt-1 h-10"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-600">Local</Label>
                  <select
                    value={localEntrega}
                    onChange={(e) => setLocalEntrega(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                  >
                    {LOCAIS_ENTREGA.map((local) => (
                      <option key={local} value={local}>
                        {local}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                  <CalendarDays className="h-3.5 w-3.5" /> Horário da entrega (editável) *
                </Label>
                <Input
                  type="datetime-local"
                  value={dataHoraEntrega}
                  onChange={(e) => setDataHoraEntrega(e.target.value)}
                  className="mt-1 h-10"
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-600">Observação da entrega</Label>
                <Textarea
                  value={observacaoEntrega}
                  onChange={(e) => setObservacaoEntrega(e.target.value)}
                  rows={2}
                  placeholder="Ex.: entregue na portaria, lacre conferido..."
                  className="mt-1 text-sm"
                />
              </div>

              <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-orange-800">
                  <KeyRound className="h-3.5 w-3.5" /> PIX do repasse ao prestador *
                  {carregandoPix && <Loader2 className="h-3 w-3 animate-spin" />}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] font-semibold uppercase tracking-wide text-orange-700">
                      Tipo de PIX
                    </Label>
                    <select
                      value={pixTipoBaixa}
                      onChange={(e) => setPixTipoBaixa(e.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-orange-200 bg-white px-2 text-sm"
                    >
                      {OPCOES_PIX_TIPO.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {tipo}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px] font-semibold uppercase tracking-wide text-orange-700">
                      Chave PIX
                    </Label>
                    <Input
                      value={pixChaveBaixa}
                      onChange={(e) => setPixChaveBaixa(e.target.value)}
                      placeholder="Chave do prestador"
                      className="mt-1 h-10 bg-white"
                    />
                  </div>
                </div>
                <p className="mt-1.5 text-[10px] leading-tight text-orange-700">
                  Obrigatório para concluir a baixa. Se o prestador já possui PIX cadastrado, o campo
                  vem preenchido automaticamente.
                </p>
              </div>

              <div>
                <Label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                  <Camera className="h-3.5 w-3.5" /> Fotos / comprovantes ({fotos.length}/6)
                </Label>
                <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-xs font-semibold text-slate-500">
                  <Camera className="h-4 w-4" />
                  Tirar foto ou escolher da galeria
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      adicionarFotos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                {fotos.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {fotos.map((foto, index) => (
                      <div key={foto.preview} className="relative overflow-hidden rounded-lg border">
                        <img src={foto.preview} alt={`Comprovante ${index + 1}`} className="h-20 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removerFoto(index)}
                          className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                          aria-label="Remover foto"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2">
                <Button
                  type="button"
                  onClick={() => void concluir(true)}
                  disabled={salvando}
                  className="h-11 bg-green-600 text-white hover:bg-green-700"
                >
                  {salvando ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MessageCircle className="mr-2 h-4 w-4" />
                  )}
                  {salvando ? "Concluindo..." : "Concluir e Enviar WhatsApp"}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" onClick={() => void concluir(false)} disabled={salvando}>
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> Apenas concluir
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void copiarComprovantePOD()}
                    disabled={salvando}
                    className="text-[11px]"
                  >
                    📋 Copiar Comprovante (POD)
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ReciboPagamento
        open={Boolean(reciboOS)}
        onClose={() => setReciboOS(null)}
        os={reciboOS}
        empresa={empresa}
      />
    </div>
  );
}

// ============================================================
// Aba 3 — Financeiro mobile
// ============================================================

interface FinanceiroRowMobile {
  id: string;
  descricao: string | null;
  valor: number | string | null;
  vencimento: string | null;
  data_vencimento: string | null;
  status: string | null;
  os_id: string | null;
  prestador: string | null;
  fornecedor_nome: string | null;
  fornecedor_documento: string | null;
  chave_pix: string | null;
  observacoes: string | null;
  data_pagamento: string | null;
}

type StatusRepasseMobile = "pendentes" | "pagos";

function FinanceiroMobileView({ ativo }: { ativo: boolean }) {
  const navigate = useNavigate();
  const [repasses, setRepasses] = useState<RepasseMobile[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [somenteMobile, setSomenteMobile] = useState(false);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [statusAba, setStatusAba] = useState<StatusRepasseMobile>("pendentes");
  const [periodoInicio, setPeriodoInicio] = useState<string>(hojeISO());
  const [periodoFim, setPeriodoFim] = useState<string>(hojeISO());

  const ehPagos = statusAba === "pagos";

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from("financeiro_pagar")
        .select(
          "id, descricao, valor, vencimento, data_vencimento, status, os_id, prestador, fornecedor_nome, fornecedor_documento, chave_pix, observacoes, data_pagamento",
        )
        .in("status", ehPagos ? ["pago"] : ["pendente", "aberto", "parcial"])
        .order(ehPagos ? "data_pagamento" : "vencimento", {
          ascending: !ehPagos,
          nullsFirst: false,
        })
        .limit(300);

      if (error) throw error;

      const rows = ((data || []) as unknown as FinanceiroRowMobile[]).filter(
        (r) => Boolean(r.os_id || r.prestador || r.fornecedor_nome),
      );

      const osIds = [...new Set(rows.map((r) => r.os_id).filter((v): v is string => Boolean(v)))];
      const osMap = new Map<string, { numero: string | null; isMobile: boolean }>();

      if (osIds.length) {
        const { data: oss } = await supabase
          .from("ordens_servico")
          .select("id, numero, carga, observacoes_gerais")
          .in("id", osIds);

        (oss || []).forEach((o) => {
          const row = o as Record<string, unknown>;
          osMap.set(String(row.id), {
            numero: typeof row.numero === "string" ? row.numero : null,
            isMobile: osEhMobile({
              carga: row.carga,
              observacoes_gerais:
                typeof row.observacoes_gerais === "string" ? row.observacoes_gerais : null,
            }),
          });
        });
      }

      const prestadorIds = [
        ...new Set(
          rows
            .map((r) => r.prestador)
            .filter((v): v is string => Boolean(v) && /^[0-9a-f-]{36}$/i.test(String(v))),
        ),
      ];
      const pixPrestador = new Map<string, string>();

      if (prestadorIds.length) {
        const { data: prestadoresData } = await supabase
          .from("prestadores")
          .select("id, chave_pix")
          .in("id", prestadorIds);

        (prestadoresData || []).forEach((p) => {
          const row = p as Record<string, unknown>;
          const chave = typeof row.chave_pix === "string" ? row.chave_pix.trim() : "";
          if (row.id && chave) pixPrestador.set(String(row.id), chave);
        });
      }

      const mapped: RepasseMobile[] = rows.map((row) => {
        const os = row.os_id ? osMap.get(row.os_id) : undefined;
        const obsLower = (row.observacoes || "").toLowerCase();
        const marcadorMobile = obsLower.includes("os mobile") || obsLower.includes("os-mobile");
        return {
          id: row.id,
          descricao: row.descricao,
          valor: numeroOuZero(row.valor),
          vencimento: row.vencimento || row.data_vencimento,
          data_vencimento: row.data_vencimento,
          status: row.status,
          osId: row.os_id,
          osNumero: os?.numero || null,
          prestador: row.prestador,
          fornecedorNome: row.fornecedor_nome,
          fornecedorDocumento: row.fornecedor_documento,
          chavePix: row.chave_pix || (row.prestador ? pixPrestador.get(row.prestador) || null : null),
          observacoes: row.observacoes,
          dataPagamento: row.data_pagamento,
          isMobile: Boolean(os?.isMobile || marcadorMobile),
        };
      });

      setRepasses(mapped);
    } catch (error) {
      console.error("[OsMobile] Erro no financeiro:", error);
      toast.error("Não foi possível carregar os repasses");
    } finally {
      setCarregando(false);
    }
  }, [ehPagos]);

  useEffect(() => {
    if (ativo) void carregar();
  }, [ativo, carregar]);

  // Filtro de período: pendentes → vencimento; pagos → data de pagamento.
  const filtrados = useMemo(() => {
    const base = somenteMobile ? repasses.filter((r) => r.isMobile) : repasses;
    if (!periodoInicio && !periodoFim) return base;

    return base.filter((r) => {
      const data = ehPagos ? r.dataPagamento : r.vencimento;
      if (!data) return false;
      if (periodoInicio && data < periodoInicio) return false;
      if (periodoFim && data > periodoFim) return false;
      return true;
    });
  }, [repasses, somenteMobile, ehPagos, periodoInicio, periodoFim]);

  const totalPendente = useMemo(
    () => filtrados.reduce((acc, item) => acc + item.valor, 0),
    [filtrados],
  );

  const totalHoje = useMemo(() => {
    const hoje = hojeISO();
    return filtrados
      .filter((item) => {
        if (ehPagos) return (item.dataPagamento || "") === hoje;
        return Boolean(item.vencimento && item.vencimento <= hoje);
      })
      .reduce((acc, item) => acc + item.valor, 0);
  }, [filtrados, ehPagos]);

  const totalMobile = useMemo(
    () => repasses.filter((r) => r.isMobile).reduce((acc, item) => acc + item.valor, 0),
    [repasses],
  );

  const baixar = async (repasse: RepasseMobile) => {
    if (!window.confirm(`Confirmar baixa de ${fmtBRL(repasse.valor)} para ${repasse.fornecedorNome || repasse.prestador || "prestador"}?`)) {
      return;
    }
    setBaixando(repasse.id);
    try {
      const hoje = hojeISO();
      const { error } = await supabase
        .from("financeiro_pagar")
        .update({
          status: "pago",
          data_pagamento: hoje,
          data_efetiva_pgto: hoje,
          updated_at: new Date().toISOString(),
        })
        .eq("id", repasse.id);
      if (error) throw error;
      toast.success("Repasse baixado", { description: repasse.osNumero || repasse.descricao || "" });
      await carregar();
    } catch (error) {
      toast.error("Não foi possível baixar o repasse", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBaixando(null);
    }
  };

  const copiarPix = async (repasse: RepasseMobile) => {
    const chave = (repasse.chavePix || "").trim();
    if (!chave) {
      toast.error("Chave PIX não cadastrada", {
        description: "Cadastre a chave PIX do prestador no TMS.",
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(chave);
      toast.success("PIX copiado", { description: chave });
    } catch {
      toast.error("Não foi possível copiar a chave PIX");
    }
  };

  return (
    <div className="space-y-3">
      {/* Status (pendentes x pagos) + período — padrão: hoje */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setStatusAba("pendentes")}
            className={`rounded-lg px-2 py-2 text-[11px] font-black transition-colors ${
              ehPagos ? "text-slate-600" : "bg-orange-600 text-white shadow-sm"
            }`}
          >
            Valores Pendentes
          </button>
          <button
            type="button"
            onClick={() => setStatusAba("pagos")}
            className={`rounded-lg px-2 py-2 text-[11px] font-black transition-colors ${
              ehPagos ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600"
            }`}
          >
            Valores Pagos
          </button>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] font-semibold text-slate-500">Início (de)</Label>
            <Input
              type="date"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
              className="mt-1 h-9 px-2 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] font-semibold text-slate-500">Fim (até)</Label>
            <Input
              type="date"
              value={periodoFim}
              onChange={(e) => setPeriodoFim(e.target.value)}
              className="mt-1 h-9 px-2 text-xs"
            />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] text-slate-500">
            {ehPagos ? "Baixa de pagamento no período" : "Vencimento no período"} · padrão: hoje
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                setPeriodoInicio(hojeISO());
                setPeriodoFim(hojeISO());
              }}
              className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => {
                setPeriodoInicio("");
                setPeriodoFim("");
              }}
              className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50"
            >
              Todo o período
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            <Banknote className="h-3 w-3" /> {ehPagos ? "Total pago no período" : "Total pendente"}
          </p>
          <p className="mt-1 text-xl font-black text-slate-900">{fmtBRL(totalPendente)}</p>
          <p className="text-[10px] text-slate-500">{filtrados.length} repasse(s)</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 shadow-sm">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            <CalendarDays className="h-3 w-3" /> {ehPagos ? "Pago hoje" : "A pagar hoje"}
          </p>
          <p className="mt-1 text-xl font-black text-amber-900">{fmtBRL(totalHoje)}</p>
          <p className="text-[10px] text-amber-700">
            {ehPagos ? "Baixados na data de hoje" : "Vencidos + vencendo hoje"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-orange-700">OS Mobile</p>
            <p className="text-base font-black text-orange-900">{fmtBRL(totalMobile)}</p>
          </div>
          <Badge variant="outline" className="border-orange-300 bg-white text-orange-700">
            identificação automática
          </Badge>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={somenteMobile}
              onChange={(e) => setSomenteMobile(e.target.checked)}
              className="h-4 w-4 accent-orange-600"
            />
            Somente OS Mobile
          </label>
          <div className="flex gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={() => void carregar()} disabled={carregando}>
              <RefreshCw className={`h-3.5 w-3.5 ${carregando ? "animate-spin" : ""}`} />
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => navigate("/financeiro")}>
              <ExternalLink className="mr-1 h-3.5 w-3.5" /> TMS
            </Button>
          </div>
        </div>
      </div>

      {carregando && (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-10">
          <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
        </div>
      )}

      {!carregando && filtrados.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
          <Wallet className="mx-auto mb-2 h-8 w-8 text-slate-400" />
          <p className="text-sm font-bold text-slate-700">
            {ehPagos ? "Nenhum repasse pago no período" : "Nenhum repasse pendente"}
          </p>
          <p className="text-[11px] text-slate-500">
            {ehPagos
              ? "Ajuste o período ou registre uma baixa em Valores Pendentes."
              : "Os repasses aparecem aqui após a criação das OS."}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {filtrados.map((repasse) => (
          <article key={repasse.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-black text-slate-800">
                    {repasse.fornecedorNome || repasse.prestador || "Prestador"}
                  </p>
                  {repasse.isMobile && (
                    <Badge variant="outline" className="border-orange-200 bg-orange-50 text-[10px] text-orange-700">
                      OS Mobile
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {repasse.osNumero || repasse.descricao || "Repasse"}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {ehPagos
                    ? `Pago em: ${fmtData(repasse.dataPagamento)}`
                    : `Vencimento: ${fmtData(repasse.vencimento || repasse.data_vencimento)}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-black text-slate-800">{fmtBRL(repasse.valor)}</p>
                <Badge variant="outline" className="mt-1 border-amber-200 bg-amber-50 text-[10px] text-amber-700">
                  {repasse.status || "pendente"}
                </Badge>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              {!ehPagos ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void baixar(repasse)}
                  disabled={baixando === repasse.id}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {baixando === repasse.id ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Baixar repasse
                </Button>
              ) : (
                <div className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-bold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Pago em {fmtData(repasse.dataPagamento)}
                </div>
              )}
              <Button type="button" size="sm" variant="outline" onClick={() => navigate("/financeiro")}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir TMS
              </Button>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void copiarPix(repasse)}
              disabled={!repasse.chavePix}
              className="mt-2 w-full"
            >
              <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Copiar PIX
              {repasse.chavePix ? "" : " (não cadastrado)"}
            </Button>
          </article>
        ))}
      </div>

      <p className="px-1 text-center text-[10px] text-slate-400">
        Controle rápido de caixa · a baixa oficial permanece disponível no Financeiro do TMS.
      </p>
    </div>
  );
}

// ============================================================
// Página principal — shell sem sidebar
// ============================================================

export default function OsMobile() {
  const { user } = useAuth();
  const [aba, setAba] = useState<AbaMobile>("nova");
  const [empresa, setEmpresa] = useState<DadosEmpresaFatura | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let ativo = true;
    buscarEmpresaMobile().then((dados) => {
      if (ativo) setEmpresa(dados);
    });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [aba]);

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950 text-white shadow-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-sm font-black text-slate-950">
              CE
            </div>
            <div>
              <p className="text-sm font-black leading-tight tracking-tight">
                Conexão <span className="text-orange-400">Express</span>
              </p>
              <p className="text-[10px] leading-tight text-slate-400">OS Mobile · operação de campo</p>
            </div>
          </div>
          <div className="text-right">
            <p className="max-w-[110px] truncate text-[11px] font-semibold text-slate-200">
              {user?.name || "Operador"}
            </p>
            <p className="text-[9px] uppercase tracking-wide text-slate-500">logado</p>
          </div>
        </div>
      </header>

      <main
        ref={scrollRef}
        className="mx-auto w-full max-w-lg flex-1 overflow-y-auto px-3 pt-3"
        style={{ paddingBottom: "calc(5.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className={aba === "nova" ? "block" : "hidden"}>
          <NovaOSView onAbrirEmAberto={() => setAba("aberto")} />
        </div>
        <div className={aba === "aberto" ? "block" : "hidden"}>
          <EmAbertoView ativo={aba === "aberto"} empresa={empresa} />
        </div>
        <div className={aba === "financeiro" ? "block" : "hidden"}>
          <FinanceiroMobileView ativo={aba === "financeiro"} />
        </div>
      </main>

      <MobileTabBar aba={aba} onChange={setAba} />
    </div>
  );
}
