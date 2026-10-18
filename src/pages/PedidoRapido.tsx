// ============================================================
// MISSÃO CRIACAO-PORTAL-PEDIDO-RAPIDO-WHATSAPP (WhatsApp → TMS)
// OVERHAUL-UX-PEDIDO-RAPIDO-PREMIUM
// Rota pública /pedido-rapido (alias /c) — link curto do WhatsApp.
// Premium B2B: logo oficial, microcopy indutiva, sem campos
// duplicados (hideOperationalDetails no EnderecoCompleto),
// nível de serviço, dimensões C/L/A, janela de horário,
// roteirização multimaradas (até 8 paradas + retorno à origem)
// e precificação em tempo real (maps distance + edge "estimar"
// que consulta tabela do cliente/universal no banco).
// Fluxo: preenche → cotação em tempo real → cria pedido → fila
// "Em Análise" do TMS (portal_pedidos + portal_notificacoes).
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { EnderecoCompleto, type EnderecoType } from "@/components/ui/EnderecoCompleto";
import { calcularDistancia } from "@/services/maps/distanceService";
import { OPCOES_VEICULO, veiculoPorPeso } from "@/lib/veiculoPeso";
import {
  Truck,
  MapPin,
  Package,
  Clock,
  MessageCircle,
  CheckCircle2,
  Plus,
  Trash2,
  Calculator,
  RotateCcw,
  ArrowRight,
  Zap,
  CalendarClock,
  Ruler,
  Timer,
  Info,
  Warehouse,
  Plane,
  UserRound,
  UserCheck,
} from "lucide-react";

// ============================================================
// Constantes
// ============================================================
const MAX_PARADAS = 8;

type NivelServico = "urgente" | "normal" | "agendado";

// ------------------------------------------------------------
// MODALIDADES DO PEDIDO (item 2) — 3 abas no topo do fluxo:
//   • coleta_entrega (default) — fluxo completo com coleta/entrega
//   • retirada          — só destinos; a carga entra na nossa base
//   • aereo             — remetente + destinatário (dados completos)
// ------------------------------------------------------------
type Modalidade = "coleta_entrega" | "retirada" | "aereo";

const OPCOES_MODALIDADE: { value: Modalidade; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: "coleta_entrega", label: "Coleta & Entrega", desc: "Buscamos no endereço e levamos ao destino", icon: <Truck className="h-4 w-4" /> },
  { value: "retirada", label: "Retirada na Base", desc: "Você entrega na nossa base e nós conduzimos", icon: <Warehouse className="h-4 w-4" /> },
  { value: "aereo", label: "Envio Aéreo", desc: "Remetente e destinatário com dados completos", icon: <Plane className="h-4 w-4" /> },
];

const DISCLAIMER_AEREO =
  "Importante: As companhias aéreas não transportam itens que não aceitam seguro obrigatório (ex: Documentos originais, RG, Certidões, Joias, etc.).";

interface ContatoAereo {
  nome: string;
  doc: string;
  endereco: string;
  telefone: string;
}

const CONTATO_AEREO_VAZIO: ContatoAereo = { nome: "", doc: "", endereco: "", telefone: "" };

const OPCOES_NIVEL: { value: NivelServico; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: "urgente", label: "Urgente", desc: "Coleta e entrega no mesmo dia", icon: <Zap className="h-4 w-4" /> },
  { value: "normal", label: "Normal", desc: "Próximo dia útil", icon: <Truck className="h-4 w-4" /> },
  { value: "agendado", label: "Agendado", desc: "Data e horário combinados", icon: <CalendarClock className="h-4 w-4" /> },
];

const OPCOES_CARGA: { value: string; label: string }[] = [
  { value: "seco", label: "Seco" },
  { value: "refrigerado", label: "Refrigerado" },
  { value: "fragil", label: "Frágil" },
];

const ENDERECO_VAZIO: EnderecoType = {
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", referencia: "",
};

interface ParadaState {
  endereco: EnderecoType;
  destinatario: string;
}

interface EstimativaState {
  status: "idle" | "calculando" | "ok" | "sem_tabela" | "erro";
  valor?: number;
  km?: number;
  fonte?: string;
  tabela?: string;
  aviso?: string;
}

// ============================================================
// Helpers
// ============================================================
const enderecoCompleto = (e: EnderecoType): boolean =>
  Boolean(e.cidade?.trim() && e.estado?.trim());

