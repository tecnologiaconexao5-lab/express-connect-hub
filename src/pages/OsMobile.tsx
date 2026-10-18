// ============================================================
// OVERHAUL-OS-MOBILE-APP-REGRAS-CUSTO — /os-mobile (v2 mobile-native)
// Extensão mobile-first do workspace conexao_express para criar
// Ordem de Serviço interna pelo celular, com UX de app de delivery:
//   • Paradas dinâmicas — lista Parada 1..N com seletor
//     [Retirada] / [Entrega] + janela de horário (início/fim);
//   • Auto-precificação do CLIENTE — calcularDistancia (Mapbox) +
//     edge "pedido-rapido" action "estimar";
//   • Motor EXATO de CUSTO DO PRESTADOR (tabela Motoboy) quando o
//     veículo é Moto — @/lib/custoMotoboy (regras a–g à letra):
//     pagamento por PRAZO — "À vista (até 24h)" / "Faturado (após 24h)" —
//     km, paradas, retorno (R$ 1,50/km da última parada → origem),
//     peso e espera → cálculo em tempo real;
//   • Margem prevista = Receita − Custo do prestador (barra fixa);
//   • Volume / Litros com helper do baú padrão da moto;
//   • Veículo por peso — regra fixa de @/lib/veiculoPeso (reuso);
//   • Prestador cadastrado (SearchableSelect) ou avulso;
//   • Financeiro pelo fluxo normal do TMS (trigger M80b);
//   • NÃO altera o formulário de OS desktop (estável).
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { EnderecoCompleto, type EnderecoType } from "@/components/ui/EnderecoCompleto";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { calcularDistancia } from "@/services/maps/distanceService";
import { criarOrdemServico, type CriarOSInput } from "@/services/ordemServicoService";
import { OPCOES_VEICULO, veiculoPorPeso, labelVeiculo } from "@/lib/veiculoPeso";
import {
  calcularCustoMotoboy,
  calcularReceitaClienteMoto,
  RECEITA_CLIENTE_MOTO,
  OPCOES_PAGAMENTO_PRESTADOR,
  FRANQUIA_ESPERA_MIN,
  FRANQUIA_PESO_KG,
  PARADAS_GRATUITAS,
  VALOR_KM_RETORNO,
  type TipoPagamentoPrestador,
} from "@/lib/custoMotoboy";
import { calcularLitros, alertaBauMoto } from "@/lib/cubagem";
// FIX-AUTOCOMPLETE-E-NOVO-TEMPLATE-WHATSAPP — MESMO template do desktop
// FIX-USABILIDADE-VEICULOS-E-DUPLO-TEMPLATE-WHATSAPP — 2 templates + rastreio
import {
  gerarMensagemWhatsAppMotoboy,
  gerarMensagemOrientacaoExecucao,
  gerarMensagemWhatsAppClienteRastreio,
} from "@/lib/osWhatsAppMessage";
import {
  UserRound,
  MapPin,
  Package,
  Calculator,
  Wallet,
  Truck,
  CalendarClock,
  CheckCircle2,
  Info,
  RotateCcw,
  Plus,
  Trash2,
  Clock,
  ArrowRight,
  TrendingUp,
  Pencil,
  RefreshCw,
  Bike,
  Copy,
  MessageCircle,
  ClipboardList,
  Ruler,
  Banknote,
} from "lucide-react";

// ============================================================
// Constantes / helpers (escopo de módulo — nunca dentro do render)
// ============================================================
const ENDERECO_VAZIO: EnderecoType = {
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", referencia: "",
};

const OPCOES_CARGA: { value: string; label: string }[] = [
  { value: "seco", label: "Seco" },
  { value: "refrigerado", label: "Refrigerado" },
  { value: "fragil", label: "Frágil" },
];

const MAX_PARADAS = 8;
const HELPER_BAU_MOTO = "(Padrão Baú Moto: aprox. 40x40x40cm ou 80 a 90 Litros)";

const enderecoCompleto = (e: EnderecoType): boolean =>
  Boolean(e.cidade?.trim() && e.estado?.trim());

const formatarEndereco = (e: EnderecoType): string =>
  [
    [e.logradouro, e.numero].filter(Boolean).join(", "),
    e.bairro,
    [e.cidade, e.estado].filter(Boolean).join("/"),
  ]
    .filter(Boolean)
    .join(" — ") || "Endereço não informado";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const numero = (v: string) => Number(String(v).replace(",", ".")) || 0;

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

// FIX-MOTOR-CUSTO-E-PRESTADOR-AVULSO — tipos de chave PIX do avulso
const OPCOES_PIX_TIPO = ["CPF/CNPJ", "Celular", "E-mail", "Chave Aleatória"] as const;
type PixTipo = (typeof OPCOES_PIX_TIPO)[number];

/** Valida a chave PIX conforme o tipo selecionado — retorna mensagem de erro ou null. */
const validarPixChave = (tipo: string, chave: string): string | null => {
  const c = chave.trim();
  if (!c) return "Informe a Chave PIX";
  const digitos = c.replace(/\D/g, "");
  switch (tipo) {
    case "CPF/CNPJ":
      return digitos.length === 11 || digitos.length === 14
        ? null
        : "Chave PIX (CPF/CNPJ) precisa ter 11 ou 14 dígitos";
    case "Celular":
      return digitos.length >= 10
        ? null
        : "Chave PIX (Celular) precisa ter DDD + número (mín. 10 dígitos)";
    case "E-mail":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) ? null : "Chave PIX (E-mail) inválida";
    default:
      // Chave Aleatória (formato UUID do Supabase)
      return c.length >= 10 ? null : "Chave PIX aleatória inválida (mín. 10 caracteres)";
  }
};

/** Telefone/WhatsApp do avulso — DDD + número. */
const validarTelefone = (tel: string): string | null =>
  tel.replace(/\D/g, "").length >= 10
    ? null
    : "Informe o telefone com DDD (mín. 10 dígitos)";

type EstimativaState = {
  status: "idle" | "calculando" | "ok" | "sem_tabela" | "erro";
  valor?: number;
  km?: number;
  fonte?: string;
  tabela?: string;
  aviso?: string;
};

type PrestadorTipo = "cadastrado" | "avulso";
type ParadaTipo = "retirada" | "entrega";

type ParadaState = {
  id: string;
  tipo: ParadaTipo;
  endereco: EnderecoType;
  janelaInicio: string; // "HH:MM"
  janelaFim: string; // "HH:MM"
};

type ResultadoState = {
  osId: string;
  osNumero: string;
  receb: { valor: number | null; status: string | null } | null;
  pag: { valor: number | null; status: string | null; fornecedor: string | null } | null;
  avulsoPagarErro?: string;
  /** Template 1 — Resumo da Rota (mesmo gerador do desktop) */
  mensagem: string;
  /** Template 2 — Orientação de Execução (OS completa) */
  mensagemOrientacao: string;
  /** WhatsApp do cliente/destinatário — link de rastreio */
  mensagemClienteRastreio: string;
};

const novaParada = (tipo: ParadaTipo): ParadaState => ({
  id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  tipo,
  endereco: ENDERECO_VAZIO,
  janelaInicio: "",
  janelaFim: "",
});

const PARADAS_INICIAIS = (): ParadaState[] => [novaParada("retirada"), novaParada("entrega")];

