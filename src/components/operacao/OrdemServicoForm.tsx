import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Calendar, Shield, CreditCard, FileText, Truck, MapPin, CheckCircle, Package, Lightbulb, Download, Check, Route, AlertTriangle, Clock, CheckCircle2, MessageCircle, Copy as CopyIcon, Send, Eye, DollarSign, Loader2, Link as LinkIcon, Building2, User, UserCheck, UserPlus, ChevronDown, Info, AlertCircle, TrendingUp, ListChecks, BarChart3, Gauge, Hash, Sparkles } from "lucide-react";
import { FormSectionCard, DocStepNavigation, type DocStep } from "@/components/ui/premium-document";
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
  type Tone,
} from "@/components/ui/enterprise";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { sincronizarComEscala } from "@/services/ordemServicoService";
import { useTenant } from "@/contexts/TenantContext";
import { diagnosticarOS, type DiagnosticoSincronizacao, obterLabelDivergencia } from "@/services/escala/syncDiagnostico";
import { generateProfessionalPDF } from "@/lib/pdfGenerator";
import { OrdemServico, OSEndereco, OSHistorico, OSCarga, STATUS_CORES, OSStatus, obterStatusGlobalOS, type PortadorExterno } from "./osTypes";
import { STATUS_GLOBAL_ORDER, STATUS_GLOBAL_INFO, obterClasseDotGlobal, obterClasseBadgeGlobal, obterInfoGlobal, type StatusGlobal } from "./statusGlobal";
import { FavoritosDropdown, SaveFavoritoButton } from "@/components/enderecos/EnderecosFavoritos";
import CompartilharRastreioModal from "./CompartilharRastreioModal";
import EntregasComprovantes from "@/components/comprovantes/EntregasComprovantes";
import { verificarInadimplenciaCliente } from "@/services/financeiro/inadimplenciaService";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useFormExitGuard } from "@/hooks/useFormExitGuard";
import { useRouterBlocker } from "@/hooks/useRouterBlocker";
import { EnderecoCompleto, EnderecoType } from "@/components/ui/EnderecoCompleto";
import { TIPOS_VEICULO, sugerirVeiculo, VEICULO_PARAMETROS } from "@/constants/tiposVeiculo";
import { toOSInsert, toOSUpdate } from "@/lib/dbMappers";
import { calcularDistancia } from "@/services/maps";
import { calcularRotasAlternativas } from "@/services/maps/distanceService";
import type { DistanceResult, TipoRota, RoutesResult } from "@/services/maps/types";
import type { ResultadoCalculo } from "@/services/financeiro/calculoService";
import { calcularCubagem, sugerirVeiculosPorCarga, verificarAlertasCubagem, type ResultadoCubagem, type SugestaoVeiculo, type AlertaCubagem } from "@/services/operacao/cargaService";
import { calcularPrecoRapido } from "@/services/precificacao/precificacaoEngineService";
import { buscarTabelaValoresCliente } from "@/services/precificacao/buscarTabelasService";
import { gerarMensagemWhatsAppOS, generatePDFCliente, generatePDFPrestador } from "@/lib/pdfGenerator";
import {
  gerarMensagemOrientacaoExecucao,
  gerarMensagemWhatsAppClienteRastreio,
} from "@/lib/osWhatsAppMessage";
import { enviarMensagem as WhatsAppEnviar } from "@/services/integracoes/whatsappService";
import { gerarLinkRastreio } from "@/services/rastreamento/trackingService";
import {
  publicarOportunidade,
  buscarPrestadoresCompativeis,
  cancelarOportunidade,
  obterOportunidadePorOS,
  obterStatusRedeInfo,
  type RedeOportunidade,
  type PrestadorCompativel,
} from "@/services/operacao/redePrestadoresService";
import { Users, Network } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { podeVerReceitaEMargem } from "@/lib/permissoes";
import type { PedagioInfo } from "@/services/maps/types";
import { ColetaReversaFields, emptyReversaFields, type ReversaFields } from "./ColetaReversaFields";
import { disparaEventoAutomacao } from "@/services/integracoes/automacaoCentralService";
import { registrarLog } from "@/services/integracoes/integrationLogger";
import { enviarWebhookWhatsAppOSCriada } from "@/services/integracoes/whatsAppOSService";
import { enviarWhatsAppAutomatico } from "@/services/whatsappAutomation";
import { gerarRascunhoCte } from "@/services/fiscal/cteService";
import { gerarRascunhoMdfe } from "@/services/fiscal/mdfeService";
import { gerarRascunhoNfse } from "@/services/fiscal/nfseService";
import { buscarCodigoIbge } from "@/services/fiscal/ibgeService";
import {
  gerarMensagemOSCriada,
  gerarMensagemOSAtualizada,
  gerarMensagemPrestadorAcionado,
  gerarMensagemOSFinalizada,
  gerarMensagemOcorrenciaOS,
} from "@/services/osWhatsAppTemplates";

const separarNumeroLogradouro = (endereco: string): { logradouro: string; numero: string } => {
  const match = endereco?.match(/^(.+?),\s*(\d+)\s*[-–]?\s*$/);
  if (match) {
    return { logradouro: match[1].trim(), numero: match[2].trim() };
  }
  return { logradouro: endereco || "", numero: "" };
};

// ============================================================
// TESTE WHATSAPP REAL - remover após validação
// ============================================================
const testarWhatsAppReal = async () => {
  console.log("[TESTE WhatsApp] Iniciando teste real...");
  const testNumber = "SEU_NUMERO_AQUI".replace(/\D/g, "");
  const testMsg = "🚀 TESTE REAL TMS CONEXÃO EXPRESS - " + new Date().toISOString();
  
  const result = await WhatsAppEnviar(testNumber, testMsg);
  console.log("[TESTE WhatsApp] Resultado:", result);
  return result;
};

interface TabelaValorRow {
  id?: string;
  nome?: string;
  tipo_veiculo?: string;
  km_inicial?: number;
  km_final?: number;
  valor_base?: number;
  valor_km?: number;
  valor_km_excedente?: number;
  valor_minimo?: number;
  franquia_km?: number;
  percentual_prestador?: number;
  pedagio_incluso?: boolean;
  ativo?: boolean;
  universal?: boolean;
  cliente_id?: string;
}

/**
 * @deprecated Missão 78 — substituído por buscarTabelaValoresCliente() + calcularPrecoRapido().
 * Mantido apenas como referência.
 */
const _calcularValorAutomaticoLegado = (tabela: TabelaValorRow | null, distanciaKm: number) => {
  if (!tabela) return { valor: 0, valorPrestador: 0, tabelaNome: "", pendente: true, descricao: "" };
  const valorBase = Number(tabela.valor_base) || 0;
  const franquiaKm = Number(tabela.franquia_km) || 0;
  const valorKmExcedente = Number(tabela.valor_km_excedente) || 0;
  const kmExcedente = Math.max(0, distanciaKm - franquiaKm);
  const valorCalculado = valorBase + (kmExcedente * valorKmExcedente);
  const valorPrestador = valorCalculado * ((tabela.percentual_prestador || 80) / 100);
  return {
    valor: valorCalculado,
    valorPrestador,
    tabelaNome: tabela.nome || "Tabela Padrão",
    pendente: false,
    descricao: `Base R$${valorBase} + ${kmExcedente}km exced.`
  };
};

type FiscalClassification = {
  tipo: 'Municipal' | 'Intermunicipal' | 'Interestadual' | 'Indefinido';
  exigeNFSe: boolean;
  exigeCTe: boolean;
  exigeMDFe: boolean;
};

const classificarFiscalmente = (enderecos: OSEndereco[]): FiscalClassification => {
  const origem = enderecos.find(e => e.tipo === 'coleta' && e.cidade?.trim() && e.estado?.trim());
  const destino = [...enderecos].reverse().find(e => e.tipo === 'entrega' && e.cidade?.trim() && e.estado?.trim());
  
  if (!origem || !destino) {
    return { tipo: 'Indefinido', exigeNFSe: false, exigeCTe: false, exigeMDFe: false };
  }
  
  const mesmaCidade = origem.cidade!.trim().toLowerCase() === destino.cidade!.trim().toLowerCase();
  const mesmaUF = origem.estado!.trim().toLowerCase() === destino.estado!.trim().toLowerCase();
  
  if (mesmaUF && mesmaCidade) {
    return { tipo: 'Municipal', exigeNFSe: true, exigeCTe: false, exigeMDFe: false };
  }
  
  if (mesmaUF && !mesmaCidade) {
    return { tipo: 'Intermunicipal', exigeNFSe: false, exigeCTe: true, exigeMDFe: false };
  }
  
  return { tipo: 'Interestadual', exigeNFSe: false, exigeCTe: true, exigeMDFe: true };
};

const FISCAL_TIPO_CORES: Record<FiscalClassification['tipo'], string> = {
  Municipal: 'bg-green-100 text-green-800 border-green-300',
  Intermunicipal: 'bg-blue-100 text-blue-800 border-blue-300',
  Interestadual: 'bg-purple-100 text-purple-800 border-purple-300',
  Indefinido: 'bg-gray-100 text-gray-500 border-gray-300',
};

type FiscalDocTipo = 'NFSe' | 'CTe' | 'MDFe';

const validarPendenciasFiscais = (
  tipo: FiscalDocTipo,
  data: OrdemServico,
  enderecos: OSEndereco[]
): string[] => {
  const pendencias: string[] = [];
  const origem = enderecos.find(e => e.tipo === 'coleta' && e.cidade?.trim() && e.estado?.trim());
  const destino = [...enderecos].reverse().find(e => e.tipo === 'entrega' && e.cidade?.trim() && e.estado?.trim());

  if (!data.cliente?.trim()) pendencias.push('Cliente/tomador não informado');
  if (!data.valorCliente || data.valorCliente <= 0) pendencias.push('Valor do frete/serviço não informado');
  if (!origem?.cidade?.trim()) pendencias.push('Cidade de origem não informada');
  if (!origem?.estado?.trim()) pendencias.push('UF de origem não informada');
  if (!destino?.cidade?.trim()) pendencias.push('Cidade de destino não informada');
  if (!destino?.estado?.trim()) pendencias.push('UF de destino não informada');

  if (tipo === 'NFSe') {
    if (!origem?.cidade?.trim()) pendencias.push('Município de prestação não definido');
  }

  if (tipo === 'CTe') {
    if (!data.prestador?.trim()) pendencias.push('Prestador/motorista não informado');
    if (!data.veiculoPlaca?.trim() && !data.veiculoTipo?.trim()) pendencias.push('Veículo não informado (placa ou tipo)');
    if (!data.valorCliente || data.valorCliente <= 0) pendencias.push('Base de cálculo do ICMS não informada (valor do frete zerado)');
  }

  if (tipo === 'MDFe') {
    if (!data.prestador?.trim()) pendencias.push('Prestador/motorista não informado');
    if (!data.veiculoPlaca?.trim()) pendencias.push('Placa do veículo não informada');
  }

  return pendencias;
};

interface SugestaoVeiculo { tipo: string; motivo: string; }

interface DocumentoOS {
  id: string;
  tipo: 'nf' | 'cte' | 'xml' | 'comprovante' | 'foto' | 'outro';
  nome: string;
  url?: string;
  dataUpload: string;
}

interface Props {
  os?: OrdemServico;
  modo: "ver" | "editar" | "novo";
  onVoltar: () => void;
  onSalvar: () => void;
}