const paraPayloadEntrega = (e: EnderecoType, destinatario: string) => ({
  destinatario: destinatario || null,
  cep: e.cep || null,
  rua: e.logradouro || "",
  numero: e.numero || "",
  complemento: e.complemento || "",
  bairro: e.bairro || "",
  cidade: e.cidade || "",
  uf: e.estado || "",
  referencia: e.referencia || "",
});

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ============================================================
// Subcomponentes internos (identidade premium)
// ============================================================
function SectionCard({
  step, icon, title, subtitle, children,
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
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Etapa {step}</span>
          </div>
          <h2 className="text-base font-semibold text-slate-900 leading-tight">{title}</h2>
          {subtitle && <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="px-5 pb-5 pt-3 space-y-4">{children}</div>
    </Card>
  );
}

// ============================================================
// Modalidade "Envio Aéreo" — card de remetente/destinatário.
// Definido NO ESCOPO DO MÓDULO (nunca dentro do render) para
// preservar a identidade do componente e o foco do input.
// ============================================================
function ContatoAereoCard({
  step, icon, title, subtitle, value, onChange,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  value: ContatoAereo;
  onChange: (v: ContatoAereo) => void;
}) {
  const patch = (campo: keyof ContatoAereo) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [campo]: e.target.value });
  return (
    <SectionCard step={step} icon={icon} title={title} subtitle={subtitle}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Nome completo *</Label>
          <Input value={value.nome} onChange={patch("nome")} placeholder="Nome / Razão social" className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>CPF / CNPJ *</Label>
          <Input value={value.doc} onChange={patch("doc")} placeholder="000.000.000-00" className="rounded-xl" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Endereço completo *</Label>
        <Input value={value.endereco} onChange={patch("endereco")} placeholder="Rua, número, bairro, cidade/UF" className="rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label>Telefone / WhatsApp *</Label>
        <Input value={value.telefone} onChange={patch("telefone")} placeholder="(11) 99999-9999" className="rounded-xl" />
      </div>
    </SectionCard>
  );
}