// Cabeçalho de etapa (delivery-style) — escopo de módulo
function SectionCard({
  step,
  icon,
  title,
  subtitle,
  children,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm overflow-visible">
      <div className="flex items-start gap-3 px-5 pt-5 pb-1">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-sm">
          {icon}
        </div>
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600">
            Etapa {step}
          </span>
          <h2 className="text-base font-semibold text-slate-900 leading-tight">{title}</h2>
          {subtitle && <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="px-5 pb-5 pt-3 space-y-4">{children}</div>
    </Card>
  );
}

// ============================================================
// FIX-CUBAGEM-RECEITA-CLIENTE-E-DASHBOARD-MOBILE
// Dashboard do gestor — abas inferiores (Nova OS / Em Aberto / Financeiro)
// ============================================================
const ABAS_MOBILE = [
  { value: "nova", label: "Nova OS", icon: Plus },
  { value: "abertas", label: "Em Aberto", icon: ClipboardList },
  { value: "financeiro", label: "Financeiro", icon: Wallet },
] as const;
type AbaMobile = (typeof ABAS_MOBILE)[number]["value"];

/** Status considerados "Em Aberto" na gestão mobile. */
const STATUS_EM_ABERTO = ["em_analise", "pendente", "em_andamento"] as const;

const STATUS_LABEL: Record<string, string> = {
  em_analise: "Em análise",
  pendente: "Pendente",
  em_andamento: "Em andamento",
};

function MobileTabBar({
  aba,
  onChange,
}: {
  aba: AbaMobile;
  onChange: (a: AbaMobile) => void;
}) {
  return (
    <nav className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid w-full max-w-2xl grid-cols-3">
        {ABAS_MOBILE.map((t) => {
          const Icon = t.icon;
          const ativo = aba === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange(t.value)}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition-colors ${
                ativo ? "text-orange-600" : "text-slate-500"
              }`}
            >
              <Icon className="h-5 w-5" />
              {t.label}
              <span
                className={`h-0.5 w-8 rounded-full ${ativo ? "bg-orange-500" : "bg-transparent"}`}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}

type OSLinhaMobile = {
  id: string;
  numero: string | null;
  status: string | null;
  cliente: string | null;
  valor_cliente: number | null;
  origem: string | null;
  destino: string | null;
  created_at: string | null;
};

function EmAbertoView() {
  const [carregando, setCarregando] = useState(true);
  const [itens, setItens] = useState<OSLinhaMobile[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("id, numero, status, cliente, valor_cliente, origem, destino, created_at")
        .in("status", STATUS_EM_ABERTO as unknown as string[])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setItens((data as OSLinhaMobile[]) || []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar as OS");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const totalValor = itens.reduce((acc, o) => acc + Number(o.valor_cliente || 0), 0);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-orange-600" />
            <h1 className="text-lg font-semibold text-slate-900">Em Aberto</h1>
          </div>
          <p className="text-[13px] text-slate-500">
            OS em análise, pendentes e em andamento.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-10 shrink-0 px-3"
          onClick={carregar}
          disabled={carregando}
        >
          <RefreshCw className={`mr-1.5 h-4 w-4 ${carregando ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            OS em aberto
          </div>
          <div className="text-xl font-bold text-slate-900">{itens.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Valor previsto
          </div>
          <div className="text-xl font-bold text-emerald-700">{brl(totalValor)}</div>
        </div>
      </div>

      {carregando && itens.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-500">Carregando OS...</p>
      )}
      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}
      {!carregando && !erro && itens.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
          Nenhuma OS em aberto no momento.
        </div>
      )}

      <div className="space-y-3">
        {itens.map((o) => (
          <Card key={o.id} className="rounded-2xl border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold text-slate-900">
                    {o.numero || o.id.slice(0, 8)}
                  </span>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    {STATUS_LABEL[o.status || ""] || o.status || "—"}
                  </span>
                </div>
                <div className="mt-1 truncate text-[12px] text-slate-500">
                  {o.origem && o.destino ? `${o.origem} → ${o.destino}` : "Rota não informada"}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-bold text-slate-900">
                  {brl(Number(o.valor_cliente || 0))}
                </div>
                {o.created_at && (
                  <div className="text-[11px] text-slate-400">
                    {new Date(o.created_at).toLocaleDateString("pt-BR")}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

type PagarLinhaMobile = {
  id: string;
  valor: number | null;
  status: string | null;
  fornecedor_nome: string | null;
  descricao: string | null;
  data_vencimento: string | null;
  os_id: string | null;
};

const hojeISO = () => new Date().toISOString().slice(0, 10);

function FinanceiroMobileView() {
  const [carregando, setCarregando] = useState(true);
  const [itens, setItens] = useState<PagarLinhaMobile[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const { data, error } = await supabase
        .from("financeiro_pagar")
        .select("id, valor, status, fornecedor_nome, descricao, data_vencimento, os_id")
        .in("status", ["pendente", "aberto"])
        .order("data_vencimento", { ascending: true })
        .limit(200);
      if (error) throw error;
      setItens((data as PagarLinhaMobile[]) || []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar o financeiro");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const hoje = hojeISO();
  const totalPendente = itens.reduce((acc, i) => acc + Number(i.valor || 0), 0);
  const itensHoje = itens.filter((i) => (i.data_vencimento || "") <= hoje);
  const totalHoje = itensHoje.reduce((acc, i) => acc + Number(i.valor || 0), 0);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-orange-600" />
            <h1 className="text-lg font-semibold text-slate-900">Financeiro</h1>
          </div>
          <p className="text-[13px] text-slate-500">
            Contas a pagar aos prestadores — controle rápido de caixa.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-10 shrink-0 px-3"
          onClick={carregar}
          disabled={carregando}
        >
          <RefreshCw className={`mr-1.5 h-4 w-4 ${carregando ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-red-600">
            A pagar hoje
          </div>
          <div className="text-xl font-bold text-red-700">{brl(totalHoje)}</div>
          <div className="text-[11px] text-red-600/80">{itensHoje.length} título(s)</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Total pendente
          </div>
          <div className="text-xl font-bold text-slate-900">{brl(totalPendente)}</div>
          <div className="text-[11px] text-slate-500">{itens.length} título(s)</div>
        </div>
      </div>

      {carregando && itens.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-500">Carregando títulos...</p>
      )}
      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}
      {!carregando && !erro && itens.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
          Nenhuma conta a pagar em aberto.
        </div>
      )}

      <div className="space-y-3">
        {itens.map((i) => {
          const venceHoje = (i.data_vencimento || "") <= hoje;
          return (
            <Card key={i.id} className="rounded-2xl border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {i.fornecedor_nome || "Prestador não informado"}
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-slate-500">
                    {i.descricao || "Repasse de prestador"}
                  </div>
                  {i.data_vencimento && (
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        venceHoje ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {venceHoje ? "Vence hoje" : `Vence ${new Date(
                        `${i.data_vencimento}T12:00:00`,
                      ).toLocaleDateString("pt-BR")}`}
                    </span>
                  )}
                </div>
                <div className="shrink-0 text-right text-sm font-bold text-slate-900">
                  {brl(Number(i.valor || 0))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Componente
// ============================================================
export default function OsMobile() {
  // Cliente
  const [clienteId, setClienteId] = useState<string | null>(null);

  // Paradas (lista dinâmica — substitui Origem/Destino estáticos)
  const [paradas, setParadas] = useState<ParadaState[]>(PARADAS_INICIAIS);
  const [retornoOrigem, setRetornoOrigem] = useState(false);

  // Aba inferior (dashboard do gestor)
  const [aba, setAba] = useState<AbaMobile>("nova");

  // Carga
  const [descricao, setDescricao] = useState("");
  const [peso, setPeso] = useState("");
  const [volumes, setVolumes] = useState("1");
  // FIX-CUBAGEM — dimensões (cm) → litros automáticos (C × L × A) / 1000
  const [comprimento, setComprimento] = useState("");
  const [largura, setLargura] = useState("");
  const [altura, setAltura] = useState("");
  const [valorDeclarado, setValorDeclarado] = useState("");
  const [tipoCarga, setTipoCarga] = useState("seco");
  const [observacoes, setObservacoes] = useState("");

  // Veículo (auto por peso — trava quando há sugestão)
  const [veiculoTipo, setVeiculoTipo] = useState("");

  // Prestador
  const [prestadorTipo, setPrestadorTipo] = useState<PrestadorTipo>("cadastrado");
  const [prestadorCadastradoId, setPrestadorCadastradoId] = useState<string | null>(null);
  const [prestadorNome, setPrestadorNome] = useState("");
  const [avulsoNome, setAvulsoNome] = useState("");
  const [avulsoDoc, setAvulsoDoc] = useState("");
  const [avulsoPlaca, setAvulsoPlaca] = useState("");
  // FIX-MOTOR-CUSTO-E-PRESTADOR-AVULSO — dados financeiros do avulso (obrigatórios)
  const [avulsoTelefone, setAvulsoTelefone] = useState("");
  const [avulsoOrigem, setAvulsoOrigem] = useState("");
  const [avulsoPixTipo, setAvulsoPixTipo] = useState<PixTipo>("CPF/CNPJ");
  const [avulsoPixChave, setAvulsoPixChave] = useState("");

  // Financeiro — receita (cliente)
  const [valorCliente, setValorCliente] = useState("");
  const valorManualRef = useRef(false);

  // Financeiro — custo do prestador (motor Motoboy)
  const [custoPrestador, setCustoPrestador] = useState("");
  const [custoManual, setCustoManual] = useState(false); // override manual do operador
  const [pagamentoPrestador, setPagamentoPrestador] =
    useState<TipoPagamentoPrestador>("faturado");
  const [tempoEspera, setTempoEspera] = useState("");
  const [kmRota, setKmRota] = useState("");
  const kmManualRef = useRef(false);

  // Prazo
  const [dataProgramada, setDataProgramada] = useState("");
  const [prioridade, setPrioridade] = useState("normal");

  // Estados
  const [estimativa, setEstimativa] = useState<EstimativaState>({ status: "idle" });
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoState | null>(null);
  const estimativaSeq = useRef(0);

  // ----------------------------------------------------------
  // Derivados
  // ----------------------------------------------------------
  const pesoNumero = numero(peso);
  const custoNumero = numero(custoPrestador);
  const valorNumero = numero(valorCliente);
  const kmNumero = numero(kmRota);
  const esperaNumero = numero(tempoEspera);
  const qtdParadas = paradas.length;
  const ehMoto = veiculoTipo === "moto";

  // FIX-CUBAGEM — litros calculados pelas dimensões + alerta do baú da moto
  const litros = calcularLitros({
    comprimento: numero(comprimento),
    largura: numero(largura),
    altura: numero(altura),
  });
  const alertaBau = ehMoto ? alertaBauMoto(litros) : null;

  // Origem/destino da rota derivados das paradas:
  // origem = 1ª Retirada (ou 1ª parada); destino = última Entrega (ou última parada)
  const { origemRota, destinoRota } = useMemo(() => {
    const primeiraRetirada = paradas.find((p) => p.tipo === "retirada");
    const ultimaEntrega = [...paradas].reverse().find((p) => p.tipo === "entrega");
    return {
      origemRota: primeiraRetirada?.endereco ?? paradas[0]?.endereco ?? ENDERECO_VAZIO,
      destinoRota: ultimaEntrega?.endereco ?? paradas[paradas.length - 1]?.endereco ?? ENDERECO_VAZIO,
    };
  }, [paradas]);

  // ----------------------------------------------------------
  // Auto-veículo pela regra de peso (reuso de veiculoPeso)
  // ----------------------------------------------------------
  useEffect(() => {
    const sugerido = veiculoPorPeso(pesoNumero);
    setVeiculoTipo(sugerido || "");
  }, [pesoNumero]);

  // ----------------------------------------------------------
  // Auto-precificação do CLIENTE (rota + edge "estimar")
  // ----------------------------------------------------------
  useEffect(() => {
    const origemOk = enderecoCompleto(origemRota);
    const destinoOk = enderecoCompleto(destinoRota);
    if (!origemOk || !destinoOk || !veiculoTipo || !clienteId) {
      setEstimativa({ status: "idle" });
      return;
    }

    const seq = ++estimativaSeq.current;
    const timer = setTimeout(async () => {
      setEstimativa({ status: "calculando" });
      try {
        const rota = await calcularDistancia(
          {
            latitude: origemRota.latitude, longitude: origemRota.longitude,
            logradouro: origemRota.logradouro, cidade: origemRota.cidade, estado: origemRota.estado,
          },
          {
            latitude: destinoRota.latitude, longitude: destinoRota.longitude,
            logradouro: destinoRota.logradouro, cidade: destinoRota.cidade, estado: destinoRota.estado,
          },
        );
        const km = rota?.distanciaKm ?? 0;
        if (km <= 0) {
          if (seq === estimativaSeq.current) setEstimativa({ status: "erro", km: 0 });
          return;
        }

        // FIX-RECEITA-CLIENTE — MOTOR: tabela Moto (receita do cliente).
        // Franquia R$ 28,00 (0–6 km) + R$ 2,25/km acima de 6 km.
        if (veiculoTipo === "moto") {
          if (seq !== estimativaSeq.current) return;
          const receita = calcularReceitaClienteMoto(km);
          setEstimativa({
            status: "ok",
            valor: receita.total,
            km,
            fonte: "tabela-moto",
            tabela: `Moto (R$ ${RECEITA_CLIENTE_MOTO.franquia.toFixed(2)} franquia 0–6 km + R$ ${RECEITA_CLIENTE_MOTO.valorKmAdicional.toFixed(2)}/km)`,
          });
          if (!valorManualRef.current) setValorCliente(String(receita.total));
          if (!kmManualRef.current) setKmRota(String(km));
          return;
        }

        const { data, error } = await supabase.functions.invoke("pedido-rapido", {
          body: {
            action: "estimar",
            clienteId,
            tipoVeiculo: veiculoTipo,
            distanciaKm: km,
            paradas: qtdParadas,
          },
        });
        if (seq !== estimativaSeq.current) return;
        if (error) throw error;
        if (data?.success && data.valor != null) {
          setEstimativa({
            status: "ok",
            valor: Number(data.valor),
            km: Number(data.distanciaKm ?? km),
            fonte: data.fonte,
            tabela: data.tabela?.nome,
            aviso: data.aviso,
          });
          if (!valorManualRef.current) setValorCliente(String(Number(data.valor)));
          // Distância total alimenta o motor do prestador (auto, salvo edição manual)
          if (!kmManualRef.current) setKmRota(String(Number(data.distanciaKm ?? km)));
        } else {
          setEstimativa({ status: "sem_tabela", km, aviso: data?.mensagem });
          if (!kmManualRef.current) setKmRota(String(km));
        }
      } catch {
        if (seq === estimativaSeq.current) setEstimativa({ status: "erro" });
      }
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    origemRota.cidade, origemRota.estado, origemRota.logradouro, origemRota.latitude, origemRota.longitude,
    destinoRota.cidade, destinoRota.estado, destinoRota.logradouro, destinoRota.latitude, destinoRota.longitude,
    veiculoTipo, clienteId, qtdParadas,
  ]);

  // ----------------------------------------------------------
  // Motor do prestador (tabela Motoboy) — tempo real
  // ----------------------------------------------------------
  const custoMotor = useMemo(
    () =>
      ehMoto
        ? calcularCustoMotoboy({
            km: kmNumero,
            paradas: qtdParadas,
            peso: pesoNumero,
            retorno: retornoOrigem,
            pagamento: pagamentoPrestador,
            esperaMin: esperaNumero,
          })
        : null,
    [ehMoto, kmNumero, qtdParadas, pesoNumero, retornoOrigem, pagamentoPrestador, esperaNumero],
  );

  const custoCalculado = custoMotor?.total ?? null;

  // Auto-preenchimento do campo "Custo prestador" (salvo override manual)
  useEffect(() => {
    if (ehMoto && custoCalculado != null && kmNumero > 0 && !custoManual) {
      setCustoPrestador(String(custoCalculado));
    }
  }, [ehMoto, custoCalculado, kmNumero, custoManual]);

  // Margem prevista da OS (Receita − Custo do prestador)
  const margem = valorNumero - custoNumero;
  const margemPct = valorNumero > 0 ? (margem / valorNumero) * 100 : null;

  // ----------------------------------------------------------
  // Validação
  // ----------------------------------------------------------
  const validacao = useMemo(() => {
    const erros: string[] = [];
    if (!clienteId) erros.push("Selecione o cliente");
    if (paradas.length === 0) {
      erros.push("Adicione ao menos uma parada na rota");
    } else {
      if (!paradas.some((p) => p.tipo === "retirada")) {
        erros.push("A rota precisa de ao menos uma parada do tipo Retirada");
      }
      if (!paradas.some((p) => p.tipo === "entrega")) {
        erros.push("A rota precisa de ao menos uma parada do tipo Entrega");
      }
      paradas.forEach((p, i) => {
        if (!enderecoCompleto(p.endereco)) {
          erros.push(`Parada ${i + 1} (${p.tipo === "retirada" ? "Retirada" : "Entrega"}): cidade e UF obrigatórias`);
        }
      });
    }
    if (!descricao.trim()) erros.push("Descreva brevemente a carga");
    if (!(pesoNumero > 0)) erros.push("Informe o peso total em kg");
    if (!veiculoTipo) {
      erros.push(
        pesoNumero > 2500
          ? "Peso acima de 2.500 kg — contate a operação para definir o veículo"
          : "Veículo não definido (informe o peso)",
      );
    }
    if (!(valorNumero > 0)) erros.push("Informe o valor ao cliente (R$)");
    if (ehMoto && !custoManual && !(kmNumero > 0)) {
      erros.push("Informe a distância total da rota (km) para calcular o custo do motoboy");
    }
    if (!(custoNumero > 0)) erros.push("Informe o custo do prestador / repasse (R$)");
    if (prestadorTipo === "cadastrado" && !prestadorCadastradoId) {
      erros.push("Selecione o prestador cadastrado");
    }
    if (prestadorTipo === "avulso" && !avulsoNome.trim()) {
      erros.push("Informe o nome do prestador avulso");
    }
    // FIX-MOTOR-CUSTO-E-PRESTADOR-AVULSO — campos obrigatórios do avulso
    if (prestadorTipo === "avulso") {
      const telErr = validarTelefone(avulsoTelefone);
      if (telErr) erros.push(`Telefone (WhatsApp): ${telErr}`);
      if (!avulsoOrigem.trim()) erros.push("Informe a origem (local/ponto do motoboy)");
      const pixErr = validarPixChave(avulsoPixTipo, avulsoPixChave);
      if (pixErr) erros.push(pixErr);
    }
    return erros;
  }, [
    clienteId, paradas, descricao, pesoNumero, veiculoTipo, valorNumero,
    custoNumero, ehMoto, custoManual, kmNumero, prestadorTipo, prestadorCadastradoId, avulsoNome,
    avulsoTelefone, avulsoOrigem, avulsoPixTipo, avulsoPixChave,
  ]);

  // ----------------------------------------------------------
  // Handlers de paradas
  // ----------------------------------------------------------
  const atualizarParada = (id: string, patch: Partial<ParadaState>) => {
    setParadas((lista) => lista.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const adicionarParada = () => {
    setParadas((lista) => {
      if (lista.length >= MAX_PARADAS) return lista;
      const temRetirada = lista.some((p) => p.tipo === "retirada");
      return [...lista, novaParada(temRetirada ? "entrega" : "retirada")];
    });
  };

  const removerParada = (id: string) => {
    setParadas((lista) => (lista.length <= 1 ? lista : lista.filter((p) => p.id !== id)));
  };

  // ----------------------------------------------------------
  // Submit — OS + financeiro pelo fluxo normal do TMS
  // ----------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvando || resultado) return;
    if (validacao.length > 0) {
      toast.error(validacao[0]);
      return;
    }
    setSalvando(true);
    try {
      const avulso = prestadorTipo === "avulso";
      const prestadorId = avulso ? undefined : prestadorCadastradoId || undefined;

      const enderecosMeta = paradas.map((p, i) => ({
        sequencia: i,
        tipo: p.tipo === "retirada" ? "coleta" : "entrega",
        nome_local: `Parada ${i + 1} — ${p.tipo === "retirada" ? "Retirada" : "Entrega"}`,
        logradouro: p.endereco.logradouro,
        numero: p.endereco.numero,
        complemento: p.endereco.complemento,
        bairro: p.endereco.bairro,
        cidade: p.endereco.cidade,
        estado: p.endereco.estado,
        endereco: formatarEndereco(p.endereco),
        cep: p.endereco.cep,
        referencia: p.endereco.referencia,
        janela_inicio: p.janelaInicio,
        janela_fim: p.janelaFim,
        latitude: p.endereco.latitude ?? null,
        longitude: p.endereco.longitude ?? null,
        tipo_parada: p.tipo,
        // FIX-USABILIDADE — dados para o Template 2 (Orientação de Execução)
        contato: p.endereco.contatoNome || "",
        telefone: p.endereco.contatoTelefone || "",
        instrucoes: p.endereco.referencia || "",
      }));

      const input: CriarOSInput = {
        cliente_id: clienteId!,
        cliente: clienteId!,
        origem: formatarEndereco(origemRota),
        origem_cidade: origemRota.cidade,
        origem_uf: origemRota.estado,
        destino: formatarEndereco(destinoRota),
        destino_cidade: destinoRota.cidade,
        destino_uf: destinoRota.estado,
        descricao: descricao.trim(),
        peso: pesoNumero,
        volumes: Number(volumes) || 1,
        valor_declarado: numero(valorDeclarado),
        tipo_carga: tipoCarga,
        observacoes: observacoes.trim(),
        valor_cliente: valorNumero,
        custo_prestador: custoNumero,
        prestador_id: prestadorId,
        veiculo_tipo: veiculoTipo,
        placa: avulso ? avulsoPlaca.trim() || undefined : undefined,
        data_coleta: dataProgramada || undefined,
        prioridade,
        metadata: {
          origem: "os_mobile",
          veiculo_sugerido: veiculoTipo,
          prestador_avulso: avulso
            ? {
                nome: avulsoNome.trim(),
                documento: avulsoDoc.trim() || null,
                // FIX-MOTOR-CUSTO-E-PRESTADOR-AVULSO — dados financeiros do avulso
                telefone_whatsapp: avulsoTelefone.trim(),
                origem: avulsoOrigem.trim(),
                pix_tipo: avulsoPixTipo,
                pix_chave: avulsoPixChave.trim(),
              }
            : null,
          retorno_origem: retornoOrigem,
          volume_litros: litros || 0,
          dimensoes_cm: {
            comprimento: numero(comprimento),
            largura: numero(largura),
            altura: numero(altura),
          },
          bau_alerta: alertaBau?.texto || null,
          // Snapshot do motor para auditoria do cálculo (somente Moto)
          ...(ehMoto && custoMotor
            ? {
                moto_motor: {
                  km: kmNumero,
                  paradas: qtdParadas,
                  peso: pesoNumero,
                  retorno: retornoOrigem,
                  pagamento: pagamentoPrestador,
                  tempo_espera_min: esperaNumero,
                  custo_total: custoMotor.total,
                  itens: custoMotor.itens,
                  custo_manual: custoManual,
                  calculado_em: new Date().toISOString(),
                },
              }
            : {}),
          enderecos: enderecosMeta,
        },
      };

      const criado = await criarOrdemServico(input);
      if (!criado.sucesso || !criado.os_id) {
        toast.error(criado.erro || "Falha ao criar a OS");
        return;
      }

      // Paradas persistidas também no jsonb da OS (leitura do TMS/portal)
      const { error: endErr } = await supabase
        .from("ordens_servico")
        .update({ enderecos: enderecosMeta })
        .eq("id", criado.os_id);
      if (endErr) console.warn("[os-mobile] enderecos (jsonb):", endErr.message);

      // Prestador AVULSO: trigger M80 não cria financeiro_pagar
      // (prestador_id NULL) → inserimos aqui a Contas a Pagar do repasse.
      let avulsoPagarErro: string | undefined;
      if (avulso) {
        const venc = new Date();
        venc.setDate(venc.getDate() + 30);
        const { error: pgErr } = await supabase.from("financeiro_pagar").insert({
          os_id: criado.os_id,
          descricao: `Repasse ${criado.os_numero} — ${avulsoNome.trim()} (prestador avulso)`,
          valor: custoNumero,
          data_vencimento: venc.toISOString().slice(0, 10),
          status: "pendente",
          prestador: avulsoNome.trim(),
          fornecedor_nome: avulsoNome.trim(),
          fornecedor_documento: avulsoDoc.trim() || null,
          chave_pix: avulsoPixChave.trim() || null,
          observacoes: [
            "Prestador avulso cadastrado via /os-mobile",
            `WhatsApp: ${avulsoTelefone.trim()}`,
            `Origem: ${avulsoOrigem.trim()}`,
            `PIX ${avulsoPixTipo}: ${avulsoPixChave.trim()}`,
          ].join(" · "),
        });
        if (pgErr) {
          avulsoPagarErro = pgErr.message;
          console.warn("[os-mobile] financeiro_pagar (avulso):", pgErr.message);
        }
      }

      // Prova da geração financeira (leitura pós-criação)
      const [receb, pag] = await Promise.all([
        supabase
          .from("financeiro_receber")
          .select("valor, status")
          .eq("os_id", criado.os_id)
          .maybeSingle(),
        supabase
          .from("financeiro_pagar")
          .select("valor, status, fornecedor_nome")
          .eq("os_id", criado.os_id)
          .maybeSingle(),
      ]);

      // FIX-USABILIDADE-VEICULOS-E-DUPLO-TEMPLATE-WHATSAPP — 2 templates +
      // rastreio, exatamente os mesmos geradores do formulário desktop.
      const payloadMensagem = {
        numero: criado.os_numero,
        numeroOS: criado.os_numero,
        veiculoTipo,
        prestadorNome: prestadorTipo === "avulso" ? avulsoNome.trim() : prestadorNome,
        custoPrestador: custoNumero,
        formaPagamento: pagamentoPrestador,
        distanciaKm: kmNumero || estimativa.km || 0,
        observacoes: observacoes.trim(),
        volumes,
        enderecos: enderecosMeta,
      };
      const mensagemMotoboy = gerarMensagemWhatsAppMotoboy(payloadMensagem);
      const mensagemOrientacao = gerarMensagemOrientacaoExecucao(payloadMensagem);
      const mensagemClienteRastreioMsg = gerarMensagemWhatsAppClienteRastreio({
        numeroOS: criado.os_numero,
        osId: criado.os_id,
      });

      setResultado({
        osId: criado.os_id,
        osNumero: criado.os_numero || criado.os_id,
        receb: receb.data ? { valor: receb.data.valor, status: receb.data.status } : null,
        pag: pag.data
          ? {
              valor: pag.data.valor,
              status: pag.data.status,
              fornecedor: pag.data.fornecedor_nome,
            }
          : null,
        avulsoPagarErro,
        mensagem: mensagemMotoboy,
        mensagemOrientacao,
        mensagemClienteRastreio: mensagemClienteRastreioMsg,
      });
      toast.success(`OS ${criado.os_numero} criada com sucesso`);
    } catch (err) {
      console.error("[os-mobile] erro:", err);
      toast.error(
        err instanceof Error && err.message ? err.message : "Erro inesperado ao criar a OS",
      );
    } finally {
      setSalvando(false);
    }
  };

  // FIX-AUTOCOMPLETE-E-NOVO-TEMPLATE-WHATSAPP — mesmas ações do desktop
  const copiarMensagemMotoboy = () => {
    if (!resultado?.mensagem) return;
    navigator.clipboard.writeText(resultado.mensagem);
    toast.success("Mensagem do motoboy copiada!");
  };

  const enviarMensagemWhatsapp = () => {
    if (!resultado?.mensagem) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(resultado.mensagem)}`, "_blank");
  };

  // TEMPLATE 2 — Orientação de Execução (OS completa)
  const copiarMensagemOrientacao = () => {
    if (!resultado?.mensagemOrientacao) return;
    navigator.clipboard.writeText(resultado.mensagemOrientacao);
    toast.success("Orientação de execução copiada!");
  };

  const enviarOrientacaoWhatsapp = () => {
    if (!resultado?.mensagemOrientacao) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(resultado.mensagemOrientacao)}`, "_blank");
  };

  // WHATSAPP DO CLIENTE / DESTINATÁRIO — link de rastreio
  const copiarMensagemClienteRastreio = () => {
    if (!resultado?.mensagemClienteRastreio) return;
    navigator.clipboard.writeText(resultado.mensagemClienteRastreio);
    toast.success("Mensagem de rastreio do cliente copiada!");
  };

  const enviarClienteRastreioWhatsapp = () => {
    if (!resultado?.mensagemClienteRastreio) return;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(resultado.mensagemClienteRastreio)}`,
      "_blank",
    );
  };

  const limpar = () => {
    setResultado(null);
    setClienteId(null);
    setParadas(PARADAS_INICIAIS());
    setRetornoOrigem(false);
    setDescricao("");
    setPeso("");
    setVolumes("1");
    setComprimento("");
    setLargura("");
    setAltura("");
    setValorDeclarado("");
    setTipoCarga("seco");
    setObservacoes("");
    setVeiculoTipo("");
    setPrestadorCadastradoId(null);
    setPrestadorNome("");
    setAvulsoNome("");
    setAvulsoDoc("");
    setAvulsoPlaca("");
    setAvulsoTelefone("");
    setAvulsoOrigem("");
    setAvulsoPixTipo("CPF/CNPJ");
    setAvulsoPixChave("");
    setValorCliente("");
    setCustoPrestador("");
    valorManualRef.current = false;
    setCustoManual(false);
    setPagamentoPrestador("faturado");
    setTempoEspera("");
    setKmRota("");
    kmManualRef.current = false;
    setDataProgramada("");
    setPrioridade("normal");
    setEstimativa({ status: "idle" });
  };

  // ============================================================
  // Render — sucesso
  // ============================================================
  if (resultado && aba === "nova") {
    return (
      <div className="min-h-screen bg-slate-50 pb-28">
        <div className="mx-auto w-full max-w-2xl px-4 pt-8">
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <div className="px-6 pt-6 pb-2 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h1 className="mt-3 text-lg font-semibold text-slate-900">OS criada com sucesso</h1>
              <p className="text-sm text-slate-500">
                {resultado.osNumero} · financeiro gerado pelo fluxo normal do TMS
              </p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    Contas a Receber
                  </div>
                  <div className="text-sm text-slate-700">
                    {resultado.receb ? `Status ${resultado.receb.status}` : "não criada (valor cliente = 0)"}
                  </div>
                </div>
                <div className="text-base font-semibold text-slate-900">
                  {resultado.receb?.valor != null ? brl(Number(resultado.receb.valor)) : "—"}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    Contas a Pagar
                  </div>
                  <div className="text-sm text-slate-700">
                    {resultado.pag
                      ? `Status ${resultado.pag.status}${resultado.pag.fornecedor ? ` · ${resultado.pag.fornecedor}` : ""}`
                      : "não criada"}
                  </div>
                </div>
                <div className="text-base font-semibold text-slate-900">
                  {resultado.pag?.valor != null ? brl(Number(resultado.pag.valor)) : "—"}
                </div>
              </div>
              {resultado.avulsoPagarErro && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
                  OS criada, mas a Contas a Pagar do avulso falhou ({resultado.avulsoPagarErro}).
                  Registre manualmente no Financeiro.
                </div>
              )}
            </div>
            <div className="px-6 pb-6 space-y-2">
              {/* FIX-AUTOCOMPLETE-E-NOVO-TEMPLATE-WHATSAPP —
                  MESMO template unificado do desktop (privacidade de número) */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-700 mb-2">
                  Mensagem WhatsApp do motoboy
                </div>
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-700 max-h-56 overflow-y-auto">
                  {resultado.mensagem}
                </pre>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100"
                    onClick={copiarMensagemMotoboy}
                  >
                    <Copy className="mr-1.5 h-4 w-4" /> Copiar
                  </Button>
                  <Button
                    type="button"
                    className="h-11 bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={enviarMensagemWhatsapp}
                  >
                    <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                  </Button>
                </div>
              </div>

              {/* TEMPLATE 2 — Orientação de Execução (OS completa) */}
              <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-widest text-teal-700 mb-2">
                  Orientação de Execução (OS Completa)
                </div>
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-700 max-h-56 overflow-y-auto">
                  {resultado.mensagemOrientacao}
                </pre>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 border-teal-300 bg-white text-teal-700 hover:bg-teal-100"
                    onClick={copiarMensagemOrientacao}
                  >
                    <Copy className="mr-1.5 h-4 w-4" /> Copiar
                  </Button>
                  <Button
                    type="button"
                    className="h-11 bg-teal-600 text-white hover:bg-teal-700"
                    onClick={enviarOrientacaoWhatsapp}
                  >
                    <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                  </Button>
                </div>
              </div>

              {/* WHATSAPP DO CLIENTE / DESTINATÁRIO — link de rastreio */}
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-widest text-blue-700 mb-2">
                  WhatsApp Cliente (Rastreio)
                </div>
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-700">
                  {resultado.mensagemClienteRastreio}
                </pre>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 border-blue-300 bg-white text-blue-700 hover:bg-blue-100"
                    onClick={copiarMensagemClienteRastreio}
                  >
                    <Copy className="mr-1.5 h-4 w-4" /> Copiar
                  </Button>
                  <Button
                    type="button"
                    className="h-11 bg-blue-600 text-white hover:bg-blue-700"
                    onClick={enviarClienteRastreioWhatsapp}
                  >
                    <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                  </Button>
                </div>
              </div>
              <Button className="w-full h-12 text-[15px]" onClick={limpar}>
                <RotateCcw className="mr-2 h-4 w-4" /> Criar nova OS
              </Button>
            </div>
          </Card>
        </div>
        <div className="fixed inset-x-0 bottom-0 z-40">
          <MobileTabBar aba={aba} onChange={setAba} />
        </div>
      </div>
    );
  }

  // ============================================================
  // Render — abas de gestão (Em Aberto / Financeiro)
  // ============================================================
  if (aba === "abertas" || aba === "financeiro") {
    return (
      <div className="min-h-screen bg-slate-50 pb-24">
        {aba === "abertas" ? <EmAbertoView /> : <FinanceiroMobileView />}
        <div className="fixed inset-x-0 bottom-0 z-40">
          <MobileTabBar aba={aba} onChange={setAba} />
        </div>
      </div>
    );
  }

  // ============================================================
  // Render — formulário mobile
  // ============================================================
  return (
    <div className="min-h-screen bg-slate-50 pb-44">
      <div className="mx-auto w-full max-w-2xl px-4 pt-5">
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-orange-600" />
            <h1 className="text-lg font-semibold text-slate-900">Nova OS</h1>
          </div>
          <p className="text-[13px] text-slate-500">
            Rota em paradas, precificação automática e custo do prestador calculado na hora.
          </p>
        </div>

        <form id="os-mobile-form" onSubmit={handleSubmit} className="space-y-4">
          {/* 1 — CLIENTE */}
          <SectionCard step={1} icon={<UserRound className="h-4 w-4" />} title="Cliente" subtitle="Quem recebe o serviço.">
            <SearchableSelect
              table="clientes"
              labelField="nome_fantasia"
              searchFields={["nome_fantasia", "razao_social", "cnpj"]}
              secondaryField="cnpj"
              placeholder="Pesquisar cliente (nome, razão social, CNPJ)..."
              value={clienteId}
              onChange={(v) => setClienteId(v)}
            />
          </SectionCard>

          {/* 2 — PARADAS (dinâmicas) */}
          <SectionCard
            step={2}
            icon={<MapPin className="h-4 w-4" />}
            title="Paradas da rota"
            subtitle="Adicione retiradas e entregas em ordem. Cada parada tem sua janela de horário."
          >
            <div className="space-y-3">
              {paradas.map((parada, idx) => (
                <div
                  key={parada.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Parada {idx + 1}
                      <span className="ml-1.5 text-orange-600">
                        {parada.tipo === "retirada" ? "· Retirada" : "· Entrega"}
                      </span>
                    </span>
                    {paradas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removerParada(parada.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md px-2 py-1 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" /> Remover
                      </button>
                    )}
                  </div>

                  {/* Seletor [ Retirada ] / [ Entrega ] */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => atualizarParada(parada.id, { tipo: "retirada" })}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                        parada.tipo === "retirada"
                          ? "border-orange-500 bg-orange-50 text-orange-700 ring-1 ring-orange-500"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      Retirada
                    </button>
                    <button
                      type="button"
                      onClick={() => atualizarParada(parada.id, { tipo: "entrega" })}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                        parada.tipo === "entrega"
                          ? "border-orange-500 bg-orange-50 text-orange-700 ring-1 ring-orange-500"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      Entrega
                    </button>
                  </div>

                  <EnderecoCompleto
                    label="Endereço da parada *"
                    value={parada.endereco}
                    onChange={(end) => atualizarParada(parada.id, { endereco: end })}
                    clienteId={clienteId || undefined}
                    hideOperationalDetails
                    hideDebugInfo
                  />

                  {/* Janela de horário */}
                  <div>
                    <Label className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" /> Janela de horário
                    </Label>
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          Início
                        </span>
                        <Input
                          type="time"
                          className="mt-1 h-12 text-base"
                          value={parada.janelaInicio}
                          onChange={(e) => atualizarParada(parada.id, { janelaInicio: e.target.value })}
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          Fim
                        </span>
                        <Input
                          type="time"
                          className="mt-1 h-12 text-base"
                          value={parada.janelaFim}
                          onChange={(e) => atualizarParada(parada.id, { janelaFim: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Adicionar parada */}
            {paradas.length < MAX_PARADAS ? (
              <button
                type="button"
                onClick={adicionarParada}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-orange-300 bg-orange-50/50 hover:bg-orange-50 text-orange-700 font-semibold text-sm py-3 transition-colors"
              >
                <Plus className="h-4 w-4" /> Adicionar parada
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 font-medium text-sm py-3 cursor-not-allowed"
              >
                <Plus className="h-4 w-4" /> Limite de {MAX_PARADAS} paradas atingido
              </button>
            )}

            {/* Retorno à origem */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <RotateCcw className="h-4 w-4 text-slate-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">Retorno à origem?</p>
                  <p className="text-[11px] text-slate-500">
                    Considera +R$ 1,50/km no custo do prestador (moto).
                  </p>
                  {/* FIX-MOTOR-CUSTO-E-PRESTADOR-AVULSO — valor ao vivo do retorno */}
                  {retornoOrigem && ehMoto && kmNumero > 0 && (
                    <p className="text-[11px] font-semibold text-emerald-600">
                      + {brl(r2(kmNumero * VALOR_KM_RETORNO))} · {kmNumero} km de retorno
                      (última parada → origem)
                      {custoManual ? " — motor pausado (custo manual)" : ""}
                    </p>
                  )}
                </div>
              </div>
              <Switch checked={retornoOrigem} onCheckedChange={setRetornoOrigem} />
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <ArrowRight className="h-3 w-3 shrink-0" />
              Rota atual: {paradas.filter((p) => p.tipo === "retirada").length} retirada(s) ·{" "}
              {paradas.filter((p) => p.tipo === "entrega").length} entrega(s)
              {retornoOrigem ? " · com retorno à origem" : ""}
            </div>
          </SectionCard>

          {/* 3 — CARGA + VEÍCULO */}
          <SectionCard step={3} icon={<Package className="h-4 w-4" />} title="Carga" subtitle="O que será transportado.">
            <div>
              <Label>Descrição da carga *</Label>
              <Textarea
                className="mt-1.5"
                placeholder="Ex.: 3 caixas de medicamentos, frágil..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
              />
            </div>

            {/* FIX-CUBAGEM — dimensões (cm) → litros automáticos */}
            <div>
              <Label>Quantidade de volumes *</Label>
              <Input
                className="mt-1.5 h-12 text-base"
                inputMode="numeric"
                placeholder="Ex.: 3"
                value={volumes}
                onChange={(e) => setVolumes(e.target.value)}
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Ruler className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                  Dimensões (cm)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] text-slate-500">Comprimento</Label>
                  <Input
                    className="mt-1 h-11 text-base"
                    inputMode="decimal"
                    placeholder="Ex.: 40"
                    value={comprimento}
                    onChange={(e) => setComprimento(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-500">Largura</Label>
                  <Input
                    className="mt-1 h-11 text-base"
                    inputMode="decimal"
                    placeholder="Ex.: 40"
                    value={largura}
                    onChange={(e) => setLargura(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-500">Altura</Label>
                  <Input
                    className="mt-1 h-11 text-base"
                    inputMode="decimal"
                    placeholder="Ex.: 40"
                    value={altura}
                    onChange={(e) => setAltura(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white border border-slate-200 px-3 py-2">
                <span className="text-[11px] text-slate-500">Litros calculados (C × L × A / 1000)</span>
                <span className="text-sm font-bold text-slate-900">
                  {litros > 0 ? `${litros.toLocaleString("pt-BR")} L` : "—"}
                </span>
              </div>
              <p className="text-[11px] leading-snug text-slate-500">{HELPER_BAU_MOTO}</p>
            </div>

            {alertaBau && (
              <div
                className={`rounded-xl border px-4 py-3 text-[13px] font-semibold ${
                  alertaBau.nivel >= 4
                    ? "border-red-300 bg-red-50 text-red-700"
                    : alertaBau.nivel === 3
                      ? "border-orange-300 bg-orange-50 text-orange-700"
                      : "border-amber-300 bg-amber-50 text-amber-700"
                }`}
              >
                {alertaBau.texto}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Peso total (kg) *</Label>
                <Input
                  className="mt-1.5 h-12 text-base"
                  inputMode="decimal"
                  placeholder="Ex.: 25"
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                />
              </div>
              <div>
                <Label>Valor declarado (R$)</Label>
                <Input
                  className="mt-1.5 h-12 text-base"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={valorDeclarado}
                  onChange={(e) => setValorDeclarado(e.target.value)}
                />
              </div>
            </div>

            {/* Tipo de carga — botões grandes */}
            <div className="space-y-1.5">
              <Label>Tipo de carga</Label>
              <div className="grid grid-cols-3 gap-2">
                {OPCOES_CARGA.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setTipoCarga(c.value)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                      tipoCarga === c.value
                        ? "border-orange-500 bg-orange-50 text-orange-700 ring-1 ring-orange-500"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Veículo automático pela regra de peso */}
            <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-orange-600">
                    Veículo (automático pelo peso)
                  </div>
                  <div className="text-sm font-medium text-slate-800">
                    {veiculoTipo
                      ? labelVeiculo(veiculoTipo) || veiculoTipo
                      : pesoNumero > 2500
                        ? "Acima de 2.500 kg — contate a operação"
                        : "Aguardando o peso"}
                  </div>
                </div>
                <Truck className="h-5 w-5 text-orange-600" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {OPCOES_VEICULO.map((v) => (
                  <span
                    key={v.value}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      v.value === veiculoTipo
                        ? "bg-orange-600 text-white"
                        : "bg-white text-slate-500 border border-slate-200"
                    }`}
                  >
                    {v.label}
                  </span>
                ))}
              </div>
              {ehMoto && (
                <p className="mt-2 text-[11px] text-orange-700 bg-white/70 border border-orange-200 rounded-lg px-2 py-1">
                  Moto selecionada — o custo do prestador será calculado automaticamente pela
                  tabela Motoboy (etapa 5).
                </p>
              )}
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                className="mt-1.5"
                placeholder="Informações adicionais (opcional)"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
              />
            </div>
          </SectionCard>

          {/* 4 — PRECIFICAÇÃO (cliente) */}
          <SectionCard
            step={4}
            icon={<Calculator className="h-4 w-4" />}
            title="Valor ao cliente"
            subtitle="Cotação automática pela rota e tabela do cliente."
          >
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-[13px] text-slate-600">
              {estimativa.status === "idle" && (
                <>Preencha cliente, paradas e peso para a cotação automática.</>
              )}
              {estimativa.status === "calculando" && <>Calculando rota e tabela de valores...</>}
              {estimativa.status === "ok" && (
                <>
                  <span className="font-semibold text-emerald-700">{brl(estimativa.valor || 0)}</span>
                  {" · "}{estimativa.km} km
                  {estimativa.tabela ? ` · tabela ${estimativa.tabela}` : ""}
                  {estimativa.aviso ? ` · ${estimativa.aviso}` : ""}
                </>
              )}
              {estimativa.status === "sem_tabela" && (
                <>
                  Sem tabela de valores para o cliente — informe o valor manualmente.
                  {estimativa.aviso ? ` ${estimativa.aviso}` : ""}
                </>
              )}
              {estimativa.status === "erro" && (
                <>Não foi possível calcular a rota — informe o valor manualmente.</>
              )}
            </div>
            <div>
              <Label>Valor ao cliente (R$) *</Label>
              <Input
                className="mt-1.5 h-12 text-base"
                inputMode="decimal"
                placeholder="0,00"
                value={valorCliente}
                onChange={(e) => {
                  valorManualRef.current = true;
                  setValorCliente(e.target.value);
                }}
              />
            </div>
            <div className="flex items-start gap-2 text-[12px] text-slate-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Gerará <strong>Contas a Receber</strong> (valor cliente) pela propagação financeira
                padrão da OS.
                {ehMoto && (
                  <>
                    {" "}
                    Tabela <strong>Moto</strong>: franquia R${" "}
                    {RECEITA_CLIENTE_MOTO.franquia.toFixed(2)} (0–6 km) + R${" "}
                    {RECEITA_CLIENTE_MOTO.valorKmAdicional.toFixed(2)}/km acima de 6 km.
                  </>
                )}
              </span>
            </div>
          </SectionCard>

          {/* 5 — CUSTO DO PRESTADOR (motor Motoboy) */}
          <SectionCard
            step={5}
            icon={<Wallet className="h-4 w-4" />}
            title="Custo do prestador"
            subtitle={
              ehMoto
                ? "Calculado em tempo real pela tabela Motoboy (regra exata)."
                : "Repasse do prestador — informe o valor (tabela Motoboy vale para Moto)."
            }
          >
            {ehMoto && custoMotor ? (
              <div className="space-y-3">
                {/* Tipo de pagamento — 2 faixas de prazo (A/B) */}
                <div>
                  <Label>Tipo de pagamento do prestador (prazo) *</Label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {OPCOES_PAGAMENTO_PRESTADOR.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPagamentoPrestador(opt.value)}
                        className={`rounded-xl border px-2 py-2.5 text-center transition-all ${
                          pagamentoPrestador === opt.value
                            ? "border-orange-500 bg-orange-50 ring-1 ring-orange-500"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <span className="block text-[12px] font-semibold leading-tight text-slate-900">
                          {opt.label}
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-tight text-slate-500">
                          {opt.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Distância + espera */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Distância total (km) *</Label>
                    <Input
                      className="mt-1.5 h-12 text-base"
                      inputMode="decimal"
                      placeholder="Ex.: 12,5"
                      value={kmRota}
                      onChange={(e) => {
                        kmManualRef.current = true;
                        setKmRota(e.target.value);
                      }}
                    />
                    <p className="mt-1 text-[10px] text-slate-500">
                      {kmManualRef.current
                        ? "Distância ajustada manualmente"
                        : "Preenchida pela rota automática"}
                    </p>
                  </div>
                  <div>
                    <Label>Tempo de espera (min)</Label>
                    <Input
                      className="mt-1.5 h-12 text-base"
                      inputMode="numeric"
                      placeholder="0"
                      value={tempoEspera}
                      onChange={(e) => setTempoEspera(e.target.value.replace(/\D/g, ""))}
                    />
                    <p className="mt-1 text-[10px] text-slate-500">
                      Franquia de {FRANQUIA_ESPERA_MIN} min · excedente R$ 0,40/min
                    </p>
                  </div>
                </div>

                {/* Paradas + peso (derivados) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Paradas
                    </div>
                    <div className="text-sm font-semibold text-slate-800">
                      {qtdParadas} {qtdParadas === 1 ? "parada" : "paradas"}
                      <span className="ml-1 text-[10px] font-normal text-slate-500">
                        (1ª e 2ª grátis{qtdParadas > PARADAS_GRATUITAS ? ` · ${qtdParadas - PARADAS_GRATUITAS} extra(s)` : ""})
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Peso
                    </div>
                    <div className="text-sm font-semibold text-slate-800">
                      {pesoNumero} kg
                      <span className="ml-1 text-[10px] font-normal text-slate-500">
                        {pesoNumero > FRANQUIA_PESO_KG
                          ? `+${pesoNumero - FRANQUIA_PESO_KG} kg cobrados`
                          : "na franquia"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Alerta sem km */}
                {!(kmNumero > 0) && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
                    Informe a distância total da rota (km) para calcular o custo do motoboy —
                    ou ajuste o custo manualmente.
                  </div>
                )}

                {/* Detalhamento do cálculo */}
                <div className="rounded-xl border border-orange-200 bg-orange-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-orange-600">
                      <Bike className="h-4 w-4" /> Tabela Motoboy
                    </span>
                    <span className="text-lg font-bold text-orange-700">{brl(custoMotor.total)}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {custoMotor.itens.map((item) => (
                      <div
                        key={item.chave}
                        className="flex items-start justify-between gap-3 text-[12px]"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-700">{item.label}</span>
                          <div className="text-slate-500 leading-snug">{item.detalhe}</div>
                        </div>
                        <span
                          className={`shrink-0 font-semibold ${
                            item.valor > 0 ? "text-slate-800" : "text-slate-400"
                          }`}
                        >
                          {item.valor > 0 ? brl(item.valor) : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Campo custo: auto (travado) ou manual */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Label>Custo prestador (R$) *</Label>
                    <button
                      type="button"
                      onClick={() => setCustoManual((v) => !v)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600 hover:text-orange-700"
                    >
                      {custoManual ? (
                        <>
                          <RefreshCw className="h-3 w-3" /> Voltar ao automático
                        </>
                      ) : (
                        <>
                          <Pencil className="h-3 w-3" /> Ajustar manualmente
                        </>
                      )}
                    </button>
                  </div>
                  <Input
                    className="mt-1.5 h-12 text-base"
                    inputMode="decimal"
                    placeholder="0,00"
                    readOnly={!custoManual}
                    value={custoPrestador}
                    onChange={(e) => setCustoPrestador(e.target.value)}
                  />
                  {custoManual ? (
                    <div className="mt-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
                      Custo ajustado <strong>manualmente</strong> — o motor está pausado
                      (faixa de km, retorno, paradas, peso e espera{" "}
                      <strong>não</strong> são aplicados ao valor digitado). Use
                      "Voltar ao automático" para recalcular.
                    </div>
                  ) : (
                    <p className="mt-1 text-[10px] text-slate-500">
                      Preenchido automaticamente pelo motor — edições exigem "Ajustar manualmente".
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>Custo prestador (R$) *</Label>
                  <Input
                    className="mt-1.5 h-12 text-base"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={custoPrestador}
                    onChange={(e) => setCustoPrestador(e.target.value)}
                  />
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] text-slate-600">
                  A tabela Motoboy (faixas por km, paradas, peso e espera) vale para{" "}
                  <strong>Moto (até {FRANQUIA_PESO_KG} kg de franquia, até 40 kg)</strong>. Com
                  este veículo, informe o repasse manualmente ou reduza o peso para ativar o
                  cálculo automático.
                </div>
              </div>
            )}

            {/* Margem prevista */}
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" /> Margem prevista
                </div>
                <div className="text-[11px] text-emerald-700/80">
                  Receita {valorNumero > 0 ? brl(valorNumero) : "—"} − custo{" "}
                  {custoNumero > 0 ? brl(custoNumero) : "—"}
                </div>
              </div>
              <div
                className={`text-lg font-bold ${margem < 0 ? "text-red-600" : "text-emerald-700"}`}
              >
                {brl(margem)}
                {margemPct !== null && (
                  <span className="ml-1 text-[11px] font-medium text-slate-500">
                    ({margemPct.toFixed(0)}%)
                  </span>
                )}
              </div>
            </div>
          </SectionCard>

          {/* 6 — PRESTADOR */}
          <SectionCard step={6} icon={<Truck className="h-4 w-4" />} title="Prestador" subtitle="Quem executa o serviço.">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={prestadorTipo === "cadastrado" ? "default" : "outline"}
                className="h-12"
                onClick={() => setPrestadorTipo("cadastrado")}
              >
                Cadastrado
              </Button>
              <Button
                type="button"
                variant={prestadorTipo === "avulso" ? "default" : "outline"}
                className="h-12"
                onClick={() => setPrestadorTipo("avulso")}
              >
                Avulso
              </Button>
            </div>

            {prestadorTipo === "cadastrado" ? (
              <div>
                <Label>Prestador *</Label>
                <div className="mt-1.5">
                  <SearchableSelect
                    table="prestadores"
                    labelField="nome_completo"
                    searchFields={["nome_completo", "cpf_cnpj", "telefone"]}
                    secondaryField="cpf_cnpj"
                    placeholder="Pesquisar prestador (nome, CPF/CNPJ, telefone)..."
                    value={prestadorCadastradoId}
                    onChange={(v, record) => {
                      setPrestadorCadastradoId(v);
                      setPrestadorNome(record?.nome_completo || "");
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>Nome do prestador *</Label>
                  <Input
                    className="mt-1.5 h-12 text-base"
                    placeholder="Nome completo / razão social"
                    value={avulsoNome}
                    onChange={(e) => setAvulsoNome(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>CPF / CNPJ</Label>
                    <Input
                      className="mt-1.5 h-12 text-base"
                      placeholder="Somente números"
                      value={avulsoDoc}
                      onChange={(e) => setAvulsoDoc(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Placa</Label>
                    <Input
                      className="mt-1.5 h-12 text-base"
                      placeholder="Ex.: ABC1D23"
                      value={avulsoPlaca}
                      onChange={(e) => setAvulsoPlaca(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                {/* FIX-MOTOR-CUSTO-E-PRESTADOR-AVULSO — dados financeiros obrigatórios */}
                <div>
                  <Label>Telefone (WhatsApp) *</Label>
                  <Input
                    className="mt-1.5 h-12 text-base"
                    type="tel"
                    inputMode="tel"
                    placeholder="Ex.: (11) 99999-9999"
                    value={avulsoTelefone}
                    onChange={(e) => setAvulsoTelefone(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Origem (local/ponto do motoboy) *</Label>
                  <Input
                    className="mt-1.5 h-12 text-base"
                    placeholder="Ex.: Terminal Guarulhos, Rua X, nº..."
                    value={avulsoOrigem}
                    onChange={(e) => setAvulsoOrigem(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo de PIX *</Label>
                    <Select value={avulsoPixTipo} onValueChange={(v) => setAvulsoPixTipo(v as PixTipo)}>
                      <SelectTrigger className="mt-1.5 h-12">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {OPCOES_PIX_TIPO.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Chave PIX *</Label>
                    <Input
                      className="mt-1.5 h-12 text-base"
                      placeholder={
                        avulsoPixTipo === "E-mail"
                          ? "email@provedor.com"
                          : avulsoPixTipo === "Celular"
                            ? "DDD + número"
                            : avulsoPixTipo === "CPF/CNPJ"
                              ? "Somente números"
                              : "UUID da chave"
                      }
                      value={avulsoPixChave}
                      onChange={(e) => setAvulsoPixChave(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-[12px] text-slate-500">
                  O repasse do avulso entra como Contas a Pagar manual vinculada à OS
                  (telefone, origem e chave PIX gravados no Financeiro e na OS).
                </p>
              </div>
            )}
          </SectionCard>

          {/* 7 — PRAZO */}
          <SectionCard step={7} icon={<CalendarClock className="h-4 w-4" />} title="Prazo e prioridade">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data programada</Label>
                <Input
                  type="date"
                  className="mt-1.5 h-12 text-base"
                  value={dataProgramada}
                  onChange={(e) => setDataProgramada(e.target.value)}
                />
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={prioridade} onValueChange={setPrioridade}>
                  <SelectTrigger className="mt-1.5 h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SectionCard>

          {/* Resumo */}
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <div className="px-5 py-4 space-y-2 text-[13px] text-slate-600">
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                Resumo da OS
              </div>
              <div className="flex justify-between gap-3">
                <span>Rota</span>
                <span className="text-right font-medium text-slate-800">
                  {enderecoCompleto(origemRota) && enderecoCompleto(destinoRota)
                    ? `${origemRota.cidade}/${origemRota.estado} → ${destinoRota.cidade}/${destinoRota.estado}`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Paradas</span>
                <span className="font-medium text-slate-800">
                  {qtdParadas} {qtdParadas === 1 ? "parada" : "paradas"}
                  {retornoOrigem ? " + retorno" : ""}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Valor ao cliente</span>
                <span className="font-medium text-slate-800">
                  {valorNumero > 0 ? brl(valorNumero) : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Custo prestador</span>
                <span className="font-medium text-slate-800">
                  {custoNumero > 0 ? brl(custoNumero) : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-slate-700">Margem prevista</span>
                <span
                  className={`font-semibold ${margem < 0 ? "text-red-600" : "text-emerald-600"}`}
                >
                  {brl(margem)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Prestador</span>
                <span className="font-medium text-slate-800">
                  {prestadorTipo === "avulso" ? avulsoNome || "—" : prestadorNome || "—"}
                </span>
              </div>
            </div>
          </Card>
        </form>
      </div>

      {/* Barra fixa (mobile) — margem + CTA + abas inferiores */}
      <div className="fixed inset-x-0 bottom-0 z-40">
        <div className="border-t border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Margem prevista
              </div>
              <div
                className={`text-base font-bold ${margem < 0 ? "text-red-600" : "text-emerald-600"}`}
              >
                {brl(margem)}
                {margemPct !== null && (
                  <span className="ml-1 text-[11px] font-medium text-slate-500">
                    ({margemPct.toFixed(0)}%)
                  </span>
                )}
              </div>
            </div>
            <Button
              type="submit"
              form="os-mobile-form"
              disabled={salvando}
              className="h-12 shrink-0 px-6 text-[15px] font-semibold"
            >
              {salvando ? "Criando..." : "Criar OS"}
            </Button>
          </div>
        </div>
        <MobileTabBar aba={aba} onChange={setAba} />
      </div>
    </div>
  );
}