const emptyEnd = (): OSEndereco => ({ sequencia: 1, tipo: "coleta", nomeLocal: "", endereco: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", referencia: "", instrucoes: "", contato: "", telefone: "", email: "", enviarWhatsApp: false, notificarWhatsApp: false, janelaInicio: "", janelaFim: "", agendamento: false, statusPonto: "pendente", observacoes: "", observacaoPonto: "", latitude: undefined, longitude: undefined, enderecoFormatado: "", portaria: "", doca: "", procedimentoEntrada: "", procedimentoSaida: "", estacionamento: "", documentoNecessario: "", codigoAcesso: "", exigenciaEpi: false, exigeAjudante: false, restricaoVeiculo: "", restricaoAltura: "", outrasRestricoes: "", horarioLimite: "", dataPrevista: "", recebedorPrevisto: "", contatoNome: "", contatoTelefone: "" });

const OPCOES_PIX_TIPO_FORM = ["CPF/CNPJ", "Celular", "E-mail", "Chave Aleatória"] as const;

const emptyPortadorExterno = (): PortadorExterno => ({
  ativo: false,
  nome: "",
  cpf: "",
  placaMoto: "",
  grupoOrigem: "",
  telefoneWhatsapp: "",
  pixTipo: "CPF/CNPJ",
  pixChave: "",
  pixFavorecido: "",
  banco: "",
  agencia: "",
  conta: "",
});

const emptyCarga = (): OSCarga => ({
  tipo: "Seca", descricao: "", volumes: 0, peso: 0, cubagem: 0, pallets: 0, valorDeclarado: 0, qtdNotas: 0,
  refrigerada: false, ajudante: false, fragil: false, empilhavel: true, risco: false, perigosa: false, controlada: false,
  conferencia: false, equipamento: "", condicao: "", comprimento: 0, largura: 0, altura: 0, pesoPorVolume: 0, 
  temperaturaMinima: 0, temperaturaMaxima: 0, observacoesCarga: "",
  portadorExterno: emptyPortadorExterno()
});

const emptyOS = (): OrdemServico => {
  const agora = new Date();
  const dataHoje = agora.toISOString().split("T")[0];
  return {
    numero: `OS-${agora.getFullYear()}${String(agora.getMonth()+1).padStart(2,'0')}-${String(Math.floor(Math.random()*900000)+100000).padStart(6,'0')}`,
    data: dataHoje, cliente: "", unidade: "", centroCusto: "", orcamentoOrigem: "", prestador: "", veiculoAlocado: "", veiculoPlaca: "",
    tipoOperacao: "Coleta e Entrega", modalidade: "esporadico", prioridade: "normal", status: "em_analise", responsavel: "", refCliente: "", pedidoInterno: "", slaOperacao: "", observacoesGerais: "",
    comprovanteObrigatorio: true, cteObrigatorio: false, xmlObrigatorio: false, operacaoDedicada: false,
    carga: emptyCarga(),
    veiculoTipo: "", veiculoSubcategoria: "", veiculoCarroceria: "", veiculoTermica: "seco", isReserva: false, retornoObrigatorio: false,
    dataProgramada: "", janelaOperacional: "", previsaoInicio: "", previsaoTermino: "", tipoEscala: "", instrucoesOperacionaisOS: "", observacaoTorre: "",
    tabelaAplicada: "", valorCliente: 0, custoPrestador: 0, pedagio: 0, ajudante: 0, adicionais: 0, descontos: 0, reembolsoPrevisto: 0, contaContabil: "", centroCustoFin: "", statusFaturamento: "a faturar", statusPagamento: "a pagar",
    emailDestinatario: "", whatsappDestinatario: "", notificarDestinatario: true, eventosTracker: "principais",
    enderecos: [emptyEnd()], historico: [{ data: new Date().toISOString(), acao: "OS Criada", status_novo: "em_analise", usuario: "Usuário" }]
  };
};

const obterPrioridadeLabel = (p?: string) => (p === "urgente" ? "Urgente / Crítica" : p === "baixa" ? "Baixa" : "Normal");

// ============================================================
// ETAPA-1: Cálculo bidirecional de peso
// Volumes × Peso por Volume = Peso Total
// Preenchendo 2 dos 3 campos, o terceiro é derivado automaticamente.
// ============================================================
const arredondar = (valor: number, casas: number) => {
  const fator = Math.pow(10, casas);
  return Math.round(valor * fator) / fator;
};

const aplicarCalculoPesoBidirecional = (carga: OSCarga, campoEditado: keyof OSCarga): OSCarga => {
  if (campoEditado !== "volumes" && campoEditado !== "peso" && campoEditado !== "pesoPorVolume") {
    return carga;
  }

  let volumes = Number(carga.volumes) || 0;
  let peso = Number(carga.peso) || 0;
  let pesoPorVolume = Number(carga.pesoPorVolume) || 0;

  if (campoEditado === "volumes") {
    if (volumes > 0 && pesoPorVolume > 0) peso = arredondar(volumes * pesoPorVolume, 2);
    else if (volumes > 0 && peso > 0) pesoPorVolume = arredondar(peso / volumes, 3);
  } else if (campoEditado === "peso") {
    if (peso > 0 && volumes > 0) pesoPorVolume = arredondar(peso / volumes, 3);
    else if (peso > 0 && pesoPorVolume > 0) volumes = arredondar(peso / pesoPorVolume, 2);
  } else if (campoEditado === "pesoPorVolume") {
    if (pesoPorVolume > 0 && volumes > 0) peso = arredondar(volumes * pesoPorVolume, 2);
    else if (pesoPorVolume > 0 && peso > 0) volumes = arredondar(peso / pesoPorVolume, 2);
  }

  return { ...carga, volumes, peso, pesoPorVolume };
};

// ============================================================
// ETAPA-1: Persistência de rascunho local (sessionStorage)
// Evita perda de dados ao alternar abas/recarregar o painel.
// ============================================================
const OS_DRAFT_PREFIX = "tms_os_draft_v1";
const OS_DRAFT_TTL_MS = 48 * 60 * 60 * 1000; // 48h
/** Chaves descartadas — impedem regravação no unmount/flush. */
const osDraftsDescartados = new Set<string>();

interface OSDraft {
  data: OrdemServico;
  reversaFields: ReversaFields;
  abaAtiva: string;
  savedAt: string;
}

const getDraftKey = (osId?: string | null, modo?: string | null) =>
  `${OS_DRAFT_PREFIX}:${osId || "nova"}:${modo || "novo"}`;

const lerRascunhoLocal = (key: string): OSDraft | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OSDraft;
    if (!parsed || typeof parsed !== "object" || !parsed.data) return null;
    const salvoEm = parsed.savedAt ? new Date(parsed.savedAt).getTime() : NaN;
    if (Number.isFinite(salvoEm) && Date.now() - salvoEm > OS_DRAFT_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const gravarRascunhoLocal = (key: string, draft: OSDraft) => {
  if (osDraftsDescartados.has(key)) return;
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // localStorage indisponível ou cota excedida — ignora silenciosamente
  }
};

/** Remove e PERMITE novas gravações (após salvar com sucesso). */
const limparRascunhoLocal = (key: string) => {
  osDraftsDescartados.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    // ignora
  }
};

/** Remove e BLOQUEIA regravações (descarte confirmado). */
const descartarRascunhoLocal = (key: string) => {
  osDraftsDescartados.add(key);
  try {
    localStorage.removeItem(key);
  } catch {
    // ignora
  }
};

const liberarRascunhoLocal = (key: string) => {
  osDraftsDescartados.delete(key);
};

const obterToneGlobal = (status: string | null | undefined): Tone => {
  const info = obterInfoGlobal(obterStatusGlobalOS(status));
  const mapa: Record<string, Tone> = {
    slate: "slate", amber: "amber", blue: "blue", orange: "orange",
    indigo: "indigo", green: "green", emerald: "emerald", violet: "violet", purple: "purple",
  };
  return mapa[info.cor] || "slate";
};

// ============================================================
// Painel lateral de resumo operacional (somente visual)
// ============================================================
const ResumoOperacionalPanel = ({
  data,
  clienteNome,
  diagnosticoEscala,
  ultimaOperacaoPrestador,
  alertasCubagem,
  pendenciasFiscais,
  verReceitaMargem,
}: {
  data: OrdemServico;
  clienteNome?: string;
  diagnosticoEscala: DiagnosticoSincronizacao | null;
  ultimaOperacaoPrestador: { data: string; valor?: number } | null;
  alertasCubagem: AlertaCubagem[];
  pendenciasFiscais: string[];
  /** UPGRADE-REGRAS: false => Receita/Margem ocultas (exibem "---") para não-admin */
  verReceitaMargem: boolean;
}) => {
  const margemValor = (data.valorCliente || 0) - (data.custoPrestador || 0);
  const margemPct = (data.valorCliente || 0) > 0 ? ((margemValor / data.valorCliente) * 100) : 0;

  const pendenciaItems: string[] = [];
  if (!data.cliente?.trim()) pendenciaItems.push("Cliente não informado");
  if (!data.tipoOperacao?.trim()) pendenciaItems.push("Tipo de operação não informado");
  if (!data.veiculoTipo && !data.veiculoPlaca) pendenciaItems.push("Veículo não informado");
  if ((data.enderecos || []).filter((e) => e?.endereco?.trim()).length < 2) pendenciaItems.push("Informe origem e destino");
  if (!(data.valorCliente > 0)) pendenciaItems.push("Valor cliente zerado");
  (alertasCubagem || []).forEach((a) => { if (a?.mensagem) pendenciaItems.push(a.mensagem); });
  (pendenciasFiscais || []).forEach((p) => pendenciaItems.push(p));

  const statusGlobalAtual = obterStatusGlobalOS(data.status);
  const statusFinOk = data.statusFaturamento === "faturada" || data.statusFaturamento === "paga";
  const escalaOk = diagnosticoEscala?.status === "sincronizada";
  const escalaLabel = obterLabelDivergencia(diagnosticoEscala?.status || "os_sem_escala");
  const pontosEnderecados = (data.enderecos || []).filter((e) => e?.endereco?.trim()).length;

  const checklist = [
    { ok: Boolean(data.cliente?.trim()), label: "Cliente definido", detail: clienteNome || data.cliente || "—" },
    { ok: Boolean(data.tipoOperacao?.trim()), label: "Tipo da operação", detail: data.tipoOperacao || "—" },
    { ok: Boolean(data.veiculoTipo || data.veiculoPlaca), label: "Veículo", detail: data.veiculoTipo || data.veiculoPlaca || "pendente" },
    { ok: pontosEnderecados >= 2, label: "Origem e destino", detail: `${pontosEnderecados} ponto(s) com endereço` },
    { ok: (data.valorCliente || 0) > 0, label: "Financeiro OK", detail: verReceitaMargem ? `R$ ${(data.valorCliente || 0).toFixed(2)}` : ((data.valorCliente || 0) > 0 ? "definido" : "pendente") },
    { ok: escalaOk, label: "Programação", detail: escalaLabel },
    { ok: (pendenciasFiscais || []).length === 0, label: "Fiscal OK", detail: (pendenciasFiscais || []).length > 0 ? `${pendenciasFiscais.length} pendência(s)` : "sem pendências" },
  ];
  const totalCheckOk = checklist.filter((c) => c.ok).length;
  const totalPendencias = pendenciaItems.length;

  return (
    <div className="flex flex-col">
      {/* FINANCEIRO — UPGRADE-REGRAS: Receita/Margem restritas a admin máximo */}
      <PanelSection icon={TrendingUp} title="Financeiro" accent="emerald">
        <PanelRow label="Receita (Cliente)" value={verReceitaMargem ? `R$ ${(data.valorCliente || 0).toFixed(2)}` : "---"} />
        <PanelRow label="Custo Prestador" value={`R$ ${(data.custoPrestador || 0).toFixed(2)}`} />
        <PanelRow
          label="Margem (R$)"
          value={verReceitaMargem ? `R$ ${margemValor.toFixed(2)}` : "---"}
          valueClass={verReceitaMargem ? (margemValor >= 0 ? "text-green-600" : "text-red-600") : "text-slate-400"}
        />
        <PanelRow
          label="Margem (%)"
          value={verReceitaMargem ? ((data.valorCliente || 0) > 0 ? `${margemPct.toFixed(1)}%` : "—") : "---"}
          valueClass={verReceitaMargem ? ((data.valorCliente || 0) > 0 ? (margemPct >= 20 ? "text-green-600" : margemPct > 0 ? "text-amber-600" : "text-red-600") : undefined) : "text-slate-400"}
        />
        <div className="mt-1 flex items-center justify-between border-t border-slate-200/70 pt-2 text-xs">
          <span className="font-medium text-slate-500">Tabela</span>
          <span className="truncate font-bold text-slate-700">{data.tabelaAplicada || "Padrão"}</span>
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
      <PanelSection icon={AlertCircle} title="Pendências" accent={totalPendencias > 0 ? "amber" : "emerald"} right={
        <span className="text-[10px] font-bold text-slate-400">{totalPendencias}</span>
      }>
        {pendenciaItems.length > 0 ? (
          <ul className="space-y-1">
            {pendenciaItems.map((p, i) => (
              <li key={i} className="flex items-start gap-1.5 rounded-md border border-amber-100 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                <span className="mt-0.5 text-amber-400">●</span>
                <span className="flex-1">{p}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-1.5 text-[11px] text-emerald-600">
            <CheckCircle className="h-3.5 w-3.5" /> Nenhuma pendência detectada
          </p>
        )}
      </PanelSection>

      {/* INDICADORES */}
      <PanelSection icon={BarChart3} title="Indicadores" accent="orange">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-slate-200 bg-white p-2 text-center">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Distância</p>
            <p className="text-sm font-black text-slate-800">{data.distanciaKm || 0} km</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-2 text-center">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Tempo</p>
            <p className="text-sm font-black text-slate-800">{data.tempoEstimado || "—"}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-2 text-center">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Pontos</p>
            <p className="text-sm font-black text-slate-800">{(data.enderecos || []).length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-2 text-center">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Eventos</p>
            <p className="text-sm font-black text-slate-800">{(data.historico || []).length}</p>
          </div>
        </div>
      </PanelSection>

      {/* ÚLTIMA ATUALIZAÇÃO */}
      <PanelSection icon={Clock} title="Última Atualização" accent="slate">
        {ultimaOperacaoPrestador && (
          <div className="mb-2 space-y-0.5 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5"><User className="h-3 w-3 text-slate-400" /> Última operação do prestador</div>
            <div className="pl-4 text-[10px]">
              {ultimaOperacaoPrestador.data ? new Date(ultimaOperacaoPrestador.data).toLocaleDateString("pt-BR") : "N/A"}
              {verReceitaMargem && ultimaOperacaoPrestador.valor ? ` • R$ ${ultimaOperacaoPrestador.valor.toFixed(2)}` : ""}
            </div>
          </div>
        )}
        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <Building2 className="h-3 w-3 text-slate-400" />
          Emitida em {data.data ? new Date(data.data).toLocaleDateString("pt-BR") : "—"}
        </div>
      </PanelSection>
    </div>
  );
};

// ============================================================
// Etapas do formulário premium (somente visual)
// ============================================================
const obterDocStepsOS = (
  data: OrdemServico,
  alertasCubagem: AlertaCubagem[],
  pendenciasFiscais: string[],
): DocStep[] => {
  const identOk = Boolean(data.cliente?.trim() && data.tipoOperacao?.trim());
  const cargaOk = Boolean(data.carga?.tipo?.trim());
  const veiculoOk = Boolean(data.veiculoTipo || data.veiculoPlaca);
  const rotasOk = (data.enderecos || []).filter((e) => e?.endereco?.trim()).length >= 2;
  const valoresOk = (data.valorCliente || 0) > 0;
  return [
    { value: "identificacao", label: "Identificação", icon: FileText, done: identOk, pending: !identOk },
    { value: "carga", label: "Carga", icon: Package, done: cargaOk, pending: !cargaOk },
    { value: "veiculo", label: "Veículo", icon: Truck, done: veiculoOk, pending: !veiculoOk },
    { value: "enderecos", label: "Rotas e Paradas", icon: MapPin, done: rotasOk, pending: !rotasOk },
    { value: "valores", label: "Torre & Financeiro", icon: CreditCard, done: valoresOk, pending: (alertasCubagem || []).length > 0 || (pendenciasFiscais || []).length > 0 },
    { value: "historico", label: "Histórico", icon: Clock, done: (data.historico || []).length > 0 },
  ];
};

// MISSÃO ENDERECOS-INTELIGENTES — separa exibição (nome) de persistência (UUID) de data.cliente
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================
// UPGRADE-REGRAS-DE-NEGOCIO — MATCH INTELIGENTE DE PRESTADOR
// Ranking de prestadores ativos por: compatibilidade de veículo com a exigência
// da OS, capacidade x peso/cubagem, região da coleta, refrigeração e histórico.
// ============================================================
// ============================================================
// UPGRADE — MATCH INTELIGENTE
// Shapes mínimos das tabelas prestadores/veiculos usados no ranking
// (linhas 80 prestadores + veículos vinculados via prestador_vinculado).
// ============================================================
interface VeiculoMatchRow {
  id?: string;
  prestador_vinculado?: string | null;
  tipo_veiculo?: string | null;
  tipo?: string | null;
  placa?: string | null;
  capacidade_kg?: number | null;
  capacidade_m3?: number | null;
  status?: string | null;
}

interface PrestadorMatchRow {
  id?: string;
  nome_completo?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  regiao_principal?: string | null;
  regioes_secundarias?: string | null;
  aceita_refrigerado?: boolean | null;
  aceita_refrigerada?: boolean | null;
  indice_aceite?: number | null;
  avaliacao_operacional?: number | null;
  qtd_operacoes?: number | null;
  veiculos?: VeiculoMatchRow[];
}

export type SugestaoPrestadorMatch = {
  prestadorId: string;
  nome: string;
  telefone?: string;
  regiao?: string;
  veiculo?: { placa?: string; tipo?: string; capacidadeKg?: number; capacidadeM3?: number };
  score: number;
  motivos: string[];
};

type CtxMatch = {
  tipoVeiculo: string;
  pesoKg: number;
  m3: number;
  refrigerado: boolean;
  cidade: string;
  uf: string;
};

const normTxt = (v?: string | null): string => (v == null ? "" : String(v).trim().toLowerCase());

// Grafias de veículo variam entre OS ("Moto", "caminhão") e cadastro ("truck", "moto")
const VEICULO_ALIAS: Array<[string, string]> = [
  ["motocicleta", "moto"],
  ["moto", "moto"],
  ["fiorino", "fiorino"],
  ["vuc", "vuc"],
  ["hr", "hr"],
  ["carreta", "truck"],
  ["truck", "truck"],
  ["caminhao", "truck"],
  ["van", "van"],
  ["utilitario", "fiorino"],
];

const chaveVeiculo = (t?: string | null): string => {
  const v = normTxt(t);
  if (!v) return "";
  for (const [alias, chave] of VEICULO_ALIAS) if (v.includes(alias)) return chave;
  return v;
};

const cobreRegiao = (p: PrestadorMatchRow, ctx: CtxMatch): boolean => {
  const regiaoTxt = normTxt(`${p?.regiao_principal || ""} ${p?.regioes_secundarias || ""}`);
  if (!regiaoTxt) return false;
  if (/todas|brasil|nacional|pais/.test(regiaoTxt)) return true;
  if (ctx.cidade && (regiaoTxt.includes(ctx.cidade) || ctx.cidade.includes(regiaoTxt.trim()))) return true;
  if (ctx.uf && new RegExp(`(^|[^a-z])${ctx.uf}([^a-z]|$)`, "i").test(regiaoTxt)) return true;
  return false;
};

const calcularMatchPrestador = (p: PrestadorMatchRow, ctx: CtxMatch): SugestaoPrestadorMatch | null => {
  const motivos: string[] = [];
  let score = 0;
  const veiculos: VeiculoMatchRow[] = Array.isArray(p?.veiculos) ? p.veiculos : [];

  // Exigência de carga refrigerada: prestador precisa aceitar (incompatível => descartado)
  if (ctx.refrigerado && !(p?.aceita_refrigerado || p?.aceita_refrigerada)) return null;

  const chaveAlvo = chaveVeiculo(ctx.tipoVeiculo);
  const veic =
    veiculos.find((v) => chaveVeiculo(v?.tipo_veiculo || v?.tipo) === chaveAlvo && chaveAlvo && normTxt(v?.status) !== "inativo") ||
    veiculos.find((v) => normTxt(v?.status) !== "inativo") ||
    veiculos[0] ||
    null;

  // Capacidade x exigência da OS: veículo incompatível é descartado
  const capKg = Number(veic?.capacidade_kg || 0);
  const capM3 = Number(veic?.capacidade_m3 || 0);
  if (ctx.pesoKg > 0 && capKg > 0 && capKg < ctx.pesoKg) return null;
  if (ctx.m3 > 0 && capM3 > 0 && capM3 < ctx.m3) return null;

  // 1) Tipo de veículo compatível
  const chaveVeic = chaveVeiculo(veic?.tipo_veiculo || veic?.tipo);
  if (chaveAlvo && chaveVeic && chaveVeic === chaveAlvo) {
    score += 40;
    motivos.push(`Veículo compatível (${veic?.tipo_veiculo || veic?.tipo})`);
  } else if (chaveAlvo && veic) {
    score += 10;
    motivos.push(`Veículo disponível (${veic?.tipo_veiculo || veic?.tipo})`);
  } else if (!veic) {
    motivos.push("Sem veículo cadastrado");
  }

  // 2) Capacidade x peso/cubagem da OS
  if (ctx.pesoKg > 0) {
    if (capKg >= ctx.pesoKg) { score += 25; motivos.push(`Capacidade ${capKg}kg >= ${ctx.pesoKg}kg`); }
    else { score += 10; motivos.push("Capacidade não informada no cadastro"); }
  }
  if (ctx.m3 > 0) {
    if (capM3 >= ctx.m3) { score += 10; motivos.push(`Cubagem ${capM3}m3 >= ${ctx.m3}m3`); }
    else { score += 5; motivos.push("Cubagem não informada no cadastro"); }
  }

  // 3) Região da coleta
  if (cobreRegiao(p, ctx)) {
    score += 20;
    motivos.push(`Atende região da coleta${p?.regiao_principal ? ` (${p.regiao_principal})` : ""}`);
  } else if (!normTxt(p?.regiao_principal) && !normTxt(p?.regioes_secundarias)) {
    score += 8;
    motivos.push("Sem região declarada");
  }

  // 4) Refrigeração aceita (quando exigida pela OS)
  if (ctx.refrigerado) { score += 10; motivos.push("Aceita carga refrigerada"); }

  // 5) Disponibilidade do veículo
  if (veic && ["ativo", "disponivel", "disponível", "operacional"].includes(normTxt(veic.status))) {
    score += 5;
    motivos.push("Veículo disponível");
  }

  // 6) Qualidade histórica (índice de aceite 0-100 + avaliação 0-5)
  const qualidade = (Math.min(Number(p?.indice_aceite) || 0, 100) / 100) * 5 + (Math.min(Number(p?.avaliacao_operacional) || 0, 5) / 5) * 5;
  if (qualidade > 0) score += qualidade;

  return {
    prestadorId: p.id,
    nome: p.nome_completo || "Prestador sem nome",
    telefone: p.telefone || p.whatsapp || undefined,
    regiao: p.regiao_principal || undefined,
    veiculo: veic
      ? {
          placa: veic.placa || undefined,
          tipo: veic.tipo_veiculo || veic.tipo || undefined,
          capacidadeKg: capKg || undefined,
          capacidadeM3: capM3 || undefined,
        }
      : undefined,
    score: Math.round(score),
    motivos,
  };
};

const OrdemServicoForm = ({ os, modo, onVoltar, onSalvar }: Props) => {
  // ETAPA-1: rascunho local por OS/modo (sessionStorage) — restaurado antes do estado inicial
  const draftKey = getDraftKey(os?.id, modo);
  // UPGRADE-REGRAS: permissão de visualização de Receita/Margem (somente admin máximo)
  const { user } = useAuth();
  const verReceitaMargem = podeVerReceitaEMargem(user?.role);
  // AUTO-SAVE — restaura o rascunho local (localStorage) tanto na edição quanto
  // na "Nova OS": ao trocar de aba/menu e voltar, o progresso é preservado.
  // Rascunhos expirados (TTL 48h) são descartados automaticamente.
  const [rascunhoInicial] = useState<OSDraft | null>(() =>
    modo === "ver" ? null : lerRascunhoLocal(draftKey),
  );
  const draftRef = useRef<OSDraft | null>(null);
  const [data, setData] = useState<OrdemServico>(() => {
    if (rascunhoInicial?.data) return rascunhoInicial.data;
    return os ? JSON.parse(JSON.stringify(os)) : emptyOS();
  });
  // MISSÃO ENDERECOS-INTELIGENTES — nome do cliente para exibição (data.cliente pode conter UUID)
  const [clienteNomeExibicao, setClienteNomeExibicao] = useState("");
  useEffect(() => {
    const valor = (data.cliente || "").trim();
    if (!valor) {
      setClienteNomeExibicao("");
      return;
    }
    if (!UUID_REGEX.test(valor)) {
      setClienteNomeExibicao(valor);
      return;
    }
    const idCliente = data.clienteId && UUID_REGEX.test(data.clienteId) ? data.clienteId : valor;
    let ativo = true;
    supabase
      .from("clientes")
      .select("nome_fantasia, razao_social")
      .eq("id", idCliente)
      .maybeSingle()
      .then(({ data: cli }) => {
        if (!ativo || !cli) return;
        const nome = (cli as any).nome_fantasia || (cli as any).razao_social || "";
        if (nome) setClienteNomeExibicao(nome);
      }, () => undefined);
    return () => { ativo = false; };
  }, [data.cliente, data.clienteId]);
  const clienteIdEfetivo =
    data.clienteId && UUID_REGEX.test(data.clienteId)
      ? data.clienteId
      : data.cliente && UUID_REGEX.test(data.cliente)
        ? data.cliente
        : "";
  const osInicialRef = useRef<OrdemServico>(data);
  const statusOverrideRef = useRef<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sugestaoVeiculo, setSugestaoVeiculo] = useState<SugestaoVeiculo | null>(null);
  const [sugestoesVeiculo, setSugestoesVeiculo] = useState<SugestaoVeiculo[]>([]);
  const [resultadoCubagem, setResultadoCubagem] = useState<ResultadoCubagem | null>(null);
  const [alertasCubagem, setAlertasCubagem] = useState<AlertaCubagem[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoOS[]>([]);
  const [calculandoDistancia, setCalculandoDistancia] = useState(false);
  const [distanciaRota, setDistanciaRota] = useState<DistanceResult | null>(null);
  const [faixaCalculada, setFaixaCalculada] = useState("");
  const [rotaSelecionada, setRotaSelecionada] = useState<TipoRota>("rapida");
  const [distanciasAlternativas, setDistanciasAlternativas] = useState<RoutesResult | null>(null);
  // UPGRADE — PEDÁGIO: estado da origem do valor (API de rota x inserção manual)
  const [pedagioInfo, setPedagioInfo] = useState<PedagioInfo>({ fonte: "nao_identificado" });
  // ETAPA-4 — detalhamento das praças de pedágio (persistido em carga.pedagios).
  const [mostrarPedagiosDetalhe, setMostrarPedagiosDetalhe] = useState(false);
  // UPGRADE — MATCH INTELIGENTE: sugestões ordenadas de prestadores compatíveis
  const [buscandoSugestao, setBuscandoSugestao] = useState(false);
  const [sugestoesPrestador, setSugestoesPrestador] = useState<SugestaoPrestadorMatch[]>([]);
  const [motivoAjusteManual, setMotivoAjusteManual] = useState("");
  const [showMotivoDialog, setShowMotivoDialog] = useState(false);
  const [enviandoWhatsApp, setEnviandoWhatsApp] = useState(false);
  const [enviarWhatsAppAuto, setEnviarWhatsAppAuto] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const initialDataRef = useRef<string>("");
  const readOnly = modo === "ver" || (!!os && (os.status === "finalizada" || os.status === "cancelada"));

  // NAVIGATION GUARD — modal "Descartar alterações?" ao tentar sair com dados
  // não salvos (nova OS e edição). Baseline = estado inicial carregado.
  const exitGuard = useFormExitGuard({
    current: data,
    initial: osInicialRef.current,
    enabled: !readOnly,
    onDiscard: () => {
      draftRef.current = null;
      descartarRascunhoLocal(draftKey);
    },
  });

  // BLOCKER de rota — menu lateral/links também respeitam o rascunho não salvo.
  useRouterBlocker({
    isDirty: exitGuard.isDirty,
    enabled: !readOnly,
    onDiscard: () => {
      draftRef.current = null;
      descartarRascunhoLocal(draftKey);
    },
  });

  const handleVoltar = async () => {
    const pode = await exitGuard.confirmExit();
    if (pode) onVoltar();
  };

  // AUTO-SAVE — libera a gravação de rascunho ao abrir o formulário (a chave
  // pode ter sido bloqueada por um descarte anterior nesta sessão).
  useEffect(() => {
    liberarRascunhoLocal(draftKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [visualizacaoOS, setVisualizacaoOS] = useState<"cliente" | "prestador">("cliente");
  const [ultimaOperacaoPrestador, setUltimaOperacaoPrestador] = useState<{ data: string; valor?: number } | null>(null);
  const [escalaVinculada, setEscalaVinculada] = useState(false);
  const [diagnosticoEscala, setDiagnosticoEscala] = useState<DiagnosticoSincronizacao | null>(null);
  // M80: Financeiro sincronizado via trigger SQL — não mais via TS
  const [emRede, setEmRede] = useState(false);
  const [redeOportunidade, setRedeOportunidade] = useState<RedeOportunidade | null>(null);
  const [prestadoresCompativeis, setPrestadoresCompativeis] = useState<PrestadorCompativel[]>([]);
  // Missão A27: detalhes do aceite na Rede (prestador/veículo/data/alocação)
  const [aceiteRedeInfo, setAceiteRedeInfo] = useState<{
    prestador: string;
    placa?: string;
    tipo_veiculo?: string;
    aceite_em?: string;
    alocacao_id?: string;
  } | null>(null);
  const [carregandoRede, setCarregandoRede] = useState(false);
  const [gerandoNFSe, setGerandoNFSe] = useState(false);
  const [gerandoCTe, setGerandoCTe] = useState(false);
  const [gerandoMDFe, setGerandoMDFe] = useState(false);
  const [docFiscalExistente, setDocFiscalExistente] = useState<{ nfse: boolean; nfseId?: string; cte: boolean; cteId?: string; mdfe: boolean; mdfeId?: string }>({ nfse: false, cte: false, mdfe: false });
  const [pendenciasFiscais, setPendenciasFiscais] = useState<string[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<string>(() => rascunhoInicial?.abaAtiva || "identificacao");
  const [trackingToken, setTrackingToken] = useState<string | null>(null);
  const [gerandoLink, setGerandoLink] = useState(false);
  const [showFiscalPreview, setShowFiscalPreview] = useState(false);
  const [simulandoFocus, setSimulandoFocus] = useState(false);
  const [ibgePreview, setIbgePreview] = useState<{ origem?: string; destino?: string }>({});
  const [reversaFields, setReversaFields] = useState<ReversaFields>(() => {
    if (rascunhoInicial?.reversaFields) return rascunhoInicial.reversaFields;
    const saved = (data as any).tipo_reversa ? {
      tipo_reversa: (data as any).tipo_reversa || "sem_reversa",
      reversa_qtd_volumes: (data as any).reversa_qtd_volumes || 0,
      reversa_observacoes: (data as any).reversa_observacoes || "",
      reversa_endereco_coleta: (data as any).reversa_endereco_coleta || "",
      reversa_endereco_devolucao: (data as any).reversa_endereco_devolucao || "",
      reversa_unidade_cobranca: (data as any).reversa_unidade_cobranca || "unidade",
      reversa_valor_unitario: (data as any).reversa_valor_unitario || 0,
      reversa_qtd_coletada: (data as any).reversa_qtd_coletada || 0,
      reversa_divergencia: (data as any).reversa_divergencia || "",
      reversa_motivo_divergencia: (data as any).reversa_motivo_divergencia || "",
      reversa_responsavel: (data as any).reversa_responsavel || "",
      reversa_documento_responsavel: (data as any).reversa_documento_responsavel || "",
      reversa_telefone: (data as any).reversa_telefone || "",
      reversa_status: (data as any).reversa_status || "nao_iniciada",
      reversa_data_prevista: (data as any).reversa_data_prevista || "",
      reversa_data_realizada: (data as any).reversa_data_realizada || "",
      reversa_valor_adicional: (data as any).reversa_valor_adicional || 0,
      reversa_impacto_prestador: (data as any).reversa_impacto_prestador || 0,
      reversa_impacto_cliente: (data as any).reversa_impacto_cliente || 0,
    } : emptyReversaFields();
    return saved;
  });
  const navigate = useNavigate();
  const { tenant } = useTenant();

  // ============================================================
  // UPGRADE — ALOCAÇÃO DE PRESTADOR: seleção compartilhada entre o novo bloco
  // de Identificação e o cartão "Alocação Torre" (etapa Torre & Financeiro).
  // Observação: prestadores NÃO possui colunas veiculo_tipo/veiculo_placa —
  // o veículo vem da tabela veiculos (prestador_vinculado).
  // ============================================================
  const handleSelecionarPrestador = async (v: string | null, record: { id?: string } | null) => {
    if (emRede) { toast.warning("Desative a Rede antes de alocar diretamente"); return; }
    update("prestador", v || "");
    if (record?.id) setData((p) => ({ ...p, prestadorId: record.id }) as OrdemServico);
    if (record?.id && v) {
      try {
        const { data: veiculoPrest } = await supabase
          .from("veiculos")
          .select("tipo_veiculo, placa, tipo_carga, principal, status")
          .eq("prestador_vinculado", record.id)
          .order("principal", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (veiculoPrest) {
          const vp = veiculoPrest;
          if (vp.tipo_veiculo) update("veiculoTipo", vp.tipo_veiculo);
          if (vp.placa) update("veiculoPlaca", vp.placa);
          if (vp.tipo_carga === "refrigerada" || vp.tipo_carga === "refrigerado") update("veiculoTermica", "refrigerado");
        }
        const { data: ultimaOS } = await supabase.from("ordens_servico").select("data, valor_cliente").eq("prestador", v).order("data", { ascending: false }).limit(1).maybeSingle();
        if (ultimaOS) {
          setUltimaOperacaoPrestador({ data: ultimaOS.data, valor: ultimaOS.valor_cliente });
        }
      } catch (e) { console.warn("Erro ao buscar dados do prestador:", e); }
    }
  };

  // ============================================================
  // UPGRADE — MATCH INTELIGENTE: busca prestadores ativos com veículos
  // compatíveis com a exigência da OS e que operem na região da coleta,
  // devolvendo lista ordenada por score de compatibilidade.
  // ============================================================
  const buscarSugestoesPrestador = async () => {
    setBuscandoSugestao(true);
    try {
      const pontos = data.enderecos || [];
      const origem = pontos.find((e) => e?.tipo === "coleta" && e?.endereco?.trim()) || pontos[0];
      const ctx: CtxMatch = {
        tipoVeiculo: data.veiculoTipo || "",
        pesoKg: Number(data.carga?.peso || 0),
        m3: Number(data.carga?.cubagem || 0),
        refrigerado: normTxt(data.veiculoTermica) === "refrigerado",
        cidade: normTxt(origem?.cidade),
        uf: normTxt(origem?.estado),
      };

      const { data: lista, error } = await supabase
        .from("prestadores")
        .select("id, nome_completo, telefone, whatsapp, status, regiao_principal, regioes_secundarias, aceita_refrigerado, aceita_refrigerada, indice_aceite, avaliacao_operacional, qtd_operacoes")
        .eq("status", "ativo")
        .limit(80);
      if (error) throw error;

      const ids = (lista || []).map((p) => p.id);
      const veics = ids.length
        ? (await supabase
            .from("veiculos")
            .select("id, prestador_vinculado, tipo_veiculo, tipo, capacidade_kg, capacidade_m3, placa, status, principal")
            .in("prestador_vinculado", ids)
            .limit(300)).data || []
        : [];
      const veicsPorPrestador = new Map<string, VeiculoMatchRow[]>();
      for (const v of veics as VeiculoMatchRow[]) {
        const arr = veicsPorPrestador.get(v.prestador_vinculado) || [];
        arr.push(v);
        veicsPorPrestador.set(v.prestador_vinculado, arr);
      }

      const sugestoes = (lista || [])
        .map((p) => calcularMatchPrestador({ ...p, veiculos: veicsPorPrestador.get(p.id) || [] }, ctx))
        .filter((s): s is SugestaoPrestadorMatch => s !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

      setSugestoesPrestador(sugestoes);
      if (sugestoes.length === 0) {
        toast.info("Nenhum prestador compatível com a exigência desta OS.");
      } else {
        toast.success(`${sugestoes.length} sugest(ões) encontrada(s) — escolha abaixo.`);
      }
    } catch (e) {
      console.warn("[MatchInteligente] Erro:", e instanceof Error ? e.message : e);
      toast.error("Erro ao buscar sugestões de prestadores.");
    } finally {
      setBuscandoSugestao(false);
    }
  };

  const recalcularValores = async (distanciaKm: number, veiculoTipo: string, cliente: string) => {
    if (!veiculoTipo) return;
    const enderecoOrigem = data.enderecos?.find((e: any) => e.tipo === "coleta" || e.tipo === "origem");
    const enderecoDestino = data.enderecos?.find((e: any) => e.tipo === "entrega" || e.tipo === "destino" || e.tipo === "delivery");
    try {
      const { tabela } = await buscarTabelaValoresCliente({
        tenant_id: tenant?.id || "",
        cliente_id: data.clienteId || "",
        tipo_veiculo: veiculoTipo || "",
        tipo_operacao: "fracionado",
        distancia_km: Math.ceil(distanciaKm),
        quantidade_paradas: 1,
        origem: { endereco: enderecoOrigem?.endereco || "", bairro: enderecoOrigem?.bairro || "", cidade: enderecoOrigem?.cidade || "", uf: enderecoOrigem?.uf || enderecoOrigem?.estado || "", cep: enderecoOrigem?.cep || "" },
        destino: { endereco: enderecoDestino?.endereco || "", bairro: enderecoDestino?.bairro || "", cidade: enderecoDestino?.cidade || "", uf: enderecoDestino?.uf || enderecoDestino?.estado || "", cep: enderecoDestino?.cep || "" },
        modo: "preview",
      });
      if (tabela && (tabela.fonte === "tabelas_valores" || tabela.fonte === "universal")) {
        const calc = calcularPrecoRapido(tabela, distanciaKm);
        setData(p => ({ ...p, valorCliente: calc.valorCliente, custoPrestador: calc.valorPrestador, tabelaAplicada: tabela.nome || "Tabela Padrão", faixaAplicada: calc.descricao }));
        setFaixaCalculada(calc.descricao);
      } else {
        console.warn("[OrdemServicoForm] Nenhuma tabela ativa encontrada para", veiculoTipo, distanciaKm);
        setFaixaCalculada("Tabela não encontrada");
      }
    } catch (e) {
      console.error("[OrdemServicoForm] Erro recalcularValores:", e);
      setFaixaCalculada("Erro ao consultar tabela");
    }
  };

  // UPGRADE — PEDÁGIO: aplica o valor monetário vindo da API de rota (Maplink/
  // Google Routes — DistanceResult.pedagio) quando disponível; caso contrário
  // mantém o valor atual e sinaliza "não identificado" (inserção manual na UI).
  const aplicarPedagioDaRota = (rota: { pedagio?: number; pedagioProvider?: string; distanciaKm?: number; duracaoMin?: number; distanciaTexto?: string; duracaoTexto?: string; provider?: string } | null | undefined) => {
    if (typeof rota?.pedagio === "number" && rota.pedagio > 0) {
      const valor = rota.pedagio;
      setData(p => ({ ...p, pedagio: valor }));
      setPedagioInfo({ fonte: "api", provider: rota.pedagioProvider || "routes", atualizadoEm: new Date().toISOString() });
      toast.success(`Pedágio identificado pela API: R$ ${valor.toFixed(2)}`);
    } else if (!(data.pedagio > 0)) {
      setPedagioInfo({ fonte: "nao_identificado" });
    }
  };

 const calculaRotaEValor = async () => {
    try {
      const enderecos = data.enderecos ?? [];
      const origem = (enderecos ?? []).find(e => e?.tipo === "coleta" && e?.endereco?.trim()) || (enderecos ?? []).find(e => e?.endereco?.trim());
      const destino = [...(enderecos ?? [])].reverse().find(e => e?.tipo === "entrega" && e?.endereco?.trim()) || (enderecos ?? [])[(enderecos?.length ?? 1) - 1];
      
      if (!origem || !destino || !origem.endereco || !destino.endereco) {
        return;
      }
      
      setCalculandoDistancia(true);
      toast.info("Calculando rotas disponiveis...");

      const alternativas = await calcularRotasAlternativas(origem.endereco, destino.endereco);

      if (alternativas) {
        setDistanciasAlternativas(alternativas);

        const rotaUsar = alternativas.operacional || alternativas.rapida || alternativas.curta;
        if (!rotaUsar) {
          toast.error("Nao foi possivel calcular as rotas.");
          return;
        }

        setDistanciaRota(rotaUsar);
        setRotaSelecionada("operacional");
        setData(p => ({ ...p, distanciaKm: rotaUsar.distanciaKm, tempoEstimado: rotaUsar.duracaoTexto, tipoRota: "operacional", distanciaAlternativas: { rapida: alternativas.rapida, curta: alternativas.curta, operacional: alternativas.operacional } }));
        aplicarPedagioDaRota(rotaUsar);

        recalcularValores(rotaUsar.distanciaKm, data.veiculoTipo, data.cliente);
        toast.success(`Rotas calculadas: ${alternativas.rapida?.distanciaTexto || '—'} (rapida) | ${alternativas.curta?.distanciaTexto || '—'} (curta)`);
      } else {
        const resultado = await calcularDistancia(origem.endereco, destino.endereco);
        if (!resultado) {
          toast.error("Nao foi possivel calcular a rota.");
          return;
        }
        setDistanciaRota(resultado);
        setRotaSelecionada("rapida");
        setData(p => ({ ...p, distanciaKm: resultado.distanciaKm, tempoEstimado: resultado.duracaoTexto, tipoRota: "rapida" }));
        aplicarPedagioDaRota(resultado);
        recalcularValores(resultado.distanciaKm, data.veiculoTipo, data.cliente);
        toast.success(`Rota calculada: ${resultado.distanciaTexto}`);
      }
    } catch (e) {
      console.error("Erro no calculo automatico:", e);
      toast.error("Erro ao calcular rota: " + (e instanceof Error ? e.message : "Erro desconhecido"));
    } finally {
      setCalculandoDistancia(false);
    }
  };

  const handleTrocarRota = (tipo: TipoRota) => {
    setRotaSelecionada(tipo);
    const alts = distanciasAlternativas;
    let rota: { distanciaKm: number; duracaoMin: number; distanciaTexto: string; duracaoTexto: string } | null = null;
    if (alts) {
      if (tipo === "rapida") rota = alts.rapida;
      else if (tipo === "curta") rota = alts.curta;
      else rota = alts.operacional;
    }
    if (rota) {
      setDistanciaRota(rota);
      setData(p => ({ ...p, distanciaKm: rota!.distanciaKm, tempoEstimado: rota!.duracaoTexto, tipoRota: tipo }));
      aplicarPedagioDaRota(rota);
      if (!data.valorClienteEditado && !data.custoPrestadorEditado) {
        recalcularValores(rota!.distanciaKm, data.veiculoTipo, data.cliente);
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(calculaRotaEValor, 2000);
    return () => clearTimeout(timer);
  }, [data.enderecos, data.veiculoTipo, data.cliente]);

  useEffect(() => {
    osInicialRef.current = data;
  }, [os]);

  useEffect(() => {
    if (data.id) {
      diagnosticarOS(data.id).then((diag) => {
        setDiagnosticoEscala(diag);
        setEscalaVinculada(diag.existeAlocacao);
      }).catch(() => {
        setDiagnosticoEscala(null);
        setEscalaVinculada(false);
      });
    }
  }, [data.id]);

  // Verificar se OS está na Rede
  useEffect(() => {
    if (!data.id) return;
    obterOportunidadePorOS(data.id).then((res) => {
      if (res.sucesso && res.oportunidade) {
        setRedeOportunidade(res.oportunidade);
        setEmRede(res.oportunidade.status !== "cancelada" && res.oportunidade.status !== "expirada");
        if (res.oportunidade.status === "publicada" || res.oportunidade.status === "visualizada") {
          buscarPrestadoresCompativeis(res.oportunidade.id).then((r) => {
            if (r.sucesso && r.prestadores) setPrestadoresCompativeis(r.prestadores);
          });
        }
      }
    });
  }, [data.id]);

  // Missão A27: detalhes do aceite na Rede (prestador/veículo/data/alocação)
  useEffect(() => {
    if (!data.id || !redeOportunidade || redeOportunidade.status !== "aceita") {
      setAceiteRedeInfo(null);
      return;
    }
    let ativo = true;
    (async () => {
      try {
        const [alocRes, prestRes, veicRes] = await Promise.all([
          supabase
            .from("alocacoes_escala")
            .select("id, placa, tipo_veiculo, data_aceite")
            .eq("ordem_servico_id", data.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          redeOportunidade.prestador_aceite_id
            ? supabase
                .from("prestadores")
                .select("nome_completo")
                .eq("id", redeOportunidade.prestador_aceite_id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          redeOportunidade.prestador_aceite_id
            ? supabase
                .from("veiculos")
                .select("placa, tipo_veiculo")
                .eq("prestador_vinculado", redeOportunidade.prestador_aceite_id)
                .order("placa", { ascending: true })
                .limit(1)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        if (!ativo) return;
        setAceiteRedeInfo({
          prestador: prestRes.data?.nome_completo || "—",
          placa: alocRes.data?.placa || veicRes.data?.placa || undefined,
          tipo_veiculo: alocRes.data?.tipo_veiculo || veicRes.data?.tipo_veiculo || undefined,
          aceite_em: alocRes.data?.data_aceite || redeOportunidade.aceite_em || undefined,
          alocacao_id: alocRes.data?.id || undefined,
        });
      } catch (e) {
        console.warn("Erro ao buscar detalhes do aceite da Rede:", e);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [data.id, redeOportunidade]);

  // MISSAO 04.1: Protecao contra perda de dados nao salvos
  useEffect(() => {
    if (!initialDataRef.current) {
      initialDataRef.current = JSON.stringify(data);
      return;
    }
    const changed = JSON.stringify(data) !== initialDataRef.current;
    setFormDirty(changed);
  }, [data]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (formDirty) {
        if (draftRef.current) gravarRascunhoLocal(draftKey, draftRef.current);
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [formDirty, draftKey]);

  // ETAPA-1: avisa quando um rascunho local é restaurado
  useEffect(() => {
    if (modo !== "ver" && rascunhoInicial?.data) {
      toast.info("Rascunho local restaurado", {
        description: "Os dados não salvos desta OS foram recuperados automaticamente.",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ETAPA-1: normaliza Peso/Volume no carregamento de OS vindas do banco
  useEffect(() => {
    if (readOnly) return;
    const peso = Number(data.carga?.peso) || 0;
    const volumes = Number(data.carga?.volumes) || 0;
    const pesoPorVolume = Number(data.carga?.pesoPorVolume) || 0;
    if (!pesoPorVolume && peso > 0 && volumes > 0) {
      setData((p) => ({ ...p, carga: { ...p.carga, pesoPorVolume: arredondar(peso / volumes, 3) } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AUTO-SAVE (localStorage): persiste silenciosamente a cada alteração real.
  // Não grava um formulário "virgem" sem edição (evita rascunhos vazios).
  useEffect(() => {
    if (readOnly) return;
    if (!formDirty && !rascunhoInicial) return;
    draftRef.current = { data, reversaFields, abaAtiva, savedAt: new Date().toISOString() };
    const timer = setTimeout(() => {
      if (draftRef.current) gravarRascunhoLocal(draftKey, draftRef.current);
    }, 400);
    return () => clearTimeout(timer);
  }, [data, reversaFields, abaAtiva, readOnly, draftKey, formDirty, rascunhoInicial]);

  // ETAPA-1: grava o rascunho também ao desmontar (trocar de OS/aba do painel)
  useEffect(() => {
    return () => {
      if (draftRef.current) gravarRascunhoLocal(draftKey, draftRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (!data.id) {
      setDocFiscalExistente({ nfse: false, cte: false, mdfe: false });
      return;
    }
    (async () => {
      try {
        const [nfseRes, cteRes] = await Promise.all([
          supabase.from("fiscal_nfse").select("id").eq("ordem_servico_id", data.id).in("status", ["rascunho", "processando", "autorizado"]).limit(1),
          supabase.from("fiscal_ctes").select("id").eq("ordem_servico_id", data.id).in("status", ["rascunho", "processando", "autorizado"]).limit(1),
        ]);
        const nfse = !!(nfseRes.data && nfseRes.data.length > 0);
        const nfseId = nfse ? nfseRes.data![0].id : undefined;
        const cte = !!(cteRes.data && cteRes.data.length > 0);
        const cteId = cte ? cteRes.data![0].id : undefined;
        let mdfe = false;
        let mdfeId: string | undefined;
        if (cteRes.data && cteRes.data.length > 0) {
          const cteLookupId = cteRes.data[0].id;
          const { data: mdfeRes } = await supabase.from("fiscal_mdfes").select("id, metadata").in("status", ["rascunho", "processando", "autorizado"]);
          const mdfeFound = (mdfeRes || []).find((m: any) => {
            const vinculados: { cte_id: string }[] = m.metadata?.ctes_vinculados || [];
            return vinculados.some((v) => v.cte_id === cteLookupId);
          });
          if (mdfeFound) {
            mdfe = true;
            mdfeId = mdfeFound.id;
          }
        }
        setDocFiscalExistente({ nfse, nfseId, cte, cteId, mdfe, mdfeId });
      } catch {
        setDocFiscalExistente({ nfse: false, cte: false, mdfe: false });
      }
    })();
  }, [data.id]);

  // TEMPLATE 1 — RESUMO DA ROTA (privacidade: sem número da porta).
  const copiarWhatsApp = () => {
    const msg = gerarMensagemWhatsAppOS(data);
    navigator.clipboard.writeText(msg);
    toast.success("Resumo da rota copiado!");
  };

  // TEMPLATE 2 — ORIENTAÇÃO DE EXECUÇÃO (OS completa).
  const copiarOrientacaoExecucao = () => {
    const msg = gerarMensagemOrientacaoExecucao(data);
    navigator.clipboard.writeText(msg);
    toast.success("Orientação de execução copiada!");
  };

  // WHATSAPP DO CLIENTE / DESTINATÁRIO — link de rastreio.
  const mensagemClienteRastreio = () =>
    gerarMensagemWhatsAppClienteRastreio({ numeroOS: data.numero, osId: data.id });

  const copiarWhatsAppClienteRastreio = () => {
    navigator.clipboard.writeText(mensagemClienteRastreio());
    toast.success("Mensagem de rastreio do cliente copiada!");
  };

  const abrirWhatsAppClienteRastreio = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(mensagemClienteRastreio())}`,
      "_blank",
    );
  };

  const handleGerarLinkRastreio = async () => {
    if (!data.id) { toast.error("Salve a OS antes de gerar o link"); return; }
    setGerandoLink(true);
    try {
      const result = await gerarLinkRastreio(data.id);
      if (result) {
        setTrackingToken(result.token);
        toast.success("Link de rastreio gerado com sucesso!");
      } else {
        toast.error("Erro ao gerar link de rastreio");
      }
    } catch {
      toast.error("Erro ao gerar link de rastreio");
    }
    setGerandoLink(false);
  };

  const enviarWhatsAppPrestador = async () => {
    if (!data.prestador) {
      toast.error("Selecione um prestador antes de enviar via WhatsApp");
      return;
    }

    setEnviandoWhatsApp(true);
    const startTime = Date.now();

    try {
      const { data: prestadores } = await supabase
        .from("prestadores")
        .select("telefone")
        .eq("nome_completo", data.prestador)
        .limit(1);

      if (!prestadores || prestadores.length === 0 || !prestadores[0].telefone) {
        toast.error("Telefone do prestador não encontrado");
        await registrarLog({
          tipo: 'whatsapp',
          acao: 'enviar_os_prestador',
          status: 'erro',
          mensagem: 'Telefone do prestador não encontrado',
          payload: { prestador: data.prestador, os: data.numero }
        });
        return;
      }

      const telefone = prestadores[0].telefone.replace(/\D/g, '');
      const msg = gerarMensagemWhatsAppOS(data);

      const result = await WhatsAppEnviar(telefone, msg);

      const duracao = Date.now() - startTime;

      if (result.ok) {
        toast.success(`Mensagem enviada para ${data.prestador}!`);
        await registrarLog({
          tipo: 'whatsapp',
          acao: 'enviar_os_prestador',
          status: 'sucesso',
          mensagem: `OS ${data.numero} enviada para prestador`,
          payload: { prestador: data.prestador, telefone, os: data.numero },
          duracaoMs: duracao
        });
      } else {
        toast.error(`Falha ao enviar: ${result.error}`);
        await registrarLog({
          tipo: 'whatsapp',
          acao: 'enviar_os_prestador',
          status: 'erro',
          mensagem: result.error || 'Erro desconhecido',
          payload: { prestador: data.prestador, os: data.numero },
          erro: result.error,
          duracaoMs: duracao
        });
      }
    } catch (e: any) {
      await registrarLog({
        tipo: 'whatsapp',
        acao: 'enviar_os_prestador',
        status: 'erro',
        mensagem: e.message || 'Erro ao enviar WhatsApp',
        payload: { prestador: data.prestador, os: data.numero },
        erro: e
      });
      toast.error("Erro ao enviar WhatsApp");
    } finally {
      setEnviandoWhatsApp(false);
    }
  };

  const handleEnviarParaRede = async () => {
    if (!data.id) { toast.error("Salve a OS antes de enviar para Rede"); return; }
    if (data.prestador) { toast.error("OS já possui prestador alocado"); return; }
    if (data.custoPrestador <= 0) { toast.error("Calcule os valores antes de enviar para Rede"); return; }
    setCarregandoRede(true);
    try {
      const res = await publicarOportunidade({
        os_id: data.id,
        valor_prestador: data.custoPrestador,
        veiculo_necessario: {
          tipo: data.veiculoTipo || "",
          carroceria: data.veiculoCarroceria || "",
          termica: data.veiculoTermica || "seco",
          capacidade_kg: data.carga?.peso || 0,
        },
        regiao: data.enderecos?.find(e => e.tipo === "coleta")?.cidade || "",
        prazo_expiracao: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      if (res.sucesso && res.oportunidade) {
        setRedeOportunidade(res.oportunidade);
        setEmRede(true);
        toast.success("OS enviada para Rede de Prestadores!");
        const compRes = await buscarPrestadoresCompativeis(res.oportunidade.id);
        if (compRes.sucesso && compRes.prestadores) {
          setPrestadoresCompativeis(compRes.prestadores);
          toast.info(`${compRes.prestadores.length} prestadores compatíveis encontrados`);
        }
      } else {
        toast.error(res.erro || "Erro ao publicar oportunidade");
      }
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setCarregandoRede(false);
    }
  };

  const handleCancelarRede = async () => {
    if (!redeOportunidade) return;
    const res = await cancelarOportunidade(redeOportunidade.id);
    if (res.sucesso) {
      setEmRede(false);
      setRedeOportunidade(null);
      setPrestadoresCompativeis([]);
      toast.success("Oportunidade cancelada");
    } else {
      toast.error(res.erro || "Erro ao cancelar");
    }
  };

  const handleAtualizarCompativeis = async () => {
    if (!redeOportunidade) return;
    setCarregandoRede(true);
    const res = await buscarPrestadoresCompativeis(redeOportunidade.id);
    if (res.sucesso && res.prestadores) {
      setPrestadoresCompativeis(res.prestadores);
      toast.success(`${res.prestadores.length} prestadores compatíveis`);
    }
    setCarregandoRede(false);
  };

  const update = (field: keyof OrdemServico, value: any) => setData(p => ({ ...p, [field]: value ?? (typeof p[field] === 'number' ? 0 : '') }));
  const updateCarga = (field: keyof OSCarga, value: any) => {
    const cargaBase = { ...data.carga, [field]: value ?? (typeof (data.carga as any)[field] === 'number' ? 0 : '') };
    const novaCarga = aplicarCalculoPesoBidirecional(cargaBase, field);
    setData(p => ({ ...p, carga: novaCarga }));
    
    const calcCubagem = calcularCubagem({
      peso: Number(novaCarga.peso) || 0,
      volumes: Number(novaCarga.volumes) || 0,
      comprimento: Number(novaCarga.comprimento) || 0,
      largura: Number(novaCarga.largura) || 0,
      altura: Number(novaCarga.altura) || 0,
      cubagem: Number(novaCarga.cubagem) || 0,
      tipo: novaCarga.tipo as any
    });
    setResultadoCubagem(calcCubagem);
    
    const alertas = verificarAlertasCubagem({
      peso: Number(novaCarga.peso) || 0,
      volumes: Number(novaCarga.volumes) || 0,
      comprimento: Number(novaCarga.comprimento) || 0,
      largura: Number(novaCarga.largura) || 0,
      altura: Number(novaCarga.altura) || 0,
      tipo: novaCarga.tipo as any
    }, calcCubagem);
    setAlertasCubagem(alertas);
    
    const novasSugestoes = sugerirVeiculosPorCarga({
      peso: Number(novaCarga.peso) || 0,
      volumes: Number(novaCarga.volumes) || 0,
      comprimento: Number(novaCarga.comprimento) || 0,
      largura: Number(novaCarga.largura) || 0,
      altura: Number(novaCarga.altura) || 0,
      // Usa a cubagem CALCULADA (dimensões × volumes) quando não houver valor
      // manual — antes a sugestão ignorava a cubagem real e escolhia só por peso.
      cubagem: calcCubagem.cubagemTotal,
      tipo: novaCarga.tipo as any
    });
    setSugestoesVeiculo(novasSugestoes);
    
    if (novasSugestoes.length > 0 && novasSugestoes[0].adequado) {
      setSugestaoVeiculo(novasSugestoes[0]);
      setData(p => ({ ...p, veiculoTipo: novasSugestoes[0].tipo }));
    } else {
      setSugestaoVeiculo(null);
    }
  };

  // ETAPA-4 — Pedágio detalhado por praça (jsonb carga.pedagios, sem migration).
  const pedagiosDetalhe = data.carga?.pedagios || [];
  const updatePedagios = (lista: { praca: string; valor: number }[]) =>
    setData((p) => ({ ...p, carga: { ...p.carga, pedagios: lista } }));

  // ETAPA-2: atualização do Portador Externo/Avulso (persistido em carga.portadorExterno)
  const portadorExterno: PortadorExterno = data.carga?.portadorExterno || emptyPortadorExterno();
  const updatePortador = (field: keyof PortadorExterno, value: any) => {
    setData((p) => ({
      ...p,
      carga: {
        ...p.carga,
        portadorExterno: {
          ...(p.carga?.portadorExterno || emptyPortadorExterno()),
          [field]: value,
        },
      },
    }));
  };

  // ETAPA-3 — Novo menu de prestadores: Cadastrado | Enviar para a Rede | Externo / Avulso.
  // A escolha é refletida nos flags persistidos (`carga.portadorExterno.ativo` e Rede).
  type ModoAlocacao = "cadastrado" | "rede" | "externo";
  const [modoAlocacao, setModoAlocacao] = useState<ModoAlocacao>(
    data.carga?.portadorExterno?.ativo ? "externo" : "cadastrado",
  );

  useEffect(() => {
    if (emRede) {
      setModoAlocacao("rede");
      return;
    }
    setModoAlocacao(data.carga?.portadorExterno?.ativo ? "externo" : "cadastrado");
  }, [emRede, data.carga?.portadorExterno?.ativo]);

  // Alocar um prestador cadastrado desativa o portador externo (estados exclusivos).
  useEffect(() => {
    if (data.prestador && data.carga?.portadorExterno?.ativo) {
      setData((p) => ({
        ...p,
        carga: {
          ...p.carga,
          portadorExterno: { ...(p.carga?.portadorExterno || emptyPortadorExterno()), ativo: false },
        },
      }));
    }
  }, [data.prestador, data.carga?.portadorExterno?.ativo]);

  const selecionarModoAlocacao = (modo: ModoAlocacao) => {
    if (readOnly) return;
    if (modo !== "rede" && emRede) {
      toast.warning("Cancele a publicação na Rede antes de alterar a alocação (aba Torre & Financeiro).");
      return;
    }
    setModoAlocacao(modo);
    if (modo === "externo") {
      updatePortador("ativo", true);
      if (data.prestador) {
        setData((p) => ({ ...p, prestador: "", veiculoPlaca: "", prestadorId: "" }) as OrdemServico);
      }
    } else {
      updatePortador("ativo", false);
    }
  };

  const sanitizeOrdemServicoPayload = (rawPayload: Record<string, any>): { payload: Record<string, any>; removed: string[] } => {
    const removed: string[] = [];
    const payloadSeguro: Record<string, any> = {};

    for (const key of Object.keys(rawPayload)) {
      const value = rawPayload[key];
      if (value === undefined) {
        removed.push(key);
        continue;
      }
      payloadSeguro[key] = value;
    }

    console.log("[OS SAVE] Payload original:", rawPayload);
    console.log("[OS SAVE] Payload final enviado:", payloadSeguro);
    console.log("[OS SAVE] Campos removidos:", removed);

    return { payload: payloadSeguro, removed };
  };

  const STATUS_TRANSICOES_VALIDAS: Record<string, string[]> = {
    em_analise: ["rascunho", "pendente", "cancelada"],
    rascunho: ["pendente", "cancelada"],
    pendente: ["agendada", "cancelada"],
    agendada: ["em_andamento", "em_rota", "cancelada"],
    em_andamento: ["coletado", "em_rota", "ocorrencia", "cancelada"],
    em_rota: ["coletado", "entregue", "ocorrencia", "cancelada"],
    coletado: ["entregue", "em_rota", "ocorrencia", "cancelada"],
    entregue: ["finalizada", "ocorrencia"],
    finalizada: [],
    cancelada: [],
    ocorrencia: ["em_rota", "coletado", "entregue", "finalizada"],
  };

  const handleSalvar = async () => {
    try {
      setIsSaving(true);

      const statusFinal = statusOverrideRef.current || data.status;
      statusOverrideRef.current = null;

      if (!data.cliente && !data.clienteId) {
        toast.error("Selecione um cliente para a OS");
        setIsSaving(false);
        return;
      }
      if (!data.tipoOperacao) {
        toast.error("Selecione o tipo de operação");
        setIsSaving(false);
        return;
      }
      const enderecosValidos = data.enderecos?.filter(e => e.endereco?.trim());
      if (!enderecosValidos?.length) {
        toast.error("Adicione pelo menos um endereço de coleta/entrega");
        setIsSaving(false);
        return;
      }
      if (!enderecosValidos.some(e => e.tipo === "coleta")) {
        toast.error("Adicione um endereço de coleta");
        setIsSaving(false);
        return;
      }
      if (!enderecosValidos.some(e => e.tipo === "entrega")) {
        toast.error("Adicione um endereço de entrega");
        setIsSaving(false);
        return;
      }

      if (data.status === "finalizada" && !data.prestador && !portadorExterno.ativo) {
        toast.error("Informe um prestador antes de finalizar a OS");
        setIsSaving(false);
        return;
      }

      if (portadorExterno.ativo) {
        if (!portadorExterno.nome?.trim()) {
          toast.error("Informe o nome completo do prestador externo");
          setIsSaving(false);
          return;
        }
        if (!portadorExterno.placaMoto?.trim()) {
          toast.error("Informe a placa do veículo do prestador externo");
          setIsSaving(false);
          return;
        }
      }

      if (data.id) {
        const statusAnterior = osInicialRef.current.status;
        const statusNovo = data.status;
        if (statusAnterior && statusNovo !== statusAnterior) {
          const permitidas = STATUS_TRANSICOES_VALIDAS[statusAnterior] || [];
          if (!permitidas.includes(statusNovo)) {
            toast.error(`Transição de status inválida: "${statusAnterior}" → "${statusNovo}" não é permitida`);
            setIsSaving(false);
            return;
          }
          if (statusNovo === "cancelada" && data.statusFaturamento && ["faturada", "paga"].includes(data.statusFaturamento)) {
            toast.error("Não é possível cancelar uma OS com faturamento já faturado/pago");
            setIsSaving(false);
            return;
          }
        }
      } else {
        if (data.status !== "rascunho" && data.status !== "em_analise" && data.status !== "pendente") {
          toast.error("OS nova deve iniciar como Em análise, Rascunho ou Pendente");
          setIsSaving(false);
          return;
        }
      }

      if (!data.id && data.numero) {
        const { data: osExistente } = await supabase
          .from("ordens_servico")
          .select("id")
          .eq("numero", data.numero)
          .maybeSingle();
        if (osExistente) {
          toast.error(`Já existe uma OS com o número "${data.numero}". Recarregue para gerar um novo.`);
          setIsSaving(false);
          return;
        }
      }

      if (data.id && osInicialRef.current.aceiteMotorista) {
        if (data.prestador !== osInicialRef.current.prestador) {
          toast.warning("Prestador alterado em OS com aceite de motorista. Verifique se a reatribuição é necessária.");
        }
        if (data.veiculoPlaca !== osInicialRef.current.veiculoPlaca) {
          toast.warning("Veículo alterado em OS com aceite de motorista. Notifique o motorista sobre a mudança.");
        }
      }

      const rawPayload = data.id ? toOSUpdate(data) : toOSInsert(data);
      
      const { payload: sanitizedPayload, removed } = sanitizeOrdemServicoPayload(rawPayload);

      // Aplicar override de status (ex: "Salvar rascunho" força status="rascunho")
      if (statusFinal !== data.status) {
        sanitizedPayload.status = statusFinal;
      }

      // Adicionar campos de coleta reversa
      if (reversaFields.tipo_reversa !== "sem_reversa" || data.tipoOperacao === "Coleta Reversa") {
        sanitizedPayload.tipo_reversa = reversaFields.tipo_reversa;
        sanitizedPayload.reversa_qtd_volumes = reversaFields.reversa_qtd_volumes;
        sanitizedPayload.reversa_observacoes = reversaFields.reversa_observacoes;
      }

      // Bloquear criação se cliente estiver inadimplente
      const clienteIdCheck = data.clienteId || sanitizedPayload?.cliente_id;
      if (!data.id && clienteIdCheck) {
        const inadimplencia = await verificarInadimplenciaCliente(clienteIdCheck);
        if (inadimplencia.inadimplente) {
          toast.error(`Cliente inadimplente: ${inadimplencia.mensagem}`);
          setIsSaving(false);
          return;
        }
      }

      const { data: dbResult, error } = data.id 
        ? await supabase.from("ordens_servico").update(sanitizedPayload).eq("id", data.id).select().single()
        : await supabase.from("ordens_servico").insert([sanitizedPayload]).select().single();

      if (error) throw error;
      const savedOS = dbResult;

      // Sincronizar com Escala automaticamente
      try {
        let prestadorId = (data as any).prestadorId || null;
        if (!prestadorId && data.prestador) {
          const { data: prestData } = await supabase
            .from("prestadores")
            .select("id")
            .eq("nome_completo", data.prestador)
            .limit(1)
            .maybeSingle();
          if (prestData) prestadorId = prestData.id;
        }

        const dadosSync = {
          ...data,
          id: savedOS?.id || data.id,
          prestador_id: prestadorId,
        };

        const resultadoEscala = await sincronizarComEscala(dadosSync);

        if (resultadoEscala.sucesso) {
          const acaoLabel = resultadoEscala.acao === "criada" ? "criada" : "atualizada";
          setEscalaVinculada(true);
          if (savedOS?.id) {
            const diag = await diagnosticarOS(savedOS.id);
            setDiagnosticoEscala(diag);
          }
          if (resultadoEscala.acao !== "ignorada") {
            toast.success(`Programação ${acaoLabel} para OS ${data.numero}`);
          }
        } else {
          console.warn("[SincronizacaoEscala] Falha na sincronização:", resultadoEscala.erro);
          toast.warning(`Programação não atualizada: ${resultadoEscala.erro}`);
        }
      } catch (e: any) {
        console.error("[SincronizacaoEscala] Falha na sincronização automática:", e.message);
        toast.error(`Erro ao sincronizar programação: ${e.message}`);
      }

      toast.success("Ordem de Serviço salva com sucesso!");
      setFormDirty(false);
      initialDataRef.current = JSON.stringify(data);
      // Baseline do guard = estado salvo (evita prompt indevido ao navegar depois).
      exitGuard.markClean();
      // AUTO-SAVE: descarta o rascunho local após salvar com sucesso
      draftRef.current = null;
      limparRascunhoLocal(draftKey);

      if (enviarWhatsAppAuto && data.prestador) {
        setEnviandoWhatsApp(true);
        try {
          const { data: prestadores } = await supabase
            .from("prestadores")
            .select("telefone")
            .eq("nome_completo", data.prestador)
            .limit(1);

          if (prestadores && prestadores.length > 0 && prestadores[0].telefone) {
            const telefone = prestadores[0].telefone.replace(/\D/g, '');
            const msg = gerarMensagemWhatsAppOS(data);
            const result = await WhatsAppEnviar(telefone, msg);
            
            if (result.ok) {
              toast.success(`WhatsApp enviado para ${data.prestador}!`);
              await registrarLog({
                tipo: 'whatsapp',
                acao: 'enviar_os_auto',
                status: 'sucesso',
                mensagem: `OS ${data.numero} enviada automaticamente`,
                payload: { prestador: data.prestador, telefone, os: data.numero }
              });
            } else {
              toast.error(`Falha ao enviar WhatsApp: ${result.error}`);
              await registrarLog({
                tipo: 'whatsapp',
                acao: 'enviar_os_auto',
                status: 'erro',
                mensagem: result.error || 'Erro ao enviar',
                payload: { prestador: data.prestador, os: data.numero },
                erro: result.error
              });
            }
          }
        } catch (e: any) {
          toast.error("Erro ao enviar WhatsApp: " + e.message);
        } finally {
          setEnviandoWhatsApp(false);
        }
      }

      const isNovaOS = !data.id;
      const tipoEvento = isNovaOS ? "OS_CRIADA" : "OS_ATUALIZADA";

      const enderecos = data.enderecos || [];
      const coleta = enderecos.find(e => e.tipo === "coleta");
      const entrega = [...enderecos].reverse().find(e => e.tipo === "entrega");

      const telefoneCliente = data.whatsappDestinatario || coleta?.telefone || "";
      const telefonePrestador = "";

      const automacaoResult = await disparaEventoAutomacao(
        "operacional",
        tipoEvento,
        {
          cliente: data.cliente,
          prestador: data.prestador,
          origem: coleta?.endereco || "",
          destino: entrega?.endereco || "",
          km: data.distanciaKm || data.distanciaRota?.distanciaKm || 0,
          tipoVeiculo: data.veiculoTipo,
          tipoCarga: data.carga?.tipo || "",
          valorCliente: data.valorCliente,
          valorPrestador: data.custoPrestador,
          status: data.status,
          telefoneCliente: telefoneCliente,
          telefonePrestador: telefonePrestador
        },
        {
          osId: savedOS?.id || data.id || "",
          telefoneCliente: telefoneCliente.replace(/\D/g, ""),
          telefonePrestador: telefonePrestador.replace(/\D/g, "")
        }
      );

      if (automacaoResult.sucesso) {
        console.log(`[AutomacaoCentral] ${tipoEvento} disparada com sucesso`);
      } else {
        console.warn(`[AutomacaoCentral] ${tipoEvento} falhou: ${automacaoResult.erro}`);
      }

      if (isNovaOS && telefoneCliente) {
        await enviarWebhookWhatsAppOSCriada(
          telefoneCliente,
          {
            origem: coleta?.endereco || "",
            destino: entrega?.endereco || "",
            cliente: data.cliente,
            numeroOS: data.numero
          }
        );
      }

      const msgContext = {
        numero: data.numero,
        cliente: data.cliente,
        origem: coleta?.endereco || "",
        destino: entrega?.endereco || "",
        prestador: data.prestador,
        status: data.status,
        placa: data.veiculoPlaca,
      };

      const osInicial = osInicialRef.current;
      const prestadorMudou = !!data.prestador && data.prestador !== osInicial.prestador;
      const statusFinalizada = data.status === "finalizada" && osInicial.status !== "finalizada";
      const statusOcorrencia = data.status === "ocorrencia" && osInicial.status !== "ocorrencia";
      const telefoneDestino = telefoneCliente || "5511912133010";

      enviarWhatsAppAutomatico({
        telefone: telefoneDestino,
        mensagem: isNovaOS ? gerarMensagemOSCriada(msgContext) : gerarMensagemOSAtualizada(msgContext),
      });

      if (prestadorMudou) {
        enviarWhatsAppAutomatico({
          telefone: telefoneDestino,
          mensagem: gerarMensagemPrestadorAcionado(msgContext),
        });
      }

      if (statusFinalizada) {
        enviarWhatsAppAutomatico({
          telefone: telefoneDestino,
          mensagem: gerarMensagemOSFinalizada(msgContext),
        });
      }

      if (statusOcorrencia) {
        enviarWhatsAppAutomatico({
          telefone: telefoneDestino,
          mensagem: gerarMensagemOcorrenciaOS(msgContext),
        });
      }

      onSalvar();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSalvarRascunho = () => {
    statusOverrideRef.current = "rascunho";
    handleSalvar();
  };

  const MOTIVOS_AJUSTE = [
    "Cliente autorizou valor diferente",
    "Veiculo substituido",
    "Operacao especial",
    "Ajuste comercial",
    "Outro",
  ];

  const confirmarAjusteManual = () => {
    if (!motivoAjusteManual.trim()) {
      toast.error("Informe o motivo do ajuste manual");
      return;
    }
    setData(p => ({
      ...p,
      motivoAjusteManual: motivoAjusteManual.trim(),
      usuarioAjusteManual: "Operador",
      dataAjusteManual: new Date().toISOString(),
    }));
    setShowMotivoDialog(false);
    toast.success("Ajuste manual registrado");
  };

  const etapasDoc = obterDocStepsOS(data, alertasCubagem, pendenciasFiscais);
  const idxAbaAtual = etapasDoc.findIndex((s) => s.value === abaAtiva);
  const temProximaEtapa = idxAbaAtual >= 0 && idxAbaAtual < etapasDoc.length - 1;
  const handleAvancarEtapa = () => {
    const proxima = etapasDoc[idxAbaAtual + 1];
    if (proxima) setAbaAtiva(proxima.value);
  };

  // ETAPA-4.1 — "Voltar" do rodapé retrocede UMA etapa do wizard. O alerta de
  // descarte só aparece quando não há etapa anterior (saída real do formulário).
  const handleVoltarEtapa = () => {
    const anterior = idxAbaAtual > 0 ? etapasDoc[idxAbaAtual - 1] : null;
    if (anterior) {
      setAbaAtiva(anterior.value);
      return;
    }
    void handleVoltar();
  };

  return (
    <PremiumDocumentDialog>
      {/* Cabeçalho fixo do formulário premium */}
      <PremiumDialogHeader onClose={handleVoltar}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button variant="outline" size="icon" onClick={handleVoltar} title="Voltar" className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm font-extrabold text-slate-800 truncate">
                {modo === "novo" ? "Nova Ordem de Serviço" : "Ordem de Serviço"} <span className="text-primary">{data.numero || "—"}</span>
              </h1>
              <Badge className={`${obterClasseBadgeGlobal(obterStatusGlobalOS(data.status))} text-[10px] shrink-0`}>
                {STATUS_GLOBAL_INFO[obterStatusGlobalOS(data.status)].label}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              {clienteNomeExibicao || data.cliente || "Cliente não definido"} • {data.unidade || "Unidade não definida"} • {data.tipoOperacao || "Tipo de operação não definida"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* ETAPA-2: copiar mensagem padronizada durante a gestão (novo/editar) */}
          {modo !== "ver" && (
            <>
              <Button variant="outline" className="border-green-200 text-green-600 hover:bg-green-50" onClick={copiarWhatsApp}>
                <CopyIcon className="w-4 h-4 mr-2" /> Copiar WhatsApp
              </Button>
              <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={copiarOrientacaoExecucao}>
                <ListChecks className="w-4 h-4 mr-2" /> Copiar Orientação (OS Completa)
              </Button>
              <Button variant="outline" className="border-blue-200 text-blue-600 hover:bg-blue-50" onClick={copiarWhatsAppClienteRastreio}>
                <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp Cliente (Rastreio)
              </Button>
            </>
          )}
          {/* Botões de visualização - só aparecem após salvar (data.id existe) */}
          {modo === "ver" && data.id && (
            <div className="flex gap-2 items-center">
              <div className="bg-slate-100 rounded-lg p-1 flex">
                <Button 
                  variant={visualizacaoOS === "cliente" ? "default" : "ghost"} 
                  size="sm"
                  onClick={() => setVisualizacaoOS("cliente")}
                  className={visualizacaoOS === "cliente" ? "bg-blue-600 hover:bg-blue-700" : ""}
                >
                  <Eye className="w-4 h-4 mr-2" /> OS Cliente
                </Button>
                <Button 
                  variant={visualizacaoOS === "prestador" ? "default" : "ghost"} 
                  size="sm"
                  onClick={() => setVisualizacaoOS("prestador")}
                  className={visualizacaoOS === "prestador" ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  <Truck className="w-4 h-4 mr-2" /> OS Prestador
                </Button>
              </div>
              
              {visualizacaoOS === "prestador" && (
                <>
                    <Button variant="outline" className="border-green-200 text-green-600 hover:bg-green-50" onClick={copiarWhatsApp}>
                      <CopyIcon className="w-4 h-4 mr-2" /> Copiar WhatsApp
                    </Button>
                    <Button 
                      variant="outline" 
                      className="border-green-600 text-green-700 hover:bg-green-50" 
                      onClick={enviarWhatsAppPrestador}
                      disabled={enviandoWhatsApp || !data.prestador}
                    >
                      <Send className="w-4 h-4 mr-2" /> {enviandoWhatsApp ? "Enviando..." : "Enviar WhatsApp"}
                    </Button>
                  </>
              )}

              {data.id && (
                trackingToken ? (
                  <CompartilharRastreioModal token={trackingToken} />
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-blue-200 text-blue-600 hover:bg-blue-50"
                    onClick={handleGerarLinkRastreio}
                    disabled={gerandoLink}
                  >
                    <LinkIcon className="w-4 h-4 mr-2" /> {gerandoLink ? "Gerando..." : "Link Rastreio"}
                  </Button>
                )
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="border-orange-200 text-orange-600 hover:bg-orange-50">
                    <Download className="w-4 h-4 mr-2" /> PDF OS
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => generatePDFCliente(data)}>
                    <FileText className="w-4 h-4 mr-2" /> PDF Cliente
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => generatePDFPrestador(data)}>
                    <Truck className="w-4 h-4 mr-2" /> PDF Prestador
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          
          {/* Durante criação (novo/editar), mostrar apenas info */}
          {!readOnly && !data.id && (
            <div className="text-sm text-muted-foreground">
              OS ainda não salva. Salve primeiro para liberar ações.
            </div>
          )}
        </div>
      </PremiumDialogHeader>

      {/* Workspace Enterprise */}
      <div className="flex-1 min-h-0 p-3 sm:p-4">
        <EnterpriseFormWorkspace>
          <EnterpriseWorkspaceHeader>

      {/* Resumo horizontal do workspace — indicadores rápidos da etapa atual */}
      <div className="px-4 pb-3 pt-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <MetaChip icon={Gauge} label="Prioridade" value={obterPrioridadeLabel(data.prioridade)} tone={data.prioridade === "urgente" ? "red" : data.prioridade === "baixa" ? "slate" : "blue"} />
          <MetaChip icon={CheckCircle} label="Status Op." value={STATUS_GLOBAL_INFO[obterStatusGlobalOS(data.status)].label} tone={obterToneGlobal(data.status)} />
          <MetaChip icon={CreditCard} label="Status Fin." value={(data.statusFaturamento || "N/I").toUpperCase()} tone={data.statusFaturamento === "faturada" || data.statusFaturamento === "paga" ? "green" : data.statusFaturamento === "a faturar" ? "amber" : "slate"} />
          <MetaChip icon={Calendar} label="Programação" value={obterLabelDivergencia(diagnosticoEscala?.status || "os_sem_escala")} tone={diagnosticoEscala?.status === "sincronizada" ? "emerald" : diagnosticoEscala?.status?.startsWith("divergencia") ? "red" : "amber"} />
          {ultimaOperacaoPrestador && (
            <span className="ml-auto text-[10px] text-slate-400">
              Última operação do prestador: {ultimaOperacaoPrestador.data ? new Date(ultimaOperacaoPrestador.data).toLocaleDateString('pt-BR') : 'N/A'}
              {verReceitaMargem && ultimaOperacaoPrestador.valor ? <> • R$ {ultimaOperacaoPrestador.valor.toFixed(2)}</> : null}
            </span>
          )}
        </div>
        {/* UPGRADE-REGRAS: cards de Receita/Margem restritos a admin máximo (demais perfis veem "---") */}
        <div className="mt-3 grid grid-cols-4 gap-3 md:grid-cols-7">
          <StatCard icon={DollarSign} label="Receita" value={verReceitaMargem ? `R$ ${(data.valorCliente || 0).toFixed(2)}` : "---"} tone={verReceitaMargem && data.valorCliente > 0 ? "blue" : "slate"} />
          <StatCard icon={Truck} label="Custo Prest." value={`R$ ${(data.custoPrestador || 0).toFixed(2)}`} tone={data.custoPrestador > 0 ? "orange" : "slate"} />
          <StatCard
            icon={TrendingUp}
            label="Margem"
            value={verReceitaMargem ? `R$ ${((data.valorCliente || 0) - (data.custoPrestador || 0)).toFixed(2)}` : "---"}
            tone={verReceitaMargem ? ((data.valorCliente || 0) - (data.custoPrestador || 0) > 0 ? "green" : "red") : "slate"}
          />
          <StatCard
            icon={TrendingUp}
            label="Margem %"
            value={verReceitaMargem ? (data.valorCliente > 0 ? (((data.valorCliente - data.custoPrestador) / data.valorCliente * 100)).toFixed(1) + '%' : '—') : "---"}
            tone={verReceitaMargem ? (data.valorCliente > 0 ? (((data.valorCliente - data.custoPrestador) / data.valorCliente * 100) >= 20 ? "green" : ((data.valorCliente - data.custoPrestador) / data.valorCliente * 100) > 0 ? "amber" : "red") : "slate") : "slate"}
          />
          <StatCard icon={CreditCard} label="Status Fin." value={(data.statusFaturamento || "N/I").toUpperCase()} tone={data.statusFaturamento === "faturada" || data.statusFaturamento === "paga" ? "green" : data.statusFaturamento === "a faturar" ? "amber" : "slate"} />
          <StatCard icon={CheckCircle} label="Status Op." value={STATUS_GLOBAL_INFO[obterStatusGlobalOS(data.status)].label} tone={obterToneGlobal(data.status)} />
          <StatCard
            icon={Calendar}
            label="Programação"
            value={obterLabelDivergencia(diagnosticoEscala?.status || "os_sem_escala")}
            tone={diagnosticoEscala?.status === "sincronizada" ? "emerald" : diagnosticoEscala?.status?.startsWith("divergencia") ? "red" : "amber"}
            sub={diagnosticoEscala?.descricao}
          />
        </div>
      </div>
      </EnterpriseWorkspaceHeader>

      <EnterpriseFormBody>
        {/* Painel lateral esquerdo — contexto operacional */}
        <EnterpriseContextSidebar>
          <PanelSection icon={Building2} title="Operação" accent="primary">
            <PanelRow label="Cliente" value={clienteNomeExibicao || data.cliente || "—"} />
            <PanelRow label="Unidade" value={data.unidade || "—"} />
            <PanelRow label="Tipo de Operação" value={data.tipoOperacao || "—"} />
            <PanelRow label="Prioridade" value={obterPrioridadeLabel(data.prioridade)} />
            <PanelRow label="Veículo" value={data.veiculoTipo || data.veiculoPlaca || "—"} sub={data.veiculoPlaca ? `Placa: ${data.veiculoPlaca}` : undefined} />
            <PanelRow label="Prestador" value={data.prestador || "—"} />
          </PanelSection>
          <PanelSection icon={Gauge} title="Status" accent="blue">
            <PanelRow label="Operacional" value={<span className="flex items-center justify-end gap-1.5"><span className={`h-2 w-2 rounded-full ${obterClasseDotGlobal(obterStatusGlobalOS(data.status))}`} />{STATUS_GLOBAL_INFO[obterStatusGlobalOS(data.status)].label}</span>} />
            <PanelRow label="Financeiro" value={<span className="flex items-center justify-end gap-1.5"><span className={`h-2 w-2 rounded-full ${(data.statusFaturamento === "faturada" || data.statusFaturamento === "paga") ? "bg-green-500" : data.statusFaturamento === "a faturar" ? "bg-amber-500" : "bg-slate-400"}`} />{(data.statusFaturamento || "N/I").toUpperCase()}</span>} />
            <PanelRow label="Programação" value={obterLabelDivergencia(diagnosticoEscala?.status || "os_sem_escala")} valueClass={diagnosticoEscala?.status === "sincronizada" ? "text-emerald-700" : "text-amber-700"} />
            <PanelRow label="Emissão" value={data.data ? new Date(data.data).toLocaleDateString("pt-BR") : "—"} />
          </PanelSection>
          <ResumoOperacionalPanel
            data={data}
            clienteNome={clienteNomeExibicao}
            diagnosticoEscala={diagnosticoEscala}
            ultimaOperacaoPrestador={ultimaOperacaoPrestador}
            alertasCubagem={alertasCubagem}
            pendenciasFiscais={pendenciasFiscais}
            verReceitaMargem={verReceitaMargem}
          />
        </EnterpriseContextSidebar>

        <EnterpriseMainContent>

      {/* Formulário por etapas */}
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
        <EnterpriseStepStrip className="mb-5">
          <DocStepNavigation steps={obterDocStepsOS(data, alertasCubagem, pendenciasFiscais)} value={abaAtiva} />
        </EnterpriseStepStrip>

        <TabsContent value="identificacao" className="space-y-4">
              <FormSectionCard icon={FileText} title="Dados do Documento" description="Identificação básica da ordem de serviço.">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  <Field label="Nº OS"><Input value={data.numero} readOnly className="bg-slate-50 font-bold" /></Field>
                  <Field label="Romaneio / OC Cliente">
                    <Input
                      value={data.romaneio || ""}
                      readOnly={readOnly}
                      onChange={(e) => update("romaneio", e.target.value)}
                      placeholder="Referência externa do cliente (opcional)"
                      className="bg-white"
                    />
                  </Field>
                  <Field label="Data de Emissão"><Input type="date" value={data.data} readOnly={readOnly} onChange={(e) => update("data", e.target.value)} /></Field>
                  <Field label="Cliente" required>
                    <div className="rounded-xl border-2 border-primary/50 bg-primary/5 p-2 shadow-sm ring-1 ring-primary/10">
                    <SearchableSelect table="clientes" labelField="nome_fantasia" valueField="nome_fantasia" returnField="id" secondaryField="cnpj" value={clienteNomeExibicao || data.cliente} onChange={async (v, record) => { 
                      setClienteNomeExibicao(record ? ((record as any).nome_fantasia || (record as any).razao_social || "") : "");
                      update("cliente", v); 
                      update("clienteId", record?.id || null); 
                      if (record?.id) {
                        try {
                          const { data: clientData } = await supabase.from("clientes").select("*").eq("id", record.id).single();
                          if (clientData) {
                            const row = clientData as any;
                            update("tipoCobrancaCliente", row.tipo_cobranca || null);
                            update("vencimentoPadraoCliente", row.vencimento_padrao || null);
                            update("cfopPadraoCliente", row.cfop_padrao || null);
                            update("tomadorCliente", row.tomador || null);
                            if (row.cte_obrigatorio) update("cteObrigatorio", true);
                            if (row.xml_obrigatorio) update("xmlObrigatorio", true);
                            if (row.comprovante_obrigatorio) update("comprovanteObrigatorio", true);
                            setData(p => ({ 
                              ...p, 
                              tabelaValoresPadraoId: row.tabela_valores_padrao_id || null
                            }));
                          }
                        } catch (e) { console.warn("Erro ao buscar dados do cliente:", e); }
                      }
                    }} disabled={readOnly} searchFields={["nome_fantasia", "razao_social"]} />
                    </div>
                  </Field>
                  <Field label="Tipo de Operação" required>
                    <Select value={data.tipoOperacao} onValueChange={(v) => update("tipoOperacao", v)} disabled={readOnly}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Coleta">Coleta</SelectItem>
                        <SelectItem value="Entrega">Entrega</SelectItem>
                        <SelectItem value="Coleta e Entrega">Coleta e Entrega</SelectItem>
                        <SelectItem value="Transferência">Transferência</SelectItem>
                        <SelectItem value="Retirada">Retirada</SelectItem>
                        <SelectItem value="Distribuição">Distribuição</SelectItem>
                        <SelectItem value="Reentrega">Reentrega</SelectItem>
                        <SelectItem value="Devolução">Devolução</SelectItem>
                        <SelectItem value="Apoio Operacional">Apoio Operacional</SelectItem>
                        <SelectItem value="Dedicado">Dedicado</SelectItem>
                        <SelectItem value="Emergencial">Emergencial</SelectItem>
                        <SelectItem value="Agendado">Agendado</SelectItem>
                        <SelectItem value="Coleta Reversa">Coleta Reversa</SelectItem>
                        <SelectItem value="E-commerce Multiparadas">E-commerce Multiparadas</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Unidade"><Input value={data.unidade} readOnly={readOnly} onChange={(e) => update("unidade", e.target.value)} /></Field>
                </div>
              </FormSectionCard>

              {/* UPGRADE-REGRAS-DE-NEGOCIO — ALOCAÇÃO DE PRESTADOR em destaque no corpo principal
                  (antes o campo ficava apenas na sidebar / etapa Torre & Financeiro) */}
              <FormSectionCard
                icon={User}
                title="Alocação de Prestador"
                description="Selecione manualmente ou use a Sugestão Inteligente (veículo compatível com a OS + região da coleta)."
                contentClassName="space-y-4"
              >
                {/* ETAPA-3 — 3 modos de alocação: Cadastrado | Enviar para a Rede | Externo / Avulso */}
                <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-100/70 p-1">
                  {([
                    { id: "cadastrado", label: "Cadastrado", icon: UserCheck },
                    { id: "rede", label: "Enviar para a Rede", icon: Network },
                    { id: "externo", label: "Externo / Avulso", icon: UserPlus },
                  ] as const).map((op) => {
                    const Icone = op.icon;
                    const ativo = modoAlocacao === op.id;
                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => selecionarModoAlocacao(op.id)}
                        disabled={readOnly}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                          ativo
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-slate-600 hover:bg-white hover:text-slate-900"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <Icone className="h-3.5 w-3.5" />
                        {op.label}
                      </button>
                    );
                  })}
                </div>

                {modoAlocacao === "cadastrado" && (
                  <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <Field label="Prestador / Motorista">
                      <SearchableSelect
                        table="prestadores"
                        labelField="nome_completo"
                        valueField="nome_completo"
                        searchFields={["nome_completo"]}
                        filters={{ status: "ativo" }}
                        value={emRede ? "" : data.prestador}
                        onChange={handleSelecionarPrestador}
                        disabled={readOnly || emRede}
                      />
                    </Field>
                  </div>
                  <Field label="Placa Alocada">
                    <Input value={data.veiculoPlaca || ""} readOnly={readOnly} onChange={(e) => update("veiculoPlaca", e.target.value)} placeholder="ABC-1234" />
                  </Field>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={buscarSugestoesPrestador}
                    disabled={readOnly || buscandoSugestao}
                    className="border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800"
                  >
                    {buscandoSugestao ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    {buscandoSugestao ? "Buscando prestadores..." : "Sugestão Inteligente"}
                  </Button>
                  {data.prestador && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Alocado: {data.prestador}
                    </span>
                  )}
                  {emRede && (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      OS ativa na Rede de Prestadores
                    </span>
                  )}
                </div>

                {sugestoesPrestador.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Sugestões ordenadas por compatibilidade
                    </p>
                    {sugestoesPrestador.map((s, i) => (
                      <div
                        key={s.prestadorId}
                        className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${
                          i === 0 ? "border-indigo-300 bg-indigo-50/60" : "border-slate-200 bg-white"
                        }`}
                      >
                        <span className="w-5 text-[11px] font-black text-slate-400">#{i + 1}</span>
                        <div className="min-w-[180px] flex-1">
                          <p className="text-sm font-bold text-slate-800">{s.nome}</p>
                          <p className="text-[11px] text-slate-500">
                            {s.veiculo?.tipo
                              ? `${s.veiculo.tipo}${s.veiculo.placa ? ` · ${s.veiculo.placa}` : ""}`
                              : "Sem veículo cadastrado"}
                            {s.veiculo?.capacidadeKg ? ` · até ${s.veiculo.capacidadeKg} kg` : ""}
                            {s.regiao ? ` · ${s.regiao}` : ""}
                            {s.telefone ? ` · ${s.telefone}` : ""}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {s.motivos.slice(0, 3).map((m, mi) => (
                              <span key={mi} className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                        <Badge className={i === 0 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}>
                          {Math.min(100, s.score)}% match
                        </Badge>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSelecionarPrestador(s.nome, { id: s.prestadorId })}
                          disabled={readOnly || emRede}
                          className="bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          Selecionar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                  </>
                )}

                {modoAlocacao === "rede" && (
                  <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
                    <div className="flex items-start gap-3">
                      <Network className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-indigo-900">A OS será disparada no App da Conexão Express</p>
                        <p className="text-xs text-indigo-700">
                          A oportunidade fica disponível para os prestadores compatíveis aceitarem direto no app. O
                          acompanhamento do aceite fica na aba <strong>Torre &amp; Financeiro</strong>.
                        </p>
                      </div>
                    </div>

                    {emRede ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-indigo-600 text-white">OS ativa na Rede</Badge>
                        {redeOportunidade && (
                          <span className="text-xs font-semibold text-indigo-800">
                            Valor do repasse: R$ {redeOportunidade.valor_prestador.toFixed(2)}
                          </span>
                        )}
                        {!readOnly && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleCancelarRede}
                            className="border-red-200 text-red-600 hover:bg-red-50"
                          >
                            Cancelar publicação
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {!data.id && (
                          <p className="text-xs font-medium text-amber-700">Salve a OS antes de publicar na Rede.</p>
                        )}
                        {data.prestador && (
                          <p className="text-xs font-medium text-amber-700">Remova o prestador cadastrado para publicar na Rede.</p>
                        )}
                        {data.custoPrestador <= 0 && (
                          <p className="text-xs font-medium text-amber-700">Calcule o valor do repasse antes de publicar.</p>
                        )}
                        <Button
                          type="button"
                          onClick={handleEnviarParaRede}
                          disabled={readOnly || carregandoRede || !data.id || !!data.prestador || data.custoPrestador <= 0}
                          className="bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                          {carregandoRede ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Network className="mr-2 h-4 w-4" />}
                          {carregandoRede ? "Publicando..." : "Enviar para Rede de Prestadores"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {modoAlocacao === "externo" && (
                  <div className="space-y-4">
                    <div className="space-y-4 rounded-xl border border-orange-200 bg-orange-50/50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-orange-700">Identificação do prestador externo</p>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Field label="Nome Completo" required>
                          <Input value={portadorExterno.nome} readOnly={readOnly} onChange={(e) => updatePortador("nome", e.target.value)} placeholder="Nome completo" />
                        </Field>
                        <Field label="Placa do Veículo" required>
                          <Input value={portadorExterno.placaMoto} readOnly={readOnly} onChange={(e) => updatePortador("placaMoto", e.target.value.toUpperCase())} placeholder="ABC-1D23" className="font-mono" />
                        </Field>
                        <Field label="Documento / CPF (opcional)">
                          <Input value={portadorExterno.cpf} readOnly={readOnly} onChange={(e) => updatePortador("cpf", e.target.value)} placeholder="000.000.000-00" />
                        </Field>
                        <Field label="Telefone / WhatsApp">
                          <Input type="tel" value={portadorExterno.telefoneWhatsapp || ""} readOnly={readOnly} onChange={(e) => updatePortador("telefoneWhatsapp", e.target.value)} placeholder="(11) 99999-9999" />
                        </Field>
                        <Field label="Origem do Prestador" className="md:col-span-2">
                          <Input value={portadorExterno.grupoOrigem} readOnly={readOnly} onChange={(e) => updatePortador("grupoOrigem", e.target.value)} placeholder="Ex.: Indicação, FreteBras, Grupo de WhatsApp" />
                        </Field>
                      </div>
                    </div>

                    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <CreditCard className="h-4 w-4 text-slate-600" />
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Dados bancários / PIX</p>
                        <span className="text-[11px] text-muted-foreground">— opcional na alocação; pode ser informado na baixa</span>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Field label="Tipo de PIX">
                          <Select value={portadorExterno.pixTipo || "CPF/CNPJ"} onValueChange={(v) => updatePortador("pixTipo", v)} disabled={readOnly}>
                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent>
                              {OPCOES_PIX_TIPO_FORM.map((t) => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Chave PIX">
                          <Input value={portadorExterno.pixChave || ""} readOnly={readOnly} onChange={(e) => updatePortador("pixChave", e.target.value)} placeholder="Chave PIX do prestador" />
                        </Field>
                        <Field label="Favorecido (se a conta não for do prestador)">
                          <Input value={portadorExterno.pixFavorecido || ""} readOnly={readOnly} onChange={(e) => updatePortador("pixFavorecido", e.target.value)} placeholder="Nome do titular da conta" />
                        </Field>
                        <Field label="Banco">
                          <Input value={portadorExterno.banco || ""} readOnly={readOnly} onChange={(e) => updatePortador("banco", e.target.value)} placeholder="Ex.: Itaú, Bradesco, Nubank" />
                        </Field>
                        <Field label="Agência">
                          <Input value={portadorExterno.agencia || ""} readOnly={readOnly} onChange={(e) => updatePortador("agencia", e.target.value)} placeholder="0000" />
                        </Field>
                        <Field label="Conta">
                          <Input value={portadorExterno.conta || ""} readOnly={readOnly} onChange={(e) => updatePortador("conta", e.target.value)} placeholder="00000-0" />
                        </Field>
                      </div>
                    </div>
                  </div>
                )}
              </FormSectionCard>

              <FormSectionCard icon={ListChecks} title="Instruções e Operação" description="Orientação operacional da coleta e entrega." contentClassName="space-y-4">
                  <div className="md:col-span-3 lg:col-span-4">
                    <Field label="Instruções Operacionais da OS">
                      <Textarea value={data.instrucoesOperacionaisOS} readOnly={readOnly} onChange={(e) => update("instrucoesOperacionaisOS", e.target.value)} rows={3} placeholder="Descreva aqui orientações importantes para a coleta, entrega e restrições do cliente..." />
                    </Field>
                  </div>
                  
                  {(data.tipoOperacao === "Coleta Reversa" || data.tipoOperacao?.toLowerCase().includes("reversa")) && (
                    <div className="md:col-span-3 lg:col-span-4">
                      <ColetaReversaFields fields={reversaFields} onChange={setReversaFields} readOnly={readOnly} defaultOpen />
                    </div>
                  )}
              </FormSectionCard>

              <FormSectionCard icon={Calendar} title="Serviço Programado & Status" description="Agendamento e situação operacional da OS." contentClassName="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="font-bold text-blue-900 flex items-center gap-2"><Calendar className="w-4 h-4"/> Serviço Programado?</Label>
                        <Switch checked={!!data.dataProgramada} onCheckedChange={(v) => {
                          if (v) {
                            const agora = new Date();
                            const dataHoje = agora.toISOString().split("T")[0];
                            const horaAgora = `${agora.getHours().toString().padStart(2,'0')}:${agora.getMinutes().toString().padStart(2,'0')}`;
                            setData(p => ({ 
                              ...p, 
                              dataProgramada: dataHoje, 
                              previsaoInicio: p.previsaoInicio || horaAgora, status: p.status === "finalizada" || p.status === "cancelada" ? p.status : "agendada" 
                            }));
                          } else {
                            setData(p => ({ ...p, dataProgramada: "", previsaoInicio: "", previsaoTermino: "" }));
                          }
                        }} disabled={readOnly} />
                      </div>
                      {data.dataProgramada && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                          <Field label="Data Programada"><Input type="date" value={data.dataProgramada} readOnly={readOnly} onChange={(e) => update("dataProgramada", e.target.value)} /></Field>
                          <div className="grid grid-cols-2 gap-2">
                            <Field label="Horário Início *">
                              <Input type="time" required={!!data.dataProgramada} value={data.previsaoInicio || ""} readOnly={readOnly} onChange={(e) => update("previsaoInicio", e.target.value)} />
                            </Field>
                            <Field label="Horário Fim (Janela)">
                              <Input type="time" value={data.previsaoTermino || ""} readOnly={readOnly} onChange={(e) => update("previsaoTermino", e.target.value)} />
                            </Field>
                          </div>
                          <Field label="Observações"><Textarea value={data.observacaoTorre} readOnly={readOnly} onChange={(e) => update("observacaoTorre", e.target.value)} rows={2} /></Field>
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <Field label="Status Operacional">
                        <Select value={data.status} onValueChange={(v) => update("status", v)} disabled={readOnly}>
                          <SelectTrigger className="h-10 font-semibold"><SelectValue/></SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_CORES).map(([key, val]) => {
                              const globalStatus = obterStatusGlobalOS(key);
                              return (
                                <SelectItem key={key} value={key} className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full inline-block mr-2 ${obterClasseDotGlobal(globalStatus)}`}></span>
                                  {STATUS_GLOBAL_INFO[globalStatus].label}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Prioridade">
                        <Select value={data.prioridade} onValueChange={(v) => update("prioridade", v)} disabled={readOnly}>
                          <SelectTrigger><SelectValue/></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="baixa">Baixa</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="urgente">Urgente / Crítica</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  </div>
                </FormSectionCard>

              <Card className="border-none shadow-md rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2"><Shield className="w-5 h-5 text-primary"/> Classificação Fiscal da OS</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {(() => {
                    const fiscal = classificarFiscalmente(data.enderecos || []);
                    const origem = (data.enderecos || []).find(e => e.tipo === 'coleta' && e.cidade?.trim() && e.estado?.trim());
                    const destino = [...(data.enderecos || [])].reverse().find(e => e.tipo === 'entrega' && e.cidade?.trim() && e.estado?.trim());
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-slate-700">Tipo:</span>
                          <Badge className={`text-xs font-bold px-3 py-0.5 border ${FISCAL_TIPO_CORES[fiscal.tipo]}`}>
                            {fiscal.tipo}
                          </Badge>
                          {fiscal.tipo === 'Indefinido' && (
                            <span className="text-xs text-amber-600 italic">— preencha origem e destino</span>
                          )}
                        </div>
                        {origem && destino && (
                          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
                            <MapPin className="w-3 h-3" />
                            <span>{origem.cidade}/{origem.estado}</span>
                            <span className="text-slate-300">→</span>
                            <MapPin className="w-3 h-3" />
                            <span>{destino.cidade}/{destino.estado}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-100">
                            <span className="text-sm font-medium text-slate-600">NFS-e</span>
                            {fiscal.exigeNFSe ? (
                              docFiscalExistente.nfse ? (
                                <Badge className="bg-emerald-200 text-emerald-800 border-emerald-300">Criada</Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-800 border-green-300">Sim</Badge>
                              )
                            ) : (
                              <Badge className="bg-gray-100 text-gray-400 border-gray-200">Não</Badge>
                            )}
                          </div>
                          <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-100">
                            <span className="text-sm font-medium text-slate-600">CT-e</span>
                            {fiscal.exigeCTe ? (
                              docFiscalExistente.cte ? (
                                <Badge className="bg-emerald-200 text-emerald-800 border-emerald-300">Criado</Badge>
                              ) : (
                                <Badge className="bg-blue-100 text-blue-800 border-blue-300">Sim</Badge>
                              )
                            ) : (
                              <Badge className="bg-gray-100 text-gray-400 border-gray-200">Não</Badge>
                            )}
                          </div>
                          <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-100">
                            <span className="text-sm font-medium text-slate-600">MDF-e</span>
                            {fiscal.exigeMDFe ? (
                              docFiscalExistente.mdfe ? (
                                <Badge className="bg-emerald-200 text-emerald-800 border-emerald-300">Criado</Badge>
                              ) : (
                                <Badge className="bg-purple-100 text-purple-800 border-purple-300">Sim</Badge>
                              )
                            ) : (
                              <Badge className="bg-gray-100 text-gray-400 border-gray-200">Não</Badge>
                            )}
                          </div>
                        </div>
                        <div className="pt-2 border-t">
                          {fiscal.tipo === 'Indefinido' ? (
                            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg p-3 border border-amber-200">
                              <AlertTriangle className="w-4 h-4" />
                              <span>Preencha origem e destino para liberar ações fiscais.</span>
                            </div>
                          ) : (
                          <div className="flex flex-wrap gap-2">
                              {fiscal.exigeNFSe && (docFiscalExistente.nfse ? (
                                <>
                                  <Button
                                    variant="outline"
                                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => navigate('/fiscal?tab=nfse')}
                                  >
                                    <Eye className="w-4 h-4 mr-2" /> Abrir NFS-e
                                  </Button>
                                  <Button
                                    variant="outline"
                                    className="border-slate-300 text-slate-600 hover:bg-slate-50"
                                    disabled={simulandoFocus || !docFiscalExistente.nfseId}
                                    onClick={async () => {
                                      setSimulandoFocus(true);
                                      try {
                                        const { data: fnData, error: fnError } = await supabase.functions.invoke("focus-emissao", { body: { tipoDocumento: "nfse", documentoId: docFiscalExistente.nfseId } });
                                        if (fnError) { toast.error(`Erro na simulação: ${fnError.message}`); return; }
                                        toast.success(`Simulação Focus concluída: ${(fnData as any)?.mensagem || 'Modo simulado'}`);
                                      } catch (e: any) {
                                        toast.error("Erro ao chamar Edge Function: " + e.message);
                                      } finally {
                                        setSimulandoFocus(false);
                                      }
                                    }}
                                  >
                                    <Send className="w-4 h-4 mr-2" /> Simular Focus
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="outline"
                                  className="border-green-300 text-green-700 hover:bg-green-50"
                                  disabled={readOnly || gerandoNFSe || !data.id}
                                  onClick={async () => {
                                    if (!data.id) { toast.warning("Salve a OS antes de gerar documentos fiscais."); return; }
                                    const pendencias = validarPendenciasFiscais('NFSe', data, data.enderecos || []);
                                    if (origem?.cidade && origem?.estado) {
                                      const cod = await buscarCodigoIbge(origem.cidade, origem.estado);
                                      if (!cod) pendencias.push(`Código IBGE não encontrado para ${origem.cidade}/${origem.estado}`);
                                    }
                                    if (pendencias.length > 0) {
                                      setPendenciasFiscais(pendencias);
                                      toast.warning('Existem pendências fiscais antes de gerar NFS-e.');
                                      return;
                                    }
                                    setPendenciasFiscais([]);
                                    setGerandoNFSe(true);
                                    try {
                                      const { data: existente } = await supabase
                                        .from("fiscal_nfse")
                                        .select("id")
                                        .eq("ordem_servico_id", data.id!)
                                        .in("status", ["rascunho", "processando", "autorizado"])
                                        .limit(1);
                                      if (existente && existente.length > 0) {
                                        toast.warning("Já existe NFS-e para esta OS.");
                                        return;
                                      }
                                      const result = await gerarRascunhoNfse({ origem: "os", origem_id: data.id!, municipio_prestacao: origem?.cidade || undefined, descricao_servico: "Transporte de Cargas" });
                                      if (result.success) {
                                        toast.success(`NFS-e rascunho criado com sucesso!`);
                                        setPendenciasFiscais([]);
                                        setDocFiscalExistente(p => ({ ...p, nfse: true, nfseId: (result as any).nfse?.id }));
                                      } else {
                                        toast.error(`Erro ao gerar NFS-e: ${result.error}`);
                                      }
                                    } catch (e: any) {
                                      toast.error("Erro ao gerar NFS-e: " + e.message);
                                    } finally {
                                      setGerandoNFSe(false);
                                    }
                                  }}
                                >
                                  {gerandoNFSe ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                                  {gerandoNFSe ? "Gerando..." : "Gerar NFS-e"}
                                </Button>
                              ))}
                              {fiscal.exigeCTe && (docFiscalExistente.cte ? (
                                <>
                                  <Button
                                    variant="outline"
                                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => navigate('/fiscal?tab=cte')}
                                  >
                                    <Eye className="w-4 h-4 mr-2" /> Abrir CT-e
                                  </Button>
                                  <Button
                                    variant="outline"
                                    className="border-slate-300 text-slate-600 hover:bg-slate-50"
                                    disabled={simulandoFocus || !docFiscalExistente.cteId}
                                    onClick={async () => {
                                      setSimulandoFocus(true);
                                      try {
                                        const { data: fnData, error: fnError } = await supabase.functions.invoke("focus-emissao", { body: { tipoDocumento: "cte", documentoId: docFiscalExistente.cteId } });
                                        if (fnError) { toast.error(`Erro na simulação: ${fnError.message}`); return; }
                                        toast.success(`Simulação Focus concluída: ${(fnData as any)?.mensagem || 'Modo simulado'}`);
                                      } catch (e: any) {
                                        toast.error("Erro ao chamar Edge Function: " + e.message);
                                      } finally {
                                        setSimulandoFocus(false);
                                      }
                                    }}
                                  >
                                    <Send className="w-4 h-4 mr-2" /> Simular Focus
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="outline"
                                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                                  disabled={readOnly || gerandoCTe || !data.id}
                                  onClick={async () => {
                                    if (!data.id) { toast.warning("Salve a OS antes de gerar documentos fiscais."); return; }
                                    const pendencias = validarPendenciasFiscais('CTe', data, data.enderecos || []);
                                    if (origem?.cidade && origem?.estado) {
                                      const cod = await buscarCodigoIbge(origem.cidade, origem.estado);
                                      if (!cod) pendencias.push(`Código IBGE não encontrado para origem: ${origem.cidade}/${origem.estado}`);
                                    }
                                    if (destino?.cidade && destino?.estado) {
                                      const cod = await buscarCodigoIbge(destino.cidade, destino.estado);
                                      if (!cod) pendencias.push(`Código IBGE não encontrado para destino: ${destino.cidade}/${destino.estado}`);
                                    }
                                    if (pendencias.length > 0) {
                                      setPendenciasFiscais(pendencias);
                                      toast.warning('Existem pendências fiscais antes de gerar CT-e.');
                                      return;
                                    }
                                    setPendenciasFiscais([]);
                                    setGerandoCTe(true);
                                    try {
                                      const { data: existente } = await supabase
                                        .from("fiscal_ctes")
                                        .select("id")
                                        .eq("ordem_servico_id", data.id!)
                                        .in("status", ["rascunho", "processando", "autorizado"])
                                        .limit(1);
                                      if (existente && existente.length > 0) {
                                        toast.warning("Já existe CT-e para esta OS.");
                                        return;
                                      }
                                      const result = await gerarRascunhoCte(data.id!);
                                      if (result.success) {
                                        toast.success(`CT-e rascunho criado com sucesso!`);
                                        setPendenciasFiscais([]);
                                        setDocFiscalExistente(p => ({ ...p, cte: true, cteId: (result as any).cte?.id }));
                                      } else {
                                        toast.error(`Erro ao gerar CT-e: ${result.error}`);
                                      }
                                    } catch (e: any) {
                                      toast.error("Erro ao gerar CT-e: " + e.message);
                                    } finally {
                                      setGerandoCTe(false);
                                    }
                                  }}
                                >
                                  {gerandoCTe ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                                  {gerandoCTe ? "Gerando..." : "Gerar CT-e"}
                                </Button>
                              ))}
                              {fiscal.exigeMDFe && (docFiscalExistente.mdfe ? (
                                <>
                                  <Button
                                    variant="outline"
                                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => navigate('/fiscal?tab=mdfe')}
                                  >
                                    <Eye className="w-4 h-4 mr-2" /> Abrir MDF-e
                                  </Button>
                                  <Button
                                    variant="outline"
                                    className="border-slate-300 text-slate-600 hover:bg-slate-50"
                                    disabled={simulandoFocus || !docFiscalExistente.mdfeId}
                                    onClick={async () => {
                                      setSimulandoFocus(true);
                                      try {
                                        const { data: mdfeData } = await supabase
                                          .from("fiscal_mdfes")
                                          .select("metadata")
                                          .eq("id", docFiscalExistente.mdfeId)
                                          .single();
                                        const vinculados: any[] = mdfeData?.metadata?.ctes_vinculados || [];
                                        const semChave = vinculados.filter((v: any) => !v.chave_acesso || v.status !== "autorizado");
                                        if (semChave.length > 0) {
                                          toast.warning("MDF-e ainda não pode ser emitido: CT-e sem chave de acesso autorizada.");
                                          return;
                                        }
                                        const { data: fnData, error: fnError } = await supabase.functions.invoke("focus-emissao", { body: { tipoDocumento: "mdfe", documentoId: docFiscalExistente.mdfeId } });
                                        if (fnError) { toast.error(`Erro na simulação: ${fnError.message}`); return; }
                                        toast.success(`Simulação Focus concluída: ${(fnData as any)?.mensagem || 'Modo simulado'}`);
                                      } catch (e: any) {
                                        toast.error("Erro ao chamar Edge Function: " + e.message);
                                      } finally {
                                        setSimulandoFocus(false);
                                      }
                                    }}
                                  >
                                    <Send className="w-4 h-4 mr-2" /> Simular Focus
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="outline"
                                  className="border-purple-300 text-purple-700 hover:bg-purple-50"
                                  disabled={readOnly || gerandoMDFe || !data.id}
                                  onClick={async () => {
                                    if (!data.id) { toast.warning("Salve a OS antes de gerar documentos fiscais."); return; }
                                    const pendencias = validarPendenciasFiscais('MDFe', data, data.enderecos || []);
                                    if (pendencias.length > 0) {
                                      setPendenciasFiscais(pendencias);
                                      toast.warning('Existem pendências fiscais antes de gerar MDF-e.');
                                      return;
                                    }
                                    setPendenciasFiscais([]);
                                    setGerandoMDFe(true);
                                    try {
                                      const { data: ctes } = await supabase
                                        .from("fiscal_ctes")
                                        .select("id")
                                        .eq("ordem_servico_id", data.id!)
                                        .eq("status", "rascunho");
                                      if (!ctes || ctes.length === 0) {
                                        toast.warning("Gere o CT-e antes do MDF-e.");
                                        return;
                                      }
                                      const cteIds = ctes.map((c: any) => c.id);
                                      const { data: mdfesAtivos } = await supabase
                                        .from("fiscal_mdfes")
                                        .select("id, metadata")
                                        .in("status", ["rascunho", "processando", "autorizado"]);
                                      const jaExiste = (mdfesAtivos || []).some((m: any) => {
                                        const vinculados: { cte_id: string }[] = m.metadata?.ctes_vinculados || [];
                                        return vinculados.some((v) => cteIds.includes(v.cte_id));
                                      });
                                      if (jaExiste) {
                                        toast.warning("Já existe MDF-e para esta OS.");
                                        return;
                                      }
                                      const result = await gerarRascunhoMdfe(cteIds);
                                      if (result.success) {
                                        toast.success(`MDF-e rascunho criado com sucesso!`);
                                        setPendenciasFiscais([]);
                                        setDocFiscalExistente(p => ({ ...p, mdfe: true, mdfeId: (result as any).mdfe?.id }));
                                      } else {
                                        toast.error(`Erro ao gerar MDF-e: ${result.error}`);
                                      }
                                    } catch (e: any) {
                                      toast.error("Erro ao gerar MDF-e: " + e.message);
                                    } finally {
                                      setGerandoMDFe(false);
                                    }
                                  }}
                                >
                                  {gerandoMDFe ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                                  {gerandoMDFe ? "Gerando..." : "Gerar MDF-e"}
                                </Button>
                              ))}
                            </div>
                          )}
                          <div className="mt-2 pt-2 border-t border-slate-100">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-500 hover:text-slate-700"
                              onClick={async () => {
                                const orig = (data.enderecos || []).find(e => e.tipo === 'coleta' && e.cidade?.trim() && e.estado?.trim());
                                const dest = [...(data.enderecos || [])].reverse().find(e => e.tipo === 'entrega' && e.cidade?.trim() && e.estado?.trim());
                                const [codOrig, codDest] = await Promise.all([
                                  orig?.cidade && orig?.estado ? buscarCodigoIbge(orig.cidade, orig.estado) : null,
                                  dest?.cidade && dest?.estado ? buscarCodigoIbge(dest.cidade, dest.estado) : null,
                                ]);
                                setIbgePreview({ origem: codOrig || undefined, destino: codDest || undefined });
                                setShowFiscalPreview(true);
                              }}
                            >
                              <FileText className="w-4 h-4 mr-2" /> Pré-visualizar Fiscal
                            </Button>
                          </div>
                          {pendenciasFiscais.length > 0 && (
                            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                <span className="text-sm font-semibold text-amber-800">Pendências para emissão fiscal</span>
                              </div>
                              <ul className="space-y-1">
                                {pendenciasFiscais.map((p, i) => (
                                  <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                                    <span className="text-amber-400 mt-0.5">●</span>
                                    {p}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              <Dialog open={showFiscalPreview} onOpenChange={setShowFiscalPreview}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                  {(() => {
                    const fiscal = classificarFiscalmente(data.enderecos || []);
                    const origem = (data.enderecos || []).find(e => e.tipo === 'coleta' && e.cidade?.trim() && e.estado?.trim());
                    const destino = [...(data.enderecos || [])].reverse().find(e => e.tipo === 'entrega' && e.cidade?.trim() && e.estado?.trim());
                    const docsExigidos: string[] = [];
                    if (fiscal.exigeNFSe) docsExigidos.push('NFS-e');
                    if (fiscal.exigeCTe) docsExigidos.push('CT-e');
                    if (fiscal.exigeMDFe) docsExigidos.push('MDF-e');

                    const payloadPreview = {
                      tipo_fiscal: fiscal.tipo,
                      documentos_exigidos: docsExigidos,
                      emitente_cliente: data.cliente || null,
                      valor: data.valorCliente || 0,
                      tipo_operacao: data.tipoOperacao || null,
                      prestador: data.prestador || null,
                      veiculo: {
                        placa: data.veiculoPlaca || null,
                        tipo: data.veiculoTipo || null,
                      },
                      cfop: (data as any).cfopPadraoCliente || null,
                      icms: data.valorCliente > 0 ? {
                        base_calculo: data.valorCliente,
                        aliquota: 12,
                        valor: parseFloat((data.valorCliente * 0.12).toFixed(2)),
                      } : null,
                      modal: "01",
                      tipo_servico: 0,
                      carga: data.carga ? {
                        tipo: data.carga.tipo,
                        descricao: data.carga.descricao,
                        peso: data.carga.peso,
                        volumes: data.carga.volumes,
                      } : null,
                      origem: origem ? { cidade: origem.cidade, estado: origem.estado, endereco: origem.endereco, codigo_ibge: ibgePreview.origem || null } : null,
                      destino: destino ? { cidade: destino.cidade, estado: destino.estado, endereco: destino.endereco, codigo_ibge: ibgePreview.destino || null } : null,
                      tomador_indicador_ie: "9",
                      ctes_vinculados_status: docFiscalExistente.cte ? (docFiscalExistente.cteId ? "rascunho (sem chave)" : "indisponivel") : null,
                    };

                    return (
                      <>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Shield className="w-5 h-5" /> Pré-visualização Fiscal da OS
                          </DialogTitle>
                          <DialogDescription>
                            Payload interno preparado para emissão futura (Focus NFe desligado)
                          </DialogDescription>
                        </DialogHeader>

                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-sm font-semibold text-blue-800">Focus NFe desligado</span>
                            <p className="text-xs text-blue-600 mt-0.5">
                              A emissão real será feita via backend / Edge Function, nunca pelo frontend.
                              Nenhum token, certificado ou chave de API trafega pelo navegador.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {pendenciasFiscais.length > 0 && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                <span className="text-sm font-semibold text-amber-800">
                                  Payload incompleto — corrija as pendências antes de gerar
                                </span>
                              </div>
                              <ul className="space-y-1">
                                {pendenciasFiscais.map((p, i) => (
                                  <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                                    <span className="text-amber-400 mt-0.5">●</span> {p}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-50 rounded-lg p-3 border">
                              <span className="text-xs text-slate-500 font-medium">Tipo Fiscal</span>
                              <p className={`text-sm font-bold ${fiscal.tipo === 'Indefinido' ? 'text-slate-400' : fiscal.tipo === 'Municipal' ? 'text-green-700' : fiscal.tipo === 'Intermunicipal' ? 'text-blue-700' : 'text-purple-700'}`}>
                                {fiscal.tipo}
                              </p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 border">
                              <span className="text-xs text-slate-500 font-medium">Documentos Exigidos</span>
                              <p className="text-sm font-bold text-slate-700">
                                {docsExigidos.length > 0 ? docsExigidos.join(' + ') : 'Nenhum definido'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-50 rounded-lg p-3 border">
                              <span className="text-xs text-slate-500 font-medium">Cliente / Tomador</span>
                              <p className="text-sm text-slate-700">{clienteNomeExibicao || data.cliente || '—'}</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 border">
                              <span className="text-xs text-slate-500 font-medium">Indicador IE</span>
                              <p className="text-sm text-slate-700">9 — Não Contribuinte</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-50 rounded-lg p-3 border">
                              <span className="text-xs text-slate-500 font-medium">Valor</span>
                              {/* UPGRADE-REGRAS: valor da receita no preview fiscal restrito a admin */}
                              <p className="text-sm font-bold text-slate-700">{verReceitaMargem ? `R$ ${(data.valorCliente || 0).toFixed(2)}` : "---"}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-50 rounded-lg p-3 border">
                              <span className="text-xs text-slate-500 font-medium">Origem</span>
                              <p className="text-sm text-slate-700">{origem ? `${origem.cidade}/${origem.estado}` : '—'}</p>
                              {ibgePreview.origem && <p className="text-[10px] text-slate-400">IBGE: {ibgePreview.origem}</p>}
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 border">
                              <span className="text-xs text-slate-500 font-medium">Destino</span>
                              <p className="text-sm text-slate-700">{destino ? `${destino.cidade}/${destino.estado}` : '—'}</p>
                              {ibgePreview.destino && <p className="text-[10px] text-slate-400">IBGE: {ibgePreview.destino}</p>}
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-3">
                            <div className="bg-slate-50 rounded-lg p-3 border">
                              <span className="text-xs text-slate-500 font-medium">Prestador</span>
                              <p className="text-sm text-slate-700">{data.prestador || '—'}</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 border">
                              <span className="text-xs text-slate-500 font-medium">Veículo</span>
                              <p className="text-sm text-slate-700">{data.veiculoTipo || '—'}{data.veiculoPlaca ? ` (${data.veiculoPlaca})` : ''}</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 border">
                              <span className="text-xs text-slate-500 font-medium">CFOP</span>
                              <p className="text-sm text-slate-700">{(data as any).cfopPadraoCliente || '—'}</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 border">
                              <span className="text-xs text-slate-500 font-medium">Modal</span>
                              <p className="text-sm text-slate-700">Rodoviário</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-3">
                            <div className="bg-slate-50 rounded-lg p-3 border">
                              <span className="text-xs text-slate-500 font-medium">Tipo Serviço</span>
                              <p className="text-sm text-slate-700">Normal</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 border">
                              <span className="text-xs text-slate-500 font-medium">ICMS (12%)</span>
                              <p className="text-sm text-slate-700">
                                {verReceitaMargem ? (data.valorCliente > 0 ? `R$ ${(data.valorCliente * 0.12).toFixed(2)}` : '—') : '---'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-slate-50 rounded-lg p-3 border">
                              <span className="text-xs text-slate-500 font-medium">Base ICMS</span>
                              <p className="text-sm text-slate-700">{verReceitaMargem ? (data.valorCliente > 0 ? `R$ ${data.valorCliente.toFixed(2)}` : '—') : '---'}</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 border">
                              <span className="text-xs text-slate-500 font-medium">Alíquota ICMS</span>
                              <p className="text-sm text-slate-700">12%</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 border">
                              <span className="text-xs text-slate-500 font-medium">Valor ICMS</span>
                              <p className="text-sm font-bold text-slate-700">{verReceitaMargem ? (data.valorCliente > 0 ? `R$ ${(data.valorCliente * 0.12).toFixed(2)}` : '—') : '---'}</p>
                            </div>
                          </div>

                          <div>
                            <span className="text-xs font-semibold text-slate-500 uppercase">Payload JSON</span>
                            <pre className="mt-1 rounded-lg bg-slate-900 text-green-400 p-4 text-xs overflow-x-auto max-h-64 overflow-y-auto font-mono leading-relaxed">
                              {JSON.stringify(payloadPreview, null, 2)}
                            </pre>
                          </div>
                        </div>

                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowFiscalPreview(false)}>
                            Fechar
                          </Button>
                        </DialogFooter>
                      </>
                    );
                  })()}
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="enderecos" className="space-y-4">
              <div className="flex items-center justify-between gap-3 sticky top-0 z-10 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
                <h3 className="text-sm font-bold flex items-center gap-2"><MapPin className="w-4 h-4 text-primary"/> Itinerário da OS</h3>
                {!readOnly && (
                  <Button onClick={() => update("enderecos", [...(data.enderecos || []), emptyEnd()])} variant="outline" className="border-primary text-primary hover:bg-primary/5 h-8 text-xs">
                    <Plus className="w-4 h-4 mr-1"/> Adicionar Parada
                  </Button>
                )}
              </div>
              
{data.enderecos && data.enderecos.length > 0 ? (
                <div className="space-y-4">
                  {data.enderecos.map((end, idx) => (
                    <Card key={idx} className="border-none shadow-sm rounded-xl overflow-hidden group">
                      <CardHeader className="bg-slate-50 py-3 flex flex-row items-center justify-between px-6">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="rounded-full w-6 h-6 flex items-center justify-center p-0 font-bold">{idx + 1}</Badge>
                          <Select value={end.tipo || "coleta"} onValueChange={(v) => {
                            const e = [...(data.enderecos || [])];
                            e[idx].tipo = v as any;
                            update("enderecos", e);
                          }} disabled={readOnly}>
                            <SelectTrigger className="w-[120px] h-8 text-xs font-bold uppercase"><SelectValue/></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="coleta">Coleta</SelectItem>
                              <SelectItem value="entrega">Entrega</SelectItem>
                              <SelectItem value="apoio">Apoio Operacional</SelectItem>
                              <SelectItem value="retorno">Retorno</SelectItem>
                              <SelectItem value="devolucao">Devolução</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="text-sm font-semibold text-slate-700">{end.nomeLocal || "Nova Parada"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <SaveFavoritoButton
                            clienteId={clienteIdEfetivo || undefined}
                            endereco={{
                              cep: end.cep || "",
                              endereco: end.endereco || [end.logradouro, end.numero].filter(Boolean).join(", "),
                              numero: end.numero || "",
                              complemento: end.complemento || "",
                              bairro: end.bairro || "",
                              cidade: end.cidade || "",
                              uf: end.estado || "",
                              contato: end.contatoNome || "",
                              telefone: end.contatoTelefone || end.telefone || "",
                              instrucoes: end.instrucoes || end.referencia || "",
                              janelaInicio: end.janelaInicio || "",
                              janelaFim: end.janelaFim || "",
                              nomeLocal: end.nomeLocal || "",
                              tipo: end.tipo,
                            }}
                          />
                          {!readOnly && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 transition-colors" onClick={() => update("enderecos", (data.enderecos || []).filter((_, i) => i !== idx))}>
                              <Trash2 className="w-4 h-4"/>
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                         <div className="md:col-span-3">
                            <EnderecoCompleto 
                              label="Endereço"
                              clienteId={clienteIdEfetivo}
                              value={{
                                cep: end.cep || "", logradouro: end.logradouro || "", numero: end.numero || "",
                                complemento: end.complemento || "", bairro: end.bairro || "", cidade: end.cidade || "",
                                estado: end.estado || "", referencia: end.referencia || end.instrucoes || "",
                                latitude: end.latitude, longitude: end.longitude,
                                portaria: end.portaria || "", doca: end.doca || "",
                                procedimentoEntrada: end.procedimentoEntrada || "",
                                procedimentoSaida: end.procedimentoSaida || "",
                                estacionamento: end.estacionamento || "",
                                documentoNecessario: end.documentoNecessario || "",
                                codigoAcesso: end.codigoAcesso || "",
                                exigenciaEpi: end.exigenciaEpi || false,
                                exigeAjudante: end.exigeAjudante || false,
                                restricaoVeiculo: end.restricaoVeiculo || "",
                                restricaoAltura: end.restricaoAltura || "",
                                outrasRestricoes: end.outrasRestricoes || "",
                                contatoNome: end.contatoNome || "",
                                contatoTelefone: end.contatoTelefone || "",
                              } as any}
                              onChange={(obj) => {
                                const e = [...(data.enderecos || [])];
                                const { logradouro: log, numero: num } = separarNumeroLogradouro(obj.logradouro || "");
                                e[idx] = { 
                                  ...e[idx], 
                                  ...obj, 
                                  instrucoes: obj.referencia ?? e[idx].instrucoes,
                                  logradouro: obj.logradouro || log,
                                  numero: obj.numero || num,
                                  bairro: obj.bairro || end.bairro || "",
                                  cidade: obj.cidade || end.cidade || "",
                                  estado: obj.estado || end.estado || "",
                                  endereco: `${obj.logradouro || log}${obj.numero || num ? ', ' + (obj.numero || num) : ''} - ${obj.bairro || ''}, ${obj.cidade || ''}/${obj.estado || ''}`.replace(/^ - |\/$/g, "")
                                };
                                update("enderecos", e);
                              }}
                              readOnly={readOnly}
                            />
                         </div>
                         <div className="space-y-4">
                            <Field label="Nome Local"><Input value={end.nomeLocal || ""} readOnly={readOnly} onChange={(e) => { const t = [...(data.enderecos || [])]; t[idx].nomeLocal = e.target.value; update("enderecos", t); }} placeholder="Ex: Hospital X, Fábrica Y..." /></Field>
                            <div className="grid grid-cols-2 gap-2">
                               <Field label="Setor"><Input value={end.setor || ""} readOnly={readOnly} onChange={(e) => { const t = [...(data.enderecos || [])]; t[idx].setor = e.target.value; update("enderecos", t); }} /></Field>
                               <Field label="Responsável"><Input value={end.responsavel || ""} readOnly={readOnly} onChange={(e) => { const t = [...(data.enderecos || [])]; t[idx].responsavel = e.target.value; update("enderecos", t); }} /></Field>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                               <Field label="Telefone"><Input value={end.telefone || ""} readOnly={readOnly} onChange={(e) => { const t = [...(data.enderecos || [])]; t[idx].telefone = e.target.value; update("enderecos", t); }} /></Field>
                               <Field label="Ramal"><Input value={end.ramal || ""} readOnly={readOnly} onChange={(e) => { const t = [...(data.enderecos || [])]; t[idx].ramal = e.target.value; update("enderecos", t); }} /></Field>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                               <Field label="Email"><Input type="email" value={end.email || ""} readOnly={readOnly} onChange={(e) => { const t = [...(data.enderecos || [])]; t[idx].email = e.target.value; update("enderecos", t); }} placeholder="email@ex.com" /></Field>
                               <Field label="Canal">
                                 <Select value={end.enviarWhatsApp ? "whatsapp" : "email"} onValueChange={(v) => { const t = [...(data.enderecos || [])]; t[idx].enviarWhatsApp = v === "whatsapp"; update("enderecos", t); }} disabled={readOnly}>
                                   <SelectTrigger><SelectValue/></SelectTrigger>
                                   <SelectContent>
                                     <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                     <SelectItem value="email">Email</SelectItem>
                                   </SelectContent>
                                 </Select>
                               </Field>
                            </div>

                            {/* ETAPA-4 — Chave de notificação de rastreio (estilo Mercado Livre) */}
                            <div className={`rounded-lg border p-2.5 transition-colors ${end.notificarWhatsApp ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50/70"}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <Label className="flex items-center gap-1 text-xs font-bold text-slate-800">
                                    🔔 Enviar Rastreio por WhatsApp
                                  </Label>
                                  <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                                    Atualizações em tempo real e "Saiu para entrega" para o telefone/contato deste ponto.
                                  </p>
                                </div>
                                <Switch
                                  checked={!!end.notificarWhatsApp}
                                  onCheckedChange={(v) => {
                                    const t = [...(data.enderecos || [])];
                                    t[idx].notificarWhatsApp = v;
                                    update("enderecos", t);
                                    if (v) toast.success("Rastreio por WhatsApp ativado para este ponto");
                                  }}
                                  disabled={readOnly}
                                />
                              </div>
                            </div>

                            <Field label="Janela Operacional">
                              <div className="flex items-center gap-2">
                                <Input type="time" value={end.janelaInicio || ""} readOnly={readOnly} onChange={(e) => { const t = [...(data.enderecos || [])]; t[idx].janelaInicio = e.target.value; update("enderecos", t); }} />
                                <span>às</span>
                                <Input type="time" value={end.janelaFim || ""} readOnly={readOnly} onChange={(e) => { const t = [...(data.enderecos || [])]; t[idx].janelaFim = e.target.value; update("enderecos", t); }} />
                              </div>
                            </Field>
                            <Field label="Observação do Ponto"><Textarea value={end.observacaoPonto || ""} readOnly={readOnly} onChange={(e) => { const t = [...(data.enderecos || [])]; t[idx].observacaoPonto = e.target.value; update("enderecos", t); }} rows={2} /></Field>
                         </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-slate-400">Nenhum endereço adicionado</div>
              )}
              
              <div className="flex items-center justify-between mb-4">
                <Button 
                  onClick={calculaRotaEValor} 
                  disabled={calculandoDistancia || !data.enderecos || data.enderecos.length < 2}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Route className="w-4 h-4 mr-2" /> 
                  {calculandoDistancia ? "Calculando..." : "Calcular Rota"}
                </Button>
                {calculandoDistancia && <span className="text-sm text-green-600">Calculando distância e tempo...</span>}
              </div>

              {(distanciaRota || data.distanciaKm) && (
                <Card className="border-none shadow-md rounded-2xl overflow-hidden bg-green-50/50 border-green-100">
                  <CardHeader className="bg-green-50 pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-green-700"><Route className="w-4 h-4"/> Resumo da Rota</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-white rounded-lg border border-green-100">
                        <p className="text-xs text-green-600 font-medium">Distância Total</p>
                        <p className="text-xl font-bold text-green-800">{distanciaRota?.distanciaTexto || `${data.distanciaKm || 0} km`}</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg border border-green-100">
                        <p className="text-xs text-green-600 font-medium">Tempo Estimado</p>
                        <p className="text-xl font-bold text-green-800">{distanciaRota?.duracaoTexto || data.tempoEstimado || "—"}</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg border border-green-100">
                        <p className="text-xs text-green-600 font-medium">Pontos</p>
                        <p className="text-xl font-bold text-green-800">{data.enderecos?.length || 0}</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg border border-green-100">
                        <p className="text-xs text-green-600 font-medium">Pedágio</p>
                        {/* UPGRADE-REGRAS: input numérico manual reflete em data.pedagio → custo da OS
                            (ordemServicoService grava valor_pedagio). Fonte: API de rota quando existir. */}
                        <div className="relative mt-1">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={data.pedagio ?? 0}
                            readOnly={readOnly}
                            onChange={(e) => {
                              update("pedagio", Number(e.target.value));
                              setPedagioInfo({ fonte: "manual", atualizadoEm: new Date().toISOString() });
                            }}
                            className="h-8 text-sm font-bold text-green-800 text-center pr-6"
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-green-600">R$</span>
                        </div>
                        <p className="text-[9px] text-green-600 mt-1">
                          {pedagioInfo.fonte === "api"
                            ? `Via API de rota${pedagioInfo.provider ? ` (${pedagioInfo.provider})` : ""}`
                            : pedagioInfo.fonte === "manual"
                              ? "Informe manualmente se houver"
                              : "Não identificado — informe manualmente"}
                        </p>
                      </div>
                    </div>
                    {/* ETAPA-4 — Detalhamento de pedágio por praça (total continua editável) */}
                    <div className="mt-2 overflow-hidden rounded-xl border border-green-200 bg-white/70">
                      <button
                        type="button"
                        onClick={() => setMostrarPedagiosDetalhe((v) => !v)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                      >
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-green-800">
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mostrarPedagiosDetalhe ? "rotate-180" : ""}`} />
                          Detalhar pedágios
                          <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">
                            {pedagiosDetalhe.length} praça{pedagiosDetalhe.length === 1 ? "" : "s"}
                          </span>
                        </span>
                        <span className="text-xs font-bold text-green-800">Total: R$ {(data.pedagio || 0).toFixed(2)}</span>
                      </button>

                      {mostrarPedagiosDetalhe && (
                        <div className="space-y-2 border-t border-green-100 px-3 py-3">
                          {pedagiosDetalhe.length === 0 && (
                            <p className="text-[11px] text-muted-foreground">
                              Nenhuma praça informada. Adicione as praças abaixo ou mantenha o valor total manual.
                            </p>
                          )}
                          {pedagiosDetalhe.map((p, pi) => (
                            <div key={pi} className="flex items-center gap-2">
                              <Input
                                value={p.praca}
                                readOnly={readOnly}
                                onChange={(e) => updatePedagios(pedagiosDetalhe.map((item, i) => (i === pi ? { ...item, praca: e.target.value } : item)))}
                                placeholder="Praça (ex.: Anchieta KM 32)"
                                className="h-8 flex-1 text-xs"
                              />
                              <div className="relative w-28 shrink-0">
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={p.valor}
                                  readOnly={readOnly}
                                  onChange={(e) => updatePedagios(pedagiosDetalhe.map((item, i) => (i === pi ? { ...item, valor: Number(e.target.value) } : item)))}
                                  className="h-8 pr-6 text-right text-xs font-semibold"
                                />
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">R$</span>
                              </div>
                              {!readOnly && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-red-600"
                                  onClick={() => updatePedagios(pedagiosDetalhe.filter((_, i) => i !== pi))}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          ))}

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {!readOnly && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 text-xs"
                                onClick={() => updatePedagios([...pedagiosDetalhe, { praca: "", valor: 0 }])}
                              >
                                <Plus className="h-3.5 w-3.5" /> Adicionar praça
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 bg-green-600 text-xs text-white hover:bg-green-700"
                              disabled={readOnly || pedagiosDetalhe.length === 0}
                              onClick={() => {
                                const total = pedagiosDetalhe.reduce((soma, item) => soma + (Number(item.valor) || 0), 0);
                                update("pedagio", Number(total.toFixed(2)));
                                setPedagioInfo({ fonte: "manual", atualizadoEm: new Date().toISOString() });
                                toast.success(`Total de pedágio aplicado: R$ ${total.toFixed(2)}`);
                              }}
                            >
                              Usar total das praças
                            </Button>
                            <span className="text-[10px] text-muted-foreground">O valor total acima permanece livre para edição manual.</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-4">
                      <Select value={rotaSelecionada} onValueChange={(v) => handleTrocarRota(v as TipoRota)} disabled={readOnly || calculandoDistancia}>
                        <SelectTrigger className="w-[220px] h-8 text-xs"><SelectValue placeholder="Tipo de rota" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rapida">Rota mais rapida</SelectItem>
                          <SelectItem value="curta">Rota mais curta</SelectItem>
                          <SelectItem value="operacional">Rota operacional recomendada</SelectItem>
                        </SelectContent>
                      </Select>
                      {distanciasAlternativas && (
                        <span className="text-xs text-green-700">
                          {rotaSelecionada === "rapida" && `Rapida: ${distanciasAlternativas.rapida?.distanciaTexto || "—"} (${distanciasAlternativas.rapida?.duracaoTexto || "—"})`}
                          {rotaSelecionada === "curta" && `Curta: ${distanciasAlternativas.curta?.distanciaTexto || "—"} (${distanciasAlternativas.curta?.duracaoTexto || "—"})`}
                          {rotaSelecionada === "operacional" && `Operacional: ${distanciasAlternativas.operacional?.distanciaTexto || "—"} (${distanciasAlternativas.operacional?.duracaoTexto || "—"})`}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="carga" className="space-y-4">
              <Card className="border-none shadow-md rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2"><Package className="w-5 h-5 text-primary"/> Detalhamento da Carga</CardTitle>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
                  <Field label="Tipo Carga" className="lg:col-span-2">
                    <Select value={data.carga.tipo} onValueChange={(v) => updateCarga("tipo", v)} disabled={readOnly}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Seca">Seca</SelectItem>
                        <SelectItem value="Fragil">Frágil</SelectItem>
                        <SelectItem value="Documento">Documento</SelectItem>
                        <SelectItem value="Refrigerada">Refrigerada</SelectItem>
                        <SelectItem value="Congelada">Congelada</SelectItem>
                        <SelectItem value="Mista">Mista</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Descrição" className="lg:col-span-4"><Input value={data.carga.descricao} readOnly={readOnly} onChange={(e) => updateCarga("descricao", e.target.value)} /></Field>
                  <Field label="Volumes"><Input type="number" value={data.carga.volumes} readOnly={readOnly} onChange={(e) => updateCarga("volumes", Number(e.target.value))} /></Field>
                  <Field label="Peso Total (Kg)"><Input type="number" value={data.carga.peso} readOnly={readOnly} onChange={(e) => updateCarga("peso", Number(e.target.value))} /></Field>
                  <Field label="Cubagem (m³)">
                    <Input type="number" value={data.carga.cubagem || resultadoCubagem?.cubagemTotal || 0} readOnly={readOnly} onChange={(e) => updateCarga("cubagem", Number(e.target.value))} />
                    {resultadoCubagem?.cubagemManual && <span className="text-xs text-amber-600 italic">Cubagem alterada manualmente</span>}
                  </Field>
                  <Field label="Valor Declarado"><Input type="number" value={data.carga.valorDeclarado} readOnly={readOnly} onChange={(e) => updateCarga("valorDeclarado", Number(e.target.value))} /></Field>
                  
                  <div className="lg:col-span-6 grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                    <Field label="Dimensões (CxLxA cm)">
                      <div className="flex items-center gap-1">
                        <Input type="number" placeholder="C" value={data.carga.comprimento} readOnly={readOnly} onChange={(e) => updateCarga("comprimento", Number(e.target.value))} />
                        <Input type="number" placeholder="L" value={data.carga.largura} readOnly={readOnly} onChange={(e) => updateCarga("largura", Number(e.target.value))} />
                        <Input type="number" placeholder="A" value={data.carga.altura} readOnly={readOnly} onChange={(e) => updateCarga("altura", Number(e.target.value))} />
                      </div>
                    </Field>
                    <Field label="Peso por Volume (kg)">
                      <Input
                        type="number"
                        step="0.01"
                        value={data.carga.pesoPorVolume || resultadoCubagem?.pesoPorVolume?.toFixed(2) || ""}
                        readOnly={readOnly}
                        onChange={(e) => updateCarga("pesoPorVolume", Number(e.target.value))}
                        className={readOnly ? "bg-slate-50" : ""}
                      />
                    </Field>
                    {(data.carga.tipo === 'Refrigerada' || data.carga.tipo === 'Congelada' || data.carga.tipo === 'Mista') && (
                      <Field label="Temperatura (Mín/Máx)">
                        <div className="flex items-center gap-2">
                          <Input type="number" placeholder="Min" value={data.carga.temperaturaMinima} readOnly={readOnly} onChange={(e) => updateCarga("temperaturaMinima", Number(e.target.value))} />
                          <Input type="number" placeholder="Max" value={data.carga.temperaturaMaxima} readOnly={readOnly} onChange={(e) => updateCarga("temperaturaMaxima", Number(e.target.value))} />
                        </div>
                      </Field>
                    )}
                  </div>

                  <div className="lg:col-span-6">
                    <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-blue-700">
                      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>Cálculo inteligente: preencha <strong>2 dos 3</strong> campos — <strong>Volumes</strong>, <strong>Peso Total (Kg)</strong> e <strong>Peso por Volume (kg)</strong> — e o terceiro é preenchido automaticamente.</span>
                    </div>
                  </div>

                  <div className="lg:col-span-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="text-center">
                        <p className="text-xs text-blue-600 font-medium">Volume Unit.</p>
                        <p className="text-lg font-bold text-blue-800">{resultadoCubagem?.volumeUnitario?.toFixed(4) || "0.0000"} m³</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-blue-600 font-medium">Peso/Volume</p>
                        <p className="text-lg font-bold text-blue-800">{resultadoCubagem?.pesoPorVolume?.toFixed(2) || "0.00"} kg</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-blue-600 font-medium">Cubagem Total</p>
                        <p className="text-lg font-bold text-blue-800">{resultadoCubagem?.cubagemTotal?.toFixed(4) || "0.0000"} m³</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-blue-600 font-medium">Tipo Carga</p>
                        <p className="text-lg font-bold text-blue-800">{resultadoCubagem?.tipoCarga || "Seca"}</p>
                      </div>
                    </div>
                    
                    {(alertasCubagem ?? []).length > 0 && (
                      <div className="mt-3 space-y-2">
                        {(alertasCubagem ?? []).map((alerta: any, i: number) => (
                          <div key={i} className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                            alerta.tipo === "alerta" ? "bg-red-50 text-red-700 border border-red-200" :
                            alerta.tipo === "aviso" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                            "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}>
                            <AlertTriangle className="w-4 h-4" />
                            <span>{alerta.mensagem}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-6">
                    <Field label="Observações da Carga"><Textarea value={data.carga.observacoesCarga} readOnly={readOnly} onChange={(e) => updateCarga("observacoesCarga", e.target.value)} rows={2} /></Field>
                  </div>

                  <div className="lg:col-span-6 grid grid-cols-2 md:grid-cols-4 gap-6 p-6 rounded-2xl bg-slate-50 border border-slate-100 mt-2">
                    <div className="flex items-center gap-3"><Switch checked={data.carga.refrigerada || data.carga.tipo === 'Refrigerada'} onCheckedChange={(v) => updateCarga("refrigerada", v)} disabled={readOnly} /><Label className="text-sm font-medium">Refrigerada</Label></div>
                    <div className="flex items-center gap-3"><Switch checked={data.carga.fragil} onCheckedChange={(v) => updateCarga("fragil", v)} disabled={readOnly} /><Label className="text-sm font-medium">Frágil</Label></div>
                    <div className="flex items-center gap-3"><Switch checked={data.carga.ajudante} onCheckedChange={(v) => updateCarga("ajudante", v)} disabled={readOnly} /><Label className="text-sm font-medium">Ajudante</Label></div>
                    <div className="flex items-center gap-3"><Switch checked={data.carga.risco} onCheckedChange={(v) => updateCarga("risco", v)} disabled={readOnly} /><Label className="text-sm font-medium">Carga de Risco</Label></div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="veiculo" className="space-y-4">
              <Card className="border-none shadow-md rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2"><Truck className="w-5 h-5 text-primary"/> Dados do Veiculo</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Placa do Veiculo" required><Input value={data.veiculoPlaca || ''} readOnly={readOnly} onChange={(e) => update("veiculoPlaca", e.target.value.toUpperCase())} placeholder="ABC-1234" className="font-mono" /></Field>
                    <Field label="Tipo de Veiculo">
                      <select value={data.veiculoTipo || ''} onChange={(e) => update("veiculoTipo", e.target.value)} disabled={readOnly} className="w-full h-10 rounded-lg border px-3 text-sm">
                        <option value="">Selecionar...</option>
                        {TIPOS_VEICULO.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </CardContent>
              </Card>
              {sugestoesVeiculo.length > 0 && (
                <Card className="border-none shadow-md rounded-2xl overflow-hidden bg-blue-50/50 border-blue-100">
                  <CardHeader className="bg-blue-50 pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-700"><Truck className="w-4 h-4"/> Sugestões por Carga</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
<div className="flex flex-wrap gap-2">
                      {(sugestoesVeiculo ?? []).slice(0, 4).map((s: any, i: number) => (
                        <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${s.adequado ? 'bg-white border-blue-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">{s.label}</span>
                            <span className="text-[10px] text-muted-foreground">{s.motivo}</span>
                          </div>
                          <Button 
                            variant={s.adequado ? "default" : "outline"} 
                            size="sm" 
                            className="ml-2 h-7 text-xs" 
                            onClick={() => {
                              if (s && s.tipo) {
                                update("veiculoTipo", s.tipo);
                                const tipoCarga = data?.carga?.tipo;
                                if (tipoCarga === "Refrigerada" || tipoCarga === "Congelada" || tipoCarga === "Mista") {
                                  update("veiculoTermica", s.refrigerado ? (tipoCarga === "Congelada" ? "congelado" : "refrigerado") : "seco");
                                }
                                toast.success(`${s.label} selecionado`);
                              }
                            }} 
                            disabled={readOnly || !s?.adequado}
                          >Aplicar</Button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 text-xs text-blue-600 flex items-center gap-4">
                      <span>Peso necessário: <strong>{resultadoCubagem?.cubagemTotal ? (data.carga.peso || 0) + ' kg' : 'N/A'}</strong></span>
                      <span>Cubagem necessária: <strong>{resultadoCubagem?.cubagemTotal?.toFixed(4) || '0'} m³</strong></span>
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card className="border-none shadow-md rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2"><Truck className="w-5 h-5 text-primary"/> Especificações do Veículo</CardTitle>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Field label="Tipo de Veículo">
                    <Select value={data.veiculoTipo} onValueChange={(v) => update("veiculoTipo", v)} disabled={readOnly}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        {TIPOS_VEICULO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Sugestão por Carga">
                    <div className="flex items-center gap-2">
                      <Input value={sugestaoVeiculo?.label || "—"} readOnly className="bg-slate-50 italic text-blue-600" />
                      <Button variant="outline" size="sm" onClick={() => {
                        if (sugestaoVeiculo?.tipo) {
                          update("veiculoTipo", sugestaoVeiculo.tipo);
                          toast.info(`Veículo ${sugestaoVeiculo.label} selecionado`);
                        }
                      }} disabled={readOnly || !sugestaoVeiculo}>Aplicar</Button>
                    </div>
                    {sugestaoVeiculo?.motivo && (
                      <span className="text-xs text-blue-600 italic">{sugestaoVeiculo.motivo}</span>
                    )}
                  </Field>
                  <Field label="Classificação Térmica">
                    <Select value={data.veiculoTermica} onValueChange={(v) => update("veiculoTermica", v)} disabled={readOnly}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent><SelectItem value="seco">Baú Seco</SelectItem><SelectItem value="refrigerado">Refrigerado</SelectItem><SelectItem value="congelado">Congelado</SelectItem></SelectContent>
                    </Select>
                  </Field>
                  <Field label="Carroceria">
                     <Select value={data.veiculoCarroceria} onValueChange={(v) => update("veiculoCarroceria", v)} disabled={readOnly}>
                       <SelectTrigger><SelectValue/></SelectTrigger>
                       <SelectContent><SelectItem value="bau">Baú Fechado</SelectItem><SelectItem value="sider">Sider</SelectItem><SelectItem value="grade">Grade Baixa</SelectItem><SelectItem value="carreta">Carreta</SelectItem></SelectContent>
                     </Select>
                  </Field>
                  <div className="flex items-center gap-3 mt-6 lg:col-span-2"><Switch checked={data.retornoObrigatorio} onCheckedChange={(v) => update("retornoObrigatorio", v)} disabled={readOnly} /><Label className="text-sm font-medium text-orange-700">Retorno Obrigatório (Logística Reversa)</Label></div>
                  <div className="lg:col-span-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" />
                    <span>Veículo sugerido automaticamente com base na carga. Pode ser alterado pela torre conforme disponibilidade.</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

<TabsContent value="valores" className="space-y-4">
              <Card className="border-none shadow-md rounded-2xl overflow-hidden bg-blue-50/30 border-blue-100">
                <CardContent className="p-4">
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center">
                    {/* UPGRADE-REGRAS: Valor Cliente e Margem visíveis apenas para admin máximo */}
                    <div>
                      <p className="text-xs text-blue-600 font-medium">Valor Cliente</p>
                      <p className="text-lg font-bold text-blue-700">{verReceitaMargem ? `R$ ${data.valorCliente.toFixed(2)}` : "---"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-orange-600 font-medium">Prestador</p>
                      <p className="text-lg font-bold text-orange-700">R$ {data.custoPrestador.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-green-600 font-medium">Pedágio</p>
                      <p className="text-lg font-bold text-green-700">R$ {data.pedagio.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-purple-600 font-medium">Margem</p>
                      <p className="text-lg font-bold text-purple-700">{verReceitaMargem ? `${data.valorCliente > 0 ? (((data.valorCliente - data.custoPrestador) / data.valorCliente) * 100).toFixed(1) : 0}%` : "---"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Distância</p>
                      <p className="text-lg font-bold text-slate-700">{distanciaRota?.distanciaKm?.toFixed(1) || data.distanciaKm || 0} km</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Tabela</p>
                      <p className="text-xs font-bold text-slate-700">{data.tabelaAplicada || "Padrão"}</p>
                    </div>
                  </div>
                  {faixaCalculada && (
                    <div className="mt-2 text-xs text-center text-slate-500">
                      {faixaCalculada} • Distância calculada automaticamente a partir da rota •{" "}
                      <span className="text-blue-600">Valores calculados conforme tabela do cliente ou fallback teste</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-none shadow-md rounded-2xl overflow-hidden">
                  <CardHeader className="bg-slate-50/50 border-b pb-4">
                    <CardTitle className="text-base font-bold flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary"/> Composição Financeira</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-xl border space-y-4">
                        <h4 className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
                          Valores Operacionais
                          {data.tabelaAplicada && data.valorCliente > 0 && (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[9px] ml-auto">
                              {data.tabelaAplicada.length > 20 ? data.tabelaAplicada.substring(0, 20) + '…' : data.tabelaAplicada}
                            </Badge>
                          )}
                        </h4>
                        <Field label="Valor p/ Cliente">
                          <div className="relative">
                            <Input type="number" value={data.valorCliente} readOnly={readOnly} onChange={(e) => { update("valorCliente", Number(e.target.value)); setData(p => ({ ...p, valorClienteEditado: true })); }} className="text-lg font-bold text-blue-600 pr-8" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-400">R$</span>
                          </div>
                        </Field>
                        <Field label="Valor p/ Prestador">
                          <div className="relative">
                            <Input type="number" value={data.custoPrestador} readOnly={readOnly} onChange={(e) => { update("custoPrestador", Number(e.target.value)); setData(p => ({ ...p, custoPrestadorEditado: true })); }} className="text-lg font-bold text-orange-600 pr-8" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-orange-400">R$</span>
                          </div>
                        </Field>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border space-y-4">
                        <h4 className="text-xs font-bold uppercase text-slate-500">Adicionais e Taxas</h4>
                        <div className="grid grid-cols-2 gap-2">
                           <Field label="Pedágio">
                             <div className="relative">
                               <Input type="number" value={data.pedagio} readOnly={readOnly} onChange={(e) => update("pedagio", Number(e.target.value))} />
                               <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">R$</span>
                             </div>
                           </Field>
                           <Field label="Ajudante">
                             <div className="relative">
                               <Input type="number" value={data.ajudante} readOnly={readOnly} onChange={(e) => update("ajudante", Number(e.target.value))} />
                               <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">R$</span>
                             </div>
                           </Field>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                           <Field label="Adicionais">
                             <div className="relative">
                               <Input type="number" value={data.adicionais} readOnly={readOnly} onChange={(e) => update("adicionais", Number(e.target.value))} />
                               <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">R$</span>
                             </div>
                           </Field>
                           <Field label="Desconto">
                             <div className="relative">
                               <Input type="number" value={data.descontos} readOnly={readOnly} onChange={(e) => update("descontos", Number(e.target.value))} />
                               <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">R$</span>
                             </div>
                           </Field>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <Field label="Status Faturamento">
                         <Select value={data.statusFaturamento} onValueChange={(v) => update("statusFaturamento", v)} disabled={readOnly}>
                           <SelectTrigger><SelectValue/></SelectTrigger>
                           <SelectContent>
                             <SelectItem value="a vista">A vista</SelectItem>
                             <SelectItem value="a faturar">A faturar</SelectItem>
                             <SelectItem value="contrato">Contrato</SelectItem>
                             <SelectItem value="cortesia">Cortesia</SelectItem>
                             <SelectItem value="cancelado">Cancelado</SelectItem>
                           </SelectContent>
                         </Select>
                       </Field>
                       <Field label="Forma de Cobrança">
                         <Input value={data.tabelaAplicada || "Padrão"} readOnly className="bg-slate-50" />
                       </Field>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-md rounded-2xl overflow-hidden bg-primary/5 border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-primary"><Truck className="w-5 h-5"/> Alocação Torre</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <Field label="Data Programada"><Input type="date" value={data.dataProgramada} readOnly={readOnly} onChange={(e) => update("dataProgramada", e.target.value)} /></Field>
                    <Field label="Início Previsto"><Input type="datetime-local" value={data.previsaoInicio} readOnly={readOnly} onChange={(e) => update("previsaoInicio", e.target.value)} /></Field>
                    <Field label="Parceiro / Prestador">
                      {/* UPGRADE: handler compartilhado (mesmo usado no bloco "Alocação de Prestador") */}
                      <SearchableSelect table="prestadores" labelField="nome_completo" valueField="nome_completo" searchFields={['nome_completo']} filters={{ status: 'ativo' }} value={emRede ? "" : data.prestador} onChange={handleSelecionarPrestador} disabled={readOnly || emRede} />
                    </Field>
                    <Field label="Placa Alocada"><Input value={data.veiculoPlaca} readOnly={readOnly} onChange={(e) => update("veiculoPlaca", e.target.value)} placeholder="ABC-1234" /></Field>

                    {/* Separador OU */}
                    {!readOnly && data.id && !data.prestador && !emRede && (
                      <div className="flex items-center gap-3 py-2">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">ou</span>
                        <div className="flex-1 h-px bg-slate-200" />
                      </div>
                    )}

                    {/* Botão Enviar para Rede */}
                    {!readOnly && data.id && !data.prestador && !emRede && (
                      <Button
                        onClick={handleEnviarParaRede}
                        disabled={carregandoRede || data.custoPrestador <= 0}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        {carregandoRede ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Network className="w-4 h-4 mr-2" />
                        )}
                        {carregandoRede ? "Publicando..." : "Enviar para Rede de Prestadores"}
                      </Button>
                    )}

                    {/* Painel da Rede ativa */}
                    {emRede && redeOportunidade && (
                      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-indigo-800 flex items-center gap-2">
                            <Network className="w-4 h-4" /> Rede de Prestadores
                          </h4>
                          <Badge className={obterStatusRedeInfo(redeOportunidade.status).twClass}>
                            {obterStatusRedeInfo(redeOportunidade.status).label}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-indigo-600 font-medium">Valor Prestador</span>
                            <p className="font-bold text-indigo-900">R$ {redeOportunidade.valor_prestador.toFixed(2)}</p>
                          </div>
                          <div>
                            <span className="text-indigo-600 font-medium">Expira em</span>
                            <p className="font-bold text-indigo-900">
                              {redeOportunidade.prazo_expiracao
                                ? new Date(redeOportunidade.prazo_expiracao).toLocaleString("pt-BR")
                                : "Sem prazo"}
                            </p>
                          </div>
                        </div>

                        {/* Missão A27: aceite da Rede (prestador/veículo/data/alocação) */}
                        {redeOportunidade.status === "aceita" && aceiteRedeInfo && (
                          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                            <h4 className="text-xs font-bold text-green-800 uppercase flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4" /> Aceita na Rede de Prestadores
                            </h4>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <span className="text-green-600 font-medium">Prestador</span>
                                <p className="font-bold text-green-900">{aceiteRedeInfo.prestador}</p>
                              </div>
                              <div>
                                <span className="text-green-600 font-medium">Veículo</span>
                                <p className="font-bold text-green-900">
                                  {aceiteRedeInfo.tipo_veiculo || "—"}
                                  {aceiteRedeInfo.placa ? ` • ${aceiteRedeInfo.placa}` : ""}
                                </p>
                              </div>
                              <div>
                                <span className="text-green-600 font-medium">Aceite em</span>
                                <p className="font-bold text-green-900">
                                  {aceiteRedeInfo.aceite_em
                                    ? new Date(aceiteRedeInfo.aceite_em).toLocaleString("pt-BR")
                                    : "—"}
                                </p>
                              </div>
                              <div>
                                <span className="text-green-600 font-medium">Origem da alocação</span>
                                <p className="font-bold text-green-900">Rede de Oportunidades</p>
                              </div>
                            </div>
                            {aceiteRedeInfo.alocacao_id && (
                              <p className="text-[10px] text-green-700 bg-green-100 rounded p-1.5">
                                Alocação {aceiteRedeInfo.alocacao_id}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Prestadores compatíveis */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-indigo-700 uppercase">
                              {prestadoresCompativeis.length} Prestador(es) Compatível(is)
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] text-indigo-600"
                              onClick={handleAtualizarCompativeis}
                              disabled={carregandoRede}
                            >
                              <Loader2 className={`w-3 h-3 mr-1 ${carregandoRede ? "animate-spin" : ""}`} />
                              Atualizar
                            </Button>
                          </div>
                          {prestadoresCompativeis.length > 0 ? (
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {prestadoresCompativeis.map((p) => (
                                <div key={p.prestador_id} className="bg-white rounded-lg p-2 border border-indigo-100 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Users className="w-3 h-3 text-indigo-400" />
                                    <span className="text-xs font-medium text-slate-700">{p.nome_completo}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {p.tipo_veiculo && (
                                      <Badge variant="outline" className="text-[9px] h-4">{p.tipo_veiculo}</Badge>
                                    )}
                                    <span className="text-[10px] font-bold text-indigo-600">{p.score_match}pts</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-indigo-500 italic">Nenhum prestador compatível encontrado no momento</p>
                          )}
                        </div>

                        {/* Ações */}
                        <div className="flex items-center gap-2 pt-2 border-t border-indigo-200">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-8"
                            onClick={handleCancelarRede}
                          >
                            Cancelar Oportunidade
                          </Button>
                        </div>
                      </div>
                    )}
                   
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
                      <h4 className="text-xs font-bold text-amber-800 uppercase flex items-center gap-2"><AlertTriangle className="w-3 h-3"/> Ajuste Manual de Veiculo/Tabela</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label={`Tipo de Veiculo (auto: ${data.veiculoTipo || '—'})`}>
                          <Select value={data.veiculoTipo} onValueChange={(v) => {
                            if (!data.veiculoTipoOriginal) setData(p => ({ ...p, veiculoTipoOriginal: data.veiculoTipo }));
                            update("veiculoTipo", v);
                            if (!data.motivoAjusteManual) setShowMotivoDialog(true);
                            if (!data.valorClienteEditado) recalcularValores(data.distanciaKm || 0, v, data.cliente);
                          }} disabled={readOnly}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger>
                            <SelectContent>
                              {TIPOS_VEICULO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Tabela Aplicada">
                          <Input value={data.tabelaAplicada} readOnly={readOnly} onChange={(e) => {
                            if (!data.tabelaOriginal) setData(p => ({ ...p, tabelaOriginal: data.tabelaAplicada }));
                            update("tabelaAplicada", e.target.value);
                            if (!data.motivoAjusteManual) setShowMotivoDialog(true);
                          }} placeholder="Nome da tabela" className="text-xs" />
                        </Field>
                      </div>
                      {data.motivoAjusteManual && (
                        <div className="text-[10px] text-amber-700 bg-amber-100 p-2 rounded">
                          Motivo: {data.motivoAjusteManual}
                          {data.veiculoTipoOriginal && <span> | Veic. original: {data.veiculoTipoOriginal}</span>}
                          {data.tabelaOriginal && <span> | Tabela original: {data.tabelaOriginal}</span>}
                          <button className="ml-2 text-amber-500 underline" onClick={() => setShowMotivoDialog(true)}>alterar</button>
                        </div>
                      )}
                    </div>
                   
                   <div className="flex items-center justify-between pt-4 border-t">
                     <div className="flex items-center gap-2">
                       <Switch checked={enviarWhatsAppAuto} onCheckedChange={(v) => setEnviarWhatsAppAuto(v)} disabled={readOnly || !data.prestador} />
                       <Label className="text-sm font-medium">Enviar WhatsApp auto ao salvar</Label>
                     </div>
                     {enviarWhatsAppAuto && data.prestador && (
                       <Badge variant="outline" className="text-green-600 border-green-300"> will send to {data.prestador}</Badge>
                     )}
                   </div>

                   <Card className="mt-4 border-none shadow-md rounded-2xl overflow-hidden bg-primary/5 border-primary/20">
                     <CardHeader className="pb-2">
                       <CardTitle className="text-base font-bold flex items-center gap-2 text-primary"><Send className="w-5 h-5"/> Envios e Acompanhamento</CardTitle>
                       <CardDescription className="text-muted-foreground">Enviar mensagens de acompanhamento para OS</CardDescription>
                     </CardHeader>
                     <CardContent className="p-4 space-y-3">
                       <div className="grid grid-cols-1 gap-2">
                         <Button variant="outline" className="justify-start text-left h-auto py-2" onClick={async () => {
                           const telef = data.whatsappDestinatario || data.enderecos?.[0]?.telefone;
                           if (!telef) { toast.error("Telefone do cliente não encontrado"); return; }
                           const msg = `Sua encomenda está em trânsito pela Conexão Express.\nStatus: saiu para entrega.\nPrevisão: ${data.previsaoTermino || "em breve"}.\nEndereço: ${data.enderecos?.[data.enderecos?.length - 1]?.endereco || ""}`;
                           await WhatsAppEnviar(telef.replace(/\D/g, ""), msg);
                           toast.success("Acompanhamento enviado!");
                         }} disabled={readOnly || !data.id}>
                           <MessageCircle className="w-4 h-4 mr-2" /> Acompanhamento Cliente Final
                         </Button>
                         <Button variant="outline" className="justify-start text-left h-auto py-2" onClick={async () => {
                           if (!data.prestador) { toast.error("Selecione um prestador primeiro"); return; }
                           const { data: p } = await supabase.from("prestadores").select("telefone").eq("nome_completo", data.prestador).single();
                           if (!p?.telefone) { toast.error("Telefone do prestador não encontrado"); return; }
                           const msg = `Instruções da OS ${data.numero}\nColeta: ${data.enderecos?.[0]?.endereco || ""}\nEntrega: ${data.enderecos?.[data.enderecos?.length - 1]?.endereco || ""}\nValor que será pago: R$ ${data.custoPrestador.toFixed(2)}`;
                           await WhatsAppEnviar(p.telefone.replace(/\D/g, ""), msg);
                           toast.success("Instruções enviadas ao prestador!");
                         }} disabled={readOnly || !data.prestador || !data.id}>
                           <Truck className="w-4 h-4 mr-2" /> Instruções Motorista/Prestador
                         </Button>
                         <Button variant="outline" className="justify-start text-left h-auto py-2" onClick={async () => {
                           const col = data.enderecos?.find(e => e.tipo === "coleta") || data.enderecos?.[0];
                           if (!col?.telefone) { toast.error("Telefone do cliente não encontrado"); return; }
                           const msg = `Ordem de Serviço criada.\nOS: ${data.numero}\nStatus: em programação.\nOrigem: ${col?.endereco || ""}\nDestino: ${data.enderecos?.[data.enderecos?.length - 1]?.endereco || ""}`;
                           await WhatsAppEnviar(col.telefone.replace(/\D/g, ""), msg);
                           toast.success("Aviso enviado ao cliente!");
                         }} disabled={readOnly || !data.id}>
                           <FileText className="w-4 h-4 mr-2" /> Aviso Cliente Contratante
                         </Button>
                       </div>
                       <p className="text-xs text-muted-foreground mt-2">As mensagens são enviadas via WhatsApp. O salvamento da OS não é bloqueado por falhas no envio.</p>
                     </CardContent>
                   </Card>
                    
                    <div className="pt-4 border-t space-y-2">
                       <div className="flex justify-between text-xs"><span className="text-muted-foreground">Distância:</span><span className="font-bold">{distanciaRota?.distanciaTexto || "—"}</span></div>
                       <div className="flex justify-between text-xs"><span className="text-muted-foreground">Tabela:</span><span className="font-bold">{data.tabelaAplicada || "Padrão"}</span></div>
                       <div className="flex justify-between text-xs"><span className="text-muted-foreground">Faixa:</span><span className="font-bold">{faixaCalculada || "N/A"}</span></div>
                        {/* UPGRADE-REGRAS: lucro (margem) estimado restrito a admin */}
                        <div className="flex justify-between text-sm pt-2"><span className="text-muted-foreground">Lucro Est.:</span><span className="font-bold text-green-600">{verReceitaMargem ? `R$ ${(data.valorCliente - data.custoPrestador).toFixed(2)}` : "---"}</span></div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-3 border-none shadow-md rounded-2xl overflow-hidden bg-green-50 border-green-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-green-700"><MessageCircle className="w-5 h-5"/> Mensagens de WhatsApp</CardTitle>
                    <CardDescription className="text-green-600">
                      Template 1 — Resumo da Rota (privacidade: sem número da porta). Template 2 — Orientação de Execução (OS completa). E a mensagem de rastreio para o cliente/destinatário.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-green-700 mb-1">Template 1 — Resumo da Rota</p>
                      <Textarea value={gerarMensagemWhatsAppOS(data)} readOnly className="bg-white font-mono text-sm h-56 border-green-200" />
                      <Button onClick={copiarWhatsApp} className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white">
                        <CopyIcon className="w-4 h-4 mr-2" /> Copiar WhatsApp
                      </Button>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-1">Template 2 — Orientação de Execução</p>
                      <Textarea value={gerarMensagemOrientacaoExecucao(data)} readOnly className="bg-white font-mono text-sm h-64 border-emerald-200" />
                      <Button onClick={copiarOrientacaoExecucao} className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                        <ListChecks className="w-4 h-4 mr-2" /> Copiar Orientação (OS Completa)
                      </Button>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-blue-700 mb-1">WhatsApp Cliente (Rastreio)</p>
                      <Textarea value={mensagemClienteRastreio()} readOnly className="bg-white font-mono text-sm h-24 border-blue-200" />
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <Button onClick={copiarWhatsAppClienteRastreio} variant="outline" className="border-blue-200 text-blue-600 hover:bg-blue-50">
                          <CopyIcon className="w-4 h-4 mr-2" /> Copiar
                        </Button>
                        <Button onClick={abrirWhatsAppClienteRastreio} className="bg-blue-600 hover:bg-blue-700 text-white">
                          <MessageCircle className="w-4 h-4 mr-2" /> Enviar no WhatsApp
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

<TabsContent value="historico" className="space-y-4">
                {/* Etapas Operacionais */}
                <Card className="border-none shadow-md rounded-2xl overflow-hidden">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2"><Clock className="w-4 h-4 text-primary"/> Etapas Operacionais</CardTitle>
                    <CardDescription>Acompanhamento do ciclo de vida da OS</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1 overflow-x-auto pb-2">
                      {(() => {
                        const statusGlobalAtual = obterStatusGlobalOS(data.status);
                        const idxAtualGlobal = STATUS_GLOBAL_ORDER.indexOf(statusGlobalAtual);
                        const icons: Record<string, React.ElementType> = {
                          rascunho: FileText, pendente: Clock, alocado: Calendar,
                          carregando: Package, em_rota: Truck, entregue: CheckCircle,
                          finalizado: CheckCircle2, faturado: CreditCard, pago_prestador: DollarSign,
                        };
                        return STATUS_GLOBAL_ORDER.map((key, i) => {
                          const concluida = i < idxAtualGlobal;
                          const atual = key === statusGlobalAtual;
                          const Icon = icons[key] || FileText;
                          return (
                            <React.Fragment key={key}>
                              <div className={`flex flex-col items-center gap-1 min-w-[80px] ${concluida || atual ? 'opacity-100' : 'opacity-40'}`}>
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                                  concluida ? 'bg-emerald-500 border-emerald-500 text-white' : 
                                  atual ? 'bg-blue-500 border-blue-500 text-white' : 
                                  'bg-white border-slate-300 text-slate-400'
                                }`}>
                                  {concluida ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                                </div>
                                <span className={`text-[9px] font-bold text-center ${concluida ? 'text-emerald-700' : atual ? 'text-blue-700' : 'text-slate-400'}`}>
                                  {STATUS_GLOBAL_INFO[key].label}
                                </span>
                              </div>
                              {i < STATUS_GLOBAL_ORDER.length - 1 && (
                                <div className={`h-0.5 flex-1 min-w-[12px] ${concluida ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                              )}
                            </React.Fragment>
                          );
                        });
                      })()}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-md rounded-2xl overflow-hidden bg-green-50/30 border-green-100">
                  <CardHeader className="bg-green-50 pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-green-700"><Clock className="w-4 h-4"/> Resumo Operacional</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center">
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Eventos</p>
                        <p className="text-lg font-bold text-slate-700">{(data.historico || []).length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Veículo</p>
                        <p className="text-lg font-bold text-slate-700">{data.veiculoTipo || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Carga</p>
                        <p className="text-lg font-bold text-slate-700">{data.carga?.tipo || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Distância</p>
                        <p className="text-lg font-bold text-slate-700">{distanciaRota?.distanciaKm?.toFixed(1) || data.distanciaKm || 0} km</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Tempo</p>
                        <p className="text-lg font-bold text-slate-700">{distanciaRota?.duracaoTexto || data.tempoEstimado || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 font-medium">Valor Cliente</p>
                        {/* UPGRADE-REGRAS: resumo da etapa Resumo/Envio — receita restrita a admin */}
                        <p className="text-lg font-bold text-blue-700">{verReceitaMargem ? `R$ ${(data.valorCliente || 0).toFixed(2)}` : "---"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-orange-600 font-medium">Valor Prestador</p>
                        <p className="text-lg font-bold text-orange-700">R$ {(data.custoPrestador || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-green-600 font-medium">Tabela</p>
                        <p className="text-lg font-bold text-green-700">{data.tabelaAplicada || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-purple-600 font-medium">Prestador</p>
                        <p className="text-lg font-bold text-purple-700">{data.prestador || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Status</p>
                        <p className="text-lg font-bold text-slate-700">{STATUS_CORES[data.status as OSStatus]?.label || data.status}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
               
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <Card className="border-none shadow-md rounded-2xl overflow-hidden">
                   <CardHeader className="bg-slate-50/50 border-b pb-4">
                     <CardTitle className="text-base font-bold flex items-center gap-2"><Clock className="w-5 h-5 text-primary"/> Histórico Operacional Completo</CardTitle>
                   </CardHeader>
                   <CardContent className="p-6">
                      <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:-translate-x-px before:bg-gradient-to-b before:from-slate-200 before:via-slate-200 before:to-transparent">
                         {(data.historico || []).map((h, i) => (
                           <div key={i} className="relative flex items-start gap-6 pl-12 group">
                             <div className="absolute left-0 mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-white border-2 border-primary shadow-sm group-last:border-slate-300">
                                <CheckCircle2 className="w-5 h-5 text-primary group-last:text-slate-300" />
                             </div>
                             <div>
                               <p className="text-sm font-bold text-slate-800">{h.acao}</p>
                               <div className="flex items-center gap-3 mt-1">
                                 <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3"/> {new Date(h.data).toLocaleString('pt-BR')}</span>
                                 <span className="text-[10px] uppercase font-bold text-primary flex items-center gap-1"><Avatar className="w-4 h-4"><AvatarFallback className="text-[8px]">{h.usuario[0]}</AvatarFallback></Avatar> {h.usuario}</span>
                               </div>
                               {h.status_novo && <Badge variant="outline" className="mt-2 text-[9px] uppercase tracking-wider">{STATUS_CORES[h.status_novo as OSStatus]?.label || h.status_novo}</Badge>}
                             </div>
                           </div>
                         ))}
                      </div>
                   </CardContent>
                 </Card>

                 <Card className="border-none shadow-md rounded-2xl overflow-hidden">
                   <CardHeader className="bg-slate-50/50 border-b pb-4">
                     <CardTitle className="text-base font-bold flex items-center gap-2"><Shield className="w-5 h-5 text-primary"/> Entregas e Comprovantes</CardTitle>
                     <CardDescription>Entregas reais da OS com comprovantes (POD) enviados pelo App Prestador</CardDescription>
                   </CardHeader>
                   <CardContent className="p-6 space-y-6">
                     {/* POD REAL — fonte oficial entregas_protocolo (A23-A/C) */}
                     {data.id ? (
                       <EntregasComprovantes osId={data.id} numeroOs={data.numero} />
                     ) : (
                       <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center">
                         <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                         <p className="text-xs text-slate-500">Salve a OS para carregar as entregas e comprovantes reais.</p>
                       </div>
                     )}

                     <div className="pt-4 border-t border-slate-100">
                       <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                         <Hash className="w-3.5 h-3.5 text-primary" /> Dados Planejados / Manual da OS
                       </p>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <Field label="Recebedor Nome"><Input value={ (data as any).recebedorNome || "" } readOnly={readOnly} onChange={(e) => setData(p => ({ ...p, recebedorNome: e.target.value }))} /></Field>
                         <Field label="Recebedor Documento"><Input value={ (data as any).recebedorDocumento || "" } readOnly={readOnly} onChange={(e) => setData(p => ({ ...p, recebedorDocumento: e.target.value }))} /></Field>
                         <Field label="Função/Vínculo">
                           <Select value={ (data as any).recebedorFuncao || "" } onValueChange={(v) => setData(p => ({ ...p, recebedorFuncao: v }))} disabled={readOnly}>
                             <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                             <SelectContent>
                               <SelectItem value="Porteiro">Porteiro</SelectItem>
                               <SelectItem value="Recepção">Recepção</SelectItem>
                               <SelectItem value="Almoxarifado">Almoxarifado</SelectItem>
                               <SelectItem value="Segurança">Segurança</SelectItem>
                               <SelectItem value="Morador">Morador</SelectItem>
                               <SelectItem value="Vizinho">Vizinho</SelectItem>
                               <SelectItem value="Familiar">Familiar</SelectItem>
                               <SelectItem value="Funcionário">Funcionário</SelectItem>
                               <SelectItem value="Outro">Outro</SelectItem>
                             </SelectContent>
                           </Select>
                         </Field>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <Field label="Data Entrega (planejada)"><Input type="date" value={ (data as any).dataEntrega || "" } readOnly={readOnly} onChange={(e) => setData(p => ({ ...p, dataEntrega: e.target.value }))} /></Field>
                         <Field label="Hora Entrega (planejada)"><Input type="time" value={ (data as any).dataEntrega ? new Date((data as any).dataEntrega).toTimeString().slice(0,5) : "" } readOnly={readOnly} onChange={(e) => setData(p => ({ ...p, horaEntrega: e.target.value }))} /></Field>
                      </div>

                      <Field label="Observação da Entrega"><Textarea value={ (data as any).observacaoEntrega || "" } readOnly={readOnly} onChange={(e) => setData(p => ({ ...p, observacaoEntrega: e.target.value }))} rows={2} /></Field>
                     </div>
                   </CardContent>
                 </Card>
                </div>
              </TabsContent>
            </Tabs>
        </EnterpriseMainContent>
        </EnterpriseFormBody>

        {/* Rodapé interno do workspace */}
        <EnterpriseWorkspaceFooter>
        <FormFooterBar
          onCancelar={handleVoltarEtapa}
          cancelarLabel="Voltar"
          onSalvarRascunho={!readOnly ? handleSalvarRascunho : undefined}
          canRascunho={!readOnly && (data.status !== "rascunho" || !data.id)}
          onSalvar={!readOnly ? handleSalvar : undefined}
          salvarLabel="Salvar OS"
          isSaving={isSaving}
          onAvancar={handleAvancarEtapa}
          canAvancar={temProximaEtapa}
          avancarLabel="Avançar"
          readOnly={readOnly}
        />
        </EnterpriseWorkspaceFooter>
        </EnterpriseFormWorkspace>
      </div>

       <Dialog open={showMotivoDialog} onOpenChange={setShowMotivoDialog}>
         <DialogContent className="max-w-md">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500"/> Motivo do Ajuste Manual</DialogTitle>
             <DialogDescription>Informe o motivo da alteracao manual de veiculo, tabela ou valores.</DialogDescription>
           </DialogHeader>
           <div className="space-y-4 py-4">
             <div className="space-y-2">
               {MOTIVOS_AJUSTE.map((m) => (
                 <Button key={m} variant={motivoAjusteManual === m ? "default" : "outline"} size="sm" className="w-full justify-start text-left h-auto py-2" onClick={() => setMotivoAjusteManual(m)}>
                   {m}
                 </Button>
               ))}
             </div>
             <Textarea value={motivoAjusteManual} onChange={(e) => setMotivoAjusteManual(e.target.value)} placeholder="Ou digite um motivo personalizado..." rows={2} />
           </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowMotivoDialog(false)}>Cancelar</Button>
              <Button onClick={confirmarAjusteManual} className="bg-amber-500 hover:bg-amber-600">Confirmar Ajuste</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </PremiumDocumentDialog>
   );
  };

export default OrdemServicoForm;