// ============================================================
// Componente principal
// ============================================================
export default function PedidoRapido() {
  const [searchParams] = useSearchParams();
  const clienteId = searchParams.get("cliente") || null;
  const clienteCnpj = searchParams.get("cnpj") || null;

  // MODALIDADE (item 2) — abas no topo do formulário
  const [modalidade, setModalidade] = useState<Modalidade>("coleta_entrega");
  const ehColetaEntrega = modalidade === "coleta_entrega";
  const ehRetirada = modalidade === "retirada";
  const ehAereo = modalidade === "aereo";
  const [remetente, setRemetente] = useState<ContatoAereo>(CONTATO_AEREO_VAZIO);
  const [destinatarioAereo, setDestinatarioAereo] = useState<ContatoAereo>(CONTATO_AEREO_VAZIO);

  // Identificação
  const [solicitanteNome, setSolicitanteNome] = useState("");
  const [solicitanteTelefone, setSolicitanteTelefone] = useState("");
  const [solicitanteEmail, setSolicitanteEmail] = useState("");

  // Coleta e entregas
  const [coleta, setColeta] = useState<EnderecoType>(ENDERECO_VAZIO);
  const [coletaContato, setColetaContato] = useState("");
  const [paradas, setParadas] = useState<ParadaState[]>([{ endereco: ENDERECO_VAZIO, destinatario: "" }]);
  const [retornoOrigem, setRetornoOrigem] = useState(false);

  // Carga
  const [descricao, setDescricao] = useState("");
  const [volumes, setVolumes] = useState("1");
  const [peso, setPeso] = useState("");
  const [valorDeclarado, setValorDeclarado] = useState("");
  const [tipoCarga, setTipoCarga] = useState("seco");
  const [nivelServico, setNivelServico] = useState<NivelServico>("normal");
  const [veiculoTipo, setVeiculoTipo] = useState("");
  const [comprimentoCm, setComprimentoCm] = useState("");
  const [larguraCm, setLarguraCm] = useState("");
  const [alturaCm, setAlturaCm] = useState("");

  // Janela de horário da entrega
  const [janelaInicio, setJanelaInicio] = useState("");
  const [janelaFim, setJanelaFim] = useState("");

  // Observações
  const [observacoes, setObservacoes] = useState("");

  // UI
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState<{ numero: string } | null>(null);
  const [showLimiteAlert, setShowLimiteAlert] = useState(false);

  // Precificação em tempo real
  const [estimativa, setEstimativa] = useState<EstimativaState>({ status: "idle" });
  const estimativaSeq = useRef(0);

  // REFINAMENTO-B2B — trava de veículo por peso + SLA
  const [veiculoTravadoPorPeso, setVeiculoTravadoPorPeso] = useState(false);
  const pesoNumero = Number(peso) || 0;

  // Auto-seleciona e trava o veículo conforme o peso digitado
  useEffect(() => {
    const sugerido = veiculoPorPeso(pesoNumero);
    if (sugerido) {
      setVeiculoTipo((atual) => (atual === sugerido ? atual : sugerido));
      setVeiculoTravadoPorPeso(true);
    } else {
      // Peso vazio ou acima de 2.500 kg → destrava a escolha manual
      setVeiculoTravadoPorPeso(false);
    }
  }, [pesoNumero]);

  // REGRA DE SLA — "Urgente" só existe para Moto. Se o veículo não for moto
  // e o nível atual for "urgente", reverte automaticamente para "normal".
  const urgentePermitido = veiculoTipo === "moto";
  useEffect(() => {
    if (!urgentePermitido && nivelServico === "urgente") {
      setNivelServico("normal");
    }
  }, [urgentePermitido, nivelServico]);

  // ----------------------------------------------------------
  // Paradas (multidendereço, máx. 8)
  // ----------------------------------------------------------
  const podeAdicionar = paradas.length < MAX_PARADAS;

  const adicionarParada = useCallback(() => {
    if (!podeAdicionar) {
      setShowLimiteAlert(true);
      return;
    }
    setParadas((p) => [...p, { endereco: ENDERECO_VAZIO, destinatario: "" }]);
    setShowLimiteAlert(false);
  }, [podeAdicionar]);

  const removerParada = useCallback((idx: number) => {
    setParadas((p) => (p.length <= 1 ? p : p.filter((_, i) => i !== idx)));
  }, []);

  const atualizarParada = useCallback((idx: number, patch: Partial<ParadaState>) => {
    setParadas((p) => p.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  }, []);

  // ----------------------------------------------------------
  // Precificação em tempo real (debounce)
  // ----------------------------------------------------------
  const primeiraEntrega = paradas[0]?.endereco;

  useEffect(() => {
    // Sem rota coleta→entrega (retirada / aéreo) não há distância a precificar.
    const coletaOk = enderecoCompleto(coleta);
    const entregaOk = Boolean(primeiraEntrega && enderecoCompleto(primeiraEntrega));
    if (!ehColetaEntrega || !coletaOk || !entregaOk || !veiculoTipo) {
      setEstimativa({ status: "idle" });
      return;
    }

    const seq = ++estimativaSeq.current;
    const timer = setTimeout(async () => {
      setEstimativa({ status: "calculando" });
      try {
        const rota = await calcularDistancia(
          {
            latitude: coleta.latitude, longitude: coleta.longitude,
            logradouro: coleta.logradouro, cidade: coleta.cidade, estado: coleta.estado,
          },
          {
            latitude: primeiraEntrega?.latitude, longitude: primeiraEntrega?.longitude,
            logradouro: primeiraEntrega?.logradouro, cidade: primeiraEntrega?.cidade, estado: primeiraEntrega?.estado,
          }
        );
        const km = rota?.distanciaKm ?? 0;
        if (km <= 0) {
          if (seq === estimativaSeq.current) setEstimativa({ status: "erro", km: 0 });
          return;
        }
        const { data, error } = await supabase.functions.invoke("pedido-rapido", {
          body: {
            action: "estimar",
            clienteId,
            tipoVeiculo: veiculoTipo,
            distanciaKm: km,
            paradas: paradas.length,
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
        } else {
          setEstimativa({ status: "sem_tabela", km, aviso: data?.mensagem });
        }
      } catch {
        if (seq === estimativaSeq.current) setEstimativa({ status: "erro" });
      }
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ehColetaEntrega,
    coleta.cidade, coleta.estado, coleta.logradouro, coleta.latitude, coleta.longitude,
    primeiraEntrega?.cidade, primeiraEntrega?.estado, primeiraEntrega?.logradouro,
    primeiraEntrega?.latitude, primeiraEntrega?.longitude,
    veiculoTipo, paradas.length, clienteId,
  ]);

  // ----------------------------------------------------------
  // Validação e envio
  // ----------------------------------------------------------
  const validacao = useMemo(() => {
    const erros: string[] = [];
    if (!solicitanteNome.trim()) erros.push("Informe seu nome");
    if (!solicitanteTelefone.trim()) erros.push("Informe seu telefone/WhatsApp");

    if (ehColetaEntrega && !enderecoCompleto(coleta)) erros.push("Coleta: cidade e UF obrigatórios");

    if (ehAereo) {
      // Envio aéreo — remetente e destinatário com dados completos (item 2)
      const blocos: [string, ContatoAereo][] = [
        ["Remetente", remetente],
        ["Destinatário", destinatarioAereo],
      ];
      for (const [quem, dados] of blocos) {
        if (!dados.nome.trim()) erros.push(`${quem}: informe o nome completo`);
        if (!dados.doc.trim()) erros.push(`${quem}: informe o CPF/CNPJ`);
        if (!dados.endereco.trim()) erros.push(`${quem}: informe o endereço`);
        if (!dados.telefone.trim()) erros.push(`${quem}: informe o telefone`);
      }
      if (!(Number(valorDeclarado) > 0)) erros.push("Envio aéreo: informe o valor da NF");
    } else {
      const paradasCompletas = paradas.filter((p) => enderecoCompleto(p.endereco));
      if (paradasCompletas.length === 0) erros.push("Entrega: informe ao menos um destino com cidade e UF");
    }

    if (!descricao.trim()) erros.push("Descreva brevemente a carga");
    if (!(Number(peso) > 0)) erros.push("Informe o peso total em kg");
    if (!(Number(comprimentoCm) > 0 && Number(larguraCm) > 0 && Number(alturaCm) > 0)) {
      erros.push("Informe as dimensões (C × L × A em cm)");
    }
    if (!ehAereo) {
      if (!veiculoTipo) erros.push("Selecione o tipo de veículo");
      if (!janelaInicio || !janelaFim) erros.push("Informe a janela de horário da entrega");
    }
    return erros;
  }, [solicitanteNome, solicitanteTelefone, ehColetaEntrega, ehAereo, coleta, remetente, destinatarioAereo, paradas, descricao, veiculoTipo, peso, valorDeclarado, comprimentoCm, larguraCm, alturaCm, janelaInicio, janelaFim]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validacao.length > 0) {
      toast.error(validacao[0]);
      return;
    }
    setEnviando(true);
    try {
      // Montagem de coleta/entregas conforme a modalidade (item 2)
      const coletaPayload = ehColetaEntrega
        ? { ...paraPayloadEntrega(coleta, ""), contato: coletaContato.trim() || null }
        : ehRetirada
          // Retirada na base — a carga entra na nossa base; coleta fica descritiva
          ? { ...paraPayloadEntrega(ENDERECO_VAZIO, ""), referencia: "Retirada na base" }
          // Aéreo — coleta = remetente (endereço livre, sem cidade/UF)
          : {
              ...paraPayloadEntrega(ENDERECO_VAZIO, ""),
              rua: remetente.endereco.trim(),
              referencia: remetente.nome.trim() || "",
            };

      const entregasPayload = ehAereo
        ? [{
            ...paraPayloadEntrega(ENDERECO_VAZIO, destinatarioAereo.nome.trim()),
            rua: destinatarioAereo.endereco.trim(),
          }]
        : paradas.map((p) => paraPayloadEntrega(p.endereco, p.destinatario));

      const payload = {
        clienteId,
        clienteCnpj,
        modalidade,
        solicitanteNome: solicitanteNome.trim(),
        solicitanteTelefone: solicitanteTelefone.trim(),
        solicitanteEmail: solicitanteEmail.trim() || null,
        coleta: coletaPayload,
        // backward compat: primeira entrega vira a coluna entrega_* da fila
        entrega: entregasPayload[0],
        entregas: entregasPayload,
        retornoOrigem: ehAereo ? false : retornoOrigem,
        nivelServico: ehAereo ? "normal" : nivelServico,
        veiculoTipo: ehAereo ? "" : veiculoTipo,
        remetente: ehAereo
          ? {
              nome: remetente.nome.trim(),
              doc: remetente.doc.trim(),
              endereco: remetente.endereco.trim(),
              telefone: remetente.telefone.trim(),
            }
          : null,
        destinatario: ehAereo
          ? {
              nome: destinatarioAereo.nome.trim(),
              doc: destinatarioAereo.doc.trim(),
              endereco: destinatarioAereo.endereco.trim(),
              telefone: destinatarioAereo.telefone.trim(),
            }
          : null,
        // Estimativa (apenas coleta & entrega) — leva o valor para o orçamento
        valorEstimado: ehColetaEntrega && estimativa.status === "ok" ? estimativa.valor ?? null : null,
        distanciaKm: ehColetaEntrega && estimativa.status === "ok" ? estimativa.km ?? null : null,
        dimensoes: {
          comprimentoCm: Number(comprimentoCm) || 0,
          larguraCm: Number(larguraCm) || 0,
          alturaCm: Number(alturaCm) || 0,
        },
        janelaHorario: ehAereo ? { inicio: "", fim: "" } : { inicio: janelaInicio, fim: janelaFim },
        descricao: descricao.trim(),
        volumes: Math.max(1, Number(volumes) || 1),
        peso: Number(peso) || 0,
        valorDeclarado: Number(valorDeclarado) || 0,
        tipoCarga,
        observacoes: observacoes.trim() || null,
        origem: "pedido_rapido_whatsapp",
      };

      const { data, error } = await supabase.functions.invoke("pedido-rapido", {
        body: { ...payload, action: "criar" },
      });
      if (error) throw new Error(error.message || "Falha ao enviar pedido");
      if (!data?.success) throw new Error(data?.error || "Falha ao enviar pedido");
      setSucesso({ numero: data.numeroPedido || "—" });
      toast.success("Pedido enviado! Nossa equipe já está analisando.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar pedido. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  // ----------------------------------------------------------
  // Numeração dinâmica de etapas por modalidade (item 2)
  // ----------------------------------------------------------
  let _step = 0;
  const nextStep = () => ++_step;
  const etapaIdentificacao = nextStep();
  const etapaColeta = ehColetaEntrega ? nextStep() : 0;
  const etapaRemetente = ehAereo ? nextStep() : 0;
  const etapaEntregas = ehAereo ? 0 : nextStep();
  const etapaDestinatario = ehAereo ? nextStep() : 0;
  const etapaCarga = nextStep();
  const etapaJanela = ehAereo ? 0 : nextStep();
  const etapaEstimativa = ehColetaEntrega ? nextStep() : 0;
  const etapaObservacoes = nextStep();

  // ----------------------------------------------------------
  // Tela de sucesso
  // ----------------------------------------------------------
  if (sucesso) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/40 flex items-center justify-center px-4">
        <Card className="max-w-md w-full rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex items-center gap-3">
            <img src="/logos/logo-conexao-oficial.png" alt="Conexão Express" className="h-9 w-auto bg-white/95 rounded-md px-1.5 py-0.5" />
            <span className="text-white/90 text-xs font-medium">Pedido Rápido</span>
          </div>
          <div className="px-6 py-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">Pedido recebido!</h2>
            <p className="text-sm text-slate-600">
              Seu pedido <span className="font-semibold text-slate-900">{sucesso.numero}</span> foi registrado.
              Nossa equipe comercial entrará em contato pelo WhatsApp para confirmar os detalhes e o valor final.
            </p>
            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => window.location.reload()}
            >
              Fazer novo pedido
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ----------------------------------------------------------
  // Formulário principal
  // ----------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/40">
      {/* Header premium com logo oficial */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logos/logo-conexao-oficial.png"
              alt="Conexão Express"
              className="h-10 w-auto"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/logos/logo-conexao-colorido.png"; }}
            />
            <div className="hidden sm:block border-l border-slate-200 pl-3">
              <p className="text-sm font-semibold text-slate-900 leading-none">Pedido Rápido</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Cotação e coleta em minutos</p>
            </div>
          </div>
          <a
            href="https://wa.me/?text=Olá! Gostaria de falar sobre um pedido de coleta/entrega."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-full px-3 py-1.5 transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Falar no WhatsApp
          </a>
        </div>
        <div className="h-0.5 bg-gradient-to-r from-orange-500 via-orange-400 to-amber-400" />
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Intro indutiva */}
        <div className="text-center space-y-1 pt-1">
          <h1 className="text-2xl font-bold text-slate-900">Precisa enviar uma encomenda?</h1>
          <p className="text-sm text-slate-500 max-w-lg mx-auto">
            Preencha os dados abaixo e receba uma <strong className="text-slate-700">estimativa de valor em tempo real</strong>.
            Sem cadastro, sem compromisso.
          </p>
        </div>

        {/* MODALIDADE — 3 abas no topo (item 2) */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Tipo de solicitação</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {OPCOES_MODALIDADE.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setModalidade(opt.value)}
                className={`rounded-xl border px-3 py-3 text-left transition-all ${
                  modalidade === opt.value
                    ? "border-orange-500 bg-orange-50 shadow-sm ring-1 ring-orange-500"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                  <span className={modalidade === opt.value ? "text-orange-600" : "text-slate-400"}>{opt.icon}</span>
                  {opt.label}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
          {ehAereo && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-[12px] leading-snug text-amber-900">{DISCLAIMER_AEREO}</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ETAPA — Identificação */}
          <SectionCard step={etapaIdentificacao} icon={<MessageCircle className="h-4 w-4" />} title="Quem está solicitando?" subtitle="Usamos esses dados apenas para confirmar o pedido.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="nome">Seu nome completo *</Label>
                <Input id="nome" value={solicitanteNome} onChange={(e) => setSolicitanteNome(e.target.value)} placeholder="Como podemos te chamar?" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefone">WhatsApp com DDD *</Label>
                <Input id="telefone" value={solicitanteTelefone} onChange={(e) => setSolicitanteTelefone(e.target.value)} placeholder="(11) 99999-9999" className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input id="email" type="email" value={solicitanteEmail} onChange={(e) => setSolicitanteEmail(e.target.value)} placeholder="seu@email.com.br" className="rounded-xl" />
            </div>
          </SectionCard>

          {/* ETAPA — Coleta (apenas Coleta & Entrega) */}
          {ehColetaEntrega && (
            <SectionCard step={etapaColeta} icon={<MapPin className="h-4 w-4" />} title="De onde buscamos?" subtitle="Informe o endereço completo da coleta. Digite o CEP e o preenchimento é automático.">
              <div className="space-y-1.5">
                <Label htmlFor="coletaContato">Procurar por (Nome do Contato) <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input id="coletaContato" value={coletaContato} onChange={(e) => setColetaContato(e.target.value)} placeholder="Ex: João na recepção, Sr. Carlos..." className="rounded-xl" />
              </div>
              <EnderecoCompleto value={coleta} onChange={setColeta} hideOperationalDetails hideDebugInfo />
            </SectionCard>
          )}

          {/* ETAPAS — Remetente / Destinatário (apenas Envio Aéreo) */}
          {ehAereo && (
            <ContatoAereoCard
              step={etapaRemetente}
              icon={<UserRound className="h-4 w-4" />}
              title="De quem enviamos?"
              subtitle="Dados completos do remetente — exigência da companhia aérea."
              value={remetente}
              onChange={setRemetente}
            />
          )}
          {ehAereo && (
            <ContatoAereoCard
              step={etapaDestinatario}
              icon={<UserCheck className="h-4 w-4" />}
              title="Para quem enviamos?"
              subtitle="Dados completos do destinatário — exigência da companhia aérea."
              value={destinatarioAereo}
              onChange={setDestinatarioAereo}
            />
          )}

          {/* ETAPA — Entregas (multidendereço; oculta no Envio Aéreo) */}
          {!ehAereo && (
          <SectionCard
            step={etapaEntregas}
            icon={<Truck className="h-4 w-4" />}
            title="Para onde enviamos?"
            subtitle={`Adicione até ${MAX_PARADAS} destinos na mesma rota.`}
          >
            <div className="space-y-4">
              {paradas.map((parada, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      {idx === 0 ? "Entrega principal" : `Parada ${idx + 1}`}
                    </span>
                    {paradas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removerParada(idx)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md px-2 py-1 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" /> Remover
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Destinatário <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                    <Input
                      value={parada.destinatario}
                      onChange={(e) => atualizarParada(idx, { destinatario: e.target.value })}
                      placeholder="Nome de quem recebe"
                      className="rounded-xl bg-white"
                    />
                  </div>
                  <EnderecoCompleto
                    value={parada.endereco}
                    onChange={(end) => atualizarParada(idx, { endereco: end })}
                    hideOperationalDetails
                    hideDebugInfo
                  />
                </div>
              ))}
            </div>

            {/* Adicionar parada + limite 8 */}
            <div className="pt-1">
              {podeAdicionar ? (
                <button
                  type="button"
                  onClick={adicionarParada}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-orange-300 bg-orange-50/50 hover:bg-orange-50 text-orange-700 font-medium text-sm py-2.5 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Adicionar outro endereço de entrega
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 font-medium text-sm py-2.5 cursor-not-allowed"
                >
                  <Plus className="h-4 w-4" /> Limite de {MAX_PARADAS} paradas atingido
                </button>
              )}

              {/* Aviso elegante ao atingir o limite */}
              {(showLimiteAlert || !podeAdicionar) && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-[13px] text-amber-900 space-y-2">
                      <p className="font-medium">Rota com mais de {MAX_PARADAS} destinos?</p>
                      <p className="text-amber-800/90">
                        Para rotas complexas com mais de {MAX_PARADAS} destinos, por favor contate nosso time operacional via WhatsApp — montamos uma proposta sob medida.
                      </p>
                      <a
                        href="https://wa.me/?text=Olá! Preciso de uma proposta para uma rota com mais de 8 destinos."
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-full px-3 py-1.5 transition-colors"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> Falar com o time operacional
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Retorno à origem */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2.5">
                <RotateCcw className="h-4 w-4 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Adicionar retorno à origem?</p>
                  <p className="text-[11px] text-slate-500">O veículo volta ao endereço de coleta ao final das entregas.</p>
                </div>
              </div>
              <Switch checked={retornoOrigem} onCheckedChange={setRetornoOrigem} />
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <ArrowRight className="h-3 w-3" />
              Rota atual: {paradas.length} {paradas.length === 1 ? "destino" : "destinos"}{retornoOrigem ? " + retorno à origem" : ""}
            </div>
          </SectionCard>
          )}

          {/* ETAPA — Sobre a carga */}
          <SectionCard step={etapaCarga} icon={<Package className="h-4 w-4" />} title="Sobre a carga" subtitle="Detalhes que ajudam a calcular o valor com precisão.">
            <div className="space-y-1.5">
              <Label htmlFor="descricao">O que será transportado? *</Label>
              <Textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: 2 caixas com documentos, peças de informática, alimentos embalados..." rows={2} className="rounded-xl" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="volumes">Volumes *</Label>
                <Input id="volumes" type="number" min={1} value={volumes} onChange={(e) => setVolumes(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="peso">Peso total (kg) *</Label>
                <Input id="peso" type="number" min={0} step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="Ex.: 25" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="valorDeclarado">
                  {ehAereo ? "Valor da NF (R$) *" : "Valor declarado (R$)"}
                  {!ehAereo && <span className="text-muted-foreground font-normal">(opcional)</span>}
                </Label>
                <Input id="valorDeclarado" type="number" min={0} step="0.01" value={valorDeclarado} onChange={(e) => setValorDeclarado(e.target.value)} placeholder="Ex.: 500" className="rounded-xl" />
              </div>
            </div>

            {/* Nível de serviço (oculto no Envio Aéreo) */}
            {!ehAereo && (
            <div className="space-y-1.5">
              <Label>Nível de serviço *</Label>
              {!urgentePermitido && (
                <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                  Urgente está disponível apenas para Moto (até 40 kg). Para este veículo, use Normal ou Agendado.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {OPCOES_NIVEL.map((opt) => {
                  const desabilitado = opt.value === "urgente" && !urgentePermitido;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={desabilitado}
                      onClick={() => setNivelServico(opt.value)}
                      className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                        nivelServico === opt.value
                          ? "border-orange-500 bg-orange-50 shadow-sm ring-1 ring-orange-500"
                          : desabilitado
                            ? "border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed"
                            : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                        <span className={nivelServico === opt.value ? "text-orange-600" : "text-slate-400"}>{opt.icon}</span>
                        {opt.label}
                        {desabilitado && <span className="text-[9px] text-slate-400 font-normal ml-auto">só moto</span>}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            {/* Tipo de carga */}
            <div className="space-y-1.5">
              <Label>Tipo de carga *</Label>
              <div className="grid grid-cols-2 gap-2">
                {OPCOES_CARGA.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTipoCarga(opt.value)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                      tipoCarga === opt.value
                        ? "border-orange-500 bg-orange-50 text-slate-900 shadow-sm ring-1 ring-orange-500"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tipo de veículo (oculto no Envio Aéreo — o trecho é aéreo) */}
            {!ehAereo && (
            <div className="space-y-1.5">
              <Label>Tipo de veículo *</Label>
              <Select value={veiculoTipo} onValueChange={setVeiculoTipo} disabled={veiculoTravadoPorPeso}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione o veículo ideal para sua carga" />
                </SelectTrigger>
                <SelectContent>
                  {OPCOES_VEICULO.map((v) => (
                    <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {veiculoTravadoPorPeso && (
                <p className="text-[11px] text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1">
                  Selecionado automaticamente com base no peso informado ({pesoNumero} kg).
                </p>
              )}
              {pesoNumero > 2500 && (
                <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                  Carga acima de 2.500 kg — selecione o veículo manualmente ou fale com nossa operação.
                </p>
              )}
            </div>
            )}

            {/* Dimensões */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Ruler className="h-3.5 w-3.5 text-slate-400" /> Dimensões da caixa/embalagem (cm) *</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Comprimento (C)</span>
                  <Input type="number" min={0} value={comprimentoCm} onChange={(e) => setComprimentoCm(e.target.value)} placeholder="C" className="rounded-xl" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Largura (L)</span>
                  <Input type="number" min={0} value={larguraCm} onChange={(e) => setLarguraCm(e.target.value)} placeholder="L" className="rounded-xl" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Altura (A)</span>
                  <Input type="number" min={0} value={alturaCm} onChange={(e) => setAlturaCm(e.target.value)} placeholder="A" className="rounded-xl" />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ETAPA — Janela de horário (oculta no Envio Aéreo) */}
          {!ehAereo && (
          <SectionCard step={etapaJanela} icon={<Clock className="h-4 w-4" />} title="Janela de horário" subtitle="Sua encomenda poderá ser entregue de que horas a que horas?">
            <div className="grid grid-cols-2 gap-4 max-w-sm">
              <div className="space-y-1.5">
                <Label htmlFor="janelaInicio" className="flex items-center gap-1.5"><Timer className="h-3.5 w-3.5 text-slate-400" /> Das (início) *</Label>
                <Input id="janelaInicio" type="time" value={janelaInicio} onChange={(e) => setJanelaInicio(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="janelaFim">Até (fim) *</Label>
                <Input id="janelaFim" type="time" value={janelaFim} onChange={(e) => setJanelaFim(e.target.value)} className="rounded-xl" />
              </div>
            </div>
          </SectionCard>
          )}

          {/* ETAPA — Valor estimado (apenas Coleta & Entrega, que é a única com rota) */}
          {ehColetaEntrega && (
          <SectionCard step={etapaEstimativa} icon={<Calculator className="h-4 w-4" />} title="Valor estimado do serviço" subtitle="Calculado automaticamente com a tabela de preços — antes de você confirmar.">
            <div className={`rounded-2xl border p-5 transition-colors ${
              estimativa.status === "ok"
                ? "border-green-200 bg-green-50/60"
                : estimativa.status === "calculando"
                  ? "border-orange-200 bg-orange-50/40"
                  : "border-slate-200 bg-slate-50/60"
            }`}>
              {estimativa.status === "idle" && (
                <div className="flex items-center gap-3 text-slate-500">
                  <Calculator className="h-5 w-5 text-slate-400" />
                  <p className="text-sm">
                    Preencha <strong className="text-slate-700">coleta</strong>, <strong className="text-slate-700">entrega</strong> e <strong className="text-slate-700">tipo de veículo</strong> para ver a estimativa.
                  </p>
                </div>
              )}
              {estimativa.status === "calculando" && (
                <div className="flex items-center gap-3 text-orange-700">
                  <Calculator className="h-5 w-5 animate-pulse" />
                  <p className="text-sm font-medium">Calculando melhor rota e valor...</p>
                </div>
              )}
              {estimativa.status === "ok" && (
                <div className="space-y-2">
                  <div className="flex items-end justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-green-700">Valor estimado</p>
                      <p className="text-3xl font-bold text-slate-900 leading-tight">{brl(estimativa.valor || 0)}</p>
                    </div>
                    <div className="text-right text-[12px] text-slate-600 space-y-0.5">
                      {estimativa.km != null && estimativa.km > 0 && (
                        <p className="flex items-center justify-end gap-1"><MapPin className="h-3 w-3" /> {estimativa.km} km (rota principal)</p>
                      )}
                      {/* REFINAMENTO-B2B — nome da tabela NÃO é exibido ao cliente (dado interno) */}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 border-t border-green-200 pt-2">
                    {estimativa.aviso || "Valor estimado — sujeito a confirmação (distância, pedágio e disponibilidade)."}
                  </p>
                </div>
              )}
              {estimativa.status === "sem_tabela" && (
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-slate-400 mt-0.5" />
                  <div className="text-sm text-slate-600">
                    <p className="font-medium text-slate-700">Sob consulta</p>
                    <p className="text-[12px] text-slate-500 mt-0.5">
                      {estimativa.aviso || "Não conseguimos gerar uma estimativa automática para essa rota — nossa equipe comercial fará a melhor proposta."}
                      {estimativa.km ? ` Distância estimada: ${estimativa.km} km.` : ""}
                    </p>
                  </div>
                </div>
              )}
              {estimativa.status === "erro" && (
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-slate-400 mt-0.5" />
                  <div className="text-sm text-slate-600">
                    <p className="font-medium text-slate-700">Estimativa indisponível no momento</p>
                    <p className="text-[12px] text-slate-500 mt-0.5">Você pode enviar o pedido mesmo assim — calcularemos manualmente.</p>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
          )}

          {/* ETAPA — Observações + envio */}
          <SectionCard step={etapaObservacoes} icon={<Info className="h-4 w-4" />} title="Observações finais" subtitle="Alguma informação importante para a coleta ou entrega?">
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Ex.: ligar antes de chegar, contato na portaria, horário de funcionamento do destinatário..." rows={2} className="rounded-xl" />
          </SectionCard>

          {/* Resumo + botão de envio */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
            {estimativa.status === "ok" && estimativa.valor != null && (
              <div className="flex items-center justify-between rounded-xl bg-green-50 border border-green-200 px-4 py-3">
                <span className="text-sm font-medium text-green-800">Valor estimado do serviço</span>
                <span className="text-xl font-bold text-green-900">{brl(estimativa.valor)}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <Truck className="h-3 w-3" />
              {ehColetaEntrega && (
                <span>
                  Rota: coleta + {paradas.length} {paradas.length === 1 ? "entrega" : "entregas"}{retornoOrigem ? " + retorno" : ""} · Nível {OPCOES_NIVEL.find((n) => n.value === nivelServico)?.label}
                </span>
              )}
              {ehRetirada && (
                <span>
                  Retirada na base + {paradas.length} {paradas.length === 1 ? "entrega" : "entregas"} · Nível {OPCOES_NIVEL.find((n) => n.value === nivelServico)?.label}
                </span>
              )}
              {ehAereo && (
                <span>
                  Envio aéreo: {remetente.nome.trim() || "Remetente"} → {destinatarioAereo.nome.trim() || "Destinatário"}
                </span>
              )}
            </div>
            {validacao.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900 space-y-1">
                <p className="font-medium">Para enviar, falta:</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-800/90">
                  {validacao.slice(0, 4).map((v) => <li key={v}>{v}</li>)}
                  {validacao.length > 4 && <li>+{validacao.length - 4} outros itens...</li>}
                </ul>
              </div>
            )}
            <Button
              type="submit"
              disabled={enviando}
              className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-6 text-base shadow-md shadow-orange-200"
            >
              {enviando
                ? "Enviando pedido..."
                : "Deseja confirmar a solicitação?"}
            </Button>
            <p className="text-center text-[11px] text-slate-400">
              Ao enviar, você concorda em receber contato da Conexão Express pelos dados informados.
            </p>
          </div>
        </form>

        <footer className="text-center pb-8 pt-2">
          <p className="text-[11px] text-slate-400">© {new Date().getFullYear()} Conexão Express · Logística que conecta</p>
        </footer>
      </main>
    </div>
  );
}
